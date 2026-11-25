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
