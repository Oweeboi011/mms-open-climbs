import { useState } from "react";
import Modal from "@/components/Modal";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import PaymentHistory from "@/components/admin/PaymentHistory";
import {
  StatusBadge,
  PAYMENT_STYLE,
} from "@/components/admin/registrantShared";
import { getPaymentEntries } from "@/utils/payments";
import { getExpectedTotal, getOutstanding } from "@/utils/registrationFees";
import { formatPeso } from "@/utils/feeSummary";

// Registrants on one climb who still owe money at the climb's current fees,
// biggest balance first. Cancelled registrations owe nothing.
export function getBalancesDue(regs, climb, serviceGroups) {
  return (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .map((reg) => {
      const expected = getExpectedTotal(reg, climb, serviceGroups);
      const balance = getOutstanding(reg, climb, serviceGroups);
      // Only rows with a balance are kept, so nobody here has overpaid and
      // what counts as paid is exactly the difference.
      return { reg, expected, paid: expected - balance, balance };
    })
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

export function sumBalances(rows) {
  const total = (rows || []).reduce((sum, row) => sum + row.balance, 0);
  return Math.round(total * 100) / 100;
}

// `card` renders it as a standalone admin card (the climb detail page);
// otherwise it's a section inside an expanded row (the climbs list).
export default function BalanceDueTable({ rows, card = false }) {
  // Looked up from `rows` on every render so the open history follows live
  // payment updates, and closes once the balance is settled.
  const [viewingId, setViewingId] = useState(null);
  const viewing = rows.find((row) => row.reg.id === viewingId);

  const summary =
    rows.length > 0
      ? `${rows.length} registrant${rows.length !== 1 ? "s" : ""} · ${formatPeso(sumBalances(rows))} due`
      : null;

  const body =
    rows.length === 0 ? (
      <div className="admin-table-sub">
        No one on this climb has a balance left to pay.
      </div>
    ) : (
      <ResponsiveTable>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Registrant</th>
              <th>Type</th>
              <th>Mobile</th>
              <th>Fees</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ reg, expected, paid, balance }) => (
              <tr
                key={reg.id}
                className="balance-due-row"
                title="View payment history"
                onClick={() => setViewingId(reg.id)}
              >
                <td>
                  {/* The row is the click target; the button makes it
                      reachable by keyboard too. */}
                  <button type="button" className="balance-due-name">
                    {reg.name || "—"}
                  </button>
                  {reg.email && (
                    <div className="admin-table-sub">{reg.email}</div>
                  )}
                </td>
                <td>{reg.memberType === "member" ? "Member" : "Joiner"}</td>
                <td className="balance-due-money">{reg.mobile || "—"}</td>
                <td className="balance-due-money">{formatPeso(expected)}</td>
                <td className="balance-due-money">{formatPeso(paid)}</td>
                <td className="balance-due-amount">{formatPeso(balance)}</td>
                <td>
                  <StatusBadge
                    status={reg.paymentStatus}
                    styleMap={PAYMENT_STYLE}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTable>
    );

  const historyModal = viewing && (
    <Modal
      onClose={() => setViewingId(null)}
      label={`Payment history for ${viewing.reg.name || "registrant"}`}
    >
      <h3 className="balance-history-title">
        {viewing.reg.name || "Registrant"}
      </h3>
      <p className="balance-history-summary">
        Fees {formatPeso(viewing.expected)} · Paid {formatPeso(viewing.paid)} ·{" "}
        <strong className="balance-due-amount">
          Balance {formatPeso(viewing.balance)}
        </strong>
      </p>
      {getPaymentEntries(viewing.reg).length > 0 ? (
        <PaymentHistory reg={viewing.reg} thumbSize={90} />
      ) : (
        <p className="admin-table-sub">No payments recorded yet.</p>
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm balance-history-close"
        onClick={() => setViewingId(null)}
      >
        Close
      </button>
    </Modal>
  );

  if (card) {
    return (
      <div className="admin-card balance-due-card">
        <div className="admin-card-title">
          Remaining Balances{summary && ` — ${summary}`}
        </div>
        {body}
        {historyModal}
      </div>
    );
  }

  return (
    <div className="balance-due-section">
      <div className="admin-section-bar">
        <span className="admin-section-label">Remaining Balances</span>
        {summary && <span className="admin-table-sub">{summary}</span>}
      </div>
      {body}
      {historyModal}
    </div>
  );
}
