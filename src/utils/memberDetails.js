// Saved-details fields, named as on the registration form so they copy
// straight across (mirrors functions/src/shared/memberDetails.js).
export const MEMBER_DETAIL_FIELDS = [
  "mobile",
  "dateOfBirth",
  "address",
  "medicalConditions",
  "experienceLevel",
  "memberType",
  "ecName",
  "ecMobile",
  "ecRelationship",
];

// The saved answers worth filling in: known fields with a non-blank value.
export function detailsToFormFields(details) {
  const fields = {};
  MEMBER_DETAIL_FIELDS.forEach((field) => {
    const value = details?.[field];
    if (typeof value === "string" && value.trim()) fields[field] = value;
  });
  return fields;
}

// "your last climb (Pulag)" or "My Details" — where the filled-in answers
// came from, for the note above the form.
export function describeDetailsSource(details) {
  return details?.sourceClimbTitle ? `your last climb (${details.sourceClimbTitle})` : "My Details";
}
