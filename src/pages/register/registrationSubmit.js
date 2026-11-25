import {
  medCertNeededForPayment,
  REQUIRED_DOC_TYPES,
} from "@/data/requiredDocTypes";
import { PRIVACY_NOTICE_VERSION } from "@/data/privacyNotice";
import { serverTimestamp, Timestamp } from "@/services/firestore";
import { uploadRegistrationFile } from "@/services/storage";
import { cleanGuests, validateGuests } from "@/utils/guests";
import {
  getNeededItems,
  isDonationDriveOn,
  normalizePledge,
} from "@/utils/donations";

const parseAmount = (value) =>
  parseFloat(String(value).replace(/[^0-9.]/g, ""));

// Payment is optional at registration — but if they started on it, both the
// amount and the receipt are needed together, plus the medical certificate
// when the climb asks for one.
function paymentErrors({ hasAmount, paymentFiles, climb, docFiles, optionalFeeSelections }) {
  const errors = {};
  if (paymentFiles.length > 0 && !hasAmount) {
    errors.amountPaid =
      "Enter the amount you paid, to match your uploaded receipt.";
  }
  if (hasAmount && paymentFiles.length === 0) {
    errors.paymentFiles =
      "Upload your proof of payment, to match the amount entered.";
  }
  if (
    (hasAmount || paymentFiles.length > 0) &&
    medCertNeededForPayment(climb, null, optionalFeeSelections) &&
    !docFiles.medicalCert
  ) {
    errors.medicalCert = "Attach your medical certificate to submit a payment.";
  }
  return errors;
}

// Field-level problems that block submitting, keyed like FIELD_ORDER.
// Required documents are intentionally not checked — a joiner can register
// while still waiting on a medical certificate or permit and upload it later
// from My Climbs; the notification bell chases the gap. The one exception is
// the medical certificate when a payment is submitted with the registration.
export function validateRegistration({
  form,
  waiverAgreed,
  privacyConsent,
  sigName,
  amountPaid,
  paymentFiles,
  climb,
  docFiles = {},
  optionalFeeSelections = {},
}) {
  const errors = {};
  const parsedAmount = parseAmount(amountPaid);
  const hasAmount = !!amountPaid && !isNaN(parsedAmount) && parsedAmount > 0;
  const required = {
    fullName: [form.fullName, "Enter your full name."],
    mobile: [form.mobile, "Enter your mobile number."],
    ecName: [form.ecName, "Enter your emergency contact's name."],
    ecMobile: [form.ecMobile, "Enter your emergency contact's mobile number."],
    ecRelationship: [
      form.ecRelationship,
      "Enter your relationship to this contact.",
    ],
  };
  for (const [key, [value, message]] of Object.entries(required)) {
    if (!value.trim()) errors[key] = message;
  }
  const guestProblem = validateGuests(form.guests);
  if (guestProblem) errors.guests = guestProblem;
  else if (form.guests.length > 0 && !form.guestsAuthorized) {
    errors.guests =
      "Confirm you are allowed to register your guests and sign the waiver for them.";
  }
  if (!waiverAgreed)
    errors.waiverAgreed =
      "You must agree to the Waiver and Release of Liability.";
  if (!privacyConsent) {
    errors.privacyConsent =
      "Please agree to the Privacy Notice so we can process your registration.";
  }
  if (!sigName.trim())
    errors.sigName = "Type your full name to sign the waiver.";
  else if (sigName.trim().length < 3)
    errors.sigName = "Enter your complete name — at least 3 characters.";
  Object.assign(
    errors,
    paymentErrors({ hasAmount, paymentFiles, climb, docFiles, optionalFeeSelections }),
  );
  return { errors, parsedAmount };
}

