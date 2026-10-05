"use strict";

const logger = require("firebase-functions/logger");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { sendEmail } = require("../email/sendEmail");
const { tplWelcome } = require("../email/templates");
const { logFailedRequest } = require("../shared/registrationOps");
const { db, adminAuth } = require("../shared/admin");

// ── Callable: issue the caller's admin claim from their users/ role ─────────
// syncAdminClaim only fires on users/ writes, so an admin promoted before it
// existed has no claim and storage.rules would deny them members' files.
// AuthContext calls this when the profile says admin but the token doesn't.
// The role is read server-side; the caller can't grant themselves anything.
exports.ensureAdminClaim = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  const snap = await db.doc(`users/${uid}`).get();
  const isAdmin = snap.exists && snap.data().role === "admin";
  if (!isAdmin) return { admin: false };
  if (request.auth.token?.admin === true) return { admin: true };
  try {
    const user = await adminAuth.getUser(uid);
    await adminAuth.setCustomUserClaims(uid, { ...(user.customClaims || {}), admin: true });
    logger.info("[ensureAdminClaim] claim issued", { uid });
    return { admin: true };
  } catch (err) {
    throw new HttpsError("internal", err.message);
  }
});

// ── Callable: admin creates a user account and sends welcome email ─────────────
exports.createUser = onCall(
  { secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"] },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
      throw new HttpsError("unauthenticated", "You must be signed in.");

    // Everything below can throw a plain (non-HttpsError) exception — e.g. a
    // transient Firestore/Auth error. onCall silently discards the message of
    // any non-HttpsError it catches, so without this net the client would
    // just see a bare, undiagnosable "internal" error.
    try {
      const callerSnap = await db.doc(`users/${callerUid}`).get();
      if (!callerSnap.exists || callerSnap.data().role !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only admins can create users.",
        );
      }

      const { email, displayName, role = "member" } = request.data;
      if (!email || !displayName) {
        throw new HttpsError(
          "invalid-argument",
          "email and displayName are required.",
        );
      }
      if (!["member", "admin"].includes(role)) {
        throw new HttpsError(
          "invalid-argument",
          'role must be "member" or "admin".',
        );
      }

      let userRecord;
      let isFreshAccount = false;
      try {
        userRecord = await adminAuth.createUser({ email, displayName });
        isFreshAccount = true;
      } catch (err) {
        if (err.code === "auth/email-already-exists") {
          // The Auth account may be a real existing user, or it may be an
          // orphan left behind by a previous invite that failed after the
          // Auth user was created but before the Firestore profile was
          // written. Self-heal the latter case instead of dead-ending.
          let existingUser;
          try {
            existingUser = await adminAuth.getUserByEmail(email);
          } catch (lookupErr) {
            throw new HttpsError("internal", lookupErr.message);
          }
          const existingProfileSnap = await db
            .doc(`users/${existingUser.uid}`)
            .get();
          if (existingProfileSnap.exists) {
            throw new HttpsError(
              "already-exists",
              "An account with this email already exists.",
            );
          }
          userRecord = existingUser;
        } else {
          throw new HttpsError("internal", err.message);
        }
      }

      let setupLink;
      try {
        // Create Firestore user profile
        await db.doc(`users/${userRecord.uid}`).set({
          displayName,
          email,
          role,
          createdAt: FieldValue.serverTimestamp(),
          addedBy: callerUid,
        });

        // Generate password setup link (user sets their own password)
        const appUrl =
          process.env.APP_URL || "https://mms-open-climbs.web.app";
        setupLink = await adminAuth.generatePasswordResetLink(email, {
          url: `${appUrl}/login`,
        });
      } catch (err) {
        if (isFreshAccount) {
          try {
            await adminAuth.deleteUser(userRecord.uid);
          } catch (deleteErr) {
            logger.error("[createUser] Failed to roll back orphaned Auth user", {
              uid: userRecord.uid,
              err: deleteErr.message,
            });
          }
        }
        if (err instanceof HttpsError) throw err;
        throw new HttpsError("internal", err.message);
      }

      let emailSent = true;
      try {
        await sendEmail({
          to: email,
          toName: displayName,
          subject: "Welcome to MMS Open Climbs — Set Up Your Account",
          html: tplWelcome({ displayName, setupLink }),
        });
      } catch (emailErr) {
        emailSent = false;
        logger.error("[createUser] Welcome email failed", {
          email,
          err: emailErr.message,
        });
        await logFailedRequest({
          type: "email",
          source: "createUser",
          message: emailErr.message,
          userId: userRecord.uid,
        });
      }

      logger.info("[createUser] Created user", { email, role, emailSent });
      return { uid: userRecord.uid, emailSent };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const refId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      logger.error("[createUser] Unexpected error", { refId, err: err.message });
      throw new HttpsError(
        "internal",
        `Unexpected error (ref ${refId}): ${err.message || String(err)}`,
      );
    }
  },
);

