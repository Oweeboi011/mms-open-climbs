/**
 * Tests for recordManualPayment — money the club received outside the app.
 *
 * Shared by climb detail, all registrations and manage payments, so the write
 * and its audit entry can't drift between the three.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateDoc } from "firebase/firestore";
import { recordManualPayment } from "@/utils/recordPayment";
import { logAuditEvent } from "@/utils/auditLog";

vi.mock("@/utils/auditLog", () => ({ logAuditEvent: vi.fn() }));

const admin = { uid: "admin-1", displayName: "Admin User" };

function patchFrom() {
  return updateDoc.mock.calls.at(-1)[1];
}

describe("recordManualPayment", () => {
  beforeEach(() => {
    updateDoc.mockResolvedValue(undefined);
  });

  it("appends to the payment history rather than overwriting the total", async () => {
    const reg = {
      id: "reg-1",
      name: "Juan Cruz",
      payments: [{ amount: 200, proofs: [], status: "verified" }],
    };
    await recordManualPayment(
      reg,
      { amount: 300, note: "cash at jump-off", markVerified: true },
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );

    const patch = patchFrom();
    expect(patch.payments).toHaveLength(2);
    expect(patch.payments[0]).toMatchObject({ amount: 200 });
    expect(patch.payments[1]).toMatchObject({
      amount: 300,
      status: "verified",
      note: "cash at jump-off",
      recordedBy: "Admin User",
    });
  });

  it("leaves the payment awaiting review when not marked verified", async () => {
    await recordManualPayment(
      { id: "reg-1", name: "Juan Cruz" },
      { amount: 500, markVerified: false },
      { currentUser: admin },
    );
    expect(patchFrom().payments.at(-1).status).toBe("submitted");
  });

  it("carries no proof, because there is no receipt to attach", async () => {
    await recordManualPayment(
      { id: "reg-1" },
      { amount: 500, markVerified: true },
      { currentUser: admin },
    );
    expect(patchFrom().payments.at(-1).proofs).toEqual([]);
  });

  it("omits an empty note rather than storing a blank", async () => {
    await recordManualPayment(
      { id: "reg-1" },
      { amount: 500, note: "", markVerified: true },
      { currentUser: admin },
    );
    expect(patchFrom().payments.at(-1)).not.toHaveProperty("note");
  });

  it("records who took the money and whether it counts yet", async () => {
    await recordManualPayment(
      { id: "reg-1", name: "Juan Cruz" },
      { amount: 500, markVerified: false },
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );
    const entry = logAuditEvent.mock.calls.at(-1)[0];
    expect(entry.action).toBe("payment_recorded");
    expect(entry.actorName).toBe("Admin User");
    expect(entry.details).toMatch(/₱500/);
    expect(entry.details).toMatch(/Mt\. Pulag/);
    expect(entry.details).toMatch(/awaiting review/);
  });
});
