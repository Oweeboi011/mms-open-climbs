import { describe, expect, it } from "vitest";
import { groupClimbersByTrail, trailOf } from "@/utils/climbers";

const climb = {
  fees: [
    { label: "Transportation Fee", optional: true, amount: "3000" },
    { label: "Mt. A - Guide Fee", optional: true, amount: "250" },
    { label: "Mt. B - Guide Fee", optional: true, amount: "300" },
  ],
};
const reg = (id, name, picks, status = "confirmed") => ({
  id, name, status,
  feeBreakdown: picks.map((label) => ({ label, selected: true })),
});

describe("groupClimbersByTrail", () => {
  it("lists climbers per trail, with a bucket for nobody-chosen", () => {
    const { trails, none } = groupClimbersByTrail(
      [
        reg("1", "Ana", ["Mt. A - Guide Fee", "Mt. B - Guide Fee"]),
        reg("2", "Ben", ["Mt. B - Guide Fee"]),
        reg("3", "Cy", ["Transportation Fee"]),
        reg("4", "Di", ["Mt. A - Guide Fee"], "cancelled"),
      ],
      climb,
    );
    expect(trails.map((t) => [t.name, t.climbers.map((r) => r.name)])).toEqual([
      ["Mt. A", ["Ana"]],
      ["Mt. B", ["Ana", "Ben"]],
    ]);
    expect(none.map((r) => r.name)).toEqual(["Cy"]);
  });
  it("has no trails for a single-trail climb", () => {
    expect(trailOf("Guide Fee")).toBeNull();
    expect(groupClimbersByTrail([], { fees: [{ label: "Guide Fee" }] }).trails).toEqual([]);
  });
});

import { getTransportRiders } from "@/utils/climbers";
describe("getTransportRiders", () => {
  const c = { fees: [{ label: "Transportation Fee", optional: true, amount: "3000" }] };
  const rider = (id, name, paid) => ({
    id, name, status: "confirmed", amountPaid: paid,
    feeBreakdown: [{ label: "Transportation Fee", selected: true }],
  });
  it("lists riders with their payment standing", () => {
    const out = getTransportRiders(
      [rider("1", "Ana", 3000), rider("2", "Ben", 1000), rider("3", "Cy", 0),
       { id: "4", name: "Di", status: "confirmed", feeBreakdown: [] }],
      c,
    );
    expect(out.map((r) => [r.reg.name, r.payStatus])).toEqual([
      ["Ana", "paid"], ["Ben", "partial"], ["Cy", "unpaid"],
    ]);
  });
});

import { getOwnTransport } from "@/utils/climbers";
describe("getOwnTransport", () => {
  it("lists active registrants without the transport fee", () => {
    const c = { fees: [{ label: "Transportation Fee", optional: true, amount: "3000" }] };
    const regs = [
      { id: "1", name: "Ana", status: "confirmed", feeBreakdown: [{ label: "Transportation Fee", selected: true }] },
      { id: "2", name: "Ben", status: "confirmed", feeBreakdown: [] },
      { id: "3", name: "Cy", status: "cancelled", feeBreakdown: [] },
    ];
    expect(getOwnTransport(regs, c).map((r) => r.name)).toEqual(["Ben"]);
  });
});

import { groupRidersByPickup } from "@/utils/climbers";
describe("groupRidersByPickup", () => {
  it("splits riders by point and keeps the unassigned apart", () => {
    const r = (id, pickupPoint) => ({ reg: { id, pickupPoint }, payStatus: "paid" });
    const { groups, unset } = groupRidersByPickup(
      [r("1", "Cubao"), r("2", "Baguio"), r("3", undefined), r("4", "Cubao")],
      { pickupPoints: ["Baguio", "Buendia", "Cubao"] },
    );
    expect(groups.map((g) => [g.name, g.riders.length])).toEqual([["Baguio", 1], ["Buendia", 0], ["Cubao", 2]]);
    expect(unset.map((x) => x.reg.id)).toEqual(["3"]);
  });
});

