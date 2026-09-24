/**
 * Recompute each climb's registrant roster and docsCompleteCount, and move
 * private fields off the public climb doc.
 *
 * - climbInternal/{id}.registeredUserIds — the active registrants' uids
 *   (checked by the climbPrivate and feedback rules).
 * - climbInternal/{id}.officerEmails — officer emails, index-aligned with
 *   climbs/{id}.officers.
 * - climbs/{id}.registeredUserIds and climbs/{id}.officers[].email are
 *   removed: climb docs are publicly readable.
 *
 * RUN THIS (with --apply) BEFORE deploying the firestore.rules that read the
 * roster from climbInternal, or registrants lose access to their climb's
 * briefing and cannot leave feedback until they next change status.
 *
 * These fields are normally kept in sync by Cloud Function triggers
 * (onRegistrationCreated/Updated/Deleted, onClimbUpdated) added when
 * climbPrivate access control and the docs-submitted progress badge shipped.
 * Triggers only fire on future writes, so climbs with registrants who
 * registered before this change need a one-time recompute here.
 *
 * Run from repo root (uses gcloud Application Default Credentials):
 *   node scripts/backfill-climb-denorm.mjs           # dry run
 *   node scripts/backfill-climb-denorm.mjs --apply   # writes
 *
 * Safe to re-run.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

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

console.log(
  `Backfilling climb denormalized fields on project: ${projectId}` +
    (APPLY ? "" : "  (dry run — pass --apply to write)"),
);

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

  const officers = climb.officers || [];
  const officerEmails = officers.map((o) => ({
    name: o.name || "",
    email: o.email || "",
    userId: o.userId || "",
  }));
  const publicOfficers = officers.map((o) => {
    const copy = { ...o };
    delete copy.email;
    return copy;
  });

  if (APPLY) {
    // climbInternal first: once the public copies are gone, it is the only one.
    const internalRef = db.doc(`climbInternal/${climbDoc.id}`);
    const existing = await internalRef.get();
    const keepEmails =
      existing.exists &&
      (existing.data().officerEmails || []).some((o) => o.email) &&
      !officerEmails.some((o) => o.email);
    await internalRef.set(
      {
        registeredUserIds,
        // Don't clobber emails already migrated by an earlier run.
        ...(keepEmails ? {} : { officerEmails }),
      },
      { merge: true },
    );
    await climbDoc.ref.update({
      docsCompleteCount,
      officers: publicOfficers,
      registeredUserIds: FieldValue.delete(),
    });
  }
  updated++;
  console.log(
    `  ${climb.title || climbDoc.id}: ${registeredUserIds.length} registered, ${docsCompleteCount} docs-complete, ` +
      `${officerEmails.filter((o) => o.email).length} officer email(s) moved`,
  );
}

console.log(
  `Done. ${APPLY ? "Updated" : "Would update"} ${updated} climb document(s).`,
);