// The registration doesn't exist yet, so files are filed under the member.
export async function uploadRegistrationFiles({
  climbId,
  userId,
  paymentFiles,
  docFiles,
  onPaymentUpload,
}) {
  const owner = { climbId, userId };
  let paymentProofs = [];
  if (paymentFiles.length > 0) {
    onPaymentUpload?.(true);
    paymentProofs = await Promise.all(
      paymentFiles.map((file) =>
        uploadRegistrationFile("payment-proofs", owner, file),
      ),
    );
    onPaymentUpload?.(false);
  }
  const docUploads = {};
  for (const docType of REQUIRED_DOC_TYPES) {
    if (!docFiles[docType.key]) continue;
    docUploads[docType.uploadField] = await uploadRegistrationFile(
      docType.storagePrefixUpload,
      owner,
      docFiles[docType.key],
    );
  }
  return { paymentProofs, docUploads };
}

// Guest fee follows member type (joiners owe it, members never see it);
// other optional fees follow the member's ticks.
function buildFeeBreakdown(climb, memberType, optionalFeeSelections) {
  return (climb.fees || []).map((exp) => ({
    label: exp.label,
    amount: exp.amount,
    optional: !!exp.optional,
    selected: !exp.optional
      ? true
      : exp.isGuestFee
        ? memberType === "joiner"
        : !!optionalFeeSelections[exp.label],
  }));
}

function buildInitialPayment(paymentProofs, parsedAmount, paymentNote) {
  if (paymentProofs.length === 0) {
    return {
      payments: [],
      paymentStatus: "unpaid",
      amountPaid: null,
      paymentSubmittedAt: null,
    };
  }
  const note = paymentNote.trim();
  return {
    payments: [
      {
        amount: parsedAmount,
        proofs: paymentProofs,
        submittedAt: Timestamp.now(),
        status: "submitted",
        ...(note ? { note } : {}),
      },
    ],
    paymentStatus: "submitted",
    amountPaid: parsedAmount,
    paymentSubmittedAt: serverTimestamp(),
  };
}

export function buildRegistrationDoc({
  climb,
  user,
  form,
  sigName,
  uploads: { paymentProofs, docUploads },
  parsedAmount,
  paymentNote,
  optionalFeeSelections,
  pledge,
}) {
  return {
    climbId: climb.id,
    climbTitle: climb.title,
    climbDate: climb.dateLabel || "",
    climbLocation: climb.location || "",
    userId: user.uid,
    email: user.email,
    name: form.fullName,
    mobile: form.mobile,
    dateOfBirth: form.dateOfBirth,
    address: form.address,
    emergencyContact: {
      name: form.ecName,
      mobile: form.ecMobile,
      relationship: form.ecRelationship,
    },
    medicalConditions: form.medicalConditions,
    experienceLevel: form.experienceLevel,
    memberType: form.memberType,
    // Guests ride on this account: one slot, one balance, one waiver each.
    guests: cleanGuests(form.guests),
    ...(form.guests.length > 0 ? { guestsAuthorized: true } : {}),
    // Data Privacy Act consent, with the notice version it was given on.
    privacyConsentAt: serverTimestamp(),
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    waiverSigned: true,
    waiverSignedAt: serverTimestamp(),
    waiverSignedName: sigName.trim(),
    // `payments` is the history members add to over time; `paymentProofs`
    // stays the flat list of every receipt.
    paymentProofs,
    ...buildInitialPayment(paymentProofs, parsedAmount, paymentNote),
    ...Object.fromEntries(
      REQUIRED_DOC_TYPES.map((docType) => [
        docType.uploadField,
        docUploads[docType.uploadField] || null,
      ]),
    ),
    feeBreakdown: buildFeeBreakdown(
      climb,
      form.memberType,
      optionalFeeSelections,
    ),
    // Optional outreach pledge — separate from fees and payments.
    ...(isDonationDriveOn(climb)
      ? {
          donation: normalizePledge(
            pledge,
            getNeededItems(climb.donationDrive),
          ),
        }
      : {}),
    status: "pending",
    createdAt: serverTimestamp(),
  };
}

export const missingDocLabels = (climb, docUploads) =>
  REQUIRED_DOC_TYPES.filter(
    (docType) =>
      climb[docType.requiresField] && !docUploads[docType.uploadField],
  ).map((docType) => docType.label);
