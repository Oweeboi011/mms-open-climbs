import { describe, it, expect } from "vitest";
import {
  getPaymentEntries,
  getPaymentsTotal,
  getCountedTotal,
  getAllProofs,
  hasAdjustedTotal,
  derivePaymentStatus,
  buildPaymentPatch,
  setEntryStatus,
  setAllEntryStatuses,
} from "@/utils/payments";

const proof = (name) => ({ url: `https://x/${name}`, fileName: name });

describe("getPaymentEntries", () => {
  it("lists each submission in order", () => {
    const reg = {
      amountPaid: 800,
      payments: [
        { amount: 500, proofs: [proof("a.jpg")], submittedAt: null },
        { amount: 300, proofs: [proof("b.jpg")], submittedAt: null, note: "balance" },
      ],
    };
    const entries = getPaymentEntries(reg);
    expect(entries).toHaveLength(2);
    expect(entries[0].amount).toBe(500);
    expect(entries[1].note).toBe("balance");
  });

  it("keeps string amounts usable", () => {
    const reg = { payments: [{ amount: "₱1,200.50", proofs: [] }] };
    expect(getPaymentEntries(reg)[0].amount).toBe(1200.5);
  });

  it("folds a pre-`payments` registration into a single entry", () => {
    const reg = {
      amountPaid: 500,
      paymentProofs: [proof("a.jpg"), proof("b.jpg")],
      paymentSubmittedAt: { seconds: 1 },
    };
    const entries = getPaymentEntries(reg);
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(500);
    expect(entries[0].proofs).toHaveLength(2);
    expect(entries[0].submittedAt).toEqual({ seconds: 1 });
  });

  it("returns nothing when no payment was ever recorded", () => {
    expect(getPaymentEntries({ paymentStatus: "unpaid" })).toEqual([]);
    expect(getPaymentEntries({ amountPaid: null, paymentProofs: [] })).toEqual([]);
  });

  it("returns entries that can be written straight back as the new history", () => {
    const reg = { amountPaid: 500, paymentProofs: [proof("a.jpg")] };
    const next = [
      ...getPaymentEntries(reg),
      { amount: 300, proofs: [proof("b.jpg")], submittedAt: null },
    ];
    expect(next.map((p) => p.amount)).toEqual([500, 300]);
    expect(next.every((p) => "amount" in p && "proofs" in p)).toBe(true);
  });
});

describe("getPaymentsTotal", () => {
  it("sums every submission", () => {
    const reg = {
      payments: [{ amount: 500, proofs: [] }, { amount: 300, proofs: [] }],
    };
    expect(getPaymentsTotal(reg)).toBe(800);
  });

  it("falls back to amountPaid for legacy registrations", () => {
    expect(getPaymentsTotal({ amountPaid: 450 })).toBe(450);
  });
});

describe("hasAdjustedTotal", () => {
  it("flags an amountPaid an admin edited away from the recorded submissions", () => {
    const reg = {
      amountPaid: 1000,
      payments: [{ amount: 500, proofs: [] }, { amount: 300, proofs: [] }],
    };
    expect(hasAdjustedTotal(reg)).toBe(true);
  });

  it("stays quiet when the total matches", () => {
    const reg = {
      amountPaid: 800,
      payments: [{ amount: 500, proofs: [] }, { amount: 300, proofs: [] }],
    };
    expect(hasAdjustedTotal(reg)).toBe(false);
  });

  it("never flags legacy registrations, which have nothing to compare against", () => {
    expect(hasAdjustedTotal({ amountPaid: 500, paymentProofs: [] })).toBe(false);
  });
});

describe("per-payment review", () => {
  it("defaults an entry with no status to awaiting review", () => {
    const reg = { payments: [{ amount: 500, proofs: [] }] };
    expect(getPaymentEntries(reg)[0].status).toBe("submitted");
  });

  it("gives a legacy registration's lone payment the registration's own verdict", () => {
    const reg = {
      amountPaid: 500,
      paymentStatus: "verified",
      paymentProofs: [proof("a.jpg")],
    };
    expect(getPaymentEntries(reg)[0].status).toBe("verified");
  });

  it("leaves rejected payments out of the counted total", () => {
    const reg = {
      payments: [
        { amount: 500, proofs: [], status: "verified" },
        { amount: 300, proofs: [], status: "rejected" },
      ],
    };
    expect(getPaymentsTotal(reg)).toBe(800);
    expect(getCountedTotal(reg)).toBe(500);
  });

  it("counts payments still awaiting review — the member has declared them", () => {
    const reg = {
      payments: [
        { amount: 500, proofs: [], status: "verified" },
        { amount: 300, proofs: [], status: "submitted" },
      ],
    };
    expect(getCountedTotal(reg)).toBe(800);
  });

  it("doesn't mistake a rejected payment for an admin's manual override", () => {
    const reg = {
      amountPaid: 500,
      payments: [
        { amount: 500, proofs: [], status: "verified" },
        { amount: 300, proofs: [], status: "rejected" },
      ],
    };
    expect(hasAdjustedTotal(reg)).toBe(false);
  });
});

