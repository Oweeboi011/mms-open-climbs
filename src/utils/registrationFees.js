// Shared fee math for a registration, used across the admin pages that
// review/verify payments (ClimbDetail, ManagePayments, AllRegistrations).
//
// A registration's `feeBreakdown` is a snapshot taken at registration time
// (or last payment submission). When it's missing or empty — e.g. a very old
// registration predating fee tracking — we fall back to the climb's current
// non-optional fees so the numbers still make sense.

function parseAmount(amount) {
  const n = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Sum of the fees this registrant actually owes: their selected
// feeBreakdown items, or the climb's required (non-optional) fees as a
// fallback.
export function getExpectedTotal(reg, climb) {
  const items = reg.feeBreakdown?.length
    ? reg.feeBreakdown.filter((f) => f.selected)
    : (climb?.fees || []).filter((f) => !f.optional);
  return items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
}

// Remaining balance still to be settled: expected total minus whatever
// they've already paid. A rejected payment doesn't count toward what's been
// paid, since it wasn't accepted.
export function getOutstanding(reg, climb) {
  const paidCounted =
    reg.paymentStatus === "rejected" ? 0 : Number(reg.amountPaid) || 0;
  return Math.max(getExpectedTotal(reg, climb) - paidCounted, 0);
}

// Returns a new feeBreakdown array with the transportation entry's
// `selected` flag flipped, synthesizing that entry from the climb's fee
// schedule if the registrant's own snapshot doesn't have one yet. Returns
// null if the climb has no transportation fee at all (nothing to toggle).
export function toggleTransportationEntry(reg, climb) {
  const breakdown = reg.feeBreakdown ? [...reg.feeBreakdown] : [];
  let idx = breakdown.findIndex((f) => /transport/i.test(f.label));
  if (idx === -1) {
    const climbFee = (climb?.fees || []).find((f) =>
      /transport/i.test(f.label),
    );
    if (!climbFee) return null;
    breakdown.push({
      label: climbFee.label,
      amount: climbFee.amount,
      optional: true,
      selected: false,
    });
    idx = breakdown.length - 1;
  }
  return breakdown.map((f, i) => (i === idx ? { ...f, selected: !f.selected } : f));
}
