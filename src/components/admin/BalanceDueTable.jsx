import { useState } from "react";
import Modal from "@/components/Modal";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import PaymentHistory from "@/components/admin/PaymentHistory";
import {
  StatusBadge,
  PAYMENT_STYLE,
} from "@/components/admin/registrantShared";
import { getPaymentEntries } from "@/utils/payments";
import {
  getCountedPaid,
  getExpectedTotal,
  getFeeItems,
  getOutstanding,
} from "@/utils/registrationFees";
import { formatPeso, sumFeeAmounts } from "@/utils/feeSummary";

const round2 = (n) => Math.round(n * 100) / 100;

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
      return { reg, expected, paid: expected - balance, amount: balance };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

// The reverse: registrants who have paid more than their fees — usually one
// joiner whose payment covered friends, waiting to be split onto their
// records. Skipped when someone's fees aren't fully known (nothing on record,
// or an amount still TBA), since any payment would look like excess.
export function getExcessPayments(regs, climb, serviceGroups) {
  return (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .map((reg) => {
      const items = getFeeItems(reg, climb, serviceGroups);
      const { total, hasTba } = sumFeeAmounts(items);
      if (items.length === 0 || hasTba) return null;
      const paid = getCountedPaid(reg);
      return { reg, expected: total, paid, amount: round2(paid - total) };
    })
    .filter((row) => row && row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function sumAmounts(rows) {
  return round2((rows || []).reduce((sum, row) => sum + row.amount, 0));
}

const KINDS = {
  due: {
    title: "Remaining Balances",
    amountLabel: "Balance",
    totalSuffix: "due",
    amountClass: "balance-due-amount",
    empty: "No one on this climb has a balance left to pay.",
  },
  excess: {
    title: "Excess Payments",
    amountLabel: "Excess",
    totalSuffix: "over",
    amountClass: "excess-amount",
    empty: "No one on this climb has paid more than they owe.",
  },
};

// `kind` picks balances still owed ("due") or overpayments ("excess"); `card`
// renders it as a standalone admin card (the climb detail page), otherwise
// it's a section inside an expanded row (the climbs list). `onSplitEntry`
// lets a payment be split straight from the payment history dialog.
export default function BalanceDueTable({
  rows,
  kind = "due",
  card = false,
  onSplitEntry,
  onUndoSplit,
}) {
  const config = KINDS[kind];
  // Looked up from `rows` on every render so the open history follows live
  // payment updates, and closes once the row no longer applies.
  const [viewingId, setViewingId] = useState(null);
  const viewing = rows.find((row) => row.reg.id === viewingId);

  const summary =
    rows.length > 0
      ? `${rows.length} registrant${rows.length !== 1 ? "s" : ""} · ${formatPeso(sumAmounts(rows))} ${config.totalSuffix}`
      : null;

  const body =
    rows.length === 0 ? (
      <div className="admin-table-sub">{config.empty}</div>
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
              <th>{config.amountLabel}</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ reg, expected, paid, amount }) => (
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
                <td className={config.amountClass}>{formatPeso(amount)}</td>
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
        <strong className={config.amountClass}>
          {config.amountLabel} {formatPeso(viewing.amount)}
        </strong>
      </p>
      {kind === "excess" && onSplitEntry && (
        <p className="balance-history-summary">
          If a payment covered someone else on this climb, use Split on it to
          move their share onto their record.
        </p>
      )}
      {getPaymentEntries(viewing.reg).length > 0 ? (
        <PaymentHistory
          reg={viewing.reg}
          thumbSize={90}
          onSplitEntry={onSplitEntry}
          onUndoSplit={onUndoSplit}
        />
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
          {config.title}
          {summary && ` — ${summary}`}
        </div>
        {body}
        {historyModal}
      </div>
    );
  }

  return (
    <div className="balance-due-section">
      <div className="admin-section-bar">
        <span className="admin-section-label">{config.title}</span>
        {summary && <span className="admin-table-sub">{summary}</span>}
      </div>
      {body}
      {historyModal}
    </div>
  );
}
