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
