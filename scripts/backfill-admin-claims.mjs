/**
 * One-time backfill: give every existing admin the `admin` auth custom claim.
 *
 * Storage rules cannot read this project's Firestore — the app uses a named
 * database ("openclimbs") and storage's firestore.get() only reaches the
 * default one. So members' payment proofs and medical certificates are gated
 * on `request.auth.token.admin` instead, which `syncAdminClaim` keeps in step
 * with users/{uid}.role from now on.
 *
 * That trigger only fires on future writes, so admins who were already admins
 * have no claim yet. RUN THIS BEFORE DEPLOYING THE TIGHTENED storage.rules,
 * or every existing admin loses access to payment proofs the moment the rules
 * go live.
 *
 * Usage:
 *   # Point at a service account with Firebase Admin rights:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/backfill-admin-claims.mjs           # dry run, lists changes
 *   node scripts/backfill-admin-claims.mjs --apply   # writes the claims
 *
 * Safe to re-run: users already holding the correct claim are skipped.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault() });
const db = getFirestore("openclimbs");
const auth = getAuth();

const snap = await db.collection("users").get();
const admins = snap.docs.filter((d) => d.data().role === "admin");

console.log(
  `${snap.size} user docs, ${admins.length} with role "admin".` +
    (APPLY ? "" : "  (dry run — pass --apply to write)"),
);

let granted = 0;
let alreadySet = 0;
let missingAuth = 0;
let failed = 0;

for (const doc of admins) {
  const uid = doc.id;
  const email = doc.data().email || "(no email)";
  try {
    const user = await auth.getUser(uid);
    if (user.customClaims?.admin === true) {
      alreadySet++;
      continue;
    }
    if (APPLY) {
      await auth.setCustomUserClaims(uid, {
        ...(user.customClaims || {}),
        admin: true,
      });
    }
    granted++;
    console.log(`  ${APPLY ? "granted" : "would grant"}  ${email}  (${uid})`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // A users/ doc with no auth account behind it — an admin-created
      // placeholder, or an account deleted without cleaning up the doc.
      missingAuth++;
      console.log(`  skipped (no auth account)  ${email}  (${uid})`);
      continue;
    }
    failed++;
    console.error(`  FAILED  ${email}  (${uid}): ${err.message}`);
  }
}

console.log(
  `\nDone. ${granted} ${APPLY ? "granted" : "to grant"}, ` +
    `${alreadySet} already set, ${missingAuth} without an auth account, ` +
    `${failed} failed.`,
);

if (APPLY && granted > 0) {
  console.log(
    "\nClaims reach a client only when its ID token refreshes. AuthContext " +
      "forces that on load, but anyone with the app already open should " +
      "reload once.",
  );
}

if (failed > 0) process.exitCode = 1;
