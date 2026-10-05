"use strict";

const logger = require("firebase-functions/logger");
const { onDocumentCreated, onDocumentUpdatedWithAuthContext, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { getPaymentEntries } = require("../paymentMath");
const { REQUIRED_DOC_TYPES } = require("../requiredDocTypes");
const { sendEmail } = require("../email/sendEmail");
const { tplRegistrationConfirmation, tplStatusUpdate, tplOfficerNewRegistration, tplOfficerStatusUpdate } = require("../email/templates");
const { updateRoster, syncParticipantList, SEAT_HOLDING_STATUSES, isClimbFull, promoteFromWaitlist, findOtherActiveRegistration, getNotifyLists, createNotification, logFailedRequest, regDocsComplete } = require("../shared/registrationOps");
const { db } = require("../shared/admin");

// ── Trigger: new registration → send confirmation email ───────────────────────
exports.onRegistrationCreated = onDocumentCreated(
  {
    document: "registrations/{regId}",
    database: "openclimbs",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
  },
  async (event) => {
    const reg = event.data.data();
    const { name, email, climbId, userId, paymentStatus } = reg;

    try {
      const climbSnap = await db.doc(`climbs/${climbId}`).get();
      if (!climbSnap.exists) {
        logger.warn("Climb not found", { climbId });
        return;
      }
      const climb = climbSnap.data();

      // Increment registration count on the climb document. Unconditional —
      // the app always creates with status "pending"; the update/delete
      // triggers keep it to "non-cancelled" from here (unlike registeredUserIds
      // below, which is gated on an active status + a real userId).
      await db
        .doc(`climbs/${climbId}`)
        .update({ registrationCount: FieldValue.increment(1) });

      // A second live registration for the same climb is a duplicate: drop
      // it before anything is emailed. Counted above so the delete trigger's
      // decrement balances; that trigger leaves the roster and docs count
      // alone because the original registration is still active.
      const isActive = reg.status !== "cancelled";
      if (userId && isActive) {
        const original = await findOtherActiveRegistration({
          climbId,
          userId,
          regId: event.params.regId,
        });
        if (original) {
          logger.warn("[onRegistrationCreated] duplicate dropped", {
            regId: event.params.regId,
            originalId: original.id,
            climbId,
            userId,
          });
          await db.doc(`registrations/${event.params.regId}`).delete();
          return;
        }
      }

      // Capacity: pending and confirmed registrations hold a seat. Past
      // maxParticipants a new pending registration goes to the waitlist
      // instead — the status change fires onRegistrationUpdated, which sends
      // the member the "Added to Waitlist" email, so the "received" email
      // below is skipped. The client only warns; this is the enforcement.
      const autoWaitlisted =
        reg.status === "pending" &&
        (await isClimbFull(climb, climbId, event.params.regId));
      if (autoWaitlisted) {
        await db.doc(`registrations/${event.params.regId}`).update({
          status: "waitlisted",
          autoWaitlisted: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Keep the roster in sync — it's what the climbPrivate security rule
      // checks to gate pre-climb meeting details and resource links to
      // actual registrants.
      if (userId && isActive && !autoWaitlisted) {
        await updateRoster(climbId, userId, true);
      }

      await syncParticipantList(climbId);

      // Keep docsCompleteCount in sync for the climb card progress badge.
      if (isActive && regDocsComplete(climb, reg)) {
        await db
          .doc(`climbs/${climbId}`)
          .update({ docsCompleteCount: FieldValue.increment(1) });
      }

      if (paymentStatus === "unpaid" && userId) {
        await createNotification({
          userId,
          type: "payment_reminder",
          title: "Payment pending",
          message: `You registered for ${climb.title} without submitting payment yet. Add your GCash proof from My Climbs whenever you're ready.`,
          link: "/my-registrations",
          id: `payment_${event.params.regId}`,
        });
      }
      if (userId) {
        for (const docType of REQUIRED_DOC_TYPES) {
          if (!climb[docType.requiresField] || reg[docType.uploadField]) continue;
          await createNotification({
            userId,
            type: "document_reminder",
            title: `${docType.sentenceLabel} still needed`,
            message: `Please upload your ${docType.label.toLowerCase()} for ${climb.title}.`,
            link: "/my-registrations",
            id: `${docType.notificationPrefix}_${event.params.regId}`,
          });
        }
      }

      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const waiverUrl = `${appUrl}/waiver/${event.params.regId}`;
      const { officerEmails, adminEmails } = await getNotifyLists(climb, climbId);

      // 1. Confirmation to registrant (skip for admin-added walk-ins with no
      // email on file, and for the auto-waitlisted — they get the waitlist
      // email from onRegistrationUpdated instead)
      if (email && !autoWaitlisted) {
        await sendEmail({
          to: email,
          toName: name,
          subject: `Registration Received — ${climb.title} | MMS Open Climbs`,
          html: tplRegistrationConfirmation({
            name,
            climbTitle: climb.title,
            climbDate: climb.dateLabel || "",
            climbLocation: climb.location || "",
            waiverUrl,
          }),
        });
      }

      // 2. Notify each officer, CC all admins
      for (const officer of officerEmails) {
        await sendEmail({
          to: officer.email,
          toName: officer.name,
          subject: `[New Registration] ${name} — ${climb.title} | MMS Open Climbs`,
          html: tplOfficerNewRegistration({
            registrantName: name,
            registrantEmail: email,
            climbTitle: climb.title,
            climbDate: climb.dateLabel || "",
            climbLocation: climb.location || "",
            regId: event.params.regId,
            appUrl,
          }),
          cc: adminEmails,
        });
      }

      // 3. If no officers, notify admins directly
      if (officerEmails.length === 0 && adminEmails.length > 0) {
        const [first, ...rest] = adminEmails;
        await sendEmail({
          to: first.email,
          toName: first.name,
          subject: `[New Registration] ${name} — ${climb.title} | MMS Open Climbs`,
          html: tplOfficerNewRegistration({
            registrantName: name,
            registrantEmail: email,
            climbTitle: climb.title,
            climbDate: climb.dateLabel || "",
            climbLocation: climb.location || "",
            regId: event.params.regId,
            appUrl,
          }),
          cc: rest,
        });
      }

      logger.info("[onRegistrationCreated] Confirmation sent", {
        email,
        officerCount: officerEmails.length,
        adminCount: adminEmails.length,
        climbTitle: climb.title,
      });
    } catch (err) {
      logger.error("[onRegistrationCreated] Failed", { err: err.message });
      await logFailedRequest({
        type: "email",
        source: "onRegistrationCreated",
        message: err.message,
        userId,
        climbId,
        registrationId: event.params.regId,
      });
    }
  },
);

// ── Helper: mark every admin's "payment submitted" notification read once a
// submitted payment has actually been reviewed (verified or rejected) ────────
async function clearAdminSubmittedNotifs(regId) {
  const adminSnap = await db.collection("users").where("role", "==", "admin").get();
  await Promise.all(
    adminSnap.docs.map((d) =>
      db
        .collection("notifications")
        .doc(`submitted_${regId}_${d.id}`)
        .set({ read: true }, { merge: true })
        .catch(() => {}),
    ),
  );
}

// ── Trigger: registration status changed → send status email ─────────────────
// WithAuthContext, not the plain variant: only this one populates
// `event.authId`, which the forged-payment-status guard below depends on.
exports.onRegistrationUpdated = onDocumentUpdatedWithAuthContext(
  {
    document: "registrations/{regId}",
    database: "openclimbs",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const regId = event.params.regId;

    // Security rules can't iterate arrays, so they can't stop a crafted
    // client write from marking an individual payment "verified" inside
    // `payments[]`. Catch it here instead: if the writer isn't an admin, no
    // entry may gain a verdict it didn't already have. Skipped when the
    // writer is unknown (Admin SDK / backfills), which is never a client.
    const writerUid = event.authId;
    if (writerUid && Array.isArray(after.payments)) {
      const writerSnap = await db.doc(`users/${writerUid}`).get();
      const writerIsAdmin =
        writerSnap.exists && writerSnap.data().role === "admin";
      if (!writerIsAdmin) {
        const beforePayments = Array.isArray(before.payments)
          ? before.payments
          : [];
        let tampered = false;
        const clamped = after.payments.map((p, i) => {
          const priorStatus = beforePayments[i] && beforePayments[i].status;
          if (p && p.status && p.status !== "submitted" && p.status !== priorStatus) {
            tampered = true;
            return { ...p, status: priorStatus || "submitted" };
          }
          return p;
        });
        if (tampered) {
          logger.warn("[onRegistrationUpdated] Clamped forged payment status", {
            regId,
            writerUid,
          });
          await event.data.after.ref.update({ payments: clamped });
          return; // the corrective write re-runs this trigger on clean data
        }
      }
    }

    // Payment status changed → surface an in-app notification for the member.
    if (before.paymentStatus !== after.paymentStatus && after.userId) {
      const reminderId = `payment_${regId}`;
      if (after.paymentStatus === "verified") {
        await db
          .collection("notifications")
          .doc(reminderId)
          .set({ read: true }, { merge: true })
          .catch(() => {});
        await clearAdminSubmittedNotifs(regId);
        await createNotification({
          userId: after.userId,
          type: "payment_verified",
          title: "Payment verified",
          message: `Your payment for ${after.climbTitle || "your climb"} has been verified. You're all set!`,
          link: "/my-registrations",
        });
      } else if (after.paymentStatus === "rejected") {
        await clearAdminSubmittedNotifs(regId);
        await createNotification({
          userId: after.userId,
          type: "payment_reminder",
          title: "Payment rejected",
          message: `Your payment proof for ${after.climbTitle || "your climb"} was rejected${after.adminNotes ? `: ${after.adminNotes}` : ""}. Please resubmit from My Climbs.`,
          link: "/my-registrations",
          id: reminderId,
        });
      } else if (after.paymentStatus === "unpaid") {
        // An admin reset a submitted/verified payment back to unpaid.
        await clearAdminSubmittedNotifs(regId);
        await createNotification({
          userId: after.userId,
          type: "payment_reminder",
          title: "Payment status reset",
          message: `Your payment for ${after.climbTitle || "your climb"} was reset to unpaid. Please resubmit your GCash proof from My Climbs.`,
          link: "/my-registrations",
          id: reminderId,
        });
      } else if (after.paymentStatus === "submitted") {
        await db
          .collection("notifications")
          .doc(reminderId)
          .set({ read: true }, { merge: true })
          .catch(() => {});

        // Let admins know a payment is waiting for review.
        const adminSnap = await db
          .collection("users")
          .where("role", "==", "admin")
          .get();
        // Name the payment that just came in, not the running total — a
        // member sending ₱300 on top of ₱500 must not read as "₱800".
        const beforeCount = Array.isArray(before.payments)
          ? before.payments.length
          : 0;
        const newEntries = getPaymentEntries(after).slice(beforeCount);
        const newAmount = newEntries.reduce((sum, p) => sum + p.amount, 0);
        const amountLabel = newAmount
          ? `₱${newAmount.toLocaleString("en-PH")}`
          : after.amountPaid
            ? `₱${Number(after.amountPaid).toLocaleString("en-PH")}`
            : "a payment";
        await Promise.all(
          adminSnap.docs.map((d) =>
            createNotification({
              userId: d.id,
              type: "payment_submitted",
              title: "Payment submitted for review",
              message: `${after.name || "A member"} submitted ${amountLabel} for ${after.climbTitle || "a climb"}.`,
              link: "/admin/payments",
              id: `submitted_${regId}_${d.id}`,
            }),
          ),
        );
      }
    }

    // A single instalment was rejected while the registration as a whole is
    // still fine — e.g. the downpayment stands but the balance receipt was
    // unreadable. The rolled-up paymentStatus doesn't change in that case, so
    // the block above stays silent and the member would otherwise never learn
    // their balance went back up.
    if (after.paymentStatus !== "rejected" && after.userId) {
      const beforePayments = Array.isArray(before.payments)
        ? before.payments
        : [];
      const newlyRejected = (
        Array.isArray(after.payments) ? after.payments : []
      ).filter(
        (p, i) =>
          p?.status === "rejected" && beforePayments[i]?.status !== "rejected",
      );
      if (newlyRejected.length > 0) {
        const amountLabel = newlyRejected
          .map((p) => `₱${Number(p.amount || 0).toLocaleString("en-PH")}`)
          .join(" and ");
        await createNotification({
          userId: after.userId,
          type: "payment_reminder",
          title: "A payment was rejected",
          message: `Your ${amountLabel} payment for ${after.climbTitle || "your climb"} was rejected${after.adminNotes ? `: ${after.adminNotes}` : ""}. Your other payments still stand — please resubmit the rejected amount from My Climbs.`,
          link: "/my-registrations",
          id: `payment_${regId}`,
        });
      }
    }

    // An admin recorded a refund — usually the excess on a payment that
    // covered more than this registrant owed. Only newly added refunds are
    // named, so removing one (or any unrelated edit) stays silent.
    if (after.userId) {
      const beforeRefunds = Array.isArray(before.refunds)
        ? before.refunds.length
        : 0;
      const refunded = (Array.isArray(after.refunds) ? after.refunds : [])
        .slice(beforeRefunds)
        .reduce((sum, r) => sum + (Number(r && r.amount) || 0), 0);
      if (refunded > 0) {
        await createNotification({
          userId: after.userId,
          type: "payment_refunded",
          title: "Refund sent",
          message: `₱${refunded.toLocaleString("en-PH")} was refunded to you for ${after.climbTitle || "your climb"}. See the details in My Climbs.`,
          link: "/my-registrations",
        });
      }
    }

    // Required document uploaded → clear the corresponding nag notification.
    for (const docType of REQUIRED_DOC_TYPES) {
      if (!before[docType.uploadField] && after[docType.uploadField]) {
        await db
          .collection("notifications")
          .doc(`${docType.notificationPrefix}_${regId}`)
          .set({ read: true }, { merge: true })
          .catch(() => {});
      }
    }

    if (
      before.status !== after.status ||
      before.name !== after.name ||
      before.memberType !== after.memberType
    ) {
      await syncParticipantList(after.climbId);
    }

    // Keep the roster in sync whenever status moves in or out of the
    // "active" set (pending/confirmed) — the list the climbPrivate rule
    // checks. Runs even for status changes that don't
    // trigger a notification below (e.g. waitlisted → pending).
    const wasActive = ["pending", "confirmed"].includes(before.status);
    const isActive = ["pending", "confirmed"].includes(after.status);
    if (wasActive !== isActive && after.userId) {
      await updateRoster(after.climbId, after.userId, isActive);
    }

    // registrationCount follows the same non-cancelled rule the create trigger
    // uses (walk-ins included, so no userId guard). Kept here — above the
    // notify early-returns — so reinstating a cancelled registration
    // re-increments, not just cancelling decrements.
    const wasCounted = before.status !== "cancelled";
    const isCounted = after.status !== "cancelled";
    if (wasCounted !== isCounted && after.climbId) {
      await db.doc(`climbs/${after.climbId}`).update({
        registrationCount: FieldValue.increment(isCounted ? 1 : -1),
      });
    }

    // Keep docsCompleteCount in sync (climb card progress badge) whenever a
    // status change or document upload could change whether this registrant
    // counts as compliant with the climb's *current* requirements. Presence
    // comparison, not reference equality — before/after come from separate
    // snapshots so upload objects are never `===` even when unchanged.
    const docsRelevantChange =
      wasActive !== isActive ||
      REQUIRED_DOC_TYPES.some(
        (docType) =>
          !!before[docType.uploadField] !== !!after[docType.uploadField],
      );
    if (docsRelevantChange && after.userId && after.climbId) {
      const climbSnapForDocs = await db.doc(`climbs/${after.climbId}`).get();
      if (climbSnapForDocs.exists) {
        const climbForDocs = climbSnapForDocs.data();
        const wasComplete = wasActive && regDocsComplete(climbForDocs, before);
        const isComplete = isActive && regDocsComplete(climbForDocs, after);
        if (wasComplete !== isComplete) {
          await db.doc(`climbs/${after.climbId}`).update({
            docsCompleteCount: FieldValue.increment(isComplete ? 1 : -1),
          });
        }
      }
    }

    if (before.status === after.status) return; // not a status change

    // A seat just freed up — offer it to the waitlist.
    if (
      SEAT_HOLDING_STATUSES.includes(before.status) &&
      !SEAT_HOLDING_STATUSES.includes(after.status)
    ) {
      await promoteFromWaitlist(after.climbId);
    }

    const notifyOn = ["confirmed", "cancelled", "waitlisted"];
    if (!notifyOn.includes(after.status)) return;

    try {
      const climbSnap = await db.doc(`climbs/${after.climbId}`).get();
      const climb = climbSnap.exists
        ? climbSnap.data()
        : { title: after.climbTitle || after.climbId, officers: [] };
      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const { officerEmails, adminEmails } = await getNotifyLists(climb, after.climbId);

      // 1. Status update to registrant (skip for walk-ins with no email on file)
      if (after.email) {
        await sendEmail({
          to: after.email,
          toName: after.name,
          subject: `Registration Update — ${climb.title} | MMS Open Climbs`,
          html: tplStatusUpdate({
            name: after.name,
            climbTitle: climb.title,
            newStatus: after.status,
            reason: after.cancellationReason || null,
          }),
        });
      }

      if (after.userId) {
        const statusTitles = {
          confirmed: "You're confirmed!",
          cancelled: "Registration cancelled",
          waitlisted: "Added to waitlist",
        };
        await createNotification({
          userId: after.userId,
          type: "status_update",
          title: statusTitles[after.status] || "Registration updated",
          message: `${climb.title} — your registration is now ${after.status}.`,
          link: "/my-registrations",
        });
      }

      // 2. Notify each officer, CC all admins
      for (const officer of officerEmails) {
        await sendEmail({
          to: officer.email,
          toName: officer.name,
          subject: `[Status Update] ${after.name} → ${after.status.toUpperCase()} — ${climb.title}`,
          html: tplOfficerStatusUpdate({
            registrantName: after.name,
            registrantEmail: after.email,
            climbTitle: climb.title,
            newStatus: after.status,
            reason: after.cancellationReason || null,
            appUrl,
          }),
          cc: adminEmails,
        });
      }

      // 3. If no officers, notify admins directly
      if (officerEmails.length === 0 && adminEmails.length > 0) {
        const [first, ...rest] = adminEmails;
        await sendEmail({
          to: first.email,
          toName: first.name,
          subject: `[Status Update] ${after.name} → ${after.status.toUpperCase()} — ${climb.title}`,
          html: tplOfficerStatusUpdate({
            registrantName: after.name,
            registrantEmail: after.email,
            climbTitle: climb.title,
            newStatus: after.status,
            reason: after.cancellationReason || null,
            appUrl,
          }),
          cc: rest,
        });
      }

      logger.info("[onRegistrationUpdated] Status email sent", {
        status: after.status,
        email: after.email,
        officerCount: officerEmails.length,
        adminCount: adminEmails.length,
      });
    } catch (err) {
      logger.error("[onRegistrationUpdated] Failed", { err: err.message });
      await logFailedRequest({
        type: "email",
        source: "onRegistrationUpdated",
        message: err.message,
        userId: after.userId,
        climbId: after.climbId,
        registrationId: regId,
      });
    }
  },
);

// ── Trigger: registration hard-deleted (admin action) → keep
// registeredUserIds and docsCompleteCount in sync, same as the create/update
// triggers above ──────────────────────────────────────────────────────────
exports.onRegistrationDeleted = onDocumentDeleted(
  { document: "registrations/{regId}", database: "openclimbs" },
  async (event) => {
    const reg = event.data.data();
    if (!reg.climbId) return;
    await syncParticipantList(reg.climbId);
    if (SEAT_HOLDING_STATUSES.includes(reg.status)) {
      await promoteFromWaitlist(reg.climbId);
    }
    try {
      // registrationCount mirrors the create trigger's non-cancelled rule — a
      // cancelled reg was already decremented when it was cancelled, so only
      // deleting a still-counted one adjusts the total. Walk-ins (no userId)
      // count too.
      if (reg.status !== "cancelled") {
        await db
          .doc(`climbs/${reg.climbId}`)
          .update({ registrationCount: FieldValue.increment(-1) });
      }

      // registeredUserIds / docsCompleteCount track only the active set and
      // real accounts (mirrors scripts/backfill-climb-denorm.mjs).
      // A dropped duplicate (see onRegistrationCreated) never entered the
      // roster or docs count, and the original registration still holds them.
      const stillRegistered =
        reg.userId &&
        (await findOtherActiveRegistration({
          climbId: reg.climbId,
          userId: reg.userId,
          regId: event.params.regId,
        }));
      if (
        reg.userId &&
        !stillRegistered &&
        ["pending", "confirmed"].includes(reg.status)
      ) {
        await updateRoster(reg.climbId, reg.userId, false);

        const climbSnap = await db.doc(`climbs/${reg.climbId}`).get();
        if (climbSnap.exists && regDocsComplete(climbSnap.data(), reg)) {
          await db
            .doc(`climbs/${reg.climbId}`)
            .update({ docsCompleteCount: FieldValue.increment(-1) });
        }
      }
    } catch (err) {
      logger.error("[onRegistrationDeleted] Failed to sync climb denorm fields", {
        err: err.message,
        climbId: reg.climbId,
      });
    }
  },
);
