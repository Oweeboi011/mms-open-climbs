/* eslint-disable max-len */
'use strict';

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError }                   = require('firebase-functions/v2/https');
const { initializeApp }                        = require('firebase-admin/app');
const { getAuth }                              = require('firebase-admin/auth');
const { getFirestore, FieldValue }             = require('firebase-admin/firestore');

initializeApp();

const adminAuth = getAuth();
const db        = getFirestore('openclimbs');

// ── Email sender (Brevo REST API v3) ─────────────────────────────────────────
async function sendEmail({ to, toName, subject, html }) {
  const apiKey  = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.error('Brevo credentials not configured (BREVO_API_KEY / BREVO_FROM_EMAIL)');
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: 'MMS Open Climbs', email: fromEmail },
      to:          [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
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

function tplRegistrationConfirmation({ name, climbTitle, climbDate, climbLocation, waiverUrl }) {
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
    confirmed:  { title: "You're Confirmed!", body: "Great news — your registration has been confirmed. Get ready for an amazing climb!", color: '#2e7d32' },
    cancelled:  { title: 'Registration Cancelled', body: reason || 'Your registration has been cancelled. Please contact your MMS coordinator.', color: '#c62828' },
    waitlisted: { title: 'Added to Waitlist', body: 'You have been added to the waitlist. We will notify you if a spot becomes available.', color: '#e65100' },
  };
  const msg = msgs[newStatus] || { title: 'Registration Update', body: `Your status has been updated to: ${newStatus}`, color: '#1565c0' };
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

// ── Trigger: new registration → send confirmation email ───────────────────────
exports.onRegistrationCreated = onDocumentCreated({ document: 'registrations/{regId}', database: 'openclimbs' }, async (event) => {
  const reg = event.data.data();
  const { name, email, climbId } = reg;

  try {
    const climbSnap = await db.doc(`climbs/${climbId}`).get();
    if (!climbSnap.exists) { console.warn(`Climb ${climbId} not found`); return; }
    const climb = climbSnap.data();

    // Increment registration count on the climb document
    await db.doc(`climbs/${climbId}`).update({ registrationCount: FieldValue.increment(1) });

    const appUrl   = process.env.APP_URL || 'https://mms-open-climbs.web.app';
    const waiverUrl = `${appUrl}/waiver/${event.params.regId}`;

    await sendEmail({
      to:      email,
      toName:  name,
      subject: `Registration Received — ${climb.title} | MMS Open Climbs 2026`,
      html:    tplRegistrationConfirmation({
        name, climbTitle: climb.title,
        climbDate:     climb.dateLabel || '',
        climbLocation: climb.location  || '',
        waiverUrl,
      }),
    });

    console.log(`[onRegistrationCreated] Confirmation sent to ${email} for "${climb.title}"`);
  } catch (err) {
    console.error('[onRegistrationCreated]', err);
  }
});

// ── Trigger: registration status changed → send status email ─────────────────
exports.onRegistrationUpdated = onDocumentUpdated({ document: 'registrations/{regId}', database: 'openclimbs' }, async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  if (before.status === after.status) return; // not a status change

  const notifyOn = ['confirmed', 'cancelled', 'waitlisted'];
  if (!notifyOn.includes(after.status)) return;

  // If cancellation, decrement registration count
  if (after.status === 'cancelled' && before.status !== 'cancelled') {
    await db.doc(`climbs/${after.climbId}`).update({ registrationCount: FieldValue.increment(-1) });
  }

  try {
    const climbSnap = await db.doc(`climbs/${after.climbId}`).get();
    const climb = climbSnap.exists ? climbSnap.data() : { title: after.climbTitle };

    await sendEmail({
      to:      after.email,
      toName:  after.name,
      subject: `Registration Update — ${climb.title} | MMS Open Climbs 2026`,
      html:    tplStatusUpdate({
        name:       after.name,
        climbTitle: climb.title,
        newStatus:  after.status,
        reason:     after.cancellationReason || null,
      }),
    });

    console.log(`[onRegistrationUpdated] Status "${after.status}" email sent to ${after.email}`);
  } catch (err) {
    console.error('[onRegistrationUpdated]', err);
  }
});

// ── Callable: admin creates a user account and sends welcome email ─────────────
exports.createUser = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can create users.');
  }

  const { email, displayName, role = 'member' } = request.data;
  if (!email || !displayName) {
    throw new HttpsError('invalid-argument', 'email and displayName are required.');
  }

  let userRecord;
  try {
    userRecord = await adminAuth.createUser({ email, displayName });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.');
    }
    throw new HttpsError('internal', err.message);
  }

  // Create Firestore user profile
  await db.doc(`users/${userRecord.uid}`).set({
    displayName,
    email,
    role,
    createdAt: FieldValue.serverTimestamp(),
    addedBy:   callerUid,
  });

  // Generate password setup link (user sets their own password)
  const appUrl    = process.env.APP_URL || 'https://mms-open-climbs.web.app';
  const setupLink = await adminAuth.generatePasswordResetLink(email, { url: `${appUrl}/login` });

  await sendEmail({
    to:      email,
    toName:  displayName,
    subject: 'Welcome to MMS Open Climbs 2026 — Set Up Your Account',
    html:    tplWelcome({ displayName, setupLink }),
  });

  console.log(`[createUser] Created user ${email} (role: ${role})`);
  return { uid: userRecord.uid };
});