// ── Helper: verify the caller is a signed-in admin, or throw ──────────────────
async function requireAdmin(callerUid) {
  if (!callerUid)
    throw new HttpsError("unauthenticated", "You must be signed in.");
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can do this.");
  }
  return callerSnap.data();
}

// ── Callable: admin corrects a user's name and/or email ───────────────────────
exports.updateUserProfile = onCall(async (request) => {
  try {
    await requireAdmin(request.auth?.uid);

    const { uid, email, displayName } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
    if (!email && !displayName) {
      throw new HttpsError(
        "invalid-argument",
        "Provide an email and/or displayName to update.",
      );
    }

    const authUpdate = {};
    if (email) authUpdate.email = email;
    if (displayName) authUpdate.displayName = displayName;
    try {
      await adminAuth.updateUser(uid, authUpdate);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "Another account already uses this email address.",
        );
      }
      if (err.code === "auth/user-not-found") {
        throw new HttpsError(
          "not-found",
          "This user's login account no longer exists.",
        );
      }
      throw new HttpsError("internal", err.message);
    }

    const firestoreUpdate = { updatedAt: FieldValue.serverTimestamp() };
    if (email) firestoreUpdate.email = email;
    if (displayName) firestoreUpdate.displayName = displayName;
    await db.doc(`users/${uid}`).update(firestoreUpdate);

    logger.info("[updateUserProfile] Updated", { uid, email: !!email, displayName: !!displayName });
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message);
  }
});

// ── Helper: remove a deleted account's personal data ────────────────────────
// Registrations stay — they are the club's payment and attendance record —
// but the health and contact details on them, the member's notifications and
// every file they uploaded (medical certificates, IDs, receipts) go with the
// account. Best effort: a failure here is logged, never surfaced, since the
// account itself is already gone.
const MEMBER_UPLOAD_PREFIXES = [
  "payment-proofs",
  "registration-form-uploads",
  "medical-cert-uploads",
  "permit-uploads",
  "waiver-doc-uploads",
];

async function purgeUserPersonalData(uid) {
  try {
    const regs = await db.collection("registrations").where("userId", "==", uid).get();
    await Promise.all(
      regs.docs.map((d) =>
        d.ref.update({
          medicalConditions: FieldValue.delete(),
          emergencyContact: FieldValue.delete(),
          dateOfBirth: FieldValue.delete(),
          address: FieldValue.delete(),
          mobile: FieldValue.delete(),
          accountDeletedAt: FieldValue.serverTimestamp(),
        }),
      ),
    );

    const notifs = await db.collection("notifications").where("userId", "==", uid).get();
    await Promise.all(notifs.docs.map((d) => d.ref.delete()));

    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();
    const climbIds = [...new Set(regs.docs.map((d) => d.data().climbId).filter(Boolean))];
    await Promise.all(
      climbIds.flatMap((climbId) =>
        MEMBER_UPLOAD_PREFIXES.map((prefix) =>
          bucket.deleteFiles({ prefix: `${prefix}/${climbId}/${uid}/` }),
        ),
      ),
    );
  } catch (err) {
    logger.error("[deleteUserAccount] personal data purge incomplete", {
      uid,
      err: err.message,
    });
  }
}

// ── Callable: admin deletes a user's login account and profile ────────────────
exports.deleteUserAccount = onCall(async (request) => {
  try {
    const callerUid = request.auth?.uid;
    await requireAdmin(callerUid);

    const { uid } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
    if (uid === callerUid) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot delete your own account.",
      );
    }

    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      // If the Auth record is already gone, still clean up the Firestore
      // profile below instead of dead-ending on a stale account.
      if (err.code !== "auth/user-not-found") {
        throw new HttpsError("internal", err.message);
      }
    }
    await db.doc(`users/${uid}`).delete();
    await purgeUserPersonalData(uid);

    logger.info("[deleteUserAccount] Deleted", { uid });
    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message);
  }
});

Object.assign(module.exports, { requireAdmin });
