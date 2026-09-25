/* eslint-disable max-len */
"use strict";

const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentUpdatedWithAuthContext,
  onDocumentDeleted,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  getOutstanding,
  getCountedTotal,
  getPaymentEntries,
} = require("./paymentMath");
const { REQUIRED_DOC_TYPES } = require("./requiredDocTypes");

initializeApp();

// A club-sized app never needs more than a handful of concurrent instances;
// the cap bounds what a runaway trigger loop or a flood of calls can bill.
// No minInstances — idle warm instances are charged around the clock.
setGlobalOptions({ maxInstances: 5, memory: "256MiB" });

const adminAuth = getAuth();
const db = getFirestore("openclimbs");

// ── Email sender (Brevo REST API v3) ─────────────────────────────────────────
async function sendEmail({ to, toName, subject, html, cc = [] }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    logger.error(
      "Brevo credentials not configured (BREVO_API_KEY / BREVO_FROM_EMAIL)",
    );
    return;
  }

  const body = {
    sender: { name: "MMS Open Climbs", email: fromEmail },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent: html,
  };
  if (cc.length > 0) body.cc = cc;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── HTML escaping for email templates ─────────────────────────────────────────
// Template arguments are plain values — names, climb titles, reasons — and
// several (a registrant's name, their email) are typed by members. Unescaped,
// a name like `<a href="…">Verify payment</a>` becomes a working link in an
// email the club really sent to its officers and admins.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Wraps a template so every string argument is escaped before it is
// interpolated. Numbers and booleans pass through untouched.
function escaped(template) {
  return (args = {}) =>
    template(
      Object.fromEntries(
        Object.entries(args).map(([key, value]) => [
          key,
          typeof value === "string" ? escapeHtml(value) : value,
        ]),
      ),
    );
}

// ── Email HTML templates ──────────────────────────────────────────────────────
function tplBase(content) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f9f5;">
      <div style="background:#0d2b12;padding:24px;text-align:center;border-bottom:3px solid #c8a000;">
        <h1 style="color:#f0c800;font-size:22px;margin:0;letter-spacing:3px;text-transform:uppercase;">MMS Open Climbs</h1>
        <p style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:2px;margin:8px 0 0;text-transform:uppercase;">Metropolitan Mountaineering Society</p>
      </div>
      <div style="padding:32px 28px;background:#fff;">${content}</div>
      <div style="background:#0d2b12;padding:16px;text-align:center;">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0;">Metropolitan Mountaineering Society &bull; Open Climbs</p>
      </div>
    </div>`;
}

function tplRegistrationConfirmationRaw({
  name,
  climbTitle,
  climbDate,
  climbLocation,
  waiverUrl,
}) {
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Registration Received!</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Hi <strong>${name}</strong>,</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Your registration for the following climb has been received and is <strong>pending confirmation</strong>:</p>
    <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d2b12;text-transform:uppercase;letter-spacing:1px;">${climbTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#4a4a4a;">&#128197; ${climbDate} &nbsp;&bull;&nbsp; &#128205; ${climbLocation}</p>
    </div>
    <p style="color:#4a4a4a;font-size:14px;line-height:1.6;">A climb officer will confirm your spot soon. You will receive another email once confirmed.</p>
    <p style="margin:24px 0;">
      <a href="${waiverUrl}" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Print Your Waiver</a>
    </p>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">Please print and bring your signed waiver on the day of the climb. For questions, contact your MMS coordinator.</p>`);
}

function tplStatusUpdateRaw({ name, climbTitle, newStatus, reason }) {
  const msgs = {
    confirmed: {
      title: "You're Confirmed!",
      body: "Great news — your registration has been confirmed. Get ready for an amazing climb!",
      color: "#2e7d32",
    },
    cancelled: {
      title: "Registration Cancelled",
      body:
        reason ||
        "Your registration has been cancelled. Please contact your MMS coordinator.",
      color: "#c62828",
    },
    waitlisted: {
      title: "Added to Waitlist",
      body: "You have been added to the waitlist. We will notify you if a spot becomes available.",
      color: "#e65100",
    },
  };
  const msg = msgs[newStatus] || {
    title: "Registration Update",
    body: `Your status has been updated to: ${newStatus}`,
    color: "#1565c0",
  };
  return tplBase(`
    <h2 style="color:${msg.color};font-size:20px;margin:0 0 16px;">${msg.title}</h2>
    <p style="color:#4a4a4a;font-size:15px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">${msg.body}</p>
    <div style="background:#f7f9f5;border:1px solid #e0e0e0;padding:14px 18px;border-radius:6px;margin:20px 0;">
      <p style="margin:0;font-weight:700;color:#0d2b12;text-transform:uppercase;">${climbTitle}</p>
    </div>
    <p style="color:#4a4a4a;font-size:13px;">For inquiries, contact your MMS Open Climbs Coordinator.</p>`);
}

