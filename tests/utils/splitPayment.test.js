/**
 * Tests for splitting one registrant's payment across others on the climb —
 * a joiner who sent a single GCash payment covering friends.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeBatch } from "firebase/firestore";
import {
  buildSplitPatches,
  splitPayment,
  buildUndoSplitPatches,
  undoSplitPayment,
} from "@/utils/splitPayment";
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

// Applies a split to plain registration objects, the way the live snapshot
// would hand them back after the write.
function splitJuan(allocations) {
  const { payerPatch, recipients } = buildSplitPatches(juan, 0, allocations);
  return {
    payer: { ...juan, payments: payerPatch.payments },
    recipients: recipients.map(({ reg, patch }) => ({
      ...reg,
      payments: patch.payments,
    })),
  };
}

function shareFor(payer, recipient) {
  const s = payer.payments[0].splitTo.find(
    (x) => x.registrationId === recipient.id,
  );
  return {
    payerId: payer.id,
    recipientId: recipient.id,
    splitId: s.splitId,
    amount: s.amount,
  };
}

describe("buildUndoSplitPatches", () => {
  it("puts the share back on the payer and takes it off the recipient", () => {
    const {
      payer,
      recipients: [mariaAfter],
    } = splitJuan([{ reg: maria, amount: 500 }]);
    const { payerPatch, recipientPatch } = buildUndoSplitPatches(
      payer,
      mariaAfter,
      shareFor(payer, mariaAfter),
    );

    expect(payerPatch.payments[0]).toMatchObject({
      amount: 1500,
      status: "verified",
      proofs: [receipt],
    });
    expect(payerPatch.payments[0]).not.toHaveProperty("splitTo");
    expect(payerPatch.payments[0]).not.toHaveProperty("originalAmount");
    expect(recipientPatch).toMatchObject({
      payments: [],
      amountPaid: 0,
      paymentStatus: "unpaid",
    });
  });

  it("undoes one share and leaves the others split", () => {
    const {
      payer,
      recipients: [, pedroAfter],
    } = splitJuan([
      { reg: maria, amount: 500 },
      { reg: pedro, amount: 300 },
    ]);
    const { payerPatch, recipientPatch } = buildUndoSplitPatches(
      payer,
      pedroAfter,
      shareFor(payer, pedroAfter),
    );

    expect(payerPatch.payments[0]).toMatchObject({
      amount: 1000,
      originalAmount: 1500,
    });
    expect(payerPatch.payments[0].splitTo).toEqual([
      expect.objectContaining({ registrationId: "reg-maria" }),
    ]);
    // Pedro keeps the payment he made himself.
    expect(recipientPatch.payments).toHaveLength(1);
    expect(recipientPatch.amountPaid).toBe(200);
  });

  it("matches a split recorded before splits carried an id", () => {
    const payer = {
      id: "reg-juan",
      name: "Juan Cruz",
      payments: [
        {
          amount: 1000,
          originalAmount: 1500,
          proofs: [],
          status: "verified",
          splitTo: [
            { registrationId: "reg-maria", name: "Maria Santos", amount: 500 },
          ],
        },
      ],
    };
    const recipient = {
      id: "reg-maria",
      name: "Maria Santos",
      payments: [
        {
          amount: 500,
          proofs: [],
          status: "verified",
          paidBy: { registrationId: "reg-juan", name: "Juan Cruz" },
        },
      ],
    };
    const { payerPatch, recipientPatch } = buildUndoSplitPatches(
      payer,
      recipient,
      { recipientId: "reg-maria", amount: 500 },
    );
    expect(payerPatch.payments[0].amount).toBe(1500);
    expect(recipientPatch.payments).toEqual([]);
  });

  it("still returns the money to the payer if the recipient's registration is gone", () => {
    const {
      payer,
      recipients: [mariaAfter],
    } = splitJuan([{ reg: maria, amount: 500 }]);
    const { payerPatch, recipientPatch } = buildUndoSplitPatches(
      payer,
      null,
      shareFor(payer, mariaAfter),
    );
    expect(payerPatch.payments[0].amount).toBe(1500);
    expect(recipientPatch).toBeNull();
  });

  it("refuses once the split is no longer on record", () => {
    expect(() =>
      buildUndoSplitPatches(juan, maria, {
        recipientId: "reg-maria",
        splitId: "gone",
        amount: 500,
      }),
    ).toThrow(/no longer on the payer's record/);
  });

  it("won't split a share that was itself split onto this record", () => {
    const {
      recipients: [mariaAfter],
    } = splitJuan([{ reg: maria, amount: 500 }]);
    expect(() =>
      buildSplitPatches(mariaAfter, 0, [{ reg: pedro, amount: 100 }]),
    ).toThrow(/undo that split/);
  });
});

describe("undoSplitPayment", () => {
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

  it("restores the payer and the recipient together, and logs it", async () => {
    const {
      payer,
      recipients: [mariaAfter],
    } = splitJuan([{ reg: maria, amount: 500 }]);
    await undoSplitPayment(payer, mariaAfter, shareFor(payer, mariaAfter), {
      currentUser: admin,
      climbTitle: "Mt. Pulag",
    });

    expect(batch.update.mock.calls.map((c) => c[0].path)).toEqual([
      "registrations/reg-juan",
      "registrations/reg-maria",
    ]);
    expect(batch.commit).toHaveBeenCalledTimes(1);

    const entry = logAuditEvent.mock.calls.at(-1)[0];
    expect(entry.action).toBe("payment_split_undone");
    expect(entry.details).toMatch(/₱500 split to Maria Santos/);
    expect(entry.details).toMatch(/Mt\. Pulag/);
  });
});
