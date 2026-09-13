// Shared math for a climb's logged expenses (climbExpenses/{climbId}.items),
// used by ExpensesCard and ClimbDetail's net-funds figure.

export function sumExpenses(items) {
  return (items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

// Net funds so far: verified collections minus logged expenses. Can go
// negative before enough payments are verified — callers decide how to
// display that rather than clamping it here.
export function getNetFunds(totalPaid, items) {
  return (Number(totalPaid) || 0) - sumExpenses(items);
}