function tplClimbCancellationRaw({
  name,
  climbTitle,
  climbDate,
  climbLocation,
  statusLabel,
  reason,
}) {
  const isCancelled = statusLabel === "Cancelled";
  const color = isCancelled ? "#c62828" : "#e65100";
  const bg = isCancelled ? "#fdecea" : "#fff3e0";
  return tplBase(`
    <h2 style="color:${color};font-size:20px;margin:0 0 16px;">Climb ${statusLabel}</h2>
    <p style="color:#4a4a4a;font-size:15px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">The following climb you're registered for has been <strong>${statusLabel.toLowerCase()}</strong>:</p>
    <div style="background:${bg};border-left:4px solid ${color};padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d2b12;text-transform:uppercase;letter-spacing:1px;">${climbTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#4a4a4a;">&#128197; ${climbDate} &nbsp;&bull;&nbsp; &#128205; ${climbLocation}</p>
    </div>
    ${reason ? `<p style="color:#4a4a4a;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>` : ""}
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">For questions, please contact your MMS coordinator.</p>`);
}

function tplOfficerClimbCancellationRaw({
  climbTitle,
  statusLabel,
  reason,
  registrantCount,
  appUrl,
}) {
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Climb marked ${statusLabel}</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;"><strong>${climbTitle}</strong> has been marked <strong>${statusLabel.toLowerCase()}</strong> in the admin panel. ${registrantCount} active registrant${registrantCount === 1 ? " has" : "s have"} been emailed and notified.</p>
    ${reason ? `<p style="color:#4a4a4a;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>` : ""}
    <p style="margin:24px 0;">
      <a href="${appUrl}/admin" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Open Admin Panel</a>
    </p>`);
}

function tplWelcomeRaw({ displayName, setupLink }) {
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Welcome, ${displayName}!</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">An account has been created for you on the MMS Open Climbs portal.</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Click the button below to set your password and access your account:</p>
    <p style="margin:24px 0;">
      <a href="${setupLink}" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Set Up Your Account</a>
    </p>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">This link expires in 24 hours. If you did not expect this email, please disregard it.</p>`);
}

function tplOfficerNewRegistrationRaw({ registrantName, registrantEmail, climbTitle, climbDate, climbLocation, regId, appUrl }) {
  const adminUrl = `${appUrl}/admin/climbs/${regId}`;
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">New Registration Received</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">A new participant has registered for your climb:</p>
    <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#0d2b12;text-transform:uppercase;letter-spacing:1px;">${climbTitle}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#4a4a4a;">&#128197; ${climbDate} &nbsp;&bull;&nbsp; &#128205; ${climbLocation}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;width:120px;">Name</td><td style="padding:8px 12px;color:#1a1a1a;font-weight:600;">${registrantName}</td></tr>
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;">Email</td><td style="padding:8px 12px;color:#1a1a1a;">${registrantEmail}</td></tr>
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;">Status</td><td style="padding:8px 12px;color:#e65100;font-weight:600;">Pending</td></tr>
    </table>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">Please review and confirm or update the registration status in the admin panel.</p>
    <p style="margin:24px 0;">
      <a href="${appUrl}/admin" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Open Admin Panel</a>
    </p>`);
}

function tplOfficerStatusUpdateRaw({ registrantName, registrantEmail, climbTitle, newStatus, reason, appUrl }) {
  const statusColors = { confirmed: '#2e7d32', cancelled: '#c62828', waitlisted: '#e65100' };
  const color = statusColors[newStatus] || '#1565c0';
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Registration Status Updated</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">A registration status has changed for <strong>${climbTitle}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0;">
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;width:120px;">Participant</td><td style="padding:8px 12px;color:#1a1a1a;font-weight:600;">${registrantName}</td></tr>
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;">Email</td><td style="padding:8px 12px;color:#1a1a1a;">${registrantEmail}</td></tr>
      <tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;">New Status</td><td style="padding:8px 12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;">${newStatus}</td></tr>
      ${reason ? `<tr><td style="padding:8px 12px;background:#f7f9f5;color:#666;">Reason</td><td style="padding:8px 12px;color:#1a1a1a;">${reason}</td></tr>` : ""}
    </table>
    <p style="margin:24px 0;">
      <a href="${appUrl}/admin" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Open Admin Panel</a>
    </p>`);
}

