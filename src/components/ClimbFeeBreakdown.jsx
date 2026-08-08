import { getClimbFeeModel, formatPeso } from "@/utils/feeSummary";

// Itemized view of a *climb's* fee schedule (not a registrant's — that's
// FeeBreakdownTable). Required items total on their own; optional extras and
// the joiner-only guest fee are listed apart so the total never implies
// someone owes them. See utils/feeSummary.js for why.
export default function ClimbFeeBreakdown({
  climb,
  title = "Fees",
  maxWidth = 420,
}) {
  const {
    fees,
    requiredFees,
    optionalFees,
    guestFee,
    requiredTotal,
    requiredHasTBA,
    requiredHasAmount,
  } = getClimbFeeModel(climb);

  if (!fees.length) {
    return (
      <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)", margin: 0 }}>
        No fees set for this climb.
      </p>
    );
  }

  const labelCell = { padding: "4px 0" };
  const amountCell = {
    padding: "4px 0 4px 12px",
    textAlign: "right",
    fontWeight: 600,
    whiteSpace: "nowrap",
    width: "1%",
  };
  const sectionLabel = {
    padding: "8px 0 2px",
    fontSize: "0.62rem",
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "var(--ink-soft)",
  };
  const noteStyle = {
    fontSize: "0.7rem",
    color: "var(--ink-soft)",
    marginTop: 1,
  };

  return (
    <div>
      {title && (
        <div
          style={{
            fontSize: "0.64rem",
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
      )}
      <table
        style={{
          width: "100%",
          maxWidth,
          borderCollapse: "collapse",
          fontSize: "0.78rem",
        }}
      >
        <tbody>
          {requiredFees.map((fee, i) => (
            <tr
              key={`req-${i}`}
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <td style={labelCell}>
                <div>{fee.label}</div>
                {fee.note && <div style={noteStyle}>{fee.note}</div>}
              </td>
              <td style={amountCell}>{fee.amount || "TBA"}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td style={{ padding: "6px 0", fontWeight: 800 }}>
              Required total
              {requiredHasTBA && (
                <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>
                  {" "}
                  (excl. TBA)
                </span>
              )}
            </td>
            <td
              style={{
                padding: "6px 0 6px 12px",
                textAlign: "right",
                fontWeight: 900,
                whiteSpace: "nowrap",
                width: "1%",
                color: "var(--green-dark)",
              }}
            >
              {requiredHasAmount ? formatPeso(requiredTotal) : "TBA"}
            </td>
          </tr>

          {optionalFees.length > 0 && (
            <>
              <tr>
                <td colSpan={2} style={sectionLabel}>
                  Optional — only if availed
                </td>
              </tr>
              {optionalFees.map((fee, i) => (
                <tr
                  key={`opt-${i}`}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ ...labelCell, color: "var(--ink-soft)" }}>
                    <div>{fee.label}</div>
                    {fee.note && <div style={noteStyle}>{fee.note}</div>}
                  </td>
                  <td style={{ ...amountCell, color: "var(--ink-soft)" }}>
                    {fee.amount || "TBA"}
                  </td>
                </tr>
              ))}
            </>
          )}

          {guestFee && (
            <>
              <tr>
                <td colSpan={2} style={sectionLabel}>
                  Joiners only
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={labelCell}>
                  <div>{guestFee.label}</div>
                  {guestFee.note && (
                    <div style={noteStyle}>{guestFee.note}</div>
                  )}
                </td>
                <td style={amountCell}>
                  {guestFee.amount ? `+${guestFee.amount}` : "TBA"}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
