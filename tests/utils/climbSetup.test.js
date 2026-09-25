import { describe, it, expect } from "vitest";
import { getSetupGaps, nextMeeting } from "@/utils/climbSetup";

describe("getSetupGaps", () => {
  it("lists what a bare climb still needs", () => {
    const gaps = getSetupGaps({}, {});
    expect(gaps).toEqual(expect.arrayContaining([
      expect.stringMatching(/dates/),
      expect.stringMatching(/participant limit/),
      expect.stringMatching(/fee schedule/),
      expect.stringMatching(/officers/),
      expect.stringMatching(/cancellation/),
      expect.stringMatching(/pre-climb meeting/),
    ]));
  });

  it("is empty for a fully set-up climb", () => {
    const climb = {
      startDate: "2026-10-03", maxParticipants: 20, fees: [{ label: "Fee", amount: "1" }],
      gcashNumber: "0917", officers: [{ name: "A" }], paymentDueDate: "2026-09-30",
      cancellationPolicy: "No refunds within 7 days.",
    };
    expect(getSetupGaps(climb, { preClimbMeetings: [{ date: "2026-09-28" }] })).toEqual([]);
  });

  it("asks for GCash details only when there are fees to pay", () => {
    expect(getSetupGaps({ fees: [] }, {}).some((g) => /GCash/.test(g))).toBe(false);
    expect(getSetupGaps({ fees: [{ label: "F", amount: "1" }] }, {}).some((g) => /GCash/.test(g))).toBe(true);
  });
});

describe("nextMeeting", () => {
  it("picks the soonest meeting from today on", () => {
    const now = new Date("2026-09-20T00:00:00Z");
    const m = nextMeeting([{ date: "2026-09-10" }, { date: "2026-09-30" }, { date: "2026-09-25" }], now);
    expect(m.date).toBe("2026-09-25");
    expect(nextMeeting([{ date: "2026-09-01" }], now)).toBeNull();
  });
});
