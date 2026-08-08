/* eslint-disable max-len */
"use strict";

/**
 * Server-rendered social previews for /event/:climbId.
 *
 * The app is a client-rendered SPA, so a climb link pasted into Messenger or
 * Facebook — the club's main distribution channel — used to render as a bare
 * URL with no title, no description and no image. Crawlers do not run JS.
 *
 * This function sits in front of /event/** (see the hosting rewrite in
 * firebase.json), reads the climb from Firestore, and injects real OG tags
 * into the built app shell before serving it. The SPA then boots from that
 * HTML exactly as it would from the static file.
 *
 * The enriched HTML is served to everyone, not just crawlers. Sniffing the
 * User-Agent would require `Vary: User-Agent`, which makes the response
 * effectively uncacheable and turns every real page load into an invocation.
 * The output is identical for all viewers and contains no user data, so one
 * CDN entry per URL serves crawlers and humans alike.
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getFirestore } = require("firebase-admin/firestore");

// If this throws at module load it takes down every function in the
// deployment, including all the email triggers. Never let it.
let APP_SHELL = "";
try {
  APP_SHELL = require("../appShell.generated");
} catch {
  APP_SHELL = "";
}

const OG_OPEN = "<!--og-->";
const OG_CLOSE = "<!--/og-->";

const TYPE_LABEL = {
  minor: "Minor Climb",
  major: "Major Climb",
  special: "Special Climb",
};

const MAX_DESCRIPTION = 200;

// Only ever the Firestore auto-id shape. Anything else falls through to the
// plain shell rather than becoming a document path.
const EVENT_PATH = /^\/event\/([A-Za-z0-9_-]{1,64})\/?$/;

/**
 * Escape a value for use inside a double-quoted HTML attribute.
 *
 * Climb titles and descriptions are admin-entered free text. An unescaped
 * quote closes the `content="…"` attribute early and an unescaped `<` injects
 * markup straight into the shell.
 */
function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Trim to a word boundary so previews don't end mid-word. */
function truncate(text, max = MAX_DESCRIPTION) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:\s]+$/, "")}…`;
}

function buildDescription(climb) {
  const parts = [];
  if (TYPE_LABEL[climb.type]) parts.push(TYPE_LABEL[climb.type]);
  if (climb.location) parts.push(climb.location);
  if (climb.elevation) parts.push(`${climb.elevation} MASL`);
  if (climb.dateLabel) parts.push(climb.dateLabel);

  const lead = parts.join(" · ");
  const blurb = String(climb.description ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(blurb ? `${lead}. ${blurb}` : lead);
}

/**
 * Prefer the denormalized public hero, then the first trail photo. Written
 * defensively so it keeps working whichever way the climb doc is shaped —
 * this function serves unauthenticated crawlers and only ever reads the
 * public `climbs` document.
 */
function heroImageFor(climb) {
  return climb.heroImage || climb.trailImages?.[0] || null;
}

/**
 * The replacement for the marked <!--og--> region of the shell: a <title>
 * plus the full OG/Twitter block for one climb.
 */
function makeMetaBlock(climb, url, origin) {
  const title = climb.title
    ? `${climb.title}${climb.dateLabel ? ` — ${climb.dateLabel}` : ""} | MMS Open Climbs 2026`
    : "MMS Open Climbs 2026";
  const description = buildDescription(climb);
  const hero = heroImageFor(climb);
  const image = hero || `${origin}/MMS.png`;
  // A trail photo is a real landscape hero; the fallback is a square logo,
  // which a large-image card would letterbox badly.
  const card = hero ? "summary_large_image" : "summary";

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(url)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="MMS Open Climbs" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta name="twitter:card" content="${card}" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
  ];
  return tags.join("\n    ");
}

/**
 * Swap the marked region of the shell for `metaBlock`.
 *
 * Marker-delimited rather than regex-over-<title> so a shell that doesn't
 * carry the markers fails visibly (unmodified shell, generic card) instead of
 * producing half-replaced duplicate tags.
 */
function buildHtml(shell, metaBlock) {
  const start = shell.indexOf(OG_OPEN);
  const end = shell.indexOf(OG_CLOSE);
  if (start === -1 || end === -1 || end < start) return shell;
  return (
    shell.slice(0, start) + metaBlock + shell.slice(end + OG_CLOSE.length)
  );
}

async function handler(req, res) {
  const shell = APP_SHELL;
  // Never Vary on User-Agent — it destroys CDN cacheability.
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Vary", "Accept-Encoding");

  // Short TTL so a transient Firestore blip isn't pinned in the CDN for an
  // hour. 200 rather than 404 because Messenger renders nothing at all on a
  // 404, and the SPA already handles a missing climb client-side.
  const serveShell = () => {
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).send(shell);
  };

  try {
    if (!shell) return serveShell();

    const match = EVENT_PATH.exec(req.path || "");
    if (!match) return serveShell();

    const snap = await getFirestore("openclimbs")
      .doc(`climbs/${match[1]}`)
      .get();
    if (!snap.exists) return serveShell();

    const origin = `${req.protocol}://${req.get("host")}`;
    const url = `${origin}/event/${match[1]}`;
    const html = buildHtml(shell, makeMetaBlock(snap.data(), url, origin));

    res.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    return res.status(200).send(html);
  } catch (err) {
    logger.error("ogPrerender failed", {
      path: req.path,
      message: err?.message,
    });
    return serveShell();
  }
}

exports.ogPrerender = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    maxInstances: 10,
    concurrency: 80,
    invoker: "public",
  },
  handler,
);

// Exported for unit testing — the interesting logic is pure.
exports.makeMetaBlock = makeMetaBlock;
exports.buildHtml = buildHtml;
exports.escapeAttr = escapeAttr;
exports.truncate = truncate;
exports.buildDescription = buildDescription;
exports.heroImageFor = heroImageFor;
exports.EVENT_PATH = EVENT_PATH;
