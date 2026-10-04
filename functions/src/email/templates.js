"use strict";



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

function tplOfficerNewRegistrationRaw({ registrantName, registrantEmail, climbTitle, climbDate, climbLocation, appUrl }) {
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

Object.assign(module.exports, { tplClimbCancellation, tplOfficerClimbCancellation, tplOfficerNewRegistration, tplOfficerOutstandingSummary, tplOfficerStatusUpdate, tplRegistrationConfirmation, tplReleaseNote, tplStatusUpdate, tplThankYou, tplWaitlistPromoted, tplWelcome });
