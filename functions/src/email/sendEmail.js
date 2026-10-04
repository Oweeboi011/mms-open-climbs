"use strict";

const logger = require("firebase-functions/logger");

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

Object.assign(module.exports, { sendEmail });
