import { describe, it, expect } from "vitest";
import {
  getExpectedTotal,
  getOutstanding,
  toggleTransportationEntry,
} from "@/utils/registrationFees";

const climb = {
  fees: [
    { label: "Registration Fee", amount: "500", optional: false },
    { label: "Transportation Fee", amount: "300", optional: true },
    { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
  ],
};

describe("getOutstanding with a payment history", () => {
  const reg = (payments) => ({
    memberType: "member",
    feeBreakdown: [
      { label: "Registration Fee", amount: "500", selected: true },
    ],
    payments,
    paymentStatus: "submitted",
  });

  it("ignores a rejected instalment but keeps the ones that stand", () => {
    // 500 owed, 300 verified, 200 rejected → 200 still outstanding.
    expect(
      getOutstanding(
        reg([
          { amount: 300, proofs: [], status: "verified" },
          { amount: 200, proofs: [], status: "rejected" },
        ]),
        climb,
      ),
    ).toBe(200);
  });

  it("counts instalments still awaiting review", () => {
    expect(
      getOutstanding(
        reg([
          { amount: 300, proofs: [], status: "verified" },
          { amount: 200, proofs: [], status: "submitted" },
        ]),
        climb,
      ),
    ).toBe(0);
  });

  it("still zeroes a legacy registration whose single payment was rejected", () => {
    expect(
      getOutstanding(
        {
          memberType: "member",
          amountPaid: 500,
          paymentStatus: "rejected",
        },
        climb,
      ),
    ).toBe(500);
  });
});

describe("getExpectedTotal", () => {
  it("sums selected feeBreakdown items when present", () => {
    const reg = {
      feeBreakdown: [
        { label: "Registration Fee", amount: "500", selected: true },
        { label: "Transportation Fee", amount: "300", selected: false },
      ],
    };
    expect(getExpectedTotal(reg, climb)).toBe(500);
  });

  it("falls back to the climb's required fees when feeBreakdown is empty, without assuming transportation", () => {
    // No feeBreakdown recorded (e.g. a walk-in added via Add Joiner) — only
    // the required fee counts; transportation is optional and not assumed
    // just because we don't know their selection.
    expect(getExpectedTotal({ memberType: "member" }, climb)).toBe(500);
  });

  it("auto-includes the guest fee for a joiner in the fallback, but still not transportation", () => {
    expect(getExpectedTotal({ memberType: "joiner" }, climb)).toBe(950);
  });

  it("picks up a fee amount corrected after the registrant already selected it", () => {
    // Registered while the fee was still "TBA"; admin later fills in the
    // real amount on the climb — the registrant's total should reflect it.
    const reg = {
      feeBreakdown: [{ label: "Registration Fee", amount: "TBA", selected: true }],
    };
    expect(getExpectedTotal(reg, climb)).toBe(500);
  });

  it("includes a required fee added to the climb after the registrant signed up", () => {
    // Their feeBreakdown snapshot predates the new fee entirely.
    const reg = {
      feeBreakdown: [{ label: "Registration Fee", amount: "500", selected: true }],
    };
    const climbWithNewFee = {
      fees: [
        ...climb.fees,
        { label: "Environmental Fee", amount: "100", optional: false },
      ],
    };
    expect(getExpectedTotal(reg, climbWithNewFee)).toBe(600);
  });

  it("still honors a previously-selected optional fee at its updated amount", () => {
    const reg = {
      feeBreakdown: [
        { label: "Registration Fee", amount: "500", selected: true },
        { label: "Transportation Fee", amount: "300", selected: true },
      ],
    };
    const climbWithPriceChange = {
      fees: [
        { label: "Registration Fee", amount: "500", optional: false },
        { label: "Transportation Fee", amount: "350", optional: true },
      ],
    };
    expect(getExpectedTotal(reg, climbWithPriceChange)).toBe(850);
  });
});

describe("getOutstanding", () => {
  it("is the full expected total when nothing has been paid", () => {
    // Fallback total for a member: just the required fee (500) —
    // transportation isn't assumed.
    expect(getOutstanding({ paymentStatus: "unpaid" }, climb)).toBe(500);
  });

  it("subtracts a declared/verified amount from the expected total", () => {
    expect(
      getOutstanding({ paymentStatus: "submitted", amountPaid: 300 }, climb),
    ).toBe(200);
  });

  it("never goes below zero", () => {
    expect(
      getOutstanding({ paymentStatus: "verified", amountPaid: 999 }, climb),
    ).toBe(0);
  });

  it("does not count a rejected payment toward what's been paid", () => {
    expect(
      getOutstanding({ paymentStatus: "rejected", amountPaid: 500 }, climb),
    ).toBe(500);
  });
});

describe("toggleTransportationEntry", () => {
  it("flips an existing transportation entry", () => {
    const reg = {
      feeBreakdown: [
        { label: "Transportation Fee", amount: "300", optional: true, selected: false },
      ],
    };
    const updated = toggleTransportationEntry(reg, climb);
    expect(updated[0].selected).toBe(true);
  });

  it("synthesizes a transportation entry from the climb's fees when missing", () => {
    const updated = toggleTransportationEntry({ feeBreakdown: [] }, climb);
    expect(updated).toEqual([
      { label: "Transportation Fee", amount: "300", optional: true, selected: true },
    ]);
  });

  it("returns null when the climb has no transportation fee at all", () => {
    const noTranspoClimb = { fees: [{ label: "Registration Fee", amount: "500" }] };
    expect(toggleTransportationEntry({}, noTranspoClimb)).toBeNull();
  });
});
