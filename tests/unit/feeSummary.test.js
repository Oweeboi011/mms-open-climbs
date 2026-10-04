import { describe, it, expect } from "vitest";
import {
  getClimbFeeModel,
  getFeeSummary,
  computeExpectedTotal,
} from "@/utils/feeSummary";

const climb = {
  fees: [
    { label: "Registration Fee", amount: "500", optional: false },
    { label: "Guide Fee", amount: "700", optional: false },
    { label: "Transportation Fee", amount: "300", optional: true },
    { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
  ],
};

describe("getClimbFeeModel", () => {
  it("splits required, optional and guest fees", () => {
    const model = getClimbFeeModel(climb);
    expect(model.requiredFees.map((f) => f.label)).toEqual([
      "Registration Fee",
      "Guide Fee",
    ]);
    expect(model.optionalFees.map((f) => f.label)).toEqual([
      "Transportation Fee",
    ]);
    expect(model.guestFee.label).toBe("Guest Fee");
    expect(model.guestAmount).toBe(450);
  });

  it("keeps optional and guest fees out of the required total", () => {
    expect(getClimbFeeModel(climb).requiredTotal).toBe(1200);
  });

  it("treats a guest fee as guest-only even when it is not flagged optional", () => {
    const model = getClimbFeeModel({
      fees: [
        { label: "Registration Fee", amount: "500", optional: false },
        { label: "Guest Fee", amount: "450", optional: false, isGuestFee: true },
      ],
    });
    expect(model.requiredTotal).toBe(500);
    expect(model.guestFee.label).toBe("Guest Fee");
  });

  it("flags TBA amounts instead of counting them as zero", () => {
    const model = getClimbFeeModel({
      fees: [
        { label: "Registration Fee", amount: "500", optional: false },
        { label: "Guide Fee", amount: "TBA", optional: false },
      ],
    });
    expect(model.requiredTotal).toBe(500);
    expect(model.requiredHasTBA).toBe(true);
  });

  it("handles a climb with no fees", () => {
    const model = getClimbFeeModel({});
    expect(model.requiredTotal).toBe(0);
    expect(model.guestFee).toBeNull();
  });
});

describe("getFeeSummary", () => {
  it("reports the required total, with optional and guest fees noted apart", () => {
    expect(getFeeSummary(climb)).toBe(
      "4 items — ₱1,200 required, +1 optional, +₱450 guest",
    );
  });

  it("marks the total as excluding TBA items", () => {
    expect(
      getFeeSummary({
        fees: [
          { label: "Registration Fee", amount: "500", optional: false },
          { label: "Guide Fee", amount: "TBA", optional: false },
        ],
      }),
    ).toBe("2 items — ₱500 required (excl. TBA)");
  });

  it("says required TBA when no required amount is set yet", () => {
    expect(
      getFeeSummary({
        fees: [{ label: "Registration Fee", amount: "TBA", optional: false }],
      }),
    ).toBe("1 item — required TBA");
  });

  it("returns null when the climb has no fees", () => {
    expect(getFeeSummary({ fees: [] })).toBeNull();
  });
});

describe("computeExpectedTotal", () => {
  it("charges a member the required fees only", () => {
    expect(computeExpectedTotal(climb)).toEqual({ total: 1200, hasTba: false });
  });

  it("adds the guest fee for a joiner", () => {
    expect(computeExpectedTotal(climb, { isJoiner: true }).total).toBe(1650);
  });

  it("adds optional fees only when selected", () => {
    expect(
      computeExpectedTotal(climb, {
        optionalSelections: { "Transportation Fee": true },
      }).total,
    ).toBe(1500);
  });

  it("reports TBA items rather than silently dropping them", () => {
    expect(
      computeExpectedTotal({
        fees: [{ label: "Guide Fee", amount: "TBA", optional: false }],
      }),
    ).toEqual({ total: 0, hasTba: true });
  });
});
