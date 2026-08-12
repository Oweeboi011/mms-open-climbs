/* eslint-disable max-len */
"use strict";

// Cloud Functions mirror of src/data/requiredDocTypes.js. Kept as a
// separate copy since functions/ is a separately-deployed package and
// can't reach into src/. Only the fields the backend actually needs are
// included here.
const REQUIRED_DOC_TYPES = [
  {
    key: "registrationForm",
    requiresField: "requiresRegistrationForm",
    uploadField: "registrationFormUpload",
    label: "Registration Form",
    sentenceLabel: "Registration form",
    notificationPrefix: "regform",
  },
  {
    key: "medicalCert",
    requiresField: "requiresMedicalCert",
    uploadField: "medicalCertUpload",
    label: "Medical Certificate",
    sentenceLabel: "Medical certificate",
    notificationPrefix: "medcert",
  },
  {
    key: "permit",
    requiresField: "requiresPermit",
    uploadField: "permitUpload",
    label: "Mountaineering / Trekking Permit",
    sentenceLabel: "Mountaineering / trekking permit",
    notificationPrefix: "permit",
  },
  {
    key: "waiverDoc",
    requiresField: "requiresWaiverDoc",
    uploadField: "waiverDocUpload",
    label: "Waiver of Responsibility",
    sentenceLabel: "Waiver of responsibility",
    notificationPrefix: "waiverdoc",
  },
];

module.exports = { REQUIRED_DOC_TYPES };
