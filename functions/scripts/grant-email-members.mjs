/**
 * Grant or revoke "can email every member" (users/{uid}.canEmailMembers).
 *
 * Deliberately outside the app: Firestore rules refuse this field from every
 * client, because any admin can create admins and could otherwise grant it
 * to an account they control. Only someone with Google Cloud access to the
 * project (the owner) can run this.
 *
 * The email is resolved through Firebase Auth, where emails are unique — the
 * users/ profile's email field is editable by admins and is not trusted.
 *
 * Run from repo root (gcloud Application Default Credentials):
 *   node functions/scripts/grant-email-members.mjs <email>            # grant
 *   node functions/scripts/grant-email-members.mjs <email> --revoke   # revoke
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!email || email.startsWith("--")) {
  console.error("Usage: node functions/scripts/grant-email-members.mjs <email> [--revoke]");
  process.exit(1);
}

if (!getApps().length) initializeApp({ projectId: "mms-open-climbs" });
const db = getFirestore();
db.settings({ databaseId: "openclimbs" });

let account;
try {
  account = await getAuth().getUserByEmail(email);
} catch {
  console.error(`No sign-in account with email ${email}.`);
  process.exit(1);
}
const ref = db.doc(`users/${account.uid}`);
const profile = (await ref.get()).data();
if (profile?.role !== "admin") {
  console.error(`${email} (${account.uid}) is not an admin; make them one first.`);
  process.exit(1);
}
await ref.update({ canEmailMembers: !revoke });
console.log(`${revoke ? "Revoked" : "Granted"} canEmailMembers for ${account.displayName || email} (${account.uid}).`);
