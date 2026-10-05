import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { expectedTotalFor } from "@/pages/register/registerShared";

export default function ConfirmSubmitModal({
  amountPaid,
  climb,
  doSubmit,
  docFiles,
  form,
  optionalFeeSelections,
  paymentFiles,
  pledge,
  setShowConfirm,
  showConfirm,
}) {
  if (!(showConfirm)) return null;
  const { total, hasTba } = expectedTotalFor(
    climb,
    form,
    optionalFeeSelections,
    pledge,
  );
  const totalDisplay = hasTba
    ? `₱${total.toLocaleString("en-PH")} + TBA`
    : `₱${total.toLocaleString("en-PH")}`;
  const isPayingNow = paymentFiles.length > 0;
  const missingDocLabels = REQUIRED_DOC_TYPES.filter(
    (docType) =>
      climb[docType.requiresField] && !docFiles[docType.key],
  ).map((docType) => docType.label);
  return (
    <div
      onClick={() => setShowConfirm(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Confirm Registration
        </h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{climb.title}</strong>
          {climb.dateLabel ? ` — ${climb.dateLabel}` : ""}
        </p>

        {climb.fees?.length > 0 && (
          <div
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              <span>Total Fees</span>
              <span style={{ color: "var(--green-dark)" }}>
                {totalDisplay}
              </span>
            </div>
            {isPayingNow ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--ink-soft)",
                }}
              >
                You're submitting <strong>₱{Number(amountPaid).toLocaleString("en-PH")}</strong> via
                GCash now. Your registration will be marked{" "}
                <strong>Payment Submitted</strong> and reviewed by a
                climb officer.
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--ink-soft)",
                }}
              >
                You haven't submitted payment yet. Your registration
                will be marked <strong>Unpaid</strong> — you'll still
                need to settle <strong>{totalDisplay}</strong> later
                from <strong>My Climbs</strong>.
              </p>
            )}
          </div>
        )}

        {missingDocLabels.length > 0 && (
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--ink-soft)",
              marginBottom: 16,
            }}
          >
            Still to upload:{" "}
            <strong>{missingDocLabels.join(", ")}</strong>. You can
            submit these later from <strong>My Climbs</strong> — we'll
            remind you via the notification bell.
          </p>
        )}

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          Your registration will be <strong>pending confirmation</strong>{" "}
          by a climb officer either way. Ready to submit?
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowConfirm(false)}
            style={{ flex: 1 }}
          >
            Go Back
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={doSubmit}
            style={{ flex: 1 }}
          >
            Confirm &amp; Submit
          </button>
        </div>
      </div>
    </div>
  );
}
