"use strict";

const logger = require("firebase-functions/logger");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logFailedRequest } = require("../shared/registrationOps");
const { adminAuth } = require("../shared/admin");

// ── Mirror the admin role onto an auth custom claim ──────────────────────────
//
// Storage rules cannot read this project's Firestore: the app uses a named
// database ("openclimbs") and storage's firestore.get() only reaches the
// default one. With no role lookup available, those rules fell back to "any
// signed-in user", which left every member's medical certificate, payment
// receipt, permit and signed waiver readable by anyone who made an account.
//
// A custom claim is the one piece of identity storage.rules *can* read, so
// the role is mirrored here and `request.auth.token.admin` gates those files.
// users/{uid}.role stays the source of truth; this only follows it.
exports.syncAdminClaim = onDocumentWritten(
  // `database` is required: this project has no (default) Firestore
  // database, so a trigger that omits it fails the whole deploy.
  { document: "users/{uid}", database: "openclimbs" },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const wasAdmin = before?.role === "admin";
    const isAdmin = after?.role === "admin";
    if (wasAdmin === isAdmin) return;

    try {
      const user = await adminAuth.getUser(uid);
      const claims = { ...(user.customClaims || {}) };
      if (isAdmin) {
        claims.admin = true;
      } else {
        delete claims.admin;
      }
      await adminAuth.setCustomUserClaims(uid, claims);

      // A token already in the wild keeps its old claims for up to an hour.
      // Granting can wait for the client to refresh, but a revoked admin must
      // not keep reading members' documents for the rest of that hour, so cut
      // the session immediately.
      if (!isAdmin) await adminAuth.revokeRefreshTokens(uid);

      logger.info("[syncAdminClaim] claim updated", { uid, admin: isAdmin });
    } catch (err) {
      // A users/ doc can exist with no auth user behind it (an admin-created
      // placeholder, or a deleted account). That is not an error worth retrying.
      if (err.code === "auth/user-not-found") {
        logger.info("[syncAdminClaim] no auth user, nothing to sync", { uid });
        return;
      }
      logger.error("[syncAdminClaim] failed", { uid, err: err.message });
      await logFailedRequest({
        type: "firestore",
        source: "syncAdminClaim",
        message: err.message,
        userId: uid,
      });
    }
  },
);
