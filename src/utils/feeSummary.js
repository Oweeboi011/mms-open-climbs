// Shared model for a climb's fee schedule, used by every place that shows
// climb fees (Event page, Register, the admin climbs list).
//
// A climb's `fees` array mixes three kinds of line item and they must never
// be totalled together:
//   - required  — everyone owes these
//   - guest fee — flagged `isGuestFee`; owed by joiners only, never members,
//                 regardless of its `optional` flag (the registration flow
//                 decides it from memberType, not from a checkbox)
//   - optional  — opt-in extras (transportation, etc.); nobody owes them
//                 until the registrant actually selects them
//
// So the headline total is the *required* total. Optional items and the guest
// fee are surfaced separately rather than folded in, which keeps these
// displays consistent with the per-registrant math in registrationFees.js.

export function parseFeeAmount(amount) {
  const n = parseFloat(String(amount ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

// Totals a list of fee line items. TBA amounts are reported via `hasTba`
// rather than counted as zero, so callers can show "₱X + TBA" instead of
// implying the total is final.
export function sumFeeAmounts(fees) {
  let total = 0;
  let hasTba = false;
  let hasAmount = false;
  (fees || []).forEach((fee) => {
    const n = parseFeeAmount(fee.amount);
    if (n === null) hasTba = true;
    else {
      total += n;
      hasAmount = true;
    }
  });
  return { total, hasTba, hasAmount };
}

export function getClimbFeeModel(climb) {
  const fees = climb?.fees || [];
  const guestFee = fees.find((f) => f.isGuestFee) || null;
  const requiredFees = fees.filter((f) => !f.isGuestFee && !f.optional);
  const optionalFees = fees.filter((f) => !f.isGuestFee && f.optional);
  const required = sumFeeAmounts(requiredFees);
  const optional = sumFeeAmounts(optionalFees);

  return {
    fees,
    requiredFees,
    optionalFees,
    guestFee,
    requiredTotal: required.total,
    requiredHasTBA: required.hasTba,
    requiredHasAmount: required.hasAmount,
    optionalTotal: optional.total,
    optionalHasTBA: optional.hasTba,
    guestAmount: guestFee ? parseFeeAmount(guestFee.amount) : null,
  };
}

// What a specific registrant owes: required fees, the guest fee if they are a
// joiner, plus whichever optional items they ticked. `optionalSelections` is
// keyed by fee label, matching the shape stored on a registration.
export function computeExpectedTotal(
  climb,
  { isJoiner = false, optionalSelections = {} } = {},
) {
  const { requiredFees, optionalFees, guestFee } = getClimbFeeModel(climb);
  const counted = [
    ...requiredFees,
    ...(isJoiner && guestFee ? [guestFee] : []),
    ...optionalFees.filter((f) => optionalSelections[f.label]),
  ];
  const { total, hasTba } = sumFeeAmounts(counted);
  return { total, hasTba };
}

export function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString("en-PH")}`;
}

// One-line summary for dense listings (the admin climbs table). The detail —
// which items are optional, what the guest fee is — lives in the expanded row.
export function getFeeSummary(climb) {
  const {
    fees,
    requiredHasTBA,
    requiredHasAmount,
    requiredTotal,
    optionalFees,
    guestAmount,
  } = getClimbFeeModel(climb);
  if (!fees.length) return null;

  const itemLabel = `${fees.length} item${fees.length !== 1 ? "s" : ""}`;
  const parts = [];
  if (!requiredHasAmount) {
    parts.push("required TBA");
  } else {
    parts.push(
      `${formatPeso(requiredTotal)} required${requiredHasTBA ? " (excl. TBA)" : ""}`,
    );
  }
  if (optionalFees.length) {
    parts.push(`+${optionalFees.length} optional`);
  }
  if (guestAmount !== null) {
    parts.push(`+${formatPeso(guestAmount)} guest`);
  }
  return `${itemLabel} — ${parts.join(", ")}`;
}
