/**
 * One-time backfill for climbs/{id}.registeredUserIds and .docsCompleteCount.
 *
 * These fields are normally kept in sync by Cloud Function triggers
 * (onRegistrationCreated/Updated/Deleted, onClimbUpdated) added when
 * climbPrivate access control and the docs-submitted progress badge shipped.
 * Triggers only fire on future writes, so climbs with registrants who
 * registered before this change need a one-time recompute here.
 *
 * Run from repo root (uses gcloud Application Default Credentials):
 *   node scripts/backfill-climb-denorm.mjs
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "mms-open-climbs";

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

// Mirrors functions/src/requiredDocTypes.js — kept as its own copy since
// this script runs standalone via node, outside either deployable package.
const REQUIRED_DOC_TYPES = [
  { requiresField: "requiresRegistrationForm", uploadField: "registrationFormUpload" },
  { requiresField: "requiresMedicalCert", uploadField: "medicalCertUpload" },
  { requiresField: "requiresPermit", uploadField: "permitUpload" },
  { requiresField: "requiresWaiverDoc", uploadField: "waiverDocUpload" },
];

function regDocsComplete(climb, reg) {
  return REQUIRED_DOC_TYPES.every(
    (docType) => !climb?.[docType.requiresField] || !!reg?.[docType.uploadField],
  );
}

console.log(`Backfilling climb denormalized fields on project: ${projectId}`);

const [climbsSnap, regsSnap] = await Promise.all([
  db.collection("climbs").get(),
  db.collection("registrations").get(),
]);

const regsByClimb = new Map();
for (const doc of regsSnap.docs) {
  const reg = doc.data();
  if (!reg.climbId) continue;
  if (!regsByClimb.has(reg.climbId)) regsByClimb.set(reg.climbId, []);
  regsByClimb.get(reg.climbId).push(reg);
}

let updated = 0;
for (const climbDoc of climbsSnap.docs) {
  const climb = climbDoc.data();
  const regs = regsByClimb.get(climbDoc.id) || [];
  const activeRegs = regs.filter(
    (r) => r.userId && ["pending", "confirmed"].includes(r.status),
  );

  const registeredUserIds = [...new Set(activeRegs.map((r) => r.userId))];
  const docsCompleteCount = activeRegs.filter((r) =>
    regDocsComplete(climb, r),
  ).length;

  await climbDoc.ref.update({ registeredUserIds, docsCompleteCount });
  updated++;
  console.log(
    `  ${climb.title || climbDoc.id}: ${registeredUserIds.length} registered, ${docsCompleteCount} docs-complete`,
  );
}

console.log(`Done. Updated ${updated} climb document(s).`);
