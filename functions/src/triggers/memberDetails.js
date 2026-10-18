"use strict";

const logger = require("firebase-functions/logger");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../shared/admin");
const { detailsFromRegistration, sameDetails } = require("../shared/memberDetails");

// ── Trigger: registration details given or edited → member's saved details ───
// Runs for self-registration, Update Details on My Climbs and officer edits
// alike. Payment and status changes leave the details alone, so they write
// nothing. Only non-blank answers are copied, merged over what's saved.
exports.onRegistrationDetailsWritten = onDocumentWritten(
  { document: "registrations/{regId}", database: "openclimbs" },
  async (event) => {
    const after = event.data?.after?.data?.();
    if (!after?.userId || after.accountDeletedAt) return;
    const details = detailsFromRegistration(after);
    if (Object.keys(details).length === 0) return;
    const before = event.data?.before?.data?.();
    if (before && sameDetails(detailsFromRegistration(before), details)) return;

    try {
      await db.doc(`memberDetails/${after.userId}`).set(
        { ...details, sourceClimbTitle: after.climbTitle || "", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      logger.error("[onRegistrationDetailsWritten] save failed", {
        regId: event.params.regId,
        err: err.message,
      });
    }
  },
);
