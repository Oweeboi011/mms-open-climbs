import { describe, it, expect } from "vitest";
import {
  attendanceOf,
  buildMemberClimbs,
  lastSeen,
  latestSafetyDetails,
} from "@/utils/memberProfile";

const now = new Date("2026-09-25T12:00:00");
const past = { title: "Mt. Pulag", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-03"), fees: [{ label: "Fee", amount: "1000" }] };
const future = { title: "Mt. Apo", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-03"), fees: [{ label: "Fee", amount: "2000" }] };
const climbsById = { past, future };

const regs = [
  { id: "r1", climbId: "past", status: "confirmed", attended: true, paymentStatus: "verified", amountPaid: 1000, payments: [{ amount: 1000, status: "verified" }], waiverSigned: true, donationReceived: { cash: 300 } },
  { id: "r2", climbId: "future", status: "pending", paymentStatus: "submitted", amountPaid: 500, payments: [{ amount: 500, status: "submitted" }] },
  { id: "r3", climbId: "past", status: "cancelled", paymentStatus: "verified", amountPaid: 1000, payments: [{ amount: 1000, status: "verified" }], refunds: [{ amount: 1000 }] },
];

describe("attendanceOf", () => {
  it("reads what the records say about the day", () => {
    expect(attendanceOf({ status: "confirmed", attended: true }, past, now)).toBe("present");
    expect(attendanceOf({ status: "confirmed", noShow: true }, past, now)).toBe("no-show");
    expect(attendanceOf({ status: "confirmed" }, past, now)).toBe("not recorded");
    expect(attendanceOf({ status: "confirmed" }, future, now)).toBe("upcoming");
    expect(attendanceOf({ status: "cancelled" }, past, now)).toBe("cancelled");
  });
});

describe("buildMemberClimbs", () => {
  const { rows, totals } = buildMemberClimbs(regs, climbsById, {}, now);

  it("lists every registration, newest climb first", () => {
    expect(rows.map((r) => r.reg.id)).toEqual(["r2", "r1", "r3"]);
    expect(rows[0].owed).toBe(1500);
  });

  it("totals the member's record", () => {
    expect(totals).toEqual({
      climbs: 2,
      attended: 1,
      cancelled: 1,
      noShows: 0,
      paid: 1500,
      owed: 1500,
      donated: 300,
    });
  });
});

describe("latestSafetyDetails / lastSeen", () => {
  it("takes contact details from the latest registration", () => {
    const details = latestSafetyDetails([
      { createdAt: 1, mobile: "old", climbTitle: "A" },
      { createdAt: 5, mobile: "0917", emergencyContact: { name: "Mom" }, medicalConditions: "None", climbTitle: "B" },
    ]);
    expect(details).toMatchObject({ mobile: "0917", fromClimb: "B" });
    expect(latestSafetyDetails([])).toBeNull();
  });

  it("finds the most recent page view", () => {
    expect(lastSeen([{ timestamp: { toMillis: () => 5 } }, { timestamp: { toMillis: () => 9 } }])).toBe(9);
    expect(lastSeen([])).toBe(0);
  });
});
