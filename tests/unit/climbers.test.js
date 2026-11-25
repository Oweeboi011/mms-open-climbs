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
