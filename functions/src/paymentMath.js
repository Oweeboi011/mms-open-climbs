// Payment and fee math for the Cloud Functions side.
//
// This deliberately mirrors `src/utils/payments.js` and
// `src/utils/registrationFees.js` from the frontend. The two can't share a
// module — the frontend is ESM built by Vite, Functions is CommonJS on
// Node — so the rules are restated here. Keep them in step: a registrant's
// balance must mean the same thing in the admin table and in the reminder
// that chases them for it.

function parseAmount(amount) {
  const n = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function hasPaymentHistory(reg) {
  return Array.isArray(reg && reg.payments) && reg.payments.length > 0;
}

function getPaymentEntries(reg) {
  if (hasPaymentHistory(reg)) {
    return reg.payments.map((p) => ({
      amount: parseAmount(p && p.amount),
      status: ["submitted", "verified", "rejected"].includes(p && p.status)
        ? p.status
        : "submitted",
    }));
  }
  const amount = parseAmount(reg && reg.amountPaid);
  if (!amount) return [];
  return [
    {
      amount,
      status: ["submitted", "verified", "rejected"].includes(
        reg && reg.paymentStatus,
      )
        ? reg.paymentStatus
        : "submitted",
    },
  ];
}

// What counts toward the balance — rejected payments don't.
function getCountedTotal(reg) {
  return getPaymentEntries(reg)
    .filter((e) => e.status !== "rejected")
    .reduce((sum, e) => sum + e.amount, 0);
}

// The fee items a registrant owes, priced at the climb's *current* amounts.
// Required fees always count; optional ones only when they selected them,
// with the guest fee auto-applying to joiners.
function getFeeItems(reg, climb) {
  if (!climb || !Array.isArray(climb.fees) || climb.fees.length === 0) {
    return Array.isArray(reg && reg.feeBreakdown)
      ? reg.feeBreakdown.filter((f) => f.selected)
      : [];
  }
  return climb.fees.filter((fee) => {
    if (!fee.optional) return true;
    const stored = (reg.feeBreakdown || []).find((f) => f.label === fee.label);
    if (stored) return !!stored.selected;
    return fee.isGuestFee && reg.memberType === "joiner";
  });
}

function getExpectedTotal(reg, climb) {
  return getFeeItems(reg, climb).reduce(
    (sum, item) => sum + parseAmount(item.amount),
    0,
  );
}

// Remaining balance. Zero when they're square, or when the climb's fees
// aren't known well enough to say (no schedule and no snapshot) — the
// reminder should stay quiet rather than chase a number it can't compute.
function getOutstanding(reg, climb) {
  const expected = getExpectedTotal(reg, climb);
  if (expected <= 0) return 0;
  return Math.max(expected - getCountedTotal(reg), 0);
}

module.exports = {
  parseAmount,
  hasPaymentHistory,
  getPaymentEntries,
  getCountedTotal,
  getFeeItems,
  getExpectedTotal,
  getOutstanding,
};
