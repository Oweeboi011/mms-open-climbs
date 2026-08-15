import {
  getPaymentEntries,
  getPaymentsTotal,
  getCountedTotal,
} from "@/utils/payments";

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

const STATUS_LABEL = {
  submitted: "Awaiting Review",
  verified: "Verified",
  rejected: "Rejected",
};

function formatWhen(value) {
  const d = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!d || isNaN(d.getTime())) return null;
  return d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * The member-facing payment log: every instalment on a registration listed on
 * its own with its date, verdict, comment and receipts.
 *
 * Members settle in batches — a downpayment now, an optional fee added later —
 * and the rolled-up "Amount Paid" figure hides which of those went through and
 * which is still with an officer. Shown on the Official Receipt and again in
 * the Add Fees / Pay More prompt, so the picture is the same whether someone
 * is checking what they paid or about to pay more.
 *
 * The admin equivalent is components/admin/PaymentHistory — same data, but
 * with per-payment review controls and full-size receipt thumbnails.
 */
export default function PaymentLog({ reg, emptyText }) {
  const entries = getPaymentEntries(reg);

  if (entries.length === 0) {
    return emptyText ? (
      <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
        {emptyText}
      </div>
    ) : null;
  }

  const submittedTotal = getPaymentsTotal(reg);
  const countedTotal = getCountedTotal(reg);
  const rejected = entries.filter((e) => e.status === "rejected");

  return (
    <div>
      {entries.map((entry, i) => {
        const when = formatWhen(entry.submittedAt);
        return (
          <div
            key={i}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 8,
              background: "var(--surface-alt)",
              // A rejected instalment reads as struck from the running total,
              // not as another payment that counted.
              opacity: entry.status === "rejected" ? 0.72 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                Payment {i + 1}
                {entries.length > 1 ? ` of ${entries.length}` : ""}
              </span>
              <strong
                style={{ fontSize: "0.92rem", color: "var(--green-dark)" }}
              >
                {peso(entry.amount)}
              </strong>
              <span
                className={`status-badge status-payment-${entry.status}`}
                style={{ marginLeft: "auto" }}
              >
                {STATUS_LABEL[entry.status] || entry.status}
              </span>
            </div>

            {(when || entry.recordedBy) && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                }}
              >
                {when}
                {entry.recordedBy
                  ? `${when ? " · " : ""}recorded by ${entry.recordedBy}`
                  : ""}
              </div>
            )}

            {entry.note && (
              <div
                style={{
                  fontSize: "0.8rem",
                  marginTop: 6,
                  whiteSpace: "pre-wrap",
                }}
              >
                <span style={{ color: "var(--ink-soft)" }}>Comment: </span>
                {entry.note}
              </div>
            )}

            {entry.proofs.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {entry.proofs.map((proof, j) => (
                  <a
                    key={j}
                    href={proof.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--green-dark)",
                      textDecoration: "underline",
                    }}
                  >
                    {proof.fileName || `Receipt ${j + 1}`}
                  </a>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--ink-soft)",
                  marginTop: 6,
                }}
              >
                No receipt attached to this payment.
              </div>
            )}
          </div>
        );
      })}

      {entries.length > 1 && (
        <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
          Total submitted across {entries.length} payments:{" "}
          {peso(submittedTotal)}
        </div>
      )}

      {rejected.length > 0 && (
        <div
          style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}
        >
          {peso(countedTotal)} counts toward your balance — {rejected.length}{" "}
          rejected payment
          {rejected.length > 1 ? "s" : ""} ({peso(
            rejected.reduce((sum, e) => sum + e.amount, 0),
          )}
          ) excluded.
        </div>
      )}
    </div>
  );
}
