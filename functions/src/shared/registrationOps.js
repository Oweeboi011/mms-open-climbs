"use strict";

const logger = require("firebase-functions/logger");
const { FieldValue } = require("firebase-admin/firestore");
const { REQUIRED_DOC_TYPES } = require("../requiredDocTypes");
const { sendEmail } = require("../email/sendEmail");
const { tplOfficerStatusUpdate, tplWaitlistPromoted } = require("../email/templates");
const { isClimbCancelled, isClimbPostponed } = require("../shared/climbStatus");
const { db } = require("../shared/admin");

// ── Helper: registrant roster ─────────────────────────────────────────────────
// The uids of a climb's active registrants, kept in admin-only
// climbInternal/{climbId}. The climbPrivate and feedback rules check it
// (Firestore rules can't query registrations by climbId + userId). It used to
// sit on the public climb doc, where anyone could enumerate every registrant.
function updateRoster(climbId, userId, add) {
  return db.doc(`climbInternal/${climbId}`).set(
    {
      registeredUserIds: add
        ? FieldValue.arrayUnion(userId)
        : FieldValue.arrayRemove(userId),
    },
    { merge: true },
  );
}

const ACTIVE_REG_STATUSES = ["pending", "confirmed", "waitlisted"];

// How long after a climb ends the thank-you email waits (see
// sendReminderNotifications): time for leads to mark no-shows first.
const NO_SHOW_GRACE_MS = 24 * 60 * 60 * 1000;

// A climb's paymentDueDate ("YYYY-MM-DD") for reminder text, or "".
// Mirrors formatDueDate in src/utils/registrationPolicy.js.
function formatDueDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Helper: registrants-only participant list ───────────────────────────────
// Who's joining, as first name + last initial, in climbPrivate/{climbId} —
// readable only by the climb's registrants and admins (the full registrations
// can't be: the rules only let members read their own). Rebuilt from the
// climb's live registrations whenever one is created, changes status/name,
// or is deleted.
function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Participant";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

async function syncParticipantList(climbId) {
  if (!climbId) return;
  try {
    const snap = await db
      .collection("registrations")
      .where("climbId", "==", climbId)
      .get();
    const participants = snap.docs
      .map((d) => d.data())
      .filter((r) => SEAT_HOLDING_STATUSES.includes(r.status))
      .map((r) => ({ name: shortName(r.name), memberType: r.memberType || "" }));
    await db
      .doc(`climbPrivate/${climbId}`)
      .set({ participants }, { merge: true });
  } catch (err) {
    logger.error("[syncParticipantList] failed", { climbId, err: err.message });
  }
}

