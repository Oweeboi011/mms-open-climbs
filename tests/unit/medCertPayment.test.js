import { describe, expect, it } from "vitest";
import { medCertNeededForPayment } from "@/data/requiredDocTypes";
import { validateRegistration } from "@/pages/register/registrationSubmit";

const form = {
  fullName: "Juan Cruz",
  mobile: "0917",
  ecName: "Ana",
  ecMobile: "0918",
  ecRelationship: "Sister",
  guests: [],
};
const base = { form, waiverAgreed: true, privacyConsent: true, sigName: "Juan Cruz", docFiles: {} };
const receipt = [new File(["x"], "receipt.png")];
const climbWithCert = { requiresMedicalCert: true };

describe("medCertNeededForPayment", () => {
  it("needs a certificate only when the climb asks and none is on file", () => {
    expect(medCertNeededForPayment(climbWithCert, null)).toBe(true);
    expect(medCertNeededForPayment({}, null)).toBe(false);
    expect(medCertNeededForPayment(climbWithCert, { url: "https://x/y.pdf" })).toBe(false);
    expect(medCertNeededForPayment(climbWithCert, { receivedOffline: true })).toBe(false);
  });
});

describe("registering with a payment", () => {
  const paying = { ...base, amountPaid: "500", paymentFiles: receipt };

  it("asks for the medical certificate when the climb requires it", () => {
    expect(validateRegistration({ ...paying, climb: climbWithCert }).errors.medicalCert).toMatch(/medical certificate/i);
  });
  it("accepts the payment once the certificate is attached", () => {
    const docFiles = { medicalCert: new File(["x"], "cert.pdf") };
    expect(validateRegistration({ ...paying, climb: climbWithCert, docFiles }).errors).toEqual({});
  });
  it("lets a member register without paying and without the certificate", () => {
    const errors = validateRegistration({ ...base, amountPaid: "", paymentFiles: [], climb: climbWithCert }).errors;
    expect(errors).toEqual({});
  });
  it("doesn't ask when the climb needs no certificate", () => {
    expect(validateRegistration({ ...paying, climb: {} }).errors).toEqual({});
  });
});

describe("medCertNeededForPayment with flagged climbing fees", () => {
  const climb = {
    requiresMedicalCert: true,
    fees: [
      { label: "Transportation Fee", optional: true },
      { label: "Guide Fee", optional: true, requiresMedCert: true },
      { label: "Environment Fee", optional: false, requiresMedCert: true },
    ],
  };
  it("always asks when a required fee is flagged", () => {
    expect(medCertNeededForPayment(climb, null, {})).toBe(true);
  });
  it("asks only when an optional flagged fee is ticked", () => {
    const optionalOnly = { ...climb, fees: climb.fees.slice(0, 2) };
    expect(medCertNeededForPayment(optionalOnly, null, { "Transportation Fee": true })).toBe(false);
    expect(medCertNeededForPayment(optionalOnly, null, { "Guide Fee": true })).toBe(true);
  });
});
