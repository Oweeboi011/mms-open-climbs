import { describe, it, expect } from "vitest";
import { buildAttendancePatch, buildClimbDaySheet } from "@/utils/climbDaySheet";

const climb = {
  fees: [{ label: "Climb Fee", amount: "1000" }],
  requiresMedicalCert: true,
};

const regs = [
  {
    id: "p",
    name: "Pia Pending",
    status: "pending",
    memberType: "joiner",
    waiverSigned: true,
    medicalConditions: "None",
    payments: [{ amount: 1000, status: "submitted", proofs: [] }],
    medicalCertUpload: { url: "x" },
  },
  {
    id: "b",
    name: "Ben Confirmed",
    status: "confirmed",
    memberType: "member",
    mobile: "0917",
    emergencyContact: { name: "Mom", relationship: "Mother", mobile: "0918" },
    medicalConditions: "Asthma — inhaler in lid",
    waiverSigned: false,
    donation: { cashPledge: 500, inKind: "notebooks", payWithFees: false },
  },
  {
    id: "a",
    name: "Ana Confirmed",
    status: "confirmed",
    waiverSigned: true,
    medicalConditions: "none",
    payments: [{ amount: 1000, status: "verified", proofs: [] }],
    medicalCertUpload: { url: "x" },
  },
  { id: "w", name: "Wendy Waitlisted", status: "waitlisted" },
  { id: "c", name: "Carl Cancelled", status: "cancelled" },
];

describe("buildClimbDaySheet", () => {
  const { rows, totals } = buildClimbDaySheet(regs, climb);

  it("lists everyone registered: confirmed, pending, waitlisted, cancelled", () => {
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "p", "w", "c"]);
    expect(rows.map((r) => r.status)).toEqual([
      "confirmed",
      "confirmed",
      "pending",
      "waitlisted",
      "cancelled",
    ]);
    expect(rows.find((r) => r.id === "c").expected).toBe(false);
  });

  it("never chases money from someone who isn't coming", () => {
    const sheet = buildClimbDaySheet(
      [{ id: "x", name: "X", status: "cancelled", donation: { cashPledge: 200, inKind: "rice", payWithFees: false } }],
      climb,
    );
    expect(sheet.rows[0]).toMatchObject({ balanceDue: 0, cashOnTheDay: 0, items: "" });
    expect(sheet.totals).toMatchObject({ cancelled: 1, balanceDue: 0, owing: 0 });
  });

  it("carries the safety details leads need", () => {
    const ben = rows.find((r) => r.id === "b");
    expect(ben.emergency).toEqual({ name: "Mom", relationship: "Mother", mobile: "0918" });
    expect(ben.medical).toBe("Asthma — inhaler in lid");
    expect(ben.waiverSigned).toBe(false);
    expect(ben.missingDocs).toEqual(["Medical Certificate"]);
    expect(rows.find((r) => r.id === "a").emergency).toBeNull();
  });

  it("shows what is still owed and what donations leads collect by hand", () => {
    const ben = rows.find((r) => r.id === "b");
    expect(ben.balanceDue).toBe(1000);
    expect(ben.cashOnTheDay).toBe(500);
    expect(ben.items).toBe("notebooks");
    expect(rows.find((r) => r.id === "a").balanceDue).toBe(0);
  });

  it("totals the sheet", () => {
    expect(totals).toMatchObject({
      confirmed: 2,
      pending: 1,
      waitlisted: 1,
      cancelled: 1,
      balanceDue: 1000,
      owing: 1,
      cashOnTheDay: 500,
      itemDonors: 1,
      unsignedWaivers: 1,
      withMedical: 1,
    });
  });

  it("leaves a with-fees pledge to the balance, not the cash-on-the-day column", () => {
    const withFees = buildClimbDaySheet(
      [{ id: "x", name: "X", status: "confirmed", donation: { cashPledge: 300, payWithFees: true } }],
      { ...climb, donationDrive: { enabled: true, beneficiary: "School" } },
    );
    expect(withFees.rows[0].cashOnTheDay).toBe(0);
    expect(withFees.rows[0].balanceDue).toBe(1300);
  });
});

describe("attendance", () => {
  it("flags anyone present who isn't confirmed and counts expected presence", () => {
    const { rows, totals } = buildClimbDaySheet([
      { id: "a", name: "A", status: "confirmed", attended: true },
      { id: "b", name: "B", status: "confirmed" },
      { id: "p", name: "P", status: "pending", attended: true },
      { id: "c", name: "C", status: "cancelled", attended: true },
    ]);
    expect(rows.filter((r) => r.presentNotConfirmed).map((r) => r.id)).toEqual(["p", "c"]);
    expect(totals).toMatchObject({ present: 3, expectedPresent: 2, expectedCount: 3, presentNotConfirmed: 2 });
  });

  it("ticking present also settles a no-show; unticking only clears attendance", () => {
    expect(buildAttendancePatch(true, "Lead", "TS")).toMatchObject({ attended: true, attendedMarkedBy: "Lead", noShow: false });
    expect(buildAttendancePatch(false, "Lead", "TS")).toEqual({ attended: false, attendedMarkedBy: null, attendedMarkedAt: null });
  });
});
