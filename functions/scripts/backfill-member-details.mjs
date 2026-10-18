/**
 * Seed each member's saved details (memberDetails/{uid}) from the
 * registrations they already submitted, so their next registration form
 * starts filled in. Each field takes its most recent non-blank answer.
 *
 * New registrations keep the saved details current through the
 * onRegistrationDetailsWritten trigger; this only covers what came before it.
 *
 * Skips members who already have saved details (they may have edited them
 * on My Details) and accounts that no longer exist.
 *
 * Run from repo root (uses gcloud Application Default Credentials):
 *   node functions/scripts/backfill-member-details.mjs           # dry run
 *   node functions/scripts/backfill-member-details.mjs --apply   # writes
 *
 * Safe to re-run.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const APPLY = process.argv.includes("--apply");
const projectId = "mms-open-climbs";

if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

const { latestDetails } = createRequire(import.meta.url)("../src/shared/memberDetails.js");

console.log(
  `Backfilling member details on project: ${projectId}` +
    (APPLY ? "" : "  (dry run — pass --apply to write)"),
);

const [regsSnap, usersSnap, savedSnap] = await Promise.all([
  db.collection("registrations").get(),
  db.collection("users").get(),
  db.collection("memberDetails").get(),
]);
const userIds = new Set(usersSnap.docs.map((d) => d.id));
const saved = new Set(savedSnap.docs.map((d) => d.id));

const regsByUser = new Map();
regsSnap.docs.forEach((d) => {
  const reg = d.data();
  if (!reg.userId) return;
  if (!regsByUser.has(reg.userId)) regsByUser.set(reg.userId, []);
  regsByUser.get(reg.userId).push(reg);
});

let written = 0;
let skipped = 0;
for (const [uid, regs] of regsByUser) {
  if (!userIds.has(uid) || saved.has(uid)) {
    skipped++;
    continue;
  }
  const details = latestDetails(regs);
  if (!details) {
    skipped++;
    continue;
  }
  const fields = Object.keys(details).filter((k) => k !== "sourceClimbTitle");
  console.log(`  ${uid}: ${fields.join(", ")}  (latest: ${details.sourceClimbTitle || "—"})`);
  if (APPLY) {
    await db.doc(`memberDetails/${uid}`).set({ ...details, updatedAt: FieldValue.serverTimestamp() });
  }
  written++;
}

console.log(
  `${APPLY ? "Wrote" : "Would write"} ${written} member${written === 1 ? "" : "s"}; skipped ${skipped}.`,
);
