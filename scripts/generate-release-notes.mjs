/**
 * Generate a release note from git history and write it to Firestore.
 * Signs in via the Firebase Auth REST API using admin credentials (same
 * pattern as seed-climbs.mjs). Commits are grouped by conventional-commit
 * prefix (feat/fix/perf/refactor); docs/style/test/chore/ci commits and
 * anything mentioning "coverage" are treated as noise and dropped.
 *
 * Usage:
 *   node scripts/generate-release-notes.mjs <adminEmail> [options]
 *   npm run release-notes -- <adminEmail> [options]
 *   (password is prompted securely — not visible or stored in shell history)
 *
 * Options:
 *   --since <ref|date>   Start of the range (git ref, or YYYY-MM-DD). Defaults
 *                        to the commit recorded in .release-notes-state.json,
 *                        or 14 days ago if this is the first run.
 *   --title <text>       Override the auto-generated title.
 *   --publish            Write status: "published" (sets publishedAt) instead
 *                        of the default "draft". Published notes show up in
 *                        the member popup/history page immediately.
 *   --yes                Skip the preview confirmation prompt.
 *
 * The account must have role: 'admin' in Firestore (i.e. already set up).
 * No Firebase CLI or gcloud installation required.
 */
import { createInterface } from "readline";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const PROJECT_ID = "mms-open-climbs";
const DATABASE = "openclimbs";
const FIREBASE_API_KEY = "AIzaSyDLQFuxfJz74VtO9P1nvl6wYNzLWCF1uoU"; // public web API key

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, ".release-notes-state.json");

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && !isFlagValue(args, a));
const publish = args.includes("--publish");
const skipConfirm = args.includes("--yes");
const since = flagValue("--since");
const titleOverride = flagValue("--title");

function flagValue(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}
function isFlagValue(all, token) {
  const i = all.indexOf(token);
  return i > 0 && all[i - 1].startsWith("--") && all[i - 1] !== "--publish" && all[i - 1] !== "--yes";
}

if (!email) {
  console.error(
    "Usage: node scripts/generate-release-notes.mjs <adminEmail> [--since <ref|date>] [--title <text>] [--publish] [--yes]",
  );
  process.exit(1);
}

// ── Determine commit range ───────────────────────────────────────────────
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

const state = loadState();
const rangeStart = since || state.lastCommit || "14 days ago";
const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(rangeStart) || rangeStart === "14 days ago";
const revRange = isDateLike ? `--since="${rangeStart}"` : `${rangeStart}..HEAD`;

let log;
try {
  const gitArgs = isDateLike
    ? ["log", `--since=${rangeStart}`, "--no-merges", "--pretty=format:%H%x1f%s"]
    : ["log", `${rangeStart}..HEAD`, "--no-merges", "--pretty=format:%H%x1f%s"];
  log = execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
} catch (err) {
  console.error("git log failed:", err.message);
  process.exit(1);
}

if (!log) {
  console.log(`No commits found since ${rangeStart}. Nothing to generate.`);
  process.exit(0);
}

const commits = log.split("\n").map((line) => {
  const [hash, subject] = line.split("\x1f");
  return { hash, subject };
});

// ── Group by conventional-commit type ────────────────────────────────────
const TYPE_LABELS = {
  feat: "New Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Improvements",
};
const NOISE_TYPES = new Set(["docs", "style", "test", "chore", "ci", "build", "revert"]);

const groups = { "New Features": [], Fixes: [], Performance: [], Improvements: [] };
let dropped = 0;

for (const { subject } of commits) {
  if (/coverage/i.test(subject)) {
    dropped++;
    continue;
  }
  const match = subject.match(/^(\w+)(\([^)]*\))?:\s*(.+)$/);
  if (match) {
    const [, type, , rest] = match;
    if (NOISE_TYPES.has(type)) {
      dropped++;
      continue;
    }
    const label = TYPE_LABELS[type];
    if (label) {
      groups[label].push(capitalize(rest));
      continue;
    }
  }
  // Non-conventional subject — keep as a general improvement line.
  groups["Improvements"].push(capitalize(subject));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const sections = Object.entries(groups).filter(([, items]) => items.length > 0);

if (sections.length === 0) {
  console.log(
    `Found ${commits.length} commit(s) since ${rangeStart}, but all were filtered out as noise (${dropped} dropped). Nothing to generate.`,
  );
  process.exit(0);
}

const body = sections
  .map(([label, items]) => `${label}\n${items.map((i) => `- ${i}`).join("\n")}`)
  .join("\n\n");

const today = new Date().toLocaleDateString("en-PH", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const title = titleOverride || `What's New — ${today}`;

// ── Preview ───────────────────────────────────────────────────────────────
console.log(`\nRange: ${rangeStart}..HEAD  (${commits.length} commit(s), ${dropped} dropped as noise)`);
console.log(`Status: ${publish ? "published" : "draft"}\n`);
console.log(`Title: ${title}\n`);
console.log(body);
console.log();

async function confirm(prompt) {
  if (skipConfirm) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(prompt, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const proceed = await confirm("Write this release note to Firestore? [y/N] ");
if (!proceed) {
  console.log("Aborted.");
  process.exit(0);
}

// ── Auth: sign in with email/password via Firebase Auth REST API ─────────
async function promptPassword(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function signIn() {
  const password = await promptPassword(`Password for ${email}: `);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    console.error("Sign-in failed:", data.error?.message || JSON.stringify(data));
    process.exit(1);
  }
  console.log(`Signed in as ${email}\n`);
  return data;
}

const { idToken, localId } = await signIn();

// ── Write to Firestore ───────────────────────────────────────────────────
function str(v) {
  return { stringValue: v };
}
function ts(v) {
  return { timestampValue: v };
}

const nowIso = new Date().toISOString();
const fields = {
  title: str(title),
  body: str(body),
  status: str(publish ? "published" : "draft"),
  createdAt: ts(nowIso),
  updatedAt: ts(nowIso),
  createdBy: str(localId),
};
if (publish) {
  fields.publishedAt = ts(nowIso);
}

const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents/releaseNotes`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  },
);

if (!res.ok) {
  console.error(`Write failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const doc = await res.json();
const id = doc.name.split("/").pop();
console.log(`✓ Created releaseNotes/${id} (${publish ? "published" : "draft"})`);

const headCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
writeFileSync(STATE_FILE, JSON.stringify({ lastCommit: headCommit, lastRun: nowIso }, null, 2));
console.log(`Saved checkpoint at ${headCommit.slice(0, 7)} for next run.`);