describe("riders with a pickup point", () => {
  it("counts an assigned pickup point as riding even without the fee ticked", () => {
    const c = { fees: [{ label: "Transportation Fee", optional: true, amount: "3000" }] };
    const regs = [{ id: "1", name: "Ana", status: "confirmed", pickupPoint: "Cubao", feeBreakdown: [] }];
    expect(getTransportRiders(regs, c).map((r) => r.reg.name)).toEqual(["Ana"]);
    expect(getOwnTransport(regs, c)).toEqual([]);
  });
});

import { guestFeeUnits, guestJoinsTrail, guestRides } from "@/utils/climbers";
describe("guest exclusions in the lists", () => {
  const c = {
    fees: [
      { label: "Transportation Fee", optional: true },
      { label: "Mt. A - Guide Fee", optional: true },
      { label: "Mt. A - Entrance", optional: true },
      { label: "Mt. B - Guide Fee", optional: true },
    ],
  };
  it("groups a trail's fees into one unit", () => {
    expect(guestFeeUnits(c).map((u) => u.labels.length)).toEqual([1, 2, 1]);
  });
  it("drops a guest from a trail only when every fee of it is excluded", () => {
    const g = { excludedFees: ["Mt. A - Guide Fee", "Mt. A - Entrance"] };
    expect(guestJoinsTrail(g, c, "Mt. A")).toBe(false);
    expect(guestJoinsTrail(g, c, "Mt. B")).toBe(true);
    expect(guestJoinsTrail({ excludedFees: ["Mt. A - Guide Fee"] }, c, "Mt. A")).toBe(true);
  });
  it("drops a guest from the van when transport is excluded", () => {
    expect(guestRides({ excludedFees: ["Transportation Fee"] }, c)).toBe(false);
    expect(guestRides({}, c)).toBe(true);
  });
});

import { groupByAccommodation, guestStays } from "@/utils/climbers";
describe("groupByAccommodation", () => {
  const c = {
    fees: [
      { label: "Accomodation (Homestay)", optional: true, amount: "1000" },
      { label: "Accomodation (Tent)", optional: true, amount: "300" },
      { label: "Transportation Fee", optional: true },
    ],
  };
  const reg = (id, name, picks, status = "confirmed") => ({
    id, name, status, feeBreakdown: picks.map((label) => ({ label, selected: true })),
  });
  it("groups active registrants by stay, with the undecided apart", () => {
    const { options, none } = groupByAccommodation(
      [
        reg("1", "Ana", ["Accomodation (Tent)"]),
        reg("2", "Ben", ["Accomodation (Homestay)", "Transportation Fee"]),
        reg("3", "Cy", ["Transportation Fee"]),
        reg("4", "Di", ["Accomodation (Tent)"], "cancelled"),
      ],
      c,
    );
    expect(options.map((o) => o.regs.map((r) => r.name))).toEqual([["Ben"], ["Ana"]]);
    expect(none.map((r) => r.name)).toEqual(["Cy"]);
  });
  it("lets a guest be taken off a stay", () => {
    expect(guestStays({ excludedFees: ["Accomodation (Tent)"] }, "Accomodation (Tent)")).toBe(false);
    expect(guestStays({}, "Accomodation (Tent)")).toBe(true);
  });
});

import { certificateLabels, certificateCount } from "@/utils/climbers";
describe("finisher certificates", () => {
  const climb = {
    fees: [
      { label: "Mt. A - Guide Fee", amount: "100" },
      { label: "Mt. A - Finisher Certificate", amount: "50", optional: true },
      { label: "Medical Certificate", amount: "0", optional: true },
    ],
  };
  it("finds a trail's certificate fee, not the medical certificate", () => {
    expect(certificateLabels(climb, "Mt. A")).toEqual(["Mt. A - Finisher Certificate"]);
  });
  it("counts the ones a registration ordered", () => {
    const reg = {
      memberType: "member",
      feeBreakdown: [
        { label: "Mt. A - Guide Fee", amount: "100", selected: true },
        { label: "Mt. A - Finisher Certificate", amount: "50", optional: true, selected: true },
      ],
    };
    expect(certificateCount(reg, climb, certificateLabels(climb, "Mt. A"))).toBe(1);
    expect(certificateCount({ ...reg, feeBreakdown: [] }, climb, certificateLabels(climb, "Mt. A"))).toBe(0);
  });
});
