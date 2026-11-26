"use strict";

const { getFeeItems, getOutstanding } = require("../src/paymentMath");

describe("paymentMath with a donation sent with fees", () => {
  const climb = {
    fees: [{ label: "Climb Fee", amount: "1000" }],
    donationDrive: { enabled: true, beneficiary: "Tanglag School" },
  };

  it("adds the pledged donation to what the member owes", () => {
    const reg = { donation: { cashPledge: 300, payWithFees: true } };
    expect(getFeeItems(reg, climb).map((f) => f.label)).toEqual([
      "Climb Fee",
      "Donation — Tanglag School",
    ]);
    expect(getOutstanding(reg, climb)).toBe(1300);
  });

  it("leaves an on-the-day pledge out of the balance", () => {
    const reg = { donation: { cashPledge: 300, payWithFees: false } };
    expect(getOutstanding(reg, climb)).toBe(1000);
  });
});

describe("paymentMath with guests", () => {
  const climb = {
    startDate: "2027-03-20",
    fees: [
      { label: "Climb Fee", amount: "1000" },
      { label: "Transport", amount: "800", optional: true, guestFreeUpToAge: 4 },
    ],
  };
  const reg = (guests) => ({
    feeBreakdown: [{ label: "Transport", selected: true }],
    guests,
  });

  it("charges an older child per-person fees and a toddler only the climb fee", () => {
    const older = { name: "Leo", dateOfBirth: "2018-01-01" };
    const toddler = { name: "Mia", dateOfBirth: "2024-01-01" };
    // member 1800 + Leo 1800 + Mia 1000
    expect(getOutstanding(reg([older, toddler]), climb)).toBe(4600);
  });
});

describe("fees paid directly", () => {
  const { getFeeItems } = require("../src/paymentMath");
  const getExpectedTotal = (r, c) => getFeeItems(r, c).reduce((n, i) => n + Number(i.amount), 0);
  it("are not part of what the club is owed", () => {
    const climb = { fees: [{ label: "Env", optional: false, amount: "100" }, { label: "Tent", optional: true, amount: "300" }] };
    const reg = { feeBreakdown: [{ label: "Tent", selected: true }], selfPaidFees: ["Tent"] };
    expect(getExpectedTotal(reg, climb)).toBe(100);
    expect(getExpectedTotal({ ...reg, selfPaidFees: [] }, climb)).toBe(400);
  });
});
