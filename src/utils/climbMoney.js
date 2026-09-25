import { getExpectedTotal, getCountedPaid } from "@/utils/registrationFees";
import { getRefundedTotal } from "@/utils/payments";

// Explains a climb's money: how "what active registrants owe" becomes "what
// has been verified". The two differ for concrete, listable reasons, and
// without them a figure like "₱216,289 of ₱207,940 expected (104%)" reads
// as an error. Every peso of the difference lands in exactly one bucket:
//
//   verified = expected − awaiting review − still owed
//              + paid more than owed + kept from cancelled registrations
//
// `verified` is computed the same way as ClimbDetail's Total Paid tile:
// amountPaid of verified registrations, less refunds.
function verifiedAmount(reg) {
  return (reg.paymentStatus === "verified" ? Number(reg.amountPaid) || 0 : 0) -
    getRefundedTotal(reg);
}

const round = (n) => Math.round(n * 100) / 100;

// What on a climb needs an admin's hand, for the climbs list: payments
// waiting for review, and money to settle (overpayments and money kept from
// cancelled registrations — each needs a split, a refund, or a decision).
export function getClimbAttention(regs = [], climb = {}, serviceGroups = {}) {
  const r = reconcileClimbMoney(regs, climb, serviceGroups);
  // Centavo-level differences aren't worth an admin's attention.
  const toSettle = [...r.overpaid.entries, ...r.keptFromCancelled.entries].filter(
    (e) => Math.abs(e.amount) >= 1,
  );
  return {
    toReview: regs.filter(
      (reg) => reg.status !== "cancelled" && reg.paymentStatus === "submitted",
    ).length,
    toSettleCount: toSettle.length,
    toSettleTotal: round(toSettle.reduce((s, e) => s + e.amount, 0)),
  };
}

export function reconcileClimbMoney(regs = [], climb = {}, serviceGroups = {}) {
  const buckets = {
    awaitingReview: [],
    stillOwed: [],
    overpaid: [],
    keptFromCancelled: [],
  };
  let expected = 0;
  let verified = 0;
  let activeCount = 0;

  for (const reg of regs) {
    const paid = verifiedAmount(reg);
    verified += paid;
    if (reg.status === "cancelled") {
      if (Math.abs(paid) >= 0.005) {
        buckets.keptFromCancelled.push({ reg, amount: round(paid) });
      }
      continue;
    }
    activeCount++;
    const owes = getExpectedTotal(reg, climb, serviceGroups);
    expected += owes;
    if (paid - owes >= 0.005) {
      buckets.overpaid.push({ reg, amount: round(paid - owes), owes, paid });
      continue;
    }
    const gap = owes - paid;
    if (gap < 0.005) continue;
    // Declared but not yet reviewed: counts toward what they've paid, not yet
    // toward what's verified.
    const declared = Math.max(0, getCountedPaid(reg) - paid);
    const pending =
      reg.paymentStatus === "submitted" ? Math.min(gap, declared) : 0;
    if (pending >= 0.005) {
      buckets.awaitingReview.push({ reg, amount: round(pending) });
    }
    if (gap - pending >= 0.005) {
      buckets.stillOwed.push({ reg, amount: round(gap - pending) });
    }
  }

  const total = (list) => round(list.reduce((s, e) => s + e.amount, 0));
  return {
    activeCount,
    expected: round(expected),
    verified: round(verified),
    awaitingReview: { entries: buckets.awaitingReview, total: total(buckets.awaitingReview) },
    stillOwed: { entries: buckets.stillOwed, total: total(buckets.stillOwed) },
    overpaid: { entries: buckets.overpaid, total: total(buckets.overpaid) },
    keptFromCancelled: {
      entries: buckets.keptFromCancelled,
      total: total(buckets.keptFromCancelled),
    },
  };
}
