export function getExpenseSummary(climb) {
  const expenses = climb.expenses;
  if (!expenses?.length) return null;

  const memberExpenses = expenses.filter((e) => !/guest/i.test(e.label || ""));
  const numericAmounts = memberExpenses
    .map((e) => parseFloat(String(e.amount).replace(/,/g, "")))
    .filter((n) => !isNaN(n));

  const itemLabel = `${expenses.length} item${expenses.length !== 1 ? "s" : ""}`;
  if (numericAmounts.length === 0) return `${itemLabel} — TBA`;

  const hasTBA = memberExpenses.some((e) =>
    isNaN(parseFloat(String(e.amount).replace(/,/g, ""))),
  );
  const total = numericAmounts.reduce((s, n) => s + n, 0);
  const totalLabel = `₱${total.toLocaleString("en-PH")}${hasTBA ? " (excl. TBA)" : ""}`;
  return `${itemLabel} — ${totalLabel} total`;
}
