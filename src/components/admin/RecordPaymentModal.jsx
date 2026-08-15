import { useState } from "react";
import { getPaymentEntries, getPaymentsTotal } from "@/utils/payments";
import { logFailedRequest } from "@/utils/logFailedRequest";

// Logs a payment that never went through the app — cash handed over at the
// jump-off, a bank transfer, a friend settling someone's balance. It appends
// to the same history members build up by submitting GCash proofs, so the
// running total stays the sum of real payments instead of an admin's manual
// override of `amountPaid`.
export default function RecordPaymentModal({ reg, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [markVerified, setMarkVerified] = useState(true);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const alreadyPaid = getPaymentsTotal(reg);
  const parsed = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  const newTotal = alreadyPaid + (isNaN(parsed) ? 0 : parsed);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter the amount received.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(reg, {
        amount: parsed,
        note: note.trim(),
        markVerified,
        files,
      });
    } catch (err) {
      // The underlying message matters here — a denied storage upload and a
      // denied Firestore write look identical behind a generic notice, and
      // the admin is the only one who can report which one they hit.
      setError(
        `Failed to record the payment. Please try again.${
          err?.message ? ` (${err.message})` : ""
        }`,
      );
      logFailedRequest({
        type: "payment",
        source: "RecordPaymentModal.jsx",
        message: err?.message,
        path: window.location.pathname,
        userRole: "admin",
        climbId: reg.climbId,
        registrationId: reg.id,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Record Payment
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.name}</strong> — use this for money received outside
          the app. It's added to their payment history as payment{" "}
          {getPaymentEntries(reg).length + 1}.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label required">Amount Received</label>
          <input
            type="number"
            min="1"
            step="any"
            className="form-input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            Already recorded: ₱{alreadyPaid.toLocaleString("en-PH")} → new
            total ₱{newTotal.toLocaleString("en-PH")}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Payment Notes (Optional)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="e.g. cash at the jump-off, bank transfer ref 12345"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Proof of Payment (Optional)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="form-input"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files))}
          />
          <div className="form-hint">
            A receipt, bank transfer screenshot, or photo — if you have one.
          </div>
          {files.length > 0 && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--green-dark)",
                marginTop: 6,
              }}
            >
              &#10003; {files.length} file{files.length > 1 ? "s" : ""} selected
            </div>
          )}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.85rem",
            marginBottom: 16,
          }}
        >
          <input
            type="checkbox"
            checked={markVerified}
            onChange={(e) => setMarkVerified(e.target.checked)}
          />
          Mark this registrant's payment as verified
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={saving}
            style={{ flex: 1 }}
          >
            {saving ? "Recording…" : "Record Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
