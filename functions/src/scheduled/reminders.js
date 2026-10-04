"use strict";

const logger = require("firebase-functions/logger");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue } = require("firebase-admin/firestore");
const { getOutstanding, getCountedTotal } = require("../paymentMath");
const { REQUIRED_DOC_TYPES } = require("../requiredDocTypes");
const { sendEmail } = require("../email/sendEmail");
const { tplThankYou, tplOfficerOutstandingSummary } = require("../email/templates");
const { NO_SHOW_GRACE_MS, formatDueDate, shortName, getPaymentDueDate, getOfficerContacts, createNotification } = require("../shared/registrationOps");
const { db } = require("../shared/admin");
const { isClimbCancelled, isClimbOver, isClimbPostponed } = require("../shared/climbStatus");

// ── Scheduled: daily reminders for unpaid registrations & upcoming climbs ─────
const UPCOMING_REMINDER_DAYS = new Set([7, 5, 3, 1]);

exports.sendReminderNotifications = onSchedule(
  {
    schedule: "every day 09:00",
    timeZone: "Asia/Manila",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
  },
  async () => {
    const regsSnap = await db
      .collection("registrations")
      .where("status", "in", ["pending", "confirmed"])
      .get();
    const regs = regsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const climbIds = [...new Set(regs.map((r) => r.climbId).filter(Boolean))];
    const climbs = {};
    const climbPrivates = {};
    await Promise.all(
      climbIds.map(async (climbId) => {
        const snap = await db.doc(`climbs/${climbId}`).get();
        if (snap.exists) climbs[climbId] = snap.data();
        const privSnap = await db.doc(`climbPrivate/${climbId}`).get();
        if (privSnap.exists) climbPrivates[climbId] = privSnap.data();
      }),
    );

    // Daily safety net for the registrants-only participant list: the
    // registration triggers keep it current, but a climb whose registrations
    // haven't changed since it was introduced would otherwise have none.
    await Promise.all(
      climbIds.map(async (climbId) => {
        const participants = regs
          .filter((r) => r.climbId === climbId)
          .map((r) => ({ name: shortName(r.name), memberType: r.memberType || "" }));
        const stored = climbPrivates[climbId]?.participants;
        if (JSON.stringify(stored || null) === JSON.stringify(participants)) return;
        await db
          .doc(`climbPrivate/${climbId}`)
          .set({ participants }, { merge: true })
          .catch((err) =>
            logger.error("[sendReminderNotifications] participant list", {
              climbId,
              err: err.message,
            }),
          );
      }),
    );

    const now = Date.now();
    let paymentReminders = 0;
    let upcomingReminders = 0;

    for (const reg of regs) {
      if (!reg.userId) continue;
      const climb = climbs[reg.climbId];
      if (isClimbCancelled(climb)) continue;

      // Payment nag — re-surfaces as unread each run.
      //
      // Not just unpaid/rejected: members are told they can settle in
      // batches, so someone who paid ₱500 of ₱800 rolls up as "submitted"
      // or even "verified" while still owing the balance. Chase the
      // outstanding amount, not the status.
      const outstanding = getOutstanding(reg, climb);
      if (
        reg.paymentStatus === "unpaid" ||
        reg.paymentStatus === "rejected" ||
        outstanding > 0
      ) {
        const paidSoFar = getCountedTotal(reg);
        const due = formatDueDate(getPaymentDueDate(climb));
        const message =
          paidSoFar > 0 && outstanding > 0
            ? `You've paid ₱${paidSoFar.toLocaleString("en-PH")} for ${reg.climbTitle || "your climb"} — ₱${outstanding.toLocaleString("en-PH")} still to go. ${due ? `Please settle it by ${due}.` : "You can send the balance anytime before the climb."}`
            : `Don't forget to submit your GCash payment proof for ${reg.climbTitle || "your climb"}${due ? ` — due by ${due}` : ""}.`;
        await createNotification({
          userId: reg.userId,
          type: "payment_reminder",
          title: outstanding > 0 && paidSoFar > 0
            ? "Balance still outstanding"
            : "Payment still pending",
          message,
          link: "/my-registrations",
          id: `payment_${reg.id}`,
        });
        paymentReminders++;
      }

      // Missing required-document nags — re-surface as unread each run.
      if (climb && !isClimbOver(climb, now)) {
        for (const docType of REQUIRED_DOC_TYPES) {
          if (!climb[docType.requiresField] || reg[docType.uploadField]) continue;
          await createNotification({
            userId: reg.userId,
            type: "document_reminder",
            title: `${docType.sentenceLabel} still needed`,
            message: `Please upload your ${docType.label.toLowerCase()} for ${reg.climbTitle || climb.title || "your climb"}.`,
            link: "/my-registrations",
            id: `${docType.notificationPrefix}_${reg.id}`,
          });
        }
      }

      // Upcoming-climb reminders for confirmed participants only.
      if (
        reg.status === "confirmed" &&
        !isClimbPostponed(climb) &&
        climb?.startDate?.toDate
      ) {
        const daysUntil = Math.ceil(
          (climb.startDate.toDate().getTime() - now) / 86400000,
        );
        if (UPCOMING_REMINDER_DAYS.has(daysUntil)) {
          const climbTitle = reg.climbTitle || climb.title;
          const unpaid =
            reg.paymentStatus === "unpaid" || reg.paymentStatus === "rejected";
          let message = `${climbTitle} — ${reg.climbDate || climb.dateLabel || ""}. Check the event page for the itinerary, what to bring, and what to pay.`;
          const priv = climbPrivates[reg.climbId];
          // Mention only the next upcoming meeting (there can be several) —
          // past ones aren't relevant to a "your climb is coming up" nudge.
          const nextMeeting = (priv?.preClimbMeetings || [])
            .filter((m) => m.date && new Date(`${m.date}T23:59:59`).getTime() >= now)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          if (nextMeeting) {
            const meetingDate = new Date(
              `${nextMeeting.date}T00:00:00`,
            ).toLocaleDateString("en-PH", { month: "long", day: "numeric" });
            message += ` Pre-climb meeting: ${meetingDate}${nextMeeting.time ? ` at ${nextMeeting.time}` : ""}${nextMeeting.location ? ` — ${nextMeeting.location}` : ""}.`;
          }
          if (unpaid) {
            message += " You haven't submitted payment yet — please do so from My Climbs.";
          }
          await createNotification({
            userId: reg.userId,
            type: "upcoming_climb",
            title:
              daysUntil === 1
                ? "Your climb is tomorrow!"
                : `Your climb is in ${daysUntil} days`,
            message,
            link: `/event/${reg.climbId}`,
            id: `upcoming${daysUntil}_${reg.id}`,
          });
          upcomingReminders++;
        }
      }
    }

    // ── Officer/team-leader summary: unpaid & missing-doc registrants ──────
    // Reminds each officer (bell + email) once per climb per day, as long as
    // that climb still has outstanding items. Re-surfaces daily like the
    // member-facing reminders above, until resolved.
    const appUrlForOfficers = process.env.APP_URL || "https://mms-open-climbs.web.app";
    let officerSummariesSent = 0;

    for (const climbId of climbIds) {
      const climb = climbs[climbId];
      if (!climb?.officers?.length || isClimbCancelled(climb) || isClimbOver(climb, now)) continue;

      const climbRegs = regs.filter((r) => r.climbId === climbId);
      const unpaidCount = climbRegs.filter(
        (r) => r.paymentStatus === "unpaid" || r.paymentStatus === "rejected",
      ).length;
      const missingDocsCount = climbRegs.filter((r) =>
        REQUIRED_DOC_TYPES.some(
          (docType) => climb[docType.requiresField] && !r[docType.uploadField],
        ),
      ).length;
      if (unpaidCount === 0 && missingDocsCount === 0) continue;

      const climbUrl = `${appUrlForOfficers}/admin/climbs/${climbId}`;
      const summaryParts = [];
      if (unpaidCount > 0) {
        summaryParts.push(
          `${unpaidCount} unpaid/rejected registrant${unpaidCount === 1 ? "" : "s"}`,
        );
      }
      if (missingDocsCount > 0) {
        summaryParts.push(
          `${missingDocsCount} missing required document${missingDocsCount === 1 ? "" : "s"}`,
        );
      }
      const summaryMessage = `${climb.title || "Your climb"}: ${summaryParts.join(", ")}.`;

      const contacts = await getOfficerContacts(climbId, climb);
      for (const officer of contacts) {
        if (officer.userId) {
          await createNotification({
            userId: officer.userId,
            type: "officer_outstanding_summary",
            title: "Outstanding registrant items",
            message: summaryMessage,
            link: `/admin/climbs/${climbId}`,
            id: `officer_outstanding_${climbId}_${officer.userId}`,
          });
        }
        if (officer.email) {
          try {
            await sendEmail({
              to: officer.email,
              toName: officer.name || "",
              subject: `[Action Needed] ${climb.title || "Climb"} — Outstanding Registrant Items`,
              html: tplOfficerOutstandingSummary({
                officerName: officer.name || "there",
                climbTitle: climb.title || "your climb",
                unpaidCount,
                missingDocsCount,
                climbUrl,
              }),
            });
          } catch (err) {
            logger.error("[sendReminderNotifications] Officer summary email failed", {
              climbId,
              email: officer.email,
              err: err.message,
            });
          }
        }
      }
      officerSummariesSent++;
    }

    // Thank-you email + feedback request for climbs that have finished —
    // sent once per climb, to every confirmed joiner (email + in-app bell).
    const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
    let thankYouEmails = 0;
    let feedbackNotifications = 0;

    for (const climbId of climbIds) {
      const climb = climbs[climbId];
      if (!climb || climb.thankYouSentAt || !climb.endDate?.toDate) continue;
      if (isClimbCancelled(climb) || isClimbPostponed(climb)) continue;
      // A day's grace after the climb ends, so leads can mark no-shows
      // before the thank-you goes out.
      if (climb.endDate.toDate().getTime() + NO_SHOW_GRACE_MS > now) continue;

      const confirmedRegs = regs.filter(
        (r) => r.climbId === climbId && r.status === "confirmed" && !r.noShow,
      );
      const feedbackUrl = `${appUrl}/feedback/${climbId}`;

      for (const reg of confirmedRegs) {
        if (reg.email) {
          try {
            await sendEmail({
              to: reg.email,
              toName: reg.name,
              subject: `Thank You for Climbing With Us — ${climb.title} | MMS Open Climbs`,
              html: tplThankYou({
                name: reg.name,
                climbTitle: climb.title,
                appUrl,
                feedbackUrl,
                beneficiary: reg.donationReceived
                  ? climb.donationDrive?.beneficiary || "the outreach"
                  : "",
              }),
            });
            thankYouEmails++;
          } catch (err) {
            logger.error("[sendReminderNotifications] Thank-you email failed", {
              climbId,
              email: reg.email,
              err: err.message,
            });
          }
        }

        if (reg.userId) {
          await createNotification({
            userId: reg.userId,
            type: "feedback_request",
            title: "How was your climb?",
            message: `Share your feedback on ${climb.title} — it only takes a minute.`,
            link: `/feedback/${climbId}`,
            id: `feedback_${climbId}_${reg.userId}`,
          });
          feedbackNotifications++;
        }
      }

      await db
        .doc(`climbs/${climbId}`)
        .update({ thankYouSentAt: FieldValue.serverTimestamp() });
    }

    logger.info("[sendReminderNotifications] Done", {
      totalRegs: regs.length,
      paymentReminders,
      upcomingReminders,
      thankYouEmails,
      feedbackNotifications,
      officerSummariesSent,
    });
  },
);
