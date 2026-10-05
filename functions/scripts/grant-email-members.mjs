/**
 * Grant or revoke "can email every member" (users/{uid}.canEmailMembers).
 *
 * Deliberately outside the app: Firestore rules refuse this field from every
 * client, because any admin can create admins and could otherwise grant it
 * to an account they control. Only someone with Google Cloud access to the
 * project (the owner) can run this.
 *
 * Run from repo root (gcloud Application Default Credentials):
 *   node functions/scripts/grant-email-members.mjs <email>            # grant
 *   node functions/scripts/grant-email-members.mjs <email> --revoke   # revoke
 */

import { initializeApp, getApps } from "firebase-admin/app";
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

const snap = await db.collection("users").where("email", "==", email).get();
if (snap.empty) {
  console.error(`No user with email ${email}.`);
  process.exit(1);
}
const [doc] = snap.docs;
if (doc.data().role !== "admin") {
  console.error(`${email} is not an admin; make them one first.`);
  process.exit(1);
}
await doc.ref.update({ canEmailMembers: !revoke });
console.log(`${revoke ? "Revoked" : "Granted"} canEmailMembers for ${email} (${doc.id}).`);
