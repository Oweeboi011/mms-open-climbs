"use strict";

const logger = require("firebase-functions/logger");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { REQUIRED_DOC_TYPES } = require("../requiredDocTypes");
const { sendEmail } = require("../email/sendEmail");
const { tplClimbCancellation, tplOfficerClimbCancellation } = require("../email/templates");
const { promoteFromWaitlist, getNotifyLists, createNotification, logFailedRequest, regDocsComplete } = require("../shared/registrationOps");
const { db } = require("../shared/admin");

// ── Trigger: new climb announcement → notify all active registrants ──────────
exports.onClimbUpdated = onDocumentUpdated(
  {
    document: "climbs/{climbId}",
    database: "openclimbs",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const climbId = event.params.climbId;

    const beforeAnnouncements = before.announcements || [];
    const afterAnnouncements = after.announcements || [];
    const newAnnouncements = afterAnnouncements.filter(
      (a) => !beforeAnnouncements.some((b) => b.createdAt === a.createdAt),
    );

    // A requirement was switched off → clear any outstanding nag
    // notifications for it instead of leaving them stuck unread forever.
    const turnedOffDocTypes = REQUIRED_DOC_TYPES.filter(
      (docType) =>
        before[docType.requiresField] && !after[docType.requiresField],
    );
    // Either requirement flipping in *either* direction changes who counts
    // as "compliant" — docsCompleteCount needs a full recount either way.
    const requirementsChanged = REQUIRED_DOC_TYPES.some(
      (docType) =>
        !!before[docType.requiresField] !== !!after[docType.requiresField],
    );

    const CANCELLATION_LABELS = { cancelled: "Cancelled", postponed: "Postponed" };
    const cancellationChanged =
      (before.cancellationStatus || "") !== (after.cancellationStatus || "") &&
      !!CANCELLATION_LABELS[after.cancellationStatus];

    // More seats (or auto-promotion switched back on) — fill from the waitlist.
    if (
      Number(after.maxParticipants) > Number(before.maxParticipants || 0) ||
      (before.waitlistAutoPromote === false && after.waitlistAutoPromote !== false)
    ) {
      await promoteFromWaitlist(climbId);
    }

    if (
      newAnnouncements.length === 0 &&
      !requirementsChanged &&
      !cancellationChanged
    ) {
      return;
    }

    try {
      const regsSnap = await db
        .collection("registrations")
        .where("climbId", "==", climbId)
        .get();
      // Every registrant who hasn't withdrawn — including joiners an admin
      // added by hand, who have no `userId` because they never signed up for
      // an account. They still count toward `registrationCount`, so they must
      // still be told when the climb they paid for is cancelled. Anything
      // that genuinely needs an account (in-app notifications) guards on
      // `userId` at its own call site.
      const activeRegs = regsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status !== "cancelled");

      if (turnedOffDocTypes.length > 0) {
        await Promise.all(
          activeRegs.map(async (r) => {
            for (const docType of turnedOffDocTypes) {
              await db
                .collection("notifications")
                .doc(`${docType.notificationPrefix}_${r.id}`)
                .set({ read: true }, { merge: true })
                .catch(() => {});
            }
          }),
        );
      }

      if (requirementsChanged) {
        const docsCompleteCount = activeRegs.filter((r) =>
          regDocsComplete(after, r),
        ).length;
        await db.doc(`climbs/${climbId}`).update({ docsCompleteCount });
      }

      if (cancellationChanged) {
        const statusLabel = CANCELLATION_LABELS[after.cancellationStatus];
        const reason = after.cancellationReason || "";
        const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
        const { officerEmails, adminEmails } = await getNotifyLists(after, climbId);

        await Promise.all(
          activeRegs.map(async (r) => {
            if (r.email) {
              await sendEmail({
                to: r.email,
                toName: r.name || "",
                subject: `Climb ${statusLabel} — ${after.title || "MMS Open Climbs"}`,
                html: tplClimbCancellation({
                  name: r.name || "there",
                  climbTitle: after.title || "",
                  climbDate: after.dateLabel || "",
                  climbLocation: after.location || "",
                  statusLabel,
                  reason,
                }),
              }).catch((err) =>
                logger.error("[onClimbUpdated] cancellation email failed", {
                  err: err.message,
                  regId: r.id,
                }),
              );
            }
            if (r.userId) {
              await createNotification({
                userId: r.userId,
                type: "climb_status_change",
                title: `Climb ${statusLabel} — ${after.title || "your climb"}`,
                message:
                  reason || `This climb has been ${statusLabel.toLowerCase()}.`,
                link: `/event/${climbId}`,
                id: `climbstatus_${climbId}_${after.cancellationStatus}_${r.id}`,
              });
            }
          }),
        );

        // Let officers (cc admins) — or admins directly if no officers —
        // know the climb was marked cancelled/postponed and that
        // registrants have already been emailed, mirroring the
        // per-registration status-change notify pattern above.
        const officerTpl = {
          climbTitle: after.title || "",
          statusLabel,
          reason,
          registrantCount: activeRegs.length,
          appUrl,
        };
        if (officerEmails.length > 0) {
          for (const officer of officerEmails) {
            await sendEmail({
              to: officer.email,
              toName: officer.name,
              subject: `[Climb ${statusLabel}] ${after.title || "MMS Open Climbs"}`,
              html: tplOfficerClimbCancellation(officerTpl),
              cc: adminEmails,
            }).catch((err) =>
              logger.error("[onClimbUpdated] officer cancellation email failed", {
                err: err.message,
              }),
            );
          }
        } else if (adminEmails.length > 0) {
          const [first, ...rest] = adminEmails;
          await sendEmail({
            to: first.email,
            toName: first.name,
            subject: `[Climb ${statusLabel}] ${after.title || "MMS Open Climbs"}`,
            html: tplOfficerClimbCancellation(officerTpl),
            cc: rest,
          }).catch((err) =>
            logger.error("[onClimbUpdated] admin cancellation email failed", {
              err: err.message,
            }),
          );
        }
      }

      if (newAnnouncements.length > 0) {
        const recipientIds = [
          ...new Set(activeRegs.map((r) => r.userId).filter(Boolean)),
        ];
        for (const note of newAnnouncements) {
          const title = note.pinned
            ? `New reminder — ${after.title || "your climb"}`
            : `New announcement — ${after.title || "your climb"}`;
          await Promise.all(
            recipientIds.map((userId) =>
              createNotification({
                userId,
                type: "climb_announcement",
                title,
                message: note.message,
                link: `/event/${climbId}`,
                id: `announcement_${climbId}_${note.createdAt}_${userId}`,
              }),
            ),
          );
        }
      }
    } catch (err) {
      logger.error("[onClimbUpdated] Failed", { err: err.message });
      await logFailedRequest({
        type: "firestore",
        source: "onClimbUpdated",
        message: err.message,
        climbId,
      });
    }
  },
);
