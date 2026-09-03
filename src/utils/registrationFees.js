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
import { sumFeeAmounts, parseFeeAmount } from "./feeSummary";

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

// ── Optional services ────────────────────────────────────────────────────────
//
// The opt-in line items on a climb — transportation, porter, anything the
// organisers add later. Admins need headcounts for these to book the right
// number of vans or porters, so every one of them is tracked the same way.
//
// This used to be transportation-only, matched with a /transport/i regex in
// nine places across five files. Adding porter that way would have been a
// third copy of a pattern this schema already abandoned once: the guest fee
// was moved off label-text matching onto an explicit `isGuestFee` flag by
// scripts/rename-expenses-to-fees.mjs. Driving it off the climb's own fee
// schedule instead means a new service needs no code at all.
//
// feeBreakdown entries join to climb fees by `label`, the same key
// getFeeItems uses. Renaming a fee on the climb therefore orphans existing
// selections — pre-existing behaviour, unchanged here.

// The guest fee can carry `optional`, but it follows member type rather than
// a checkbox, so it is never an opt-in service.
export function getOptionalServices(climb) {
  return (climb?.fees || []).filter((f) => f.optional && !f.isGuestFee);
}

export function isAvailing(reg, label) {
  return !!(reg?.feeBreakdown || []).find((f) => f.label === label)?.selected;
}

// Which services to show a toggle for on one registrant: everything the climb
// currently offers, plus anything already in their own snapshot that the climb
// has since dropped — otherwise an orphaned availment could never be cleared.
// Headcounts (getAvailmentCounts) deliberately use the climb's list only,
// since that is what the organisers actually book against.
export function getServicesForRegistrant(reg, climb) {
  const offered = getOptionalServices(climb);
  const orphaned = (reg?.feeBreakdown || []).filter(
    (f) => f.optional && !offered.some((o) => o.label === f.label),
  );
  return [...offered, ...orphaned];
}

// Returns a new feeBreakdown array with one optional fee's `selected` flag
// flipped, synthesizing the entry from the climb's fee schedule if the
// registrant's own snapshot doesn't have it yet — so the toggle works for
// everyone on a climb that offers the service, not just those who registered
// after it was added. Returns null when the climb has no such fee.
export function toggleOptionalFeeEntry(reg, climb, label) {
  const breakdown = reg?.feeBreakdown ? [...reg.feeBreakdown] : [];
  let idx = breakdown.findIndex((f) => f.label === label);
  if (idx === -1) {
    const climbFee = getOptionalServices(climb).find((f) => f.label === label);
    if (!climbFee) return null;
    breakdown.push({
      label: climbFee.label,
      amount: climbFee.amount,
      optional: true,
      selected: false,
    });
    idx = breakdown.length - 1;
  }
  return breakdown.map((f, i) =>
    i === idx ? { ...f, selected: !f.selected } : f,
  );
}

// What should be collected in total for this climb, split by fee line item —
// unit price × how many active registrants currently owe it — so an officer
// collecting money in the field can check a specific item's expected total
// against what's actually come in, not just one lump sum. Order follows the
// climb's own fee schedule; cancelled registrations are excluded since they
// don't owe anything. Summing every item's subtotal equals the sum of
// getExpectedTotal() across active registrants.
export function getFeeItemAggregates(regs, climb) {
  const active = (regs || []).filter((r) => r.status !== "cancelled");
  const order = (climb?.fees || []).map((f) => f.label);
  const totals = new Map();

  active.forEach((reg) => {
    getFeeItems(reg, climb).forEach((item) => {
      const amount = parseFeeAmount(item.amount);
      const existing = totals.get(item.label) || {
        label: item.label,
        amount: item.amount,
        isGuestFee: !!item.isGuestFee,
        optional: !!item.optional,
        count: 0,
        subtotal: 0,
        hasTba: false,
      };
      existing.count += 1;
      if (amount === null) existing.hasTba = true;
      else existing.subtotal += amount;
      totals.set(item.label, existing);
    });
  });

  const items = [...totals.values()].sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label),
  );
  const grandTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const hasTba = items.some((i) => i.hasTba);
  return { items, grandTotal, hasTba };
}

// Per-service headcounts for a climb — what the organisers actually book
// against. Cancelled registrations are excluded: they don't need a seat.
export function getAvailmentCounts(regs, climb) {
  const active = (regs || []).filter((r) => r.status !== "cancelled");
  return getOptionalServices(climb).map((fee) => {
    const availing = active.filter((r) => isAvailing(r, fee.label)).length;
    return {
      label: fee.label,
      amount: fee.amount,
      availing,
      notAvailing: active.length - availing,
      total: active.length,
      pct: active.length ? Math.round((availing / active.length) * 100) : 0,
    };
  });
}