function tplReleaseNoteRaw({ title, body, appUrl }) {
  const paragraphs = (body || "")
    .split(/\n\s*\n/)
    .map((p) => `<p style="color:#4a4a4a;font-size:15px;line-height:1.6;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">${title}</h2>
    ${paragraphs}
    <p style="margin:24px 0;">
      <a href="${appUrl}/release-notes" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">View All Updates</a>
    </p>`);
}

function tplThankYouRaw({ name, climbTitle, appUrl, feedbackUrl, beneficiary }) {
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Thank You, ${name}!</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Congratulations on completing <strong>${climbTitle}</strong>! We hope it was an unforgettable journey.</p>
    ${beneficiary ? `<p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Thank you too for your donation to <strong>${beneficiary}</strong> — it made a real difference.</p>` : ""}
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">MMS thanks you for joining us on this climb. We'd love to see you again — check out the upcoming schedule and join us on the next one!</p>
    <p style="margin:24px 0;">
      <a href="${feedbackUrl}" style="background:#c8a000;color:#0d2b12;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;margin-right:10px;">Share Your Feedback</a>
      <a href="${appUrl}" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">See Upcoming Climbs</a>
    </p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Got a minute? Tell us how the climb went — your feedback helps us plan better ones.</p>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">Stay safe, and see you on the trail!</p>`);
}

function tplOfficerOutstandingSummaryRaw({
  officerName,
  climbTitle,
  unpaidCount,
  missingDocsCount,
  climbUrl,
}) {
  const lines = [];
  if (unpaidCount > 0) {
    lines.push(
      `<li style="margin-bottom:6px;"><strong>${unpaidCount}</strong> registrant${unpaidCount === 1 ? "" : "s"} with an unpaid or rejected payment.</li>`,
    );
  }
  if (missingDocsCount > 0) {
    lines.push(
      `<li style="margin-bottom:6px;"><strong>${missingDocsCount}</strong> registrant${missingDocsCount === 1 ? "" : "s"} missing a required document.</li>`,
    );
  }
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Outstanding items for ${climbTitle}</h2>
    <p style="color:#4a4a4a;font-size:15px;">Hi <strong>${officerName}</strong>,</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">As a team leader/officer for this climb, here's what still needs attention:</p>
    <ul style="color:#4a4a4a;font-size:14px;line-height:1.6;padding-left:20px;">${lines.join("")}</ul>
    <p style="margin:24px 0;">
      <a href="${climbUrl}" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Review Registrants</a>
    </p>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">You'll get this reminder daily until it's resolved.</p>`);
}

const tplRegistrationConfirmation = escaped(tplRegistrationConfirmationRaw);
const tplStatusUpdate = escaped(tplStatusUpdateRaw);
const tplClimbCancellation = escaped(tplClimbCancellationRaw);
const tplOfficerClimbCancellation = escaped(tplOfficerClimbCancellationRaw);
const tplWelcome = escaped(tplWelcomeRaw);
const tplOfficerNewRegistration = escaped(tplOfficerNewRegistrationRaw);
const tplOfficerStatusUpdate = escaped(tplOfficerStatusUpdateRaw);
const tplReleaseNote = escaped(tplReleaseNoteRaw);
const tplThankYou = escaped(tplThankYouRaw);
const tplOfficerOutstandingSummary = escaped(tplOfficerOutstandingSummaryRaw);

function tplWaitlistPromotedRaw({ name, climbTitle, appUrl }) {
  return tplBase(`
    <h2 style="color:#2e7d32;font-size:20px;margin:0 0 16px;">A slot opened up!</h2>
    <p style="color:#4a4a4a;font-size:15px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Good news — a seat opened on <strong>${climbTitle}</strong> and you're off the waitlist. Your registration is now <strong>pending confirmation</strong> by the climb officers.</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Please settle your fees and upload any required documents from My Climbs so they can confirm you.</p>
    <p style="margin:24px 0;">
      <a href="${appUrl}/my-registrations" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Open My Climbs</a>
    </p>`);
}
const tplWaitlistPromoted = escaped(tplWaitlistPromotedRaw);

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

// ── Scheduled: daily reminders for unpaid registrations & upcoming climbs ─────
const UPCOMING_REMINDER_DAYS = new Set([7, 5, 3, 1]);

// A cancelled climb is over as far as its registrants are concerned — chasing
// them for payment, nagging for documents, counting down to the trek, or
// thanking them for a climb that never happened are all wrong. A postponed
// one is still going ahead, so payment and document reminders stand; only the
// date-driven messages are suppressed, since the old dates no longer mean
// anything.
const isClimbCancelled = (climb) =>
  climb?.status === "cancelled" || climb?.cancellationStatus === "cancelled";
