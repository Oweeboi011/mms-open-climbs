/**
 * Grant or revoke "can email every member" (users/{uid}.canEmailMembers).
 *
 * Deliberately outside the app: Firestore rules refuse this field from every
 * client, because any admin can create admins and could otherwise grant it
 * to an account they control. Only someone with Google Cloud access to the
 * project (the owner) can run this.
 *
 * The account is resolved through Firebase Auth (by uid, or by email, which
 * Auth keeps unique) — the users/ profile's email field is editable by admins
 * and is not trusted. Demoting an admin drops the grant (syncAdminClaim).
 *
 * Run from repo root (gcloud Application Default Credentials):
 *   node functions/scripts/grant-email-members.mjs <uid|email>            # grant
 *   node functions/scripts/grant-email-members.mjs <uid|email> --revoke   # revoke
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const who = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!who || who.startsWith("--")) {
  console.error("Usage: node functions/scripts/grant-email-members.mjs <uid|email> [--revoke]");
  process.exit(1);
}

if (!getApps().length) initializeApp({ projectId: "mms-open-climbs" });
const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

let account;
try {
  account = who.includes("@") ? await getAuth().getUserByEmail(who) : await getAuth().getUser(who);
} catch {
  console.error(`No sign-in account for ${who}.`);
  process.exit(1);
}
const label = `${account.displayName || account.email} (${account.uid})`;
const ref = db.doc(`users/${account.uid}`);
const profile = (await ref.get()).data();
// Revoking works on anyone; granting only on a current admin.
if (!revoke && profile?.role !== "admin") {
  console.error(`${label} is not an admin; make them one first.`);
  process.exit(1);
}
if (revoke && !profile) {
  console.log(`${label} has no profile; nothing to revoke.`);
  process.exit(0);
}
await ref.update({ canEmailMembers: revoke ? FieldValue.delete() : true });
console.log(`${revoke ? "Revoked" : "Granted"} canEmailMembers for ${label}.`);
