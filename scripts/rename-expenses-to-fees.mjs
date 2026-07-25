/**
 * One-time migration: renames the `expenses` field on every climb document to
 * `fees`, and sets `isGuestFee: true` on whichever fee entry has a label
 * containing "guest" (case-insensitive) — replacing label-text matching with
 * an explicit flag going forward.
 *
 * Run from repo root:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
 *   node scripts/rename-expenses-to-fees.mjs          # dry run — logs what would change
 *   node scripts/rename-expenses-to-fees.mjs --apply   # actually writes the updates
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS is not set.");
  process.exit(1);
}

const envVars = readEnvFile(resolve(__dirname, "../.env"));
const projectId = envVars.VITE_FIREBASE_PROJECT_ID || "mms-open-climbs";

if (!getApps().length) {
  initializeApp({ credential: cert(credPath), projectId });
}

const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

const apply = process.argv.includes("--apply");
console.log(
  `Project: ${projectId} — ${apply ? "APPLY mode (will write)" : "DRY RUN (no writes)"}`,
);

const snap = await db.collection("climbs").get();
console.log(`Found ${snap.docs.length} climb document(s).`);

let toUpdate = 0;
const batchSize = 400;
let batch = db.batch();
let opsInBatch = 0;

for (const doc of snap.docs) {
  const data = doc.data();

  if (Array.isArray(data.fees) && !Array.isArray(data.expenses)) {
    continue; // already migrated
  }

  const source = Array.isArray(data.expenses)
    ? data.expenses
    : Array.isArray(data.fees)
      ? data.fees
      : [];

  const fees = source.map((f) => {
    const isGuest = /guest/i.test(f.label || "");
    if (!isGuest || f.isGuestFee) return f;
    return { ...f, isGuestFee: true };
  });

  toUpdate++;
  const guestCount = fees.filter((f) => f.isGuestFee).length;
  console.log(
    `- ${data.title || doc.id}: expenses -> fees (${fees.length} items, ${guestCount} flagged isGuestFee)`,
  );

  if (apply) {
    batch.update(doc.ref, { fees, expenses: FieldValue.delete() });
    opsInBatch++;
    if (opsInBatch >= batchSize) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }
}

if (apply && opsInBatch > 0) {
  await batch.commit();
}

console.log(
  `\n${apply ? "Updated" : "Would update"} ${toUpdate} of ${snap.docs.length} climb document(s).`,
);
if (!apply && toUpdate > 0) {
  console.log("Re-run with --apply to write these changes.");
}
