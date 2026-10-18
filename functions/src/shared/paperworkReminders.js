"use strict";

const { REQUIRED_DOC_TYPES } = require("../requiredDocTypes");
const { createNotification } = require("./registrationOps");
const { db } = require("./admin");

const waiverReminderId = (regId) => `waiver_${regId}`;

// Bell reminders for paperwork a registrant still owes: each required
// document not yet uploaded, and the waiver when it isn't signed (someone an
// officer added through Add Participant signs it themselves, on My Climbs).
// Deterministic ids, so re-running re-opens one row instead of piling up.
async function remindOutstandingPaperwork(reg, regId, climb, climbTitle) {
  if (!reg.userId) return;
  for (const docType of REQUIRED_DOC_TYPES) {
    if (!climb[docType.requiresField] || reg[docType.uploadField]) continue;
    await createNotification({
      userId: reg.userId,
      type: "document_reminder",
      title: `${docType.sentenceLabel} still needed`,
      message: `Please upload your ${docType.label.toLowerCase()} for ${climbTitle}.`,
      link: "/my-registrations",
      id: `${docType.notificationPrefix}_${regId}`,
    });
  }
  if (!reg.waiverSigned) {
    await createNotification({
      userId: reg.userId,
      type: "waiver_reminder",
      title: "Waiver not signed yet",
      message: `Please read and sign the waiver for ${climbTitle}: tap Sign Waiver on its card in My Climbs.`,
      link: "/my-registrations",
      id: waiverReminderId(regId),
    });
  }
}

// A document uploaded or the waiver signed → mark its reminder read.
async function clearPaperworkReminders(before, after, regId) {
  const done = REQUIRED_DOC_TYPES.filter(
    (docType) => !before[docType.uploadField] && after[docType.uploadField],
  ).map((docType) => `${docType.notificationPrefix}_${regId}`);
  if (!before.waiverSigned && after.waiverSigned) done.push(waiverReminderId(regId));
  for (const id of done) {
    await db.collection("notifications").doc(id).set({ read: true }, { merge: true }).catch(() => {});
  }
}

module.exports = { remindOutstandingPaperwork, clearPaperworkReminders };
