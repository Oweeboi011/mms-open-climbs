"use strict";

// Receives browser Content-Security-Policy violation reports (the policy is
// Report-Only for now — see firebase.json and docs/guides/SECURITY.md) and
// writes a compact line to Cloud Logging. Nothing is stored in Firestore, so a
// flood of reports costs log lines, not reads and writes.
//
// Read them with: firebase functions:log --only cspReport

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const MAX_REPORTS = 20;
const clip = (v) => (typeof v === "string" ? v.slice(0, 300) : undefined);

// Browsers send either the legacy `application/csp-report` body
// ({ "csp-report": {...} }) or the Reporting API batch ([{ type, body }]).
function normalize(payload) {
  const items = Array.isArray(payload) ? payload : [payload];
  return items.slice(0, MAX_REPORTS).flatMap((item) => {
    const r = item?.["csp-report"] || (item?.type === "csp-violation" ? item.body : null);
    if (!r || typeof r !== "object") return [];
    return [
      {
        directive: clip(r["effective-directive"] || r.effectiveDirective || r["violated-directive"]),
        blocked: clip(r["blocked-uri"] || r.blockedURL),
        page: clip(r["document-uri"] || r.documentURL),
        source: clip(r["source-file"] || r.sourceFile),
      },
    ];
  });
}

function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try {
    return JSON.parse(req.rawBody?.toString("utf8") || "null");
  } catch {
    return null;
  }
}

exports.normalize = normalize;

exports.cspReport = onRequest(
  { region: "us-central1", invoker: "public", memory: "128MiB", maxInstances: 2, concurrency: 80 },
  (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }
    for (const report of normalize(parseBody(req))) {
      logger.warn("CSP violation", report);
    }
    res.status(204).end();
  },
);
