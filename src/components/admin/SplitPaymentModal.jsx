import { useState } from "react";
import Modal from "@/components/Modal";
import { getPaymentEntries } from "@/utils/payments";
import { getOutstanding } from "@/utils/registrationFees";
import { formatPeso } from "@/utils/feeSummary";
import { logFailedRequest } from "@/utils/logFailedRequest";

const round2 = (n) => Math.round(n * 100) / 100;

function parseAmount(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Picks who else a registrant's payment covered and how much of it is each
// person's. Ticking someone pre-fills what they still owe (capped at what's
// left on the payment), since "Juan paid for Maria and Pedro" almost always
// means "covered their fees" — the amount stays editable for anything else.
export default function SplitPaymentModal({
  payer,
  entryIndex,
  regs,
  climb,
  serviceGroups,
  onClose,
  onSave,
}) {
  const entry = getPaymentEntries(payer)[entryIndex];
  const entryAmount = entry?.amount || 0;
  // regId → typed amount; a key being present means that person is ticked.
  const [amounts, setAmounts] = useState({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const others = (regs || [])
    .filter((r) => r.id !== payer.id && r.status !== "cancelled")
    .map((reg) => ({ reg, balance: getOutstanding(reg, climb, serviceGroups) }))
    .sort(
      (a, b) =>
        b.balance - a.balance ||
        (a.reg.name || "").localeCompare(b.reg.name || ""),
    );
  const q = search.trim().toLowerCase();
  const visible = q
    ? others.filter(
        ({ reg }) =>
          reg.name?.toLowerCase().includes(q) ||
          reg.email?.toLowerCase().includes(q),
      )
    : others;

  const moved = round2(
    Object.values(amounts).reduce((sum, v) => sum + parseAmount(v), 0),
  );
  const remaining = round2(entryAmount - moved);

  function toggle(reg, balance) {
    setAmounts((prev) => {
      if (reg.id in prev) {
        const { [reg.id]: _removed, ...rest } = prev;
        return rest;
      }
      const left = round2(
        entryAmount -
          Object.values(prev).reduce((sum, v) => sum + parseAmount(v), 0),
      );
      const prefill = Math.max(Math.min(balance, left), 0);
      return { ...prev, [reg.id]: prefill ? String(prefill) : "" };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const allocations = others
      .filter(({ reg }) => reg.id in amounts)
      .map(({ reg }) => ({ reg, amount: parseAmount(amounts[reg.id]) }));
    if (allocations.length === 0) {
      setError("Tick who else this payment covers.");
      return;
    }
    if (allocations.some((a) => a.amount <= 0)) {
      setError("Enter an amount for everyone you ticked.");
      return;
    }
    if (remaining < -0.005) {
      setError(`That's more than the ${formatPeso(entryAmount)} on this payment.`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(allocations);
    } catch (err) {
      setError(
        `Failed to split the payment. Please try again.${
          err?.message ? ` (${err.message})` : ""
        }`,
      );
      logFailedRequest({
        type: "payment",
        source: "SplitPaymentModal.jsx",
        message: err?.message,
        path: window.location.pathname,
        userRole: "admin",
        climbId: payer.climbId,
        registrationId: payer.id,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Split Payment">
      <form onSubmit={handleSubmit}>
        <h3 className="split-payment-title">Split Payment</h3>
        {!entry ? (
          <p className="split-payment-intro">
            This payment is no longer on {payer.name || "the registrant"}'s
            record.
          </p>
        ) : (
          <p className="split-payment-intro">
            <strong>{payer.name || "This registrant"}</strong> sent{" "}
            {formatPeso(entryAmount)} (payment {entryIndex + 1}) that also
            covers others on this climb. Each share moves onto that person's
            own record with the same receipt, and{" "}
            {entry.status === "verified"
              ? "stays verified"
              : "stays awaiting review"}
            .
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {entry && (
          <>
            <input
              type="search"
              className="form-input split-payment-search"
              placeholder="Find a registrant…"
              aria-label="Find a registrant"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="split-payment-list">
              {visible.map(({ reg, balance }) => {
                const ticked = reg.id in amounts;
                return (
                  <li key={reg.id} className="split-payment-row">
                    <label className="split-payment-who">
                      <input
                        type="checkbox"
                        checked={ticked}
                        onChange={() => toggle(reg, balance)}
                      />
                      <span>
                        <span className="admin-table-name">
                          {reg.name || "—"}
                        </span>
                        <span className="admin-table-sub">
                          {balance > 0
                            ? `Owes ${formatPeso(balance)}`
                            : "Paid up"}
                        </span>
                      </span>
                    </label>
                    {ticked && (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="form-input split-payment-amount"
                        aria-label={`Amount for ${reg.name || "registrant"}`}
                        value={amounts[reg.id]}
                        onChange={(e) =>
                          setAmounts((prev) => ({
                            ...prev,
                            [reg.id]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="split-payment-row admin-table-sub">
                  No other registrants match.
                </li>
              )}
            </ul>
            <div
              className={`split-payment-summary${remaining < -0.005 ? " over" : ""}`}
            >
              Moving {formatPeso(moved)} ·{" "}
              {remaining < -0.005
                ? `${formatPeso(-remaining)} more than this payment`
                : `${formatPeso(remaining)} stays with ${payer.name || "the payer"}`}
            </div>
          </>
        )}

        <div className="split-payment-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          {entry && (
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Split"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
