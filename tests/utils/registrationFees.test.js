import { describe, it, expect } from "vitest";
import {
  getExpectedTotal,
  getOutstanding,
  getFeeItems,
  toggleOptionalFeeEntry,
  getOptionalServices,
  getServicesForRegistrant,
  getAvailmentCounts,
  getFeeItemAggregates,
  getGroupSize,
  getGroupmates,
  isAvailing,
  describeMemberTypeChange,
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

  it("never charges a member the guest fee, even if it isn't flagged optional", () => {
    const climbWithRequiredGuestFee = {
      fees: [
        { label: "Registration Fee", amount: "500", optional: false },
        { label: "Guest Fee", amount: "450", optional: false, isGuestFee: true },
      ],
    };
    expect(
      getExpectedTotal({ memberType: "member" }, climbWithRequiredGuestFee),
    ).toBe(500);
    expect(
      getExpectedTotal({ memberType: "joiner" }, climbWithRequiredGuestFee),
    ).toBe(950);
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

describe("toggleOptionalFeeEntry", () => {
  it("flips an existing transportation entry", () => {
    const reg = {
      feeBreakdown: [
        { label: "Transportation Fee", amount: "300", optional: true, selected: false },
      ],
    };
    const updated = toggleOptionalFeeEntry(reg, climb, "Transportation Fee");
    expect(updated[0].selected).toBe(true);
  });

  it("synthesizes a transportation entry from the climb's fees when missing", () => {
    const updated = toggleOptionalFeeEntry({ feeBreakdown: [] }, climb, "Transportation Fee");
    expect(updated).toEqual([
      { label: "Transportation Fee", amount: "300", optional: true, selected: true },
    ]);
  });

  it("returns null when the climb has no transportation fee at all", () => {
    const noTranspoClimb = { fees: [{ label: "Registration Fee", amount: "500" }] };
    expect(toggleOptionalFeeEntry({}, noTranspoClimb, "Transportation Fee")).toBeNull();
  });
});

describe("correcting a mis-set participant type", () => {
  // The registration form defaults to joiner, so a member who skipped the
  // radio is charged the guest fee. Admins fix it from EditRegistrationModal.
  const asJoiner = { memberType: "joiner", feeBreakdown: [] };
  const asMember = { memberType: "member", feeBreakdown: [] };

  it("drops the guest fee once the registrant is marked a member", () => {
    expect(getExpectedTotal(asJoiner, climb)).toBe(950); // 500 + 450 guest
    expect(getExpectedTotal(asMember, climb)).toBe(500);
  });

  it("reduces what they still owe, without going negative", () => {
    const paid = { ...asJoiner, amountPaid: 500, paymentStatus: "verified" };
    expect(getOutstanding(paid, climb)).toBe(450);
    expect(getOutstanding({ ...paid, memberType: "member" }, climb)).toBe(0);
  });

  it("adds the guest fee when the correction goes the other way", () => {
    const paid = { ...asMember, amountPaid: 500, paymentStatus: "verified" };
    expect(getOutstanding(paid, climb)).toBe(0);
    expect(getOutstanding({ ...paid, memberType: "joiner" }, climb)).toBe(450);
  });
});

describe("describeMemberTypeChange", () => {
  it("names both sides of the change for the audit trail", () => {
    expect(
      describeMemberTypeChange({ memberType: "joiner" }, { memberType: "member" }),
    ).toBe(" — participant type Joiner → MMS Member");
  });

  it("treats a missing memberType as joiner, matching the form default", () => {
    expect(describeMemberTypeChange({}, { memberType: "member" })).toBe(
      " — participant type Joiner → MMS Member",
    );
  });

  it("says nothing when the edit left participant type alone", () => {
    expect(
      describeMemberTypeChange({ memberType: "member" }, { name: "New Name" }),
    ).toBe("");
    expect(
      describeMemberTypeChange({ memberType: "member" }, { memberType: "member" }),
    ).toBe("");
  });
});

describe("optional services", () => {
  // The point of the generalization: a climb that offers a porter is tracked
  // exactly like one that offers transportation, with no code change.
  const porterClimb = {
    fees: [
      { label: "Registration Fee", amount: "500", optional: false },
      { label: "Transportation Fee", amount: "300", optional: true },
      { label: "Porter", amount: "800", optional: true },
      { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
    ],
  };

  it("lists every opt-in service the climb offers", () => {
    expect(getOptionalServices(porterClimb).map((f) => f.label)).toEqual([
      "Transportation Fee",
      "Porter",
    ]);
  });

  it("never treats the guest fee as an opt-in service", () => {
    // It follows member type, not a checkbox — even flagged optional.
    expect(getOptionalServices(porterClimb).some((f) => f.isGuestFee)).toBe(
      false,
    );
  });

  it("has no services when the climb offers none", () => {
    expect(getOptionalServices({ fees: [] })).toEqual([]);
    expect(getOptionalServices(undefined)).toEqual([]);
  });

  it("toggles a porter independently of transportation", () => {
    const reg = {
      feeBreakdown: [
        { label: "Transportation Fee", amount: "300", optional: true, selected: true },
      ],
    };
    const updated = toggleOptionalFeeEntry(reg, porterClimb, "Porter");
    expect(isAvailing({ feeBreakdown: updated }, "Porter")).toBe(true);
    expect(isAvailing({ feeBreakdown: updated }, "Transportation Fee")).toBe(
      true,
    );
  });

  it("counts availment per service, ignoring cancelled registrations", () => {
    const regs = [
      {
        feeBreakdown: [
          { label: "Porter", amount: "800", optional: true, selected: true },
        ],
      },
      {
        feeBreakdown: [
          { label: "Porter", amount: "800", optional: true, selected: false },
        ],
      },
      {
        // Cancelled: doesn't need a porter booked for them.
        status: "cancelled",
        feeBreakdown: [
          { label: "Porter", amount: "800", optional: true, selected: true },
        ],
      },
    ];
    const counts = getAvailmentCounts(regs, porterClimb);
    const porter = counts.find((c) => c.label === "Porter");
    expect(porter).toMatchObject({
      availing: 1,
      notAvailing: 1,
      total: 2,
      pct: 50,
    });
  });

  it("reports zero rather than dividing by zero with no registrants", () => {
    expect(getAvailmentCounts([], porterClimb)[0]).toMatchObject({
      availing: 0,
      total: 0,
      pct: 0,
    });
  });

  it("still offers a toggle for a service the climb has since dropped", () => {
    // Otherwise an orphaned availment could never be cleared.
    const reg = {
      feeBreakdown: [
        { label: "Old Service", amount: "100", optional: true, selected: true },
      ],
    };
    expect(
      getServicesForRegistrant(reg, porterClimb).map((f) => f.label),
    ).toEqual(["Transportation Fee", "Porter", "Old Service"]);
  });

  it("does not double-list a service present in both places", () => {
    const reg = {
      feeBreakdown: [
        { label: "Porter", amount: "800", optional: true, selected: true },
      ],
    };
    expect(
      getServicesForRegistrant(reg, porterClimb).map((f) => f.label),
    ).toEqual(["Transportation Fee", "Porter"]);
  });
});

describe("service sharing", () => {
  const shareableClimb = {
    fees: [
      { label: "Registration Fee", amount: "500", optional: false },
      {
        label: "Porter",
        amount: "800",
        optional: true,
        shareable: true,
      },
    ],
  };
  const availing = (id) => ({
    id,
    feeBreakdown: [
      { label: "Porter", amount: "800", optional: true, selected: true },
    ],
  });
  const a = availing("a");
  const b = availing("b");
  const c = availing("c");
  const solo = availing("solo");
  const serviceGroups = { Porter: [["a", "b", "c"]] };

  it("reports a solo registrant's group size as 1", () => {
    expect(getGroupSize(solo, serviceGroups, "Porter")).toBe(1);
    expect(getGroupSize(solo, {}, "Porter")).toBe(1);
  });

  it("reports the full group size for a grouped registrant", () => {
    expect(getGroupSize(a, serviceGroups, "Porter")).toBe(3);
  });

  it("splits a shareable fee evenly across the group, rounded to centavos", () => {
    const items = getFeeItems(a, shareableClimb, serviceGroups);
    const porter = items.find((i) => i.label === "Porter");
    expect(porter.amount).toBeCloseTo(266.67, 2);
    expect(porter.unitAmount).toBe("800");
    expect(porter.groupSize).toBe(3);
  });

  it("leaves a solo registrant's amount unsplit", () => {
    const items = getFeeItems(solo, shareableClimb, serviceGroups);
    const porter = items.find((i) => i.label === "Porter");
    expect(porter.amount).toBe("800");
    expect(porter.groupSize).toBeUndefined();
  });

  it("leaves an unshared item untouched when no groups exist at all", () => {
    const items = getFeeItems(a, shareableClimb, {});
    expect(items.find((i) => i.label === "Porter").amount).toBe("800");
  });

  it("carries the split into the registrant's expected total and balance", () => {
    // 500 required + 800/3 = 766.67, rounded.
    expect(
      getExpectedTotal(a, shareableClimb, serviceGroups),
    ).toBeCloseTo(766.67, 2);
    expect(
      getOutstanding(
        { ...a, paymentStatus: "unpaid" },
        shareableClimb,
        serviceGroups,
      ),
    ).toBeCloseTo(766.67, 2);
  });

  it("resolves the other members sharing with a registrant, excluding themself", () => {
    const regs = [a, b, c, solo];
    const mates = getGroupmates(a, regs, serviceGroups, "Porter").map(
      (r) => r.id,
    );
    expect(mates.sort()).toEqual(["b", "c"]);
    expect(getGroupmates(solo, regs, serviceGroups, "Porter")).toEqual([]);
  });

  it("sums split shares back to the whole unit price in the collection aggregate", () => {
    const { items } = getFeeItemAggregates(
      [a, b, c, solo],
      shareableClimb,
      serviceGroups,
    );
    const porter = items.find((i) => i.label === "Porter");
    // Unit price shown, not a split share.
    expect(porter.amount).toBe("800");
    expect(porter.count).toBe(4);
    // 3 × 266.67 (rounded) + 1 × 800 ≈ 1600.
    expect(porter.subtotal).toBeCloseTo(1600, 1);
  });

  it("reduces the booking headcount to groups-in-use plus solo opt-ins", () => {
    const counts = getAvailmentCounts([a, b, c, solo], shareableClimb, serviceGroups);
    const porter = counts.find((c2) => c2.label === "Porter");
    expect(porter).toMatchObject({
      availing: 4,
      shareable: true,
      groupsInUse: 1,
      unitsNeeded: 2, // 1 group (a,b,c) + 1 solo
    });
  });

  it("does not shrink the headcount for a non-shareable service", () => {
    const nonShareableClimb = {
      fees: [
        { label: "Transportation Fee", amount: "300", optional: true },
      ],
    };
    const reg1 = {
      id: "x",
      feeBreakdown: [
        { label: "Transportation Fee", amount: "300", optional: true, selected: true },
      ],
    };
    const counts = getAvailmentCounts([reg1], nonShareableClimb, {
      "Transportation Fee": [["x", "y"]],
    });
    expect(counts[0]).toMatchObject({ availing: 1, unitsNeeded: 1 });
  });
});
