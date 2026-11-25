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
