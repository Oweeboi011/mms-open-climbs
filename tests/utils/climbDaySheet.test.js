import { describe, it, expect } from "vitest";
import { buildClimbDaySheet } from "@/utils/climbDaySheet";

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

  it("lists only people expected on the trail, confirmed first, then by name", () => {
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "p"]);
    expect(rows[2].pending).toBe(true);
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
