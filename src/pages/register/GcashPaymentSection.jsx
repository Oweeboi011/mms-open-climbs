import GcashDetails from "@/pages/register/GcashDetails";
import PaymentProofField from "@/pages/register/PaymentProofField";
import { FieldError } from "@/pages/register/registerShared";
import "./register.css";

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
        <p className="gcash-intro">
          You can register now and pay later — send your registration fee via GCash whenever you're ready, then upload
          your screenshot or photo of the receipt below. Unpaid registrations will be flagged until payment is
          submitted.
        </p>

        <div className="gcash-batches-note">
          <strong>You can pay in batches.</strong> Send a downpayment now and the rest later — go to <em>My Climbs</em>{" "}
          anytime and submit another proof of payment. Each one is recorded separately and added to your total. Just
          make sure everything is fully paid before the climb date.
        </div>

        <GcashDetails climb={climb} setQrModalOpen={setQrModalOpen} />

        <div className="form-group">
          <label className="form-label">Amount Paid via GCash</label>
          <div className="amount-field">
            <span className="amount-prefix">₱</span>
            <input
              type="number"
              min="1"
              step="any"
              ref={bindField("amountPaid")}
              className={`${inputClass("amountPaid")} amount-input`}
              placeholder="0.00"
              aria-invalid={!!fieldErrors.amountPaid}
              value={amountPaid}
              onChange={(e) => {
                setAmountPaid(e.target.value);
                clearFieldError("amountPaid");
                clearFieldError("paymentFiles");
              }}
            />
          </div>
          <FieldError message={fieldErrors.amountPaid} />
          <div className="form-hint">Enter the exact amount you sent via GCash. This must match your receipt.</div>
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
          <div className="payment-note-hint">Anything the climb officers should know about this payment.</div>
        </div>
      </div>
    </>
  );
}