const isClimbPostponed = (climb) => climb?.cancellationStatus === "postponed";
// Over once marked completed or once its last day (endDate, else startDate)
// has fully passed in Manila. Document nags and the officers' daily summary
// stop then; members are still reminded of any balance they owe.
const isClimbOver = (climb, now = Date.now()) => {
  if (climb?.status === "completed") return true;
  const last = (climb?.endDate ?? climb?.startDate)?.toDate?.();
  return !!last && last.getTime() + 86400000 < now;
};

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

// ── Callable: admin creates a user account and sends welcome email ─────────────
// ── Mirror the admin role onto an auth custom claim ──────────────────────────
//
// Storage rules cannot read this project's Firestore: the app uses a named
// database ("openclimbs") and storage's firestore.get() only reaches the
// default one. With no role lookup available, those rules fell back to "any
// signed-in user", which left every member's medical certificate, payment
// receipt, permit and signed waiver readable by anyone who made an account.
//
// A custom claim is the one piece of identity storage.rules *can* read, so
// the role is mirrored here and `request.auth.token.admin` gates those files.
// users/{uid}.role stays the source of truth; this only follows it.
exports.syncAdminClaim = onDocumentWritten(
  // `database` is required: this project has no (default) Firestore
  // database, so a trigger that omits it fails the whole deploy.
  { document: "users/{uid}", database: "openclimbs" },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const wasAdmin = before?.role === "admin";
    const isAdmin = after?.role === "admin";
    if (wasAdmin === isAdmin) return;

    try {
      const user = await adminAuth.getUser(uid);
      const claims = { ...(user.customClaims || {}) };
      if (isAdmin) {
        claims.admin = true;
      } else {
        delete claims.admin;
      }
      await adminAuth.setCustomUserClaims(uid, claims);

      // A token already in the wild keeps its old claims for up to an hour.
      // Granting can wait for the client to refresh, but a revoked admin must
      // not keep reading members' documents for the rest of that hour, so cut
      // the session immediately.
      if (!isAdmin) await adminAuth.revokeRefreshTokens(uid);

      logger.info("[syncAdminClaim] claim updated", { uid, admin: isAdmin });
    } catch (err) {
      // A users/ doc can exist with no auth user behind it (an admin-created
      // placeholder, or a deleted account). That is not an error worth retrying.
      if (err.code === "auth/user-not-found") {
        logger.info("[syncAdminClaim] no auth user, nothing to sync", { uid });
        return;
      }
      logger.error("[syncAdminClaim] failed", { uid, err: err.message });
      await logFailedRequest({
        type: "firestore",
        source: "syncAdminClaim",
        message: err.message,
        userId: uid,
      });
    }
  },
);

