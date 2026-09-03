import { getFeeItemAggregates } from "@/utils/registrationFees";
import { formatPeso } from "@/utils/feeSummary";

// Per-fee-item view of what a climb should collect in total — unit price ×
// how many active registrants currently owe it — next to what's actually
// been verified, so an officer collecting money can spot which item is
// lagging rather than only seeing one lump expected/outstanding figure.
export default function CollectionBreakdown({ regs, climb, totalPaid }) {
  const { items, grandTotal, hasTba } = getFeeItemAggregates(regs, climb);

  if (items.length === 0) return null;

  const pctCollected = grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0;

  return (
    <div className="admin-card" style={{ marginBottom: 28 }}>
      <div className="admin-card-title">Expected Collection Breakdown</div>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--ink-soft)",
          margin: "0 0 16px",
        }}
      >
        What this climb should collect in total, per fee item, at current
        amounts for every active registrant. Cancelled registrants are
        excluded.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            maxWidth: 560,
            borderCollapse: "collapse",
            fontSize: "0.84rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "4px 0" }}>Item</th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>
                Unit Price
              </th>
              <th style={{ textAlign: "right", padding: "4px 8px" }}>
                Registrants
              </th>
              <th style={{ textAlign: "right", padding: "4px 0" }}>
                Expected
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.label}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "6px 0" }}>
                  {item.label}
                  {item.isGuestFee && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: "0.68rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      (joiners)
                    </span>
                  )}
                  {item.optional && !item.isGuestFee && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: "0.68rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      (optional)
                    </span>
                  )}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.amount || "TBA"}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px" }}>
                  {item.count}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 0",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.hasTba && item.count === 0
                    ? "—"
                    : formatPeso(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td style={{ padding: "8px 0", fontWeight: 800 }}>
                Grand Total
                {hasTba && (
                  <span
                    style={{ fontWeight: 400, color: "var(--ink-soft)" }}
                  >
                    {" "}
                    (excl. TBA)
                  </span>
                )}
              </td>
              <td colSpan={2} />
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: 900,
                  color: "var(--green-dark)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatPeso(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p
        style={{
          fontSize: "0.8rem",
          color: "var(--ink-soft)",
          margin: "12px 0 0",
        }}
      >
        Verified so far: <strong>{formatPeso(totalPaid)}</strong> of{" "}
        {formatPeso(grandTotal)} expected
        {grandTotal > 0 && <> ({pctCollected}%)</>}.
      </p>
    </div>
  );
}
