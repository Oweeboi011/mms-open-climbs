import GcashDetails from "@/pages/register/GcashDetails";
import PaymentProofField from "@/pages/register/PaymentProofField";
import { FieldError } from "@/pages/register/registerShared";

export default function GcashPaymentSection({
  amountPaid,
  bindField,
  clearFieldError,
  climb,
  fieldErrors,
  inputClass,
  paymentFiles,
  paymentNote,
  paymentPreviews,
  setAmountPaid,
  setPaymentFiles,
  setPaymentNote,
  setPaymentPreviews,
  setQrModalOpen,
}) {
  return (
    <>
      {/* GCash Payment */}
      <div className="register-form-card">
        <div className="form-section-title">Payment via GCash (Optional)</div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          You can register now and pay later — send your registration fee
          via GCash whenever you're ready, then upload your screenshot or
          photo of the receipt below. Unpaid registrations will be flagged
          until payment is submitted.
        </p>

        <div
          style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--green-dark)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: "0.82rem",
          }}
        >
          <strong>You can pay in batches.</strong> Send a downpayment now
          and the rest later — go to <em>My Climbs</em> anytime and
          submit another proof of payment. Each one is recorded separately
          and added to your total. Just make sure everything is fully paid
          before the climb date.
        </div>

        <GcashDetails climb={climb} setQrModalOpen={setQrModalOpen} />

        <div className="form-group">
          <label className="form-label">
            Amount Paid via GCash
          </label>
          <div style={{ position: "relative", maxWidth: 220 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--ink-soft)",
                pointerEvents: "none",
              }}
            >
              ₱
            </span>
            <input
              type="number"
              min="1"
              step="any"
              ref={bindField("amountPaid")}
              className={inputClass("amountPaid")}
              placeholder="0.00"
              aria-invalid={!!fieldErrors.amountPaid}
              style={{ paddingLeft: 28, fontWeight: 700, fontSize: "1rem" }}
              value={amountPaid}
              onChange={(e) => {
                setAmountPaid(e.target.value);
                clearFieldError("amountPaid");
                clearFieldError("paymentFiles");
              }}
            />
          </div>
          <FieldError message={fieldErrors.amountPaid} />
          <div className="form-hint">
            Enter the exact amount you sent via GCash. This must match your
            receipt.
          </div>
        </div>

        <PaymentProofField
          bindField={bindField}
          clearFieldError={clearFieldError}
          fieldErrors={fieldErrors}
          inputClass={inputClass}
          paymentFiles={paymentFiles}
          paymentPreviews={paymentPreviews}
          setPaymentFiles={setPaymentFiles}
          setPaymentPreviews={setPaymentPreviews}
        />

        <div className="form-group">
          <label className="form-label">Payment Notes (Optional)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="e.g. downpayment only, balance to follow; sent from another GCash number"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            Anything the climb officers should know about this payment.
          </div>
        </div>
      </div>
    </>
  );
}