// ── Callable: issue the caller's admin claim from their users/ role ─────────
// syncAdminClaim only fires on users/ writes, so an admin promoted before it
// existed has no claim and storage.rules would deny them members' files.
// AuthContext calls this when the profile says admin but the token doesn't.
// The role is read server-side; the caller can't grant themselves anything.
exports.ensureAdminClaim = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  const snap = await db.doc(`users/${uid}`).get();
  const isAdmin = snap.exists && snap.data().role === "admin";
  if (!isAdmin) return { admin: false };
  if (request.auth.token?.admin === true) return { admin: true };
  try {
    const user = await adminAuth.getUser(uid);
    await adminAuth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
    logger.info("[ensureAdminClaim] claim issued", { uid });
    return { admin: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

exports.createUser = onCall(
  { secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"] },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
      throw new HttpsError("unauthenticated", "You must be signed in.");

    // Everything below can throw a plain (non-HttpsError) exception — e.g. a
    // transient Firestore/Auth error. onCall silently discards the message of
    // any non-HttpsError it catches, so without this net the client would
    // just see a bare, undiagnosable "internal" error.
    try {
      const callerSnap = await db.doc(`users/${callerUid}`).get();
      if (!callerSnap.exists || callerSnap.data().role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only admins can create users.",
        );
      }

      const { email, displayName, role = "member" } = request.data;
      if (!email || !displayName) {
        throw new HttpsError(
          "invalid-argument",
          "email and displayName are required.",
        );
      }
      if (!["member", "admin"].includes(role)) {
        throw new HttpsError(
          "invalid-argument",
          'role must be "member" or "admin".',
        );
      }

      let userRecord;
      let isFreshAccount = false;
      try {
        userRecord = await adminAuth.createUser({ email, displayName });
        isFreshAccount = true;
      } catch (err) {
        if (err.code === "auth/email-already-exists") {
          // The Auth account may be a real existing user, or it may be an
          // orphan left behind by a previous invite that failed after the
          // Auth user was created but before the Firestore profile was
          // written. Self-heal the latter case instead of dead-ending.
          let existingUser;
          try {
            existingUser = await adminAuth.getUserByEmail(email);
          } catch (lookupErr) {
            throw new HttpsError("internal", lookupErr.message);
          }
          const existingProfileSnap = await db
            .doc(`users/${existingUser.uid}`)
            .get();
          if (existingProfileSnap.exists) {
            throw new HttpsError(
              "already-exists",
              "An account with this email already exists.",
            );
          }
          userRecord = existingUser;
        } else {
          throw new HttpsError("internal", err.message);
        }
      }

      let setupLink;
      try {
        // Create Firestore user profile
        await db.doc(`users/${userRecord.uid}`).set({
          displayName,
          email,
          role,
          createdAt: FieldValue.serverTimestamp(),
          addedBy: callerUid,
        });

        // Generate password setup link (user sets their own password)
        const appUrl =
          process.env.APP_URL || "https://mms-open-climbs.web.app";
        setupLink = await adminAuth.generatePasswordResetLink(email, {
          url: `${appUrl}/login`,
        });
      } catch (err) {
        if (isFreshAccount) {
          try {
            await adminAuth.deleteUser(userRecord.uid);
          } catch (deleteErr) {
            logger.error("[createUser] Failed to roll back orphaned Auth user", {
              uid: userRecord.uid,
              err: deleteErr.message,
            });
          }
        }
        if (err instanceof HttpsError) throw err;
        throw new HttpsError("internal", err.message);
      }

      let emailSent = true;
      try {
        await sendEmail({
          to: email,
          toName: displayName,
          subject: "Welcome to MMS Open Climbs — Set Up Your Account",
          html: tplWelcome({ displayName, setupLink }),
        });
      } catch (emailErr) {
        emailSent = false;
        logger.error("[createUser] Welcome email failed", {
          email,
          err: emailErr.message,
        });
        await logFailedRequest({
          type: "email",
          source: "createUser",
          message: emailErr.message,
          userId: userRecord.uid,
        });
      }

      logger.info("[createUser] Created user", { email, role, emailSent });
      return { uid: userRecord.uid, emailSent };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const refId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      logger.error("[createUser] Unexpected error", { refId, err: err.message });
      throw new HttpsError(
        "internal",
        `Unexpected error (ref ${refId}): ${err.message || String(err)}`,
      );
    }
  },
);

// ── Helper: verify the caller is a signed-in admin, or throw ──────────────────
async function requireAdmin(callerUid) {
  if (!callerUid)
    throw new HttpsError("unauthenticated", "You must be signed in.");
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can do this.");
  }
}

// ── Callable: admin corrects a user's name and/or email ───────────────────────
exports.updateUserProfile = onCall(async (request) => {
  try {
    await requireAdmin(request.auth?.uid);

    const { uid, email, displayName } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
    if (!email && !displayName) {
      throw new HttpsError(
        "invalid-argument",
        "Provide an email and/or displayName to update.",
      );
    }

    const authUpdate = {};
    if (email) authUpdate.email = email;
    if (displayName) authUpdate.displayName = displayName;
    try {
      await adminAuth.updateUser(uid, authUpdate);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "Another account already uses this email address.",
        );
      }
      if (err.code === "auth/user-not-found") {
        throw new HttpsError(
          "not-found",
          "This user's login account no longer exists.",
        );
      }
      throw new HttpsError("internal", err.message);
    }

    const firestoreUpdate = { updatedAt: FieldValue.serverTimestamp() };
    if (email) firestoreUpdate.email = email;
    if (displayName) firestoreUpdate.displayName = displayName;
    await db.doc(`users/${uid}`).update(firestoreUpdate);

    logger.info("[updateUserProfile] Updated", { uid, email: !!email, displayName: !!displayName });
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message);
  }
});

// ── Helper: remove a deleted account's personal data ────────────────────────
// Registrations stay — they are the club's payment and attendance record —
// but the health and contact details on them, the member's notifications and
// every file they uploaded (medical certificates, IDs, receipts) go with the
// account. Best effort: a failure here is logged, never surfaced, since the
// account itself is already gone.
const MEMBER_UPLOAD_PREFIXES = [
  "payment-proofs",
  "registration-form-uploads",
  "medical-cert-uploads",
  "permit-uploads",
  "waiver-doc-uploads",
];

