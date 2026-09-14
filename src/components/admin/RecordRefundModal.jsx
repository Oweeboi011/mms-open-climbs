import { useState } from "react";
import Modal from "@/components/Modal";
import { formatPeso } from "@/utils/feeSummary";
import { logFailedRequest } from "@/utils/logFailedRequest";

// Records money sent back to a registrant who paid more than they owe.
// Capped at their current excess — refunding past it would quietly put them
// back into a balance.
export default function RecordRefundModal({ reg, excess, onClose, onSave }) {
  const [amount, setAmount] = useState(String(excess));
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const parsed = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter the amount refunded.");
      return;
    }
    if (parsed > excess + 0.005) {
      setError(
        `That's more than the ${formatPeso(excess)} ${reg.name || "they"} overpaid.`,
      );
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(reg, { amount: parsed, note: note.trim(), files });
    } catch (err) {
      setError(
        `Failed to record the refund. Please try again.${
          err?.message ? ` (${err.message})` : ""
        }`,
      );
      logFailedRequest({
        type: "payment",
        source: "RecordRefundModal.jsx",
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
    <Modal onClose={onClose} label="Record Refund">
      <form onSubmit={handleSubmit}>
        <h3 className="split-payment-title">Record Refund</h3>
        <p className="split-payment-intro">
          <strong>{reg.name || "This registrant"}</strong> paid{" "}
          {formatPeso(excess)} more than they owe. Send the money back first
          (e.g. via GCash), then record it here — it comes off what they've
          paid, and they're notified.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label required" htmlFor="refund-amount">
            Amount Refunded
          </label>
          <input
            id="refund-amount"
            type="number"
            min="0"
            step="any"
            className="form-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="form-hint">Up to {formatPeso(excess)}.</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="refund-note">
            Notes (Optional)
          </label>
          <textarea
            id="refund-note"
            className="form-input"
            rows={2}
            placeholder="e.g. GCash to 0917 123 4567, ref 12345"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="refund-proof">
            Proof of Refund (Optional)
          </label>
          <input
            id="refund-proof"
            type="file"
            accept="image/*,application/pdf"
            className="form-input"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files))}
          />
        </div>

        <div className="split-payment-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Refund"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
