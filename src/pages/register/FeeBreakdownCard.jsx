import FeeTableBody from "@/pages/register/FeeTableBody";
import { expectedTotalFor } from "@/pages/register/registerShared";
import { getClimbFeeModel } from "@/utils/feeSummary";

// What this member will owe, with optional services to tick.
export default function FeeBreakdownCard({
  climb,
  form,
  optionalFeeSelections,
  pledge,
  setOptionalFeeSelections,
}) {
  if (!(climb.fees?.length > 0)) return null;
  const isJoiner = form.memberType === "joiner";
  const { requiredFees, optionalFees, guestFee } =
    getClimbFeeModel(climb);
  // Guest Fee follows memberType, never a checkbox: joiners owe it
  // as a required item, members never see it.
  const required = [
    ...requiredFees,
    ...(isJoiner && guestFee ? [guestFee] : []),
  ];
  const optional = optionalFees;
  const {
    total: expectedTotal,
    hasTba,
    donation: donationLine,
  } = expectedTotalFor(climb, form, optionalFeeSelections, pledge);
  const totalDisplay = hasTba
    ? `₱${expectedTotal.toLocaleString("en-PH")} + TBA`
    : `₱${expectedTotal.toLocaleString("en-PH")}`;
  return (
    <div className="register-form-card">
      <div className="form-section-title">Fee Breakdown</div>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--ink-soft)",
          marginBottom: 14,
        }}
      >
        Review all fees below. Check any optional services you will
        be availing.
      </p>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.88rem",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border)" }}>
            <th style={{ width: 28 }}></th>
            <th
              style={{
                textAlign: "left",
                padding: "6px 0",
                fontWeight: 700,
                color: "var(--ink-soft)",
                fontSize: "0.68rem",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Item
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "6px 0",
                fontWeight: 700,
                color: "var(--ink-soft)",
                fontSize: "0.68rem",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <FeeTableBody
          optionalFeeSelections={optionalFeeSelections}
          setOptionalFeeSelections={setOptionalFeeSelections}
          required={required}
          optional={optional}
        />
        <tfoot>
          {donationLine && (
            <tr className="fee-donation-row">
              <td></td>
              <td>{donationLine.label}</td>
              <td>₱{donationLine.amount.toLocaleString("en-PH")}</td>
            </tr>
          )}
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td></td>
            <td
              style={{
                padding: "12px 0",
                fontWeight: 800,
                fontSize: "0.95rem",
              }}
            >
              Expected Total
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 400,
                  color: "var(--ink-soft)",
                }}
              >
                Based on your selections above
              </div>
            </td>
            <td
              style={{
                padding: "12px 0",
                textAlign: "right",
                fontWeight: 900,
                fontSize: "1.1rem",
                color: "var(--green-dark)",
              }}
            >
              {totalDisplay}
            </td>
          </tr>
        </tfoot>
      </table>
      <p
        style={{
          fontSize: "0.74rem",
          color: "var(--ink-soft)",
          marginTop: 10,
        }}
      >
        * Amounts are estimates. Final amounts will be confirmed by
        the climb officers.
      </p>
    </div>
  );
}
