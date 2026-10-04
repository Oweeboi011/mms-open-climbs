import { describe, it, expect } from "vitest";
import {
  climbMonthKey,
  defaultSeason,
  groupClimbsByCompletion,
  groupClimbsByMonth,
  isClimbCompleted,
  monthKeyLabel,
  seasonYears,
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

describe("month sections", () => {
  it("keys on the start date's year and month, any month of the year", () => {
    expect(climbMonthKey({ startDate: ts("2027-03-14") })).toBe("2027-03");
    expect(climbMonthKey({ startDate: "2027-01-02" })).toBe("2027-01");
    expect(climbMonthKey({ month: "jul" })).toBe("0000-07");
    expect(climbMonthKey({})).toBe("0000-00");
  });

  it("labels keys with or without the year", () => {
    expect(monthKeyLabel("2027-03")).toBe("March 2027");
    expect(monthKeyLabel("2027-03", { withYear: false })).toBe("March");
    expect(monthKeyLabel("0000-07")).toBe("July");
    expect(monthKeyLabel("0000-00")).toBe("Date to be announced");
  });

  it("groups in calendar order across years, undated last", () => {
    const a = { id: "a", startDate: ts("2027-01-10") };
    const b = { id: "b", startDate: ts("2026-12-05") };
    const c = { id: "c", startDate: ts("2026-12-01") };
    const d = { id: "d" };
    const sections = groupClimbsByMonth([a, b, d, c]);
    expect(sections.map((s) => s.key)).toEqual(["2026-12", "2027-01", "0000-00"]);
    expect(sections[0].climbs.map((x) => x.id)).toEqual(["c", "b"]);
  });
});

describe("seasons", () => {
  const past = { status: "completed", startDate: ts("2026-07-04") };
  const next = { status: "open", startDate: ts("2027-02-06") };
  const later = { status: "open", startDate: ts("2028-03-01") };

  it("lists the distinct years", () => {
    expect(seasonYears([later, past, next, {}])).toEqual(["2026", "2027", "2028"]);
  });

  it("opens on the season of the next climb still ahead", () => {
    expect(defaultSeason([past, next, later], undefined, now)).toBe("2027");
  });

  it("falls back to the latest season when everything is done", () => {
    expect(defaultSeason([past], undefined, now)).toBe("2026");
  });
});
