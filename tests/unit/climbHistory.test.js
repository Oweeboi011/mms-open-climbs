import { describe, it, expect } from "vitest";
import { buildClimbHistory, chunk, describeAction } from "@/utils/climbHistory";

describe("climb history", () => {
  it("merges admin actions with what members and the server did, newest first", () => {
    const audit = [
      { id: "1", action: "payment_entry_verified", actorName: "Lead Ana", targetType: "registration", targetLabel: "Ben", createdAt: { toMillis: () => 3000 } },
      { id: "2", action: "climb_updated", actorName: "Admin", targetType: "climb", targetLabel: "Mt. Pulag", createdAt: { toMillis: () => 1000 } },
    ];
    const regs = [
      {
        id: "r1", name: "Ben", userId: "u1", createdAt: 2000,
        payments: [{ amount: 500, submittedAt: 2500 }, { amount: 100, submittedAt: 2600, recordedBy: "Admin" }],
        cancelledByMember: true, cancelledAt: 4000,
      },
      { id: "r2", name: "Walk In", createdAt: 1500, autoWaitlisted: true, promotedFromWaitlistAt: 3500 },
    ];
    const events = buildClimbHistory(audit, regs);
    expect(events.map((e) => e.what)).toEqual([
      "Cancelled from My Climbs",
      "Moved off the waitlist (a seat opened)",
      "Marked payment verified",
      "Submitted a ₱500 payment",
      "Registered",
      "Added as a walk-in",
      "Put on the waitlist (climb was full)",
      "Edited climb settings",
    ]);
    // Admin-recorded payments come from the audit log, not the registration.
    expect(events.some((e) => /₱100/.test(e.what))).toBe(false);
  });

  it("describes unknown and pattern actions readably", () => {
    expect(describeAction("registration_status_confirmed")).toBe("Set status to confirmed");
    expect(describeAction("something_new")).toBe("something new");
  });

  it("chunks ids for Firestore in-queries", () => {
    expect(chunk(Array.from({ length: 65 }, (_, i) => i)).map((c) => c.length)).toEqual([30, 30, 5]);
  });
});
