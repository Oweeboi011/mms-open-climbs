export function getFeeSummary(climb) {
  const fees = climb.fees;
  if (!fees?.length) return null;

  const memberFees = fees.filter((f) => !f.isGuestFee);
  const numericAmounts = memberFees
    .map((f) => parseFloat(String(f.amount).replace(/,/g, "")))
    .filter((n) => !isNaN(n));

  const itemLabel = `${fees.length} item${fees.length !== 1 ? "s" : ""}`;
  if (numericAmounts.length === 0) return `${itemLabel} — TBA`;

  const hasTBA = memberFees.some((f) =>
    isNaN(parseFloat(String(f.amount).replace(/,/g, ""))),
  );
  const total = numericAmounts.reduce((s, n) => s + n, 0);
  const totalLabel = `₱${total.toLocaleString("en-PH")}${hasTBA ? " (excl. TBA)" : ""}`;
  return `${itemLabel} — ${totalLabel} total`;
}
