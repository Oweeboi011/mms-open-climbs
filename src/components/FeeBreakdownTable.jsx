import { getExpectedTotal } from "@/utils/registrationFees";

// Read-only itemized fee table for admin review — shows a registrant's
// selected fees (or the climb's required fees, if their own snapshot is
// empty) plus a total. Shared by ClimbDetail, ManagePayments, and
// AllRegistrations so payment review looks the same everywhere.
export default function FeeBreakdownTable({ reg, climb, title = "Fee Breakdown", maxWidth = 360 }) {
  const items = reg.feeBreakdown?.length
    ? reg.feeBreakdown.filter((f) => f.selected)
    : (climb?.fees || []).filter((f) => !f.optional);

  if (items.length === 0) {
    return (
      <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", margin: 0 }}>
        No fee breakdown recorded for this registrant.
      </p>
    );
  }

  return (
    <div>
      {title && (
        <div
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: 2,
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
          fontSize: "0.82rem",
        }}
      >
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "4px 0" }}>{item.label}</td>
              <td
                style={{
                  padding: "4px 0",
                  textAlign: "right",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {item.amount || "TBA"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td style={{ padding: "6px 0", fontWeight: 800 }}>Total</td>
            <td
              style={{
                padding: "6px 0",
                textAlign: "right",
                fontWeight: 900,
                color: "var(--green-dark)",
              }}
            >
              ₱{getExpectedTotal(reg, climb).toLocaleString("en-PH")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
