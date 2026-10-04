import { describe, it, expect } from "vitest";
import { canMarkNoShow, countPriorNoShows, buildNoShowPatch } from "@/utils/noShow";

const past = { endDate: new Date("2026-01-10") };
const future = { endDate: new Date("2099-01-10") };
const now = new Date("2026-02-01");

describe("canMarkNoShow", () => {
  it("allows confirmed registrants once the climb is over", () => {
    expect(canMarkNoShow({ status: "confirmed" }, past, now)).toBe(true);
  });
  it("not before the climb has happened", () => {
    expect(canMarkNoShow({ status: "confirmed" }, future, now)).toBe(false);
  });
  it("not for people who weren't expected", () => {
    for (const status of ["pending", "waitlisted", "cancelled"]) {
      expect(canMarkNoShow({ status }, past, now)).toBe(false);
    }
  });
  it("not for someone ticked present on the climb-day sheet", () => {
    expect(canMarkNoShow({ status: "confirmed", attended: true }, past, now)).toBe(false);
  });
  it("allows it on a climb an admin marked completed early", () => {
    expect(canMarkNoShow({ status: "confirmed" }, { ...future, status: "completed" }, now)).toBe(true);
  });
});

describe("countPriorNoShows", () => {
  it("counts each member's no-shows on other climbs only", () => {
    const regs = [
      { userId: "a", climbId: "c1", noShow: true },
      { userId: "a", climbId: "c2", noShow: true },
      { userId: "b", climbId: "c2", noShow: true },
      { userId: "c", climbId: "c3", noShow: false },
      { climbId: "c3", noShow: true }, // walk-in, no account
    ];
    expect(countPriorNoShows(regs, "c2")).toEqual({ a: 1 });
    expect(countPriorNoShows(regs, "c9")).toEqual({ a: 2, b: 1 });
  });
});

describe("buildNoShowPatch", () => {
  it("stamps who marked it", () => {
    expect(buildNoShowPatch(true, "Ana", "TS")).toEqual({
      noShow: true,
      noShowMarkedBy: "Ana",
      noShowMarkedAt: "TS",
    });
  });
  it("clears the stamp on undo", () => {
    expect(buildNoShowPatch(false, "Ana", "TS")).toEqual({
      noShow: false,
      noShowMarkedBy: null,
      noShowMarkedAt: null,
    });
  });
});
