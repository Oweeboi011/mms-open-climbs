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
