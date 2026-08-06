import {
  getPaymentEntries,
  getPaymentsTotal,
  getCountedTotal,
  hasAdjustedTotal,
} from "@/utils/payments";
import { StatusBadge, PAYMENT_STYLE } from "./registrantShared";

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

export function formatSubmittedAt(value) {
  const d = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!d || isNaN(d.getTime())) return null;
  return d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// A single receipt. Images open in the page's lightbox when one is wired up,
// and in a new tab otherwise; PDFs always open in a new tab.
function ProofThumb({ proof, index, setLightboxUrl, size }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(proof.fileName || "");
  const caption = (
    <div
      style={{
        fontSize: "0.65rem",
        color: "var(--ink-soft)",
        padding: "4px 8px",
        maxWidth: size,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {proof.fileName || `File ${index + 1}`}
    </div>
  );
  const frame = {
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--surface)",
  };

  if (isImage && setLightboxUrl) {
    return (
      <div style={frame}>
        <img
          src={proof.url}
          alt={proof.fileName}
          style={{
            width: size,
            height: size,
            objectFit: "cover",
            display: "block",
            cursor: "zoom-in",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setLightboxUrl(proof.url);
          }}
        />
        {caption}
      </div>
    );
  }

  return (
    <a
      href={proof.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...frame, display: "block", textDecoration: "none" }}
      onClick={(e) => e.stopPropagation()}
    >
      {isImage ? (
        <img
          src={proof.url}
          alt={proof.fileName}
          style={{
            width: size,
            height: size,
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "var(--surface-alt)",
          }}
        >
          <span style={{ fontSize: "2rem" }}>&#128196;</span>
          <span style={{ fontSize: "0.65rem", color: "var(--ink-soft)" }}>
            Open PDF
          </span>
        </div>
      )}
      {caption}
    </a>
  );
}

// Members can pay in instalments — a downpayment now, the balance (or a
// newly added optional fee) later — so each submission is listed on its own
// with the receipts that came with it, rather than as one undifferentiated
// pile of files.
export default function PaymentHistory({
  reg,
  setLightboxUrl,
  thumbSize = 130,
  // When provided, each payment can be reviewed on its own — an officer can
  // accept the downpayment and bounce only the instalment with the unreadable
  // receipt, instead of one verdict covering everything.
  onEntryStatusChange,
}) {
  const entries = getPaymentEntries(reg);
  if (entries.length === 0) return null;
  const rejected = entries.filter((e) => e.status === "rejected");
  return (
    <div style={{ marginBottom: 12 }}>
      {entries.map((entry, i) => {
        const when = formatSubmittedAt(entry.submittedAt);
        const hasBody = entry.proofs.length > 0 || !!entry.note;
        return (
          <div
            key={i}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 8,
              background: "var(--surface-alt)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: hasBody ? 8 : 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                }}
              >
                Payment {i + 1}
                {entries.length > 1 ? ` of ${entries.length}` : ""}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--green-dark)",
                }}
              >
                {peso(entry.amount)}
              </span>
              {when && (
                <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                  {when}
                </span>
              )}
              {entry.recordedBy && (
                <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                  recorded by{" "}
                  {entry.recordedBy === "admin" ? "admin" : entry.recordedBy}
                </span>
              )}
              <StatusBadge status={entry.status} styleMap={PAYMENT_STYLE} />
              {onEntryStatusChange && (
                <span
                  style={{ display: "flex", gap: 6, marginLeft: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-sm"
                    style={{
                      background: "#1a6b2c",
                      color: "#fff",
                      border: "none",
                    }}
                    disabled={entry.status === "verified"}
                    title="Verify just this payment"
                    onClick={() => onEntryStatusChange(reg, i, "verified")}
                  >
                    &#10003;
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={entry.status === "rejected"}
                    title="Reject just this payment — it stops counting toward their balance"
                    onClick={() => onEntryStatusChange(reg, i, "rejected")}
                  >
                    &#10005;
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={entry.status === "submitted"}
                    title="Put this payment back under review"
                    onClick={() => onEntryStatusChange(reg, i, "submitted")}
                  >
                    &#8634;
                  </button>
                </span>
              )}
            </div>
            {entry.note && (
              <div
                style={{
                  fontSize: "0.8rem",
                  marginBottom: entry.proofs.length > 0 ? 8 : 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                <span style={{ color: "var(--ink-soft)" }}>Note: </span>
                {entry.note}
              </div>
            )}
            {entry.proofs.length > 0 ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {entry.proofs.map((proof, j) => (
                  <ProofThumb
                    key={j}
                    proof={proof}
                    index={j}
                    size={thumbSize}
                    setLightboxUrl={setLightboxUrl}
                  />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                No receipt attached to this payment.
              </div>
            )}
          </div>
        );
      })}
      {entries.length > 1 && (
        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
          Total across {entries.length} payments: {peso(getPaymentsTotal(reg))}
        </div>
      )}
      {rejected.length > 0 && (
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--ink-soft)",
            marginTop: 2,
          }}
        >
          {peso(getCountedTotal(reg))} counts toward their balance —{" "}
          {rejected.length} rejected payment
          {rejected.length > 1 ? "s" : ""} ({peso(
            rejected.reduce((sum, e) => sum + e.amount, 0),
          )}
          ) excluded.
        </div>
      )}
      {hasAdjustedTotal(reg) && (
        <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: 4 }}>
          Amount paid on record is {peso(reg.amountPaid)} — adjusted by an
          admin, so it differs from the submissions above.
        </div>
      )}
    </div>
  );
}