describe("derivePaymentStatus", () => {
  it("keeps the registration in the review queue while any payment is unreviewed", () => {
    expect(
      derivePaymentStatus([{ status: "verified" }, { status: "submitted" }]),
    ).toBe("submitted");
  });

  it("verifies once everything is reviewed and at least one payment stands", () => {
    expect(
      derivePaymentStatus([{ status: "verified" }, { status: "rejected" }]),
    ).toBe("verified");
  });

  it("rejects only when every payment was rejected", () => {
    expect(
      derivePaymentStatus([{ status: "rejected" }, { status: "rejected" }]),
    ).toBe("rejected");
  });

  it("reads as unpaid with no payments at all", () => {
    expect(derivePaymentStatus([])).toBe("unpaid");
  });
});

describe("status patches", () => {
  const reg = {
    amountPaid: 800,
    payments: [
      { amount: 500, proofs: [], status: "verified" },
      { amount: 300, proofs: [], status: "submitted" },
    ],
  };

  it("reviews one payment and re-derives the total and rolled-up status", () => {
    const patch = setEntryStatus(reg, 1, "rejected");
    expect(patch.payments[0].status).toBe("verified");
    expect(patch.payments[1].status).toBe("rejected");
    expect(patch.amountPaid).toBe(500);
    expect(patch.paymentStatus).toBe("verified");
  });

  it("applies a registration-level verdict to every payment", () => {
    const patch = setAllEntryStatuses(reg, "rejected");
    expect(patch.payments.every((p) => p.status === "rejected")).toBe(true);
    expect(patch.amountPaid).toBe(0);
    expect(patch.paymentStatus).toBe("rejected");
  });

  it("normalizes a legacy registration into a history when reviewed", () => {
    const legacy = { amountPaid: 500, paymentProofs: [proof("a.jpg")] };
    const patch = setAllEntryStatuses(legacy, "verified");
    expect(patch.payments).toHaveLength(1);
    expect(patch.payments[0].status).toBe("verified");
    expect(patch.amountPaid).toBe(500);
  });

  it("still sets a status when there's nothing paid to review", () => {
    expect(setAllEntryStatuses({}, "verified")).toEqual({
      paymentStatus: "verified",
    });
  });

  it("stamps who made the verdict and when", () => {
    const at = { seconds: 1 };
    const patch = setEntryStatus(reg, 1, "verified", {
      uid: "admin-1",
      name: "Boss",
      at,
    });
    expect(patch.payments[1].reviewedBy).toBe("Boss");
    expect(patch.payments[1].reviewedAt).toBe(at);
    // Untouched payments keep their own history.
    expect(patch.payments[0].reviewedBy).toBeUndefined();
  });

  it("works without a reviewer, for callers that don't have one", () => {
    const patch = setEntryStatus(reg, 1, "verified");
    expect(patch.payments[1].status).toBe("verified");
    expect(patch.payments[1].reviewedBy).toBeUndefined();
  });

  it("moves payments, amountPaid and paymentStatus together", () => {
    const patch = buildPaymentPatch([
      { amount: 500, proofs: [], status: "verified" },
      { amount: 300, proofs: [], status: "rejected" },
    ]);
    expect(Object.keys(patch).sort()).toEqual([
      "amountPaid",
      "paymentStatus",
      "payments",
    ]);
    expect(patch.amountPaid).toBe(500);
  });
});

describe("getAllProofs", () => {
  it("flattens receipts across payments", () => {
    const reg = {
      payments: [
        { amount: 500, proofs: [proof("a.jpg")] },
        { amount: 300, proofs: [proof("b.jpg"), proof("c.pdf")] },
      ],
    };
    expect(getAllProofs(reg)).toHaveLength(3);
  });

  it("uses the legacy flat list when there's no history", () => {
    expect(getAllProofs({ paymentProofs: [proof("a.jpg")] })).toHaveLength(1);
  });
});