async function purgeUserPersonalData(uid) {
  try {
    const regs = await db.collection("registrations").where("userId", "==", uid).get();
    await Promise.all(
      regs.docs.map((d) =>
        d.ref.update({
          medicalConditions: FieldValue.delete(),
          emergencyContact: FieldValue.delete(),
          dateOfBirth: FieldValue.delete(),
          address: FieldValue.delete(),
          mobile: FieldValue.delete(),
          accountDeletedAt: FieldValue.serverTimestamp(),
        }),
      ),
    );

    const notifs = await db.collection("notifications").where("userId", "==", uid).get();
    await Promise.all(notifs.docs.map((d) => d.ref.delete()));

    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();
    const climbIds = [...new Set(regs.docs.map((d) => d.data().climbId).filter(Boolean))];
    await Promise.all(
      climbIds.flatMap((climbId) =>
        MEMBER_UPLOAD_PREFIXES.map((prefix) =>
          bucket.deleteFiles({ prefix: `${prefix}/${climbId}/${uid}/` }),
        ),
      ),
    );
  } catch (err) {
    logger.error("[deleteUserAccount] personal data purge incomplete", {
      uid,
      err: err.message,
    });
  }
}

// ── Callable: admin deletes a user's login account and profile ────────────────
exports.deleteUserAccount = onCall(async (request) => {
  try {
    const callerUid = request.auth?.uid;
    await requireAdmin(callerUid);

    const { uid } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
    if (uid === callerUid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot delete your own account.",
      );
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      // If the Auth record is already gone, still clean up the Firestore
      // profile below instead of dead-ending on a stale account.
      if (err.code !== "auth/user-not-found") {
        throw new HttpsError("internal", err.message);
      }
    }
    await db.doc(`users/${uid}`).delete();
    await purgeUserPersonalData(uid);

    logger.info("[deleteUserAccount] Deleted", { uid });
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message);
  }
});

