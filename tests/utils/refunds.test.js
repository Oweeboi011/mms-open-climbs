/**
 * Tests for refunds — money sent back to a registrant who paid more than
 * they owe — and how they net off every "what they've paid" figure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateDoc } from "firebase/firestore";
import { getRefunds, getRefundedTotal, getNetPaid } from "@/utils/payments";
import { getCountedPaid, getOutstanding } from "@/utils/registrationFees";
import { getExcessPayments } from "@/components/admin/BalanceDueTable";
import { recordRefund, removeRefund } from "@/utils/recordRefund";
import { logAuditEvent } from "@/utils/auditLog";

vi.mock("@/utils/auditLog", () => ({ logAuditEvent: vi.fn() }));

const admin = { uid: "admin-1", displayName: "Admin User" };
const climb = {
  fees: [{ label: "Registration Fee", amount: "500", optional: false }],
};
const overpaid = {
  id: "reg-1",
  name: "Juan Cruz",
  climbId: "climb-1",
  status: "confirmed",
  paymentStatus: "verified",
  amountPaid: 1500,
  payments: [{ amount: 1500, proofs: [], status: "verified" }],
};

describe("refund math", () => {
  it("nets refunds off what counts as paid", () => {
    const reg = {
      ...overpaid,
      refunds: [
        { id: "a", amount: 600 },
        { id: "b", amount: "400" },
      ],
    };
    expect(getRefunds(reg)).toHaveLength(2);
    expect(getRefundedTotal(reg)).toBe(1000);
    expect(getNetPaid(reg)).toBe(500);
    expect(getCountedPaid(reg)).toBe(500);
  });

  it("clears the excess once refunded, and a partial refund leaves the rest", () => {
    expect(getExcessPayments([overpaid], climb)[0].amount).toBe(1000);
    expect(
      getExcessPayments(
        [{ ...overpaid, refunds: [{ id: "a", amount: 400 }] }],
        climb,
      )[0],
    ).toMatchObject({ paid: 1100, amount: 600 });
    expect(
      getExcessPayments(
        [{ ...overpaid, refunds: [{ id: "a", amount: 1000 }] }],
        climb,
      ),
    ).toEqual([]);
  });

  it("puts a balance back if a refund overshoots", () => {
    expect(
      getOutstanding({ ...overpaid, refunds: [{ id: "a", amount: 1200 }] }, climb),
    ).toBe(200);
  });

  it("leaves a registration with no refunds as it was", () => {
    expect(getRefunds({})).toEqual([]);
    expect(getNetPaid(overpaid)).toBe(1500);
  });
});

describe("recordRefund", () => {
  beforeEach(() => {
    updateDoc.mockResolvedValue(undefined);
  });

  it("appends the refund without touching the payments, and logs it", async () => {
    await recordRefund(
      { ...overpaid, refunds: [{ id: "old", amount: 100 }] },
      { amount: 900, note: "GCash ref 1" },
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );

    const patch = updateDoc.mock.calls.at(-1)[1];
    expect(Object.keys(patch).sort()).toEqual(["refunds", "updatedAt"]);
    expect(patch.refunds).toHaveLength(2);
    expect(patch.refunds[1]).toMatchObject({
      amount: 900,
      note: "GCash ref 1",
      recordedBy: "Admin User",
      proofs: [],
    });
    expect(patch.refunds[1].id).toBeTruthy();

    const entry = logAuditEvent.mock.calls.at(-1)[0];
    expect(entry.action).toBe("refund_recorded");
    expect(entry.details).toMatch(/₱900/);
    expect(entry.details).toMatch(/Mt\. Pulag/);
  });

  it("refuses a refund with no amount", async () => {
    await expect(recordRefund(overpaid, { amount: 0 }, {})).rejects.toThrow(
      /amount refunded/,
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe("removeRefund", () => {
  beforeEach(() => {
    updateDoc.mockResolvedValue(undefined);
  });

  it("drops just that refund and logs it", async () => {
    await removeRefund(
      {
        ...overpaid,
        refunds: [
          { id: "keep", amount: 100 },
          { id: "oops", amount: 900 },
        ],
      },
      "oops",
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );

    expect(updateDoc.mock.calls.at(-1)[1].refunds).toEqual([
      { id: "keep", amount: 100 },
    ]);
    const entry = logAuditEvent.mock.calls.at(-1)[0];
    expect(entry.action).toBe("refund_removed");
    expect(entry.details).toMatch(/₱900/);
  });

  it("refuses a refund that's already gone", async () => {
    await expect(removeRefund(overpaid, "missing", {})).rejects.toThrow(
      /no longer on this record/,
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
