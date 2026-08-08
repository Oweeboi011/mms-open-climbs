// Shared fee math for a registration, used across the admin pages that
// review/verify payments (ClimbDetail, ManagePayments, AllRegistrations).
//
// Fees can change after someone registers — an admin fills in a "TBA" amount,
// corrects a price, or adds a new required fee — but a registration's
// `feeBreakdown` is only a snapshot taken at registration time (or last
// payment submission). If we just summed that frozen snapshot, an already-
// registered joiner's expected/outstanding total would silently go stale
// the moment the climb's fees are edited.
//
// So whenever the climb's current fee schedule is available, it's treated as
// the source of truth for labels/amounts — feeBreakdown is only consulted to
// know which *optional* items (transportation, etc.) this registrant chose.
// Required fees always count at their current amount, even ones added after
// registration. The guest fee counts automatically for joiners (mirroring
// the self-registration flow, since member/joiner status is known
// regardless of feeBreakdown). Other optional fees are NOT assumed — a
// registrant only owes those if they actually selected them, or (for
// walk-ins with no feeBreakdown at all) not at all until toggled on.
//
// Only when the climb itself isn't available (e.g. it was deleted) do we
// fall back to summing the frozen feeBreakdown snapshot as-is.

import { getCountedTotal, hasPaymentHistory } from "./payments";
import { sumFeeAmounts } from "./feeSummary";

// The fee line items this registrant currently owes. See file header for
// how the climb's current fee schedule reconciles with their feeBreakdown
// selections. Exported so display components (FeeBreakdownTable) can list
// the exact items getExpectedTotal sums.
export function getFeeItems(reg, climb) {
  if (!climb?.fees?.length) {
    return reg.feeBreakdown?.length
      ? reg.feeBreakdown.filter((f) => f.selected)
      : [];
  }
  return climb.fees.filter((fee) => {
    // The guest fee follows member type, never a stored selection or the
    // `optional` flag — same rule the registration form applies.
    if (fee.isGuestFee) return reg.memberType === "joiner";
    if (!fee.optional) return true;
    const stored = reg.feeBreakdown?.find((f) => f.label === fee.label);
    return !!stored?.selected;
  });
}

// Sum of the fees this registrant actually owes, at current amounts.
export function getExpectedTotal(reg, climb) {
  return sumFeeAmounts(getFeeItems(reg, climb)).total;
}

// Remaining balance still to be settled: expected total minus whatever
// they've already paid. A rejected payment doesn't count toward what's been
// paid, since it wasn't accepted — with a payment history that's per
// payment (one instalment can be rejected while others stand), and for
// older single-payment registrations it's the registration's own status.
export function getOutstanding(reg, climb) {
  const paidCounted = hasPaymentHistory(reg)
    ? getCountedTotal(reg)
    : reg.paymentStatus === "rejected"
      ? 0
      : Number(reg.amountPaid) || 0;
  return Math.max(getExpectedTotal(reg, climb) - paidCounted, 0);
}

// Audit-trail note for an edit that switched member/joiner. Participant type
// is the one editable field that silently changes what someone owes (it
// drives the guest fee), so "Edited registration" alone hides the money.
// Returns "" when the edit didn't touch it.
export function describeMemberTypeChange(reg, patch) {
  const before = reg?.memberType || "joiner";
  const after = patch?.memberType;
  if (!after || after === before) return "";
  const label = (t) => (t === "member" ? "MMS Member" : "Joiner");
  return ` — participant type ${label(before)} → ${label(after)}`;
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
