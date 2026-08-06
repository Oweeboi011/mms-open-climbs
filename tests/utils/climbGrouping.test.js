import { describe, it, expect } from "vitest";
import {
  groupClimbsByCompletion,
  isClimbCompleted,
} from "@/utils/climbGrouping";

const now = new Date("2026-08-07T12:00:00");
const ts = (iso) => ({ toDate: () => new Date(iso) });

describe("isClimbCompleted", () => {
  it("counts a climb whose event day has passed", () => {
    expect(isClimbCompleted({ startDate: ts("2026-08-01") }, now)).toBe(true);
  });

  it("keeps a climb happening today as upcoming until the day is over", () => {
    expect(isClimbCompleted({ startDate: ts("2026-08-07") }, now)).toBe(false);
  });

  it("honors an admin marking a future climb completed", () => {
    expect(
      isClimbCompleted({ status: "completed", startDate: ts("2026-12-01") }, now),
    ).toBe(true);
  });

  it("prefers endDate over startDate for multi-day climbs", () => {
    expect(
      isClimbCompleted(
        { startDate: ts("2026-08-05"), endDate: ts("2026-08-09") },
        now,
      ),
    ).toBe(false);
  });

  it("treats a dateless climb as upcoming", () => {
    expect(isClimbCompleted({}, now)).toBe(false);
  });

  it("accepts plain date strings from the admin date picker", () => {
    expect(isClimbCompleted({ startDate: "2026-08-01" }, now)).toBe(true);
  });
});

describe("groupClimbsByCompletion", () => {
  it("sorts upcoming soonest-first and completed most-recent-first", () => {
    const climbs = [
      { id: "far", startDate: ts("2026-12-01") },
      { id: "old", startDate: ts("2025-01-01") },
      { id: "soon", startDate: ts("2026-09-01") },
      { id: "recent", startDate: ts("2026-08-01") },
    ];
    const { upcoming, completed } = groupClimbsByCompletion(climbs, now);
    expect(upcoming.map((c) => c.id)).toEqual(["soon", "far"]);
    expect(completed.map((c) => c.id)).toEqual(["recent", "old"]);
  });

  it("sorts dateless climbs last among the upcoming", () => {
    const { upcoming } = groupClimbsByCompletion(
      [{ id: "undated" }, { id: "soon", startDate: ts("2026-09-01") }],
      now,
    );
    expect(upcoming.map((c) => c.id)).toEqual(["soon", "undated"]);
  });

  it("handles an empty list", () => {
    expect(groupClimbsByCompletion([], now)).toEqual({
      upcoming: [],
      completed: [],
    });
  });
});
