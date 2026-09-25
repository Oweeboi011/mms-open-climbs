import { describe, it, expect } from "vitest";
import { reconcileClimbMoney } from "@/utils/climbMoney";

const climb = { fees: [{ label: "Hike Package", amount: "1000" }] };
const pay = (amount, status = "verified") => ({ amount, status, proofs: [] });

const regs = [
  // exactly paid
  { id: "a", name: "Ana", status: "confirmed", paymentStatus: "verified", amountPaid: 1000, payments: [pay(1000)] },
  // paid for a friend too
  { id: "b", name: "Ben", status: "confirmed", paymentStatus: "verified", amountPaid: 2000, payments: [pay(2000)] },
  // part-paid, verified
  { id: "c", name: "Cara", status: "confirmed", paymentStatus: "verified", amountPaid: 900, payments: [pay(900)] },
  // declared, not reviewed yet
  { id: "d", name: "Dan", status: "pending", paymentStatus: "submitted", amountPaid: 600, payments: [pay(600, "submitted")] },
  // nothing yet
  { id: "e", name: "Eve", status: "pending", paymentStatus: "unpaid", amountPaid: null, payments: [] },
  // cancelled, money kept
  { id: "f", name: "Fay", status: "cancelled", paymentStatus: "verified", amountPaid: 550, payments: [pay(550)] },
  // cancelled and fully refunded
  {
    id: "g", name: "Gil", status: "cancelled", paymentStatus: "verified", amountPaid: 1000,
    payments: [pay(1000)], refunds: [{ amount: 1000 }],
  },
];

describe("reconcileClimbMoney", () => {
  const r = reconcileClimbMoney(regs, climb);

  it("sums what active registrants owe and what is verified", () => {
    expect(r.activeCount).toBe(5);
    expect(r.expected).toBe(5000);
    expect(r.verified).toBe(1000 + 2000 + 900 + 550);
  });

  it("puts every peso of the difference in exactly one bucket", () => {
    expect(r.overpaid.total).toBe(1000);
    expect(r.overpaid.entries.map((e) => e.reg.id)).toEqual(["b"]);
    expect(r.stillOwed.entries.map((e) => [e.reg.id, e.amount])).toEqual([
      ["c", 100],
      ["d", 400],
      ["e", 1000],
    ]);
    expect(r.awaitingReview.entries.map((e) => [e.reg.id, e.amount])).toEqual([["d", 600]]);
    expect(r.keptFromCancelled.entries.map((e) => [e.reg.id, e.amount])).toEqual([["f", 550]]);
  });

  it("reconciles exactly", () => {
    const rebuilt =
      r.expected - r.awaitingReview.total - r.stillOwed.total + r.overpaid.total + r.keptFromCancelled.total;
    expect(Math.round(rebuilt * 100) / 100).toBe(r.verified);
  });
});
