import PaymentLog from "@/components/PaymentLog";
import { getCountedTotal } from "@/utils/payments";
import { getFeeItems, getOutstanding } from "@/utils/registrationFees";
import { sumFeeAmounts } from "@/utils/feeSummary";

const RECEIPT_STATUS_LABEL = {
  submitted: "Awaiting Review",
  verified: "Verified",
  rejected: "Rejected",
};

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

function formatDateTime(value) {
  const d = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * A registration's Official Receipt: what was owed, what has been paid, and
 * every instalment behind that figure.
 *
 * Shared between the member's My Climbs and the admin climb detail page, so
 * an officer chasing a balance is looking at exactly the document the
 * participant sees rather than reconstructing it from the registrants table.
 * `emptyLogText` is the only thing that differs — an admin can't be told to
 * go and submit their own proof of payment.
 */
export default function ReceiptModal({ reg, climb, onClose, emptyLogText }) {
  // Read the climb's current fee schedule, not the snapshot frozen at
  // registration — an officer who corrects a "TBA" amount or adds a fee
  // afterwards should see the receipt follow, the same way the admin views
  // and the outstanding math do.
  const items = getFeeItems(reg, climb);
  const { total, hasTba } = sumFeeAmounts(items);
  const totalDisplay = hasTba
    ? `₱${total.toLocaleString("en-PH")} + TBA`
    : `₱${total.toLocaleString("en-PH")}`;
  const orNumber = `OR-${reg.id.slice(-8).toUpperCase()}`;
  // What's actually been accepted, and what's left — a rejected instalment
  // stops counting, which is exactly the case a single "Amount Paid" hid.
  const paidCounted = getCountedTotal(reg);
  const outstanding = getOutstanding(reg, climb);

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
      <div
        onClick={(e) => e.stopPropagation()}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Official Receipt</h3>
          <span className={`status-badge status-payment-${reg.paymentStatus}`}>
            {RECEIPT_STATUS_LABEL[reg.paymentStatus] || reg.paymentStatus}
          </span>
        </div>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          {orNumber}
        </p>

        <div className="reg-detail-grid" style={{ marginBottom: 16 }}>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Climb</span>
            <strong>{reg.climbTitle || climb?.title || "—"}</strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Participant</span>
            <strong>{reg.name}</strong>
          </div>
        </div>

        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 6,
              }}
            >
              Fee Breakdown
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <tbody>
                {items.map((e, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "6px 0" }}>{e.label}</td>
                    <td
                      style={{
                        padding: "6px 0",
                        textAlign: "right",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.amount || "TBA"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td style={{ padding: "8px 0", fontWeight: 800 }}>Total</td>
                  <td
                    style={{
                      padding: "8px 0",
                      textAlign: "right",
                      fontWeight: 900,
                      color: "var(--green-dark)",
                    }}
                  >
                    {totalDisplay}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="reg-detail-grid" style={{ marginBottom: 16 }}>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Amount Paid</span>
            <strong>{peso(paidCounted)}</strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Balance</span>
            <strong
              style={{
                color: outstanding > 0 ? "#b45309" : "var(--green-dark)",
              }}
            >
              {outstanding > 0 ? peso(outstanding) : "Fully settled"}
              {hasTba && outstanding === 0 ? " (+ TBA)" : ""}
            </strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Confirmed On</span>
            <strong>
              {reg.paymentStatus === "verified"
                ? formatDateTime(reg.verifiedAt)
                : "—"}
            </strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Confirmed By</span>
            <strong>
              {reg.paymentStatus === "verified"
                ? reg.verifiedBy?.name || "—"
                : "—"}
            </strong>
          </div>
        </div>

        {/* The payment log, not a single flat proof list: whoever is reading
            this needs to see which instalment an officer has already cleared
            and what was said about it. */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 6,
            }}
          >
            Payment Log
          </div>
          <PaymentLog reg={reg} emptyText={emptyLogText} />
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={onClose}
          style={{ width: "100%" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
