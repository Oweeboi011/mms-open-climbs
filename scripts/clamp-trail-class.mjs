/**
 * One-time migration for climbs/{id}.trailClass.
 *
 * The trail class scale changed from the old 1-9 Philippine mountaineering
 * scale to a 1-6 YDS-style technical difficulty scale (see
 * src/utils/trailClass.js). Any climb previously rated 7, 8, or 9 no longer
 * has a valid class under the new scale — clamp it down to 6, the new
 * scale's hardest class.
 *
 * Run from repo root (uses gcloud Application Default Credentials):
 *   node scripts/clamp-trail-class.mjs
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "mms-open-climbs";

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

console.log(`Clamping legacy trailClass values on project: ${projectId}`);

const climbsSnap = await db.collection("climbs").get();

let updated = 0;
for (const climbDoc of climbsSnap.docs) {
  const climb = climbDoc.data();
  const n = parseInt(climb.trailClass, 10);
  if (n > 6) {
    await climbDoc.ref.update({ trailClass: "6" });
    updated++;
    console.log(`  ${climb.title || climbDoc.id}: ${climb.trailClass} -> 6`);
  }
}

console.log(`Done. Updated ${updated} climb document(s).`);
