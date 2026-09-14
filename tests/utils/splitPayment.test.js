/**
 * Tests for splitting one registrant's payment across others on the climb —
 * a joiner who sent a single GCash payment covering friends.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeBatch } from "firebase/firestore";
import { buildSplitPatches, splitPayment } from "@/utils/splitPayment";
import { setEntryStatus } from "@/utils/payments";
import { logAuditEvent } from "@/utils/auditLog";

vi.mock("@/utils/auditLog", () => ({ logAuditEvent: vi.fn() }));

const admin = { uid: "admin-1", displayName: "Admin User" };
const receipt = { url: "https://x/gcash.jpg", fileName: "gcash.jpg" };

const juan = {
  id: "reg-juan",
  name: "Juan Cruz",
  payments: [
    {
      amount: 1500,
      proofs: [receipt],
      status: "verified",
      reviewedBy: "Officer Ana",
    },
  ],
};
const maria = { id: "reg-maria", name: "Maria Santos" };
const pedro = {
  id: "reg-pedro",
  name: "Pedro Reyes",
  payments: [{ amount: 200, proofs: [], status: "submitted" }],
};

describe("buildSplitPatches", () => {
  it("takes each share off the payer's payment", () => {
    const { payerPatch } = buildSplitPatches(juan, 0, [
      { reg: maria, amount: 500 },
      { reg: pedro, amount: 300 },
    ]);
    expect(payerPatch.payments[0]).toMatchObject({
      amount: 700,
      originalAmount: 1500,
      status: "verified",
      proofs: [receipt],
      splitTo: [
        { registrationId: "reg-maria", name: "Maria Santos", amount: 500 },
        { registrationId: "reg-pedro", name: "Pedro Reyes", amount: 300 },
      ],
    });
    expect(payerPatch.amountPaid).toBe(700);
  });

  it("lands each share on the recipient with the same receipt and verdict", () => {
    const { recipients } = buildSplitPatches(
      juan,
      0,
      [
        { reg: maria, amount: 500 },
        { reg: pedro, amount: 300 },
      ],
      { actorName: "Admin User" },
    );
    const [toMaria, toPedro] = recipients;

    expect(toMaria.patch.payments).toHaveLength(1);
    expect(toMaria.patch.payments[0]).toMatchObject({
      amount: 500,
      proofs: [receipt],
      status: "verified",
      reviewedBy: "Officer Ana",
      recordedBy: "Admin User",
      paidBy: { registrationId: "reg-juan", name: "Juan Cruz" },
    });
    expect(toMaria.patch.payments[0].note).toMatch(/Paid by Juan Cruz/);
    expect(toMaria.patch.paymentStatus).toBe("verified");

    // Pedro's own payment is still awaiting review, so he stays in review
    // with the share added on top of it.
    expect(toPedro.patch.payments).toHaveLength(2);
    expect(toPedro.patch.amountPaid).toBe(500);
    expect(toPedro.patch.paymentStatus).toBe("submitted");
  });

  it("can hand over the whole payment", () => {
    const { payerPatch } = buildSplitPatches(juan, 0, [
      { reg: maria, amount: 1500 },
    ]);
    expect(payerPatch.payments[0].amount).toBe(0);
    expect(payerPatch.amountPaid).toBe(0);
  });

  it("builds on an earlier split instead of forgetting it", () => {
    const first = buildSplitPatches(juan, 0, [{ reg: maria, amount: 500 }]);
    const afterFirst = { ...juan, payments: first.payerPatch.payments };

    const second = buildSplitPatches(afterFirst, 0, [
      { reg: pedro, amount: 300 },
    ]);
    expect(second.payerPatch.payments[0]).toMatchObject({
      amount: 700,
      originalAmount: 1500,
    });
    expect(second.payerPatch.payments[0].splitTo).toHaveLength(2);
    expect(() =>
      buildSplitPatches(afterFirst, 0, [{ reg: pedro, amount: 1001 }]),
    ).toThrow(/Only ₱1,000/);
  });

  it("keeps the split details through a later review of the payment", () => {
    const { payerPatch } = buildSplitPatches(juan, 0, [
      { reg: maria, amount: 500 },
    ]);
    const reviewed = setEntryStatus(
      { payments: payerPatch.payments },
      0,
      "submitted",
    );
    expect(reviewed.payments[0]).toMatchObject({
      originalAmount: 1500,
      splitTo: [{ registrationId: "reg-maria", amount: 500 }],
    });
  });

  it("refuses to move more than is on the payment", () => {
    expect(() =>
      buildSplitPatches(juan, 0, [
        { reg: maria, amount: 1000 },
        { reg: pedro, amount: 600 },
      ]),
    ).toThrow(/Only ₱1,500/);
  });

  it("refuses a rejected payment", () => {
    const bounced = {
      ...juan,
      payments: [{ amount: 1500, proofs: [], status: "rejected" }],
    };
    expect(() =>
      buildSplitPatches(bounced, 0, [{ reg: maria, amount: 500 }]),
    ).toThrow(/rejected/);
  });

  it("refuses a split with nothing to move", () => {
    expect(() =>
      buildSplitPatches(juan, 0, [{ reg: maria, amount: 0 }]),
    ).toThrow(/Choose who else/);
  });

  it("refuses to split a payment onto the person who paid it", () => {
    expect(() =>
      buildSplitPatches(juan, 0, [{ reg: juan, amount: 500 }]),
    ).toThrow(/person who paid/);
  });
});

describe("splitPayment", () => {
  let batch;

  beforeEach(() => {
    batch = {
      update: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    };
    writeBatch.mockReturnValue(batch);
  });

  it("writes the payer and every recipient in one batch", async () => {
    await splitPayment(
      juan,
      0,
      [
        { reg: maria, amount: 500 },
        { reg: pedro, amount: 300 },
      ],
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );
    expect(batch.update.mock.calls.map((c) => c[0].path)).toEqual([
      "registrations/reg-juan",
      "registrations/reg-maria",
      "registrations/reg-pedro",
    ]);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the split doesn't add up", async () => {
    await expect(
      splitPayment(juan, 0, [{ reg: maria, amount: 2000 }], {
        currentUser: admin,
      }),
    ).rejects.toThrow(/Only ₱1,500/);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("records who moved what in the audit log", async () => {
    await splitPayment(
      juan,
      0,
      [
        { reg: maria, amount: 500 },
        { reg: pedro, amount: 300 },
      ],
      { currentUser: admin, climbTitle: "Mt. Pulag" },
    );
    const entry = logAuditEvent.mock.calls.at(-1)[0];
    expect(entry.action).toBe("payment_split");
    expect(entry.actorName).toBe("Admin User");
    expect(entry.targetId).toBe("reg-juan");
    expect(entry.details).toMatch(/Split ₱800/);
    expect(entry.details).toMatch(/₱500 to Maria Santos/);
    expect(entry.details).toMatch(/Mt\. Pulag/);
  });
});
