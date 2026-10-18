"use strict";

// A member's saved details (memberDetails/{uid}): what they last gave on a
// registration, kept so the next registration form starts filled in. Field
// names match the registration form, so the client copies them straight in.

const TEXT_FIELDS = ["mobile", "dateOfBirth", "address", "medicalConditions", "experienceLevel", "memberType"];
const CONTACT_FIELDS = { ecName: "name", ecMobile: "mobile", ecRelationship: "relationship" };
const DETAIL_FIELDS = [...TEXT_FIELDS, ...Object.keys(CONTACT_FIELDS)];

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// The non-blank details on one registration. Blank answers are left out, so
// a half-filled form never erases a good answer saved earlier.
function detailsFromRegistration(reg) {
  const details = {};
  if (!reg || reg.accountDeletedAt) return details;
  TEXT_FIELDS.forEach((field) => {
    const value = clean(reg[field]);
    if (value) details[field] = value;
  });
  Object.entries(CONTACT_FIELDS).forEach(([field, key]) => {
    const value = clean(reg.emergencyContact?.[key]);
    if (value) details[field] = value;
  });
  return details;
}

function sameDetails(a, b) {
  return DETAIL_FIELDS.every((field) => (a[field] || "") === (b[field] || ""));
}

const millis = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0);
const regTime = (reg) => Math.max(millis(reg.updatedAt), millis(reg.createdAt));

// Every registration of one member folded oldest → newest, so each field ends
// up with its most recent non-blank answer. Returns null when there's nothing.
function latestDetails(regs) {
  const ordered = [...regs].sort((a, b) => regTime(a) - regTime(b));
  let details = {};
  let source = null;
  ordered.forEach((reg) => {
    const found = detailsFromRegistration(reg);
    if (Object.keys(found).length === 0) return;
    details = { ...details, ...found };
    source = reg;
  });
  if (!source) return null;
  return { ...details, sourceClimbTitle: source.climbTitle || "" };
}

module.exports = { detailsFromRegistration, sameDetails, latestDetails };
