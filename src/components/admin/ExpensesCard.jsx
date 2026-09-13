import { useState } from "react";
import { sumExpenses, getNetFunds } from "@/utils/climbExpenses";
import { formatPeso } from "@/utils/feeSummary";

// Lets an admin log what a climb actually cost (permits, guide fees,
// transport bookings, etc.) so the club can tally net funds — verified
// collections minus logged expenses — rather than only seeing what came in.
// Admin-only data (see firestore.rules climbExpenses): registrants never see
// this breakdown, only their own owed/paid figures elsewhere on the page.
export default function ExpensesCard({ items, totalPaid, onSave }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const list = items || [];
  const total = sumExpenses(list);
  const net = getNetFunds(totalPaid, list);

  async function addExpense(e) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!label.trim() || !amountNum || amountNum <= 0) return;
    setSaving(true);
    try {
      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim(),
        amount: amountNum,
        note: note.trim(),
      };
      await onSave([...list, entry]);
      setLabel("");
      setAmount("");
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expenseId) {
    setRemovingId(expenseId);
    try {
      await onSave(list.filter((item) => item.id !== expenseId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="admin-card" style={{ marginBottom: 28 }}>
      <div className="admin-card-title">Expenses</div>
      <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", margin: "0 0 16px" }}>
        What this climb actually cost — permits, guide fees, transport, etc.
        Net funds below is verified collections minus these expenses.
      </p>

      {list.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table
            style={{
              width: "100%",
              maxWidth: 560,
              borderCollapse: "collapse",
              fontSize: "0.84rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>Item</th>
                <th style={{ textAlign: "right", padding: "4px 8px" }}>
                  Amount
                </th>
                <th style={{ padding: "4px 0" }} />
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "6px 0" }}>
                    {item.label}
                    {item.note && (
                      <div
                        style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}
                      >
                        {item.note}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                    }}
                  >
                    {formatPeso(item.amount)}
                  </td>
                  <td style={{ padding: "6px 0", textAlign: "right" }}>
                    <button
                      type="button"
                      title={`Remove ${item.label}`}
                      disabled={removingId === item.id}
                      onClick={() => removeExpense(item.id)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "var(--ink-soft)",
                        fontSize: "0.75rem",
                        lineHeight: 1,
                        padding: "4px 6px",
                      }}
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td style={{ padding: "8px 0", fontWeight: 800 }}>
                  Total Expenses
                </td>
                <td
                  style={{
                    padding: "8px 8px",
                    textAlign: "right",
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatPeso(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <form
        onSubmit={addExpense}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        <input
          type="text"
          className="form-input"
          placeholder="Item (e.g. Guide Fee)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <input
          type="number"
          inputMode="decimal"
          className="form-input"
          placeholder="Amount"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 120 }}
        />
        <input
          type="text"
          className="form-input"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <button
          type="submit"
          className="btn btn-accent btn-sm"
          disabled={saving || !label.trim() || !Number(amount)}
        >
          {saving ? "Adding…" : "Add Expense"}
        </button>
      </form>

      <p style={{ fontSize: "0.9rem", margin: 0 }}>
        Net Funds:{" "}
        <strong
          style={{ color: net < 0 ? "var(--danger, #c62828)" : "var(--green-dark)" }}
        >
          {formatPeso(net)}
        </strong>{" "}
        <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
          ({formatPeso(totalPaid)} verified − {formatPeso(total)} expenses)
        </span>
      </p>
    </div>
  );
}
