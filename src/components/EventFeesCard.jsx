import Icon from "@/components/Icon";
import { getClimbFeeModel, formatPeso } from "@/utils/feeSummary";

const PLACEHOLDER_FEES = [
  "Transportation",
  "Registration / Guide Fee",
  "Accommodation",
  "Food & Meals",
];

function FeeRow({ fee }) {
  return (
    <div className="expense-row">
      <div>
        <div className="expense-label">{fee.label}</div>
        {fee.note && <div className="expense-note">{fee.note}</div>}
      </div>
      <div className="expense-amount">{fee.amount || "TBA"}</div>
    </div>
  );
}

// Public fees card on the event page. The headline is the *member* total —
// required fees only. Optional extras and the joiner-only guest fee are shown
// apart so nobody reads them as owed (see utils/feeSummary.js).
export default function EventFeesCard({ climb }) {
  const {
    requiredFees,
    optionalFees,
    guestFee,
    guestAmount,
    requiredTotal,
    requiredHasTBA,
    requiredHasAmount,
  } = getClimbFeeModel(climb);

  return (
    <div className="section-card">
      <div className="section-header">
        <span className="icon">
          <Icon name="wallet" size={17} />
        </span>
        <h3>Fees</h3>
      </div>
      <div className="section-body">
        {!climb.fees?.length ? (
          PLACEHOLDER_FEES.map((label) => (
            <FeeRow key={label} fee={{ label, amount: "TBA" }} />
          ))
        ) : (
          <>
            {requiredFees.map((fee, i) => (
              <FeeRow key={`req-${i}`} fee={fee} />
            ))}
            {requiredHasAmount && (
              <div className="expense-total-row">
                <div className="expense-total-label">
                  Member Total
                  {requiredHasTBA && (
                    <span className="expense-total-note"> (excl. TBA items)</span>
                  )}
                </div>
                <div className="expense-total-amount">
                  {formatPeso(requiredTotal)}
                </div>
              </div>
            )}
            {optionalFees.length > 0 && (
              <>
                <div className="expense-group-label">
                  Optional — only if availed
                </div>
                {optionalFees.map((fee, i) => (
                  <FeeRow key={`opt-${i}`} fee={fee} />
                ))}
              </>
            )}
            {guestFee && (
              <div className="expense-guest-note">
                + {guestAmount !== null ? formatPeso(guestAmount) : "TBA"}{" "}
                {guestFee.label} for non-members
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