// The climb's own due date, else 5 days before it starts ("YYYY-MM-DD" in
// Manila time). Mirrors getPaymentDueDate in src/utils/registrationPolicy.js.
const DEFAULT_DUE_DAYS_BEFORE = 5;
function getPaymentDueDate(climb) {
  if (climb?.paymentDueDate) return climb.paymentDueDate;
  const raw = climb?.startDate;
  const start = raw?.toDate
    ? raw.toDate()
    : typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00+08:00`)
      : null;
  if (!start || isNaN(start.getTime())) return "";
  const due = new Date(start.getTime() - DEFAULT_DUE_DAYS_BEFORE * 86400000);
  return due.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Whether every seat is taken: pending + confirmed registrations (other than
// `regId`) at or above the climb's maxParticipants. No limit set = never full.
const SEAT_HOLDING_STATUSES = ["pending", "confirmed"];
async function isClimbFull(climb, climbId, regId) {
  const max = Number(climb?.maxParticipants);
  if (!max || max <= 0) return false;
  const snap = await db
    .collection("registrations")
    .where("climbId", "==", climbId)
    .get();
  const taken = snap.docs.filter(
    (d) => d.id !== regId && SEAT_HOLDING_STATUSES.includes(d.data().status),
  ).length;
  return taken >= max;
}

// ── Helper: fill freed seats from the waitlist ──────────────────────────────
// When a seat-holder leaves (cancelled, deleted or moved to the waitlist) or
// an admin raises maxParticipants, the longest-waiting registrations move
// back to "pending" — still subject to an officer's confirmation — and the
// member and officers are told. Off per climb with waitlistAutoPromote:false,
// and never for a cancelled, postponed or finished climb.
function createdMillis(reg) {
  const t = reg.createdAt;
  return t?.toMillis ? t.toMillis() : t?.toDate ? t.toDate().getTime() : 0;
}

async function promoteFromWaitlist(climbId) {
  if (!climbId) return [];
  try {
    const climbSnap = await db.doc(`climbs/${climbId}`).get();
    if (!climbSnap.exists) return [];
    const climb = climbSnap.data();
    const max = Number(climb.maxParticipants);
    if (!max || max <= 0 || climb.waitlistAutoPromote === false) return [];
    if (isClimbCancelled(climb) || isClimbPostponed(climb)) return [];
    if (climb.status === "completed") return [];
    const end = climb.endDate?.toDate ? climb.endDate.toDate() : null;
    if (end && end.getTime() < Date.now()) return [];

    const snap = await db
      .collection("registrations")
      .where("climbId", "==", climbId)
      .get();
    const regs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const free =
      max - regs.filter((r) => SEAT_HOLDING_STATUSES.includes(r.status)).length;
    if (free <= 0) return [];

    const promoted = regs
      .filter((r) => r.status === "waitlisted")
      .sort((a, b) => createdMillis(a) - createdMillis(b) || a.id.localeCompare(b.id))
      .slice(0, free);
    if (promoted.length === 0) return [];

    const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
    const { officerEmails, adminEmails } = await getNotifyLists(climb, climbId);
    for (const reg of promoted) {
      await db.doc(`registrations/${reg.id}`).update({
        status: "pending",
        promotedFromWaitlistAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info("[promoteFromWaitlist] promoted", { climbId, regId: reg.id });
      if (reg.userId) {
        await createNotification({
          userId: reg.userId,
          type: "waitlist_promoted",
          title: "You're off the waitlist",
          message: `A slot opened on ${climb.title}. Your registration is pending confirmation — settle your fees from My Climbs.`,
          link: "/my-registrations",
          id: `waitlist_promoted_${reg.id}`,
        });
      }
      try {
        if (reg.email) {
          await sendEmail({
            to: reg.email,
            toName: reg.name || "",
            subject: `A slot opened — ${climb.title} | MMS Open Climbs`,
            html: tplWaitlistPromoted({ name: reg.name || "there", climbTitle: climb.title || "your climb", appUrl }),
          });
        }
        const officerHtml = tplOfficerStatusUpdate({
          registrantName: reg.name || "",
          registrantEmail: reg.email || "",
          climbTitle: climb.title || "",
          newStatus: "pending",
          reason: "Promoted from the waitlist — a seat opened. Please confirm.",
          appUrl,
        });
        const [first, ...rest] = officerEmails.length ? officerEmails : adminEmails;
        if (first) {
          await sendEmail({
            to: first.email,
            toName: first.name,
            subject: `[Off Waitlist] ${reg.name || "A participant"} — ${climb.title}`,
            html: officerHtml,
            cc: officerEmails.length ? [...officerEmails.slice(1), ...adminEmails] : rest,
          });
        }
      } catch (err) {
        logger.error("[promoteFromWaitlist] email failed", { regId: reg.id, err: err.message });
      }
    }
    return promoted.map((r) => r.id);
  } catch (err) {
    logger.error("[promoteFromWaitlist] failed", { climbId, err: err.message });
    return [];
  }
}

// Another live registration by the same account for the same climb, if any.
// The client checks before registering, but that check is advisory — a
// double submit or a scripted write gets past it.
async function findOtherActiveRegistration({ climbId, userId, regId }) {
  if (!climbId || !userId) return null;
  const snap = await db
    .collection("registrations")
    .where("userId", "==", userId)
    .get();
  return (
    snap.docs.find(
      (d) =>
        d.id !== regId &&
        d.data().climbId === climbId &&
        ACTIVE_REG_STATUSES.includes(d.data().status),
    ) || null
  );
}

// ── Helper: get officer emails and admin CC list for a climb ─────────────────
// Officer email addresses live in admin-only climbInternal/{climbId}, as an
// array aligned by index with the public climb.officers list — the public doc
// keeps names, roles and phone contacts, never emails. Climbs saved before
// that move still carry climb.officers[].email, which is used as a fallback.
async function getOfficerContacts(climbId, climb) {
  let internal = [];
  if (climbId) {
    const snap = await db.doc(`climbInternal/${climbId}`).get();
    if (snap.exists) internal = snap.data().officerEmails || [];
  }
  return (climb?.officers || []).map((o, i) => ({
    name: o.name || internal[i]?.name || "",
    userId: o.userId || internal[i]?.userId || "",
    email: o.email || internal[i]?.email || "",
  }));
}

async function getNotifyLists(climb, climbId) {
  const officerEmails = (await getOfficerContacts(climbId, climb))
    .filter((o) => o.email && o.email.includes("@"))
    .map((o) => ({ email: o.email, name: o.name }));

  // All site admins
  const adminSnap = await db.collection("users").where("role", "==", "admin").get();
  const adminEmails = adminSnap.docs
    .map((d) => ({ email: d.data().email, name: d.data().displayName || "" }))
    .filter((a) => a.email);

  return { officerEmails, adminEmails };
}

// ── Helper: upsert an in-app notification for the bell dropdown ──────────────
// `id` makes the write idempotent (dedupe key) — pass one when a reminder
// should re-surface as unread instead of piling up duplicate rows.
async function createNotification({ userId, type, title, message, link, id }) {
  const payload = {
    userId,
    type,
    title,
    message: message || "",
    link: link || "",
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (id) {
    await db.collection("notifications").doc(id).set(payload, { merge: true });
  } else {
    await db.collection("notifications").add(payload);
  }
}

// ── Helper: log a failure for the admin "Failed Requests" analytics view ─────
// Never throws — a logging failure must not break the caller.
async function logFailedRequest({
  type,
  source,
  message,
  userId,
  climbId,
  registrationId,
}) {
  try {
    await db.collection("failedRequests").add({
      type,
      source,
      message: String(message ?? "Unknown error").slice(0, 500),
      path: null,
      userId: userId || null,
      userRole: null,
      climbId: climbId || null,
      registrationId: registrationId || null,
      createdAt: FieldValue.serverTimestamp(),
      // Firestore TTL deletes it after 90 days (same as the client logger).
      expireAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
  } catch (e) {
    logger.error("[logFailedRequest] Failed to write failure log", {
      err: e.message,
    });
  }
}

// ── Helper: has this registrant satisfied every document the climb
// currently requires? Used to keep climbs/{id}.docsCompleteCount in sync,
// which powers the "X/Y Docs Submitted" progress badge on climb cards ──────
function regDocsComplete(climb, reg) {
  return REQUIRED_DOC_TYPES.every(
    (docType) => !climb?.[docType.requiresField] || !!reg?.[docType.uploadField],
  );
}

Object.assign(module.exports, { NO_SHOW_GRACE_MS, SEAT_HOLDING_STATUSES, createNotification, findOtherActiveRegistration, formatDueDate, getNotifyLists, getOfficerContacts, getPaymentDueDate, isClimbFull, logFailedRequest, promoteFromWaitlist, regDocsComplete, shortName, syncParticipantList, updateRoster });