// ── Callable: admin emails all members about a published release note ────────
exports.sendReleaseNoteEmail = onCall(
  { secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const { releaseNoteId } = request.data;
      if (!releaseNoteId) {
        throw new HttpsError("invalid-argument", "releaseNoteId is required.");
      }

      const noteRef = db.doc(`releaseNotes/${releaseNoteId}`);
      const noteSnap = await noteRef.get();
      if (!noteSnap.exists) {
        throw new HttpsError("not-found", "Release note not found.");
      }
      const note = noteSnap.data();
      if (note.status !== "published") {
        throw new HttpsError(
          "failed-precondition",
          "Only published release notes can be emailed.",
        );
      }

      const usersSnap = await db.collection("users").get();
      const recipients = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.email);

      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const html = tplReleaseNote({
        title: note.title,
        body: note.body,
        appUrl,
      });

      let sent = 0;
      for (const u of recipients) {
        try {
          await sendEmail({
            to: u.email,
            toName: u.displayName || u.email,
            subject: `MMS Open Climbs Update: ${note.title}`,
            html,
          });
          sent++;
        } catch (emailErr) {
          logger.error("[sendReleaseNoteEmail] Failed for recipient", {
            email: u.email,
            err: emailErr.message,
          });
          await logFailedRequest({
            type: "email",
            source: "sendReleaseNoteEmail",
            message: emailErr.message,
            userId: u.id,
          });
        }
      }

      await noteRef.update({
        emailSentAt: FieldValue.serverTimestamp(),
        emailSentCount: sent,
      });

      logger.info("[sendReleaseNoteEmail] Sent", {
        releaseNoteId,
        sent,
        recipients: recipients.length,
      });
      return { sent, total: recipients.length };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Release note draft generation from GitHub commit history ──────────────────
const GITHUB_REPO_OWNER = "Oweeboi011";
const GITHUB_REPO_NAME = "mms-open-climbs";
const GITHUB_DEFAULT_BRANCH = "main";

const RELEASE_NOTE_TYPE_LABELS = {
  feat: "New Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Improvements",
};
const RELEASE_NOTE_NOISE_TYPES = new Set([
  "docs",
  "style",
  "test",
  "chore",
  "ci",
  "build",
  "revert",
]);

async function githubApi(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new HttpsError(
      "failed-precondition",
      "GITHUB_TOKEN secret is not configured.",
    );
  }
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mms-open-climbs-functions",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpsError(
      "internal",
      `GitHub API error ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  return res.json();
}

function shapeCommit(raw) {
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    subject: raw.commit.message.split("\n")[0],
    date: raw.commit.author?.date || raw.commit.committer?.date || null,
    author: raw.commit.author?.name || "",
  };
}

// Most recent release note that recorded the commit it was generated up to —
// this is the checkpoint the next draft should start from.
async function findLastSourceCommit() {
  const snap = await db
    .collection("releaseNotes")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  for (const doc of snap.docs) {
    const sourceCommit = doc.data().sourceCommit;
    if (sourceCommit) return sourceCommit;
  }
  return null;
}

function groupCommitsIntoChangelog(commits) {
  const groups = {
    "New Features": [],
    Fixes: [],
    Performance: [],
    Improvements: [],
  };
  let dropped = 0;

  for (const { subject } of commits) {
    if (/coverage/i.test(subject)) {
      dropped++;
      continue;
    }
    const match = subject.match(/^(\w+)(\([^)]*\))?:\s*(.+)$/);
    if (match) {
      const [, type, , rest] = match;
      if (RELEASE_NOTE_NOISE_TYPES.has(type)) {
        dropped++;
        continue;
      }
      const label = RELEASE_NOTE_TYPE_LABELS[type];
      if (label) {
        groups[label].push(rest.charAt(0).toUpperCase() + rest.slice(1));
        continue;
      }
    }
    groups["Improvements"].push(
      subject.charAt(0).toUpperCase() + subject.slice(1),
    );
  }

  const sections = Object.entries(groups).filter(([, items]) => items.length > 0);
  const body = sections
    .map(([label, items]) => `${label}\n${items.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
  return { body, dropped };
}

// ── Callable: list recent commits + last checkpoint for the admin's picker ────
exports.getReleaseNoteCommitOptions = onCall(
  { secrets: ["GITHUB_TOKEN"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const since = await findLastSourceCommit();
      const raw = await githubApi(
        `/commits?sha=${GITHUB_DEFAULT_BRANCH}&per_page=30`,
      );
      const commits = raw.map(shapeCommit);

      return { since, commits };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Callable: build a title/body draft from commits since the last checkpoint ─
exports.generateReleaseNoteDraft = onCall(
  { secrets: ["GITHUB_TOKEN"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const { until } = request.data;
      if (!until) {
        throw new HttpsError("invalid-argument", "until (a commit sha) is required.");
      }

      const since = await findLastSourceCommit();

      let rawCommits;
      if (since) {
        if (since === until) {
          rawCommits = [];
        } else {
          const compare = await githubApi(`/compare/${since}...${until}`);
          rawCommits = compare.commits || [];
        }
      } else {
        const list = await githubApi(`/commits?sha=${until}&per_page=50`);
        rawCommits = list;
      }

      const commits = rawCommits.map(shapeCommit);
      const { body, dropped } = groupCommitsIntoChangelog(commits);

      const untilCommit = commits[commits.length - 1] || null;
      const dateSource = untilCommit?.date ? new Date(untilCommit.date) : new Date();
      const title = `What's New — ${dateSource.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;

      return {
        title,
        body,
        sourceCommit: until,
        commitCount: commits.length,
        droppedCount: dropped,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Callable: App Insights — Brevo email delivery stats ───────────────────────
exports.getEmailStats = onCall(
  { secrets: ["BREVO_API_KEY"] },
  async (request) => {
    await requireAdmin(request.auth?.uid);

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Brevo API key is not configured.");
    }

    const { days = 30 } = request.data || {};
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    try {
      const res = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${fmt(startDate)}&endDate=${fmt(endDate)}`,
        { headers: { "api-key": apiKey } },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new HttpsError("internal", `Brevo API error ${res.status}: ${body}`);
      }
      const data = await res.json();
      return {
        requests: data.requests || 0,
        delivered: data.delivered || 0,
        hardBounces: data.hardBounces || 0,
        softBounces: data.softBounces || 0,
        blocked: data.blocked || 0,
        opens: data.opens || 0,
        uniqueOpens: data.uniqueOpens || 0,
        clicks: data.clicks || 0,
        spamReports: data.spamReports || 0,
        rangeDays: days,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Callable: App Insights — Storage usage by folder ──────────────────────────
const STORAGE_FOLDERS = [
  "payment-proofs",
  "registration-form-uploads",
  "medical-cert-uploads",
  "registration-form-templates",
  "medical-cert-samples",
  "gcash-qr",
  "trail-images",
];

exports.getStorageUsage = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  try {
    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();
    const results = await Promise.all(
      STORAGE_FOLDERS.map(async (prefix) => {
        const [files] = await bucket.getFiles({ prefix: `${prefix}/` });
        const bytes = files.reduce(
          (sum, f) => sum + Number(f.metadata.size || 0),
          0,
        );
        return { folder: prefix, fileCount: files.length, bytes };
      }),
    );
    const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
    const totalFiles = results.reduce((s, r) => s + r.fileCount, 0);
    return { folders: results, totalBytes, totalFiles };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ── Callable: App Insights — Cloud Functions health (best-effort) ─────────────
// Requires the runtime service account to have the "Monitoring Viewer"
// (roles/monitoring.viewer) IAM role. Without it, this returns a clear
// "not configured" result instead of failing the whole insights page.
exports.getFunctionHealth = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  try {
    const { MetricServiceClient } = require("@google-cloud/monitoring");
    const client = new MetricServiceClient();
    const projectId = await client.getProjectId();
    const projectPath = client.projectPath(projectId);

    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 24 * 3600;

    async function sumMetric(metricType) {
      const [timeSeries] = await client.listTimeSeries({
        name: projectPath,
        filter: `metric.type = "${metricType}"`,
        interval: {
          startTime: { seconds: dayAgo },
          endTime: { seconds: now },
        },
        view: "FULL",
      });
      let total = 0;
      for (const series of timeSeries) {
        for (const point of series.points || []) {
          total += Number(point.value?.int64Value || point.value?.doubleValue || 0);
        }
      }
      return total;
    }

    const [executionCount, errorCount] = await Promise.all([
      sumMetric("cloudfunctions.googleapis.com/function/execution_count"),
      sumMetric("cloudfunctions.googleapis.com/function/user_memory_bytes").catch(() => 0),
    ]);

    return {
      configured: true,
      windowHours: 24,
      executionCount,
      errorCount,
    };
  } catch (err) {
    logger.warn("[getFunctionHealth] Not available", { err: err.message });
    return {
      configured: false,
      reason:
        "Cloud Monitoring is not accessible from this function yet. Grant the runtime service account the \"Monitoring Viewer\" role in IAM, then retry.",
    };
  }
});

// ── Callable: App Insights — real GCP billing cost (best-effort) ──────────────
// There is no general "get my current spend" REST API — Google's supported
// mechanism is exporting detailed billing data to a BigQuery dataset, which
// this then queries. Requires one-time setup that only a project/billing
// admin can do (this function cannot enable APIs or grant IAM roles itself):
//   1. Enable BigQuery export in the Cloud Billing Console (Billing >
//      Billing export > Detailed usage cost) into a dataset in this project.
//   2. Set the BILLING_EXPORT_TABLE env var (functions/.env) to the fully
//      qualified table, e.g.
//      "project.dataset.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX".
//   3. Grant the Cloud Functions runtime service account the
//      "BigQuery Data Viewer" and "BigQuery Job User" roles.
// Without that, this returns a clear "not configured" result instead of
// failing the whole insights page.
exports.getBillingCost = onCall(async (request) => {
  await requireAdmin(request.auth?.uid);

  const table = process.env.BILLING_EXPORT_TABLE;
  if (!table) {
    return {
      configured: false,
      reason:
        "No billing export table configured. Set BILLING_EXPORT_TABLE (functions/.env) to your BigQuery billing export table after enabling detailed usage cost export in the Cloud Billing Console.",
    };
  }

  try {
    const { BigQuery } = require("@google-cloud/bigquery");
    const bigquery = new BigQuery();
    const [rows] = await bigquery.query({
      query: `
        SELECT
          service.description AS service,
          SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS cost
        FROM \`${table}\`
        WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
        GROUP BY service
        HAVING cost > 0
        ORDER BY cost DESC
      `,
    });

    const byService = rows.map((r) => ({
      service: r.service,
      cost: Number(r.cost || 0),
    }));
    const totalCost = byService.reduce((sum, r) => sum + r.cost, 0);

    return {
      configured: true,
      currency: "USD",
      month: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long" }),
      totalCost,
      byService,
    };
  } catch (err) {
    logger.warn("[getBillingCost] Not available", { err: err.message });
    return {
      configured: false,
      reason:
        "Could not query the billing export table. Confirm BILLING_EXPORT_TABLE is correct and the runtime service account has BigQuery Data Viewer + Job User roles.",
    };
  }
});

// ── Social preview prerender for /event/** ───────────────────────────────────
// Serves the built app shell with per-climb OG tags injected, so links shared
// to Messenger/Facebook render a real card instead of a bare URL. See the
// hosting rewrite in firebase.json.
exports.ogPrerender = require("./ogPrerender").ogPrerender;
