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
  ],
};

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

  it("falls back to the climb's non-optional fees when feeBreakdown is empty", () => {
    expect(getExpectedTotal({}, climb)).toBe(500);
  });
});

describe("getOutstanding", () => {
  it("is the full expected total when nothing has been paid", () => {
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
