/* eslint-disable max-len */
"use strict";

const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

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

// ── Email HTML templates ──────────────────────────────────────────────────────
function tplBase(content) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f9f5;">
      <div style="background:#0d2b12;padding:24px;text-align:center;border-bottom:3px solid #c8a000;">
        <h1 style="color:#f0c800;font-size:22px;margin:0;letter-spacing:3px;text-transform:uppercase;">MMS Open Climbs 2026</h1>
        <p style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:2px;margin:8px 0 0;text-transform:uppercase;">Metropolitan Mountaineering Society</p>
      </div>
      <div style="padding:32px 28px;background:#fff;">${content}</div>
      <div style="background:#0d2b12;padding:16px;text-align:center;">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0;">Metropolitan Mountaineering Society &bull; Open Climbs 2026</p>
      </div>
    </div>`;
}

function tplRegistrationConfirmation({
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

function tplStatusUpdate({ name, climbTitle, newStatus, reason }) {
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

function tplWelcome({ displayName, setupLink }) {
  return tplBase(`
    <h2 style="color:#0d2b12;font-size:20px;margin:0 0 16px;">Welcome, ${displayName}!</h2>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">An account has been created for you on the MMS Open Climbs 2026 portal.</p>
    <p style="color:#4a4a4a;font-size:15px;line-height:1.6;">Click the button below to set your password and access your account:</p>
    <p style="margin:24px 0;">
      <a href="${setupLink}" style="background:#0d2b12;color:#f0c800;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;display:inline-block;">Set Up Your Account</a>
    </p>
    <p style="color:#4a4a4a;font-size:13px;line-height:1.6;">This link expires in 24 hours. If you did not expect this email, please disregard it.</p>`);
}

function tplOfficerNewRegistration({ registrantName, registrantEmail, climbTitle, climbDate, climbLocation, regId, appUrl }) {
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

function tplOfficerStatusUpdate({ registrantName, registrantEmail, climbTitle, newStatus, reason, appUrl }) {
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

function tplReleaseNote({ title, body, appUrl }) {
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

// ── Helper: get officer emails and admin CC list for a climb ─────────────────
async function getNotifyLists(climb) {
  // Officer emails stored directly on climb.officers[].email
  const officerEmails = (climb.officers || [])
    .filter((o) => o.email && o.email.includes("@"))
    .map((o) => ({ email: o.email, name: o.name || "" }));

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
    });
  } catch (e) {
    logger.error("[logFailedRequest] Failed to write failure log", {
      err: e.message,
    });
  }
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

      // Increment registration count on the climb document
      await db
        .doc(`climbs/${climbId}`)
        .update({ registrationCount: FieldValue.increment(1) });

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

      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const waiverUrl = `${appUrl}/waiver/${event.params.regId}`;
      const { officerEmails, adminEmails } = await getNotifyLists(climb);

      // 1. Confirmation to registrant (skip for admin-added walk-ins with no email on file)
      if (email) {
        await sendEmail({
          to: email,
          toName: name,
          subject: `Registration Received — ${climb.title} | MMS Open Climbs 2026`,
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
          subject: `[New Registration] ${name} — ${climb.title} | MMS Open Climbs 2026`,
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
          subject: `[New Registration] ${name} — ${climb.title} | MMS Open Climbs 2026`,
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

// ── Trigger: registration status changed → send status email ─────────────────
exports.onRegistrationUpdated = onDocumentUpdated(
  {
    document: "registrations/{regId}",
    database: "openclimbs",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const regId = event.params.regId;

    // Payment status changed → surface an in-app notification for the member.
    if (before.paymentStatus !== after.paymentStatus && after.userId) {
      const reminderId = `payment_${regId}`;
      if (after.paymentStatus === "verified") {
        await db
          .collection("notifications")
          .doc(reminderId)
          .set({ read: true }, { merge: true })
          .catch(() => {});
        await createNotification({
          userId: after.userId,
          type: "payment_verified",
          title: "Payment verified",
          message: `Your payment for ${after.climbTitle || "your climb"} has been verified. You're all set!`,
          link: "/my-registrations",
        });
      } else if (after.paymentStatus === "rejected") {
        await createNotification({
          userId: after.userId,
          type: "payment_reminder",
          title: "Payment rejected",
          message: `Your payment proof for ${after.climbTitle || "your climb"} was rejected${after.adminNotes ? `: ${after.adminNotes}` : ""}. Please resubmit from My Climbs.`,
          link: "/my-registrations",
          id: reminderId,
        });
      } else if (after.paymentStatus === "submitted") {
        await db
          .collection("notifications")
          .doc(reminderId)
          .set({ read: true }, { merge: true })
          .catch(() => {});
      }
    }

    if (before.status === after.status) return; // not a status change

    const notifyOn = ["confirmed", "cancelled", "waitlisted"];
    if (!notifyOn.includes(after.status)) return;

    // If cancellation, decrement registration count
    if (after.status === "cancelled" && before.status !== "cancelled") {
      await db
        .doc(`climbs/${after.climbId}`)
        .update({ registrationCount: FieldValue.increment(-1) });
    }

    try {
      const climbSnap = await db.doc(`climbs/${after.climbId}`).get();
      const climb = climbSnap.exists
        ? climbSnap.data()
        : { title: after.climbTitle || after.climbId, officers: [] };
      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const { officerEmails, adminEmails } = await getNotifyLists(climb);

      // 1. Status update to registrant (skip for walk-ins with no email on file)
      if (after.email) {
        await sendEmail({
          to: after.email,
          toName: after.name,
          subject: `Registration Update — ${climb.title} | MMS Open Climbs 2026`,
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

// ── Scheduled: daily reminders for unpaid registrations & upcoming climbs ─────
exports.sendReminderNotifications = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Manila" },
  async () => {
    const regsSnap = await db
      .collection("registrations")
      .where("status", "in", ["pending", "confirmed"])
      .get();
    const regs = regsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const climbIds = [...new Set(regs.map((r) => r.climbId).filter(Boolean))];
    const climbs = {};
    await Promise.all(
      climbIds.map(async (climbId) => {
        const snap = await db.doc(`climbs/${climbId}`).get();
        if (snap.exists) climbs[climbId] = snap.data();
      }),
    );

    const now = Date.now();
    let paymentReminders = 0;
    let upcomingReminders = 0;

    for (const reg of regs) {
      if (!reg.userId) continue;
      const climb = climbs[reg.climbId];

      // Unpaid / rejected payment nag — re-surfaces as unread each run.
      if (reg.paymentStatus === "unpaid" || reg.paymentStatus === "rejected") {
        await createNotification({
          userId: reg.userId,
          type: "payment_reminder",
          title: "Payment still pending",
          message: `Don't forget to submit your GCash payment proof for ${reg.climbTitle || "your climb"}.`,
          link: "/my-registrations",
          id: `payment_${reg.id}`,
        });
        paymentReminders++;
      }

      // Upcoming-climb reminders for confirmed participants only.
      if (reg.status === "confirmed" && climb?.startDate?.toDate) {
        const daysUntil = Math.ceil(
          (climb.startDate.toDate().getTime() - now) / 86400000,
        );
        if (daysUntil === 3 || daysUntil === 1) {
          await createNotification({
            userId: reg.userId,
            type: "upcoming_climb",
            title:
              daysUntil === 1
                ? "Your climb is tomorrow!"
                : "Your climb is in 3 days",
            message: `${reg.climbTitle || climb.title} — ${reg.climbDate || climb.dateLabel || ""}`,
            link: "/my-registrations",
            id: `upcoming${daysUntil}_${reg.id}`,
          });
          upcomingReminders++;
        }
      }
    }

    logger.info("[sendReminderNotifications] Done", {
      totalRegs: regs.length,
      paymentReminders,
      upcomingReminders,
    });
  },
);

// ── Callable: admin creates a user account and sends welcome email ─────────────
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
          subject: "Welcome to MMS Open Climbs 2026 — Set Up Your Account",
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
