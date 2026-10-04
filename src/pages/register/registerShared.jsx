import { getDonationFeeItem, isDonationDriveOn, normalizePledge } from "@/utils/donations";
import { computeExpectedTotal } from "@/utils/feeSummary";

// Used by the on-page Fee Breakdown card and the pre-submit confirmation
// modal, so both always agree on the total.
export function expectedTotalFor(climb, form, optionalFeeSelections, pledge) {
  const fees = computeExpectedTotal(climb, {
    isJoiner: form.memberType === "joiner",
    optionalSelections: optionalFeeSelections,
  });
  // A cash pledge sent with the GCash payment is part of what they transfer.
  const donation = getDonationFeeItem(
    { donation: isDonationDriveOn(climb) ? normalizePledge(pledge) : null },
    climb,
  );
  return donation ? { ...fees, total: fees.total + donation.amount, donation } : fees;
}

// Submit order, top to bottom. Drives which field the page scrolls to when
// validation fails — the form is ~2500px tall, so "first invalid" has to mean
// first on the page, not first in object-key order.
export const FIELD_ORDER = [
  "fullName",
  "mobile",
  "ecName",
  "ecMobile",
  "ecRelationship",
  "registrationForm",
  "medicalCert",
  "permit",
  "waiverDoc",
  "waiverAgreed",
  "sigName",
  "privacyConsent",
  "amountPaid",
  "paymentFiles",
];

// The status check catches more than "closed" — say which one it is.
export const CLOSED_REASON = {
  closed: "closed",
  completed: "already finished",
  cancelled: "cancelled",
  draft: "not open yet",
};

export function FieldError({ message }) {
  if (!message) return null;
  return <div className="form-error-msg">{message}</div>;
}

export const INITIAL_FORM = {
  fullName: "",
  mobile: "",
  dateOfBirth: "",
  address: "",
  ecName: "",
  ecMobile: "",
  ecRelationship: "",
  medicalConditions: "",
  experienceLevel: "beginner",
  memberType: "joiner",
};
