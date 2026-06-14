/**
 * Deletes all pageViews documents where path starts with /admin.
 * Run from functions folder:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
 *   node purge-admin-pageviews.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const BATCH_SIZE = 400;
let totalDeleted = 0;

console.log(`Deleting admin pageViews from project: ${projectId}`);

while (true) {
  const snap = await db
    .collection("pageViews")
    .where("path", ">=", "/admin")
    .where("path", "<", "/admio")
    .limit(BATCH_SIZE)
    .get();

  const adminDocs = snap.docs.filter((d) =>
    (d.data().path || "").startsWith("/admin"),
  );

  if (adminDocs.length === 0) break;

  const batch = db.batch();
  adminDocs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  totalDeleted += adminDocs.length;
  console.log(`Deleted ${totalDeleted} documents so far...`);

  if (snap.docs.length < BATCH_SIZE) break;
}

console.log(`Done. Total admin pageViews deleted: ${totalDeleted}`);
