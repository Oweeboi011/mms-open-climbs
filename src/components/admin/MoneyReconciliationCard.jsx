import { formatPeso } from "@/utils/feeSummary";
import { reconcileClimbMoney } from "@/utils/climbMoney";

// "Where the money stands", step by step from what active registrants owe
// to what has been verified, naming the people behind every difference so
// an officer can act on it (chase, review, refund, or split to the person a
// payment was really for).
function Step({ sign, label, hint, bucket }) {
  if (!bucket.entries.length) return null;
  return (
    <details className="money-step">
      <summary>
        <span className="money-label">
          {sign} {label} <span className="money-count">({bucket.entries.length})</span>
        </span>
        <span className="money-amount">
          {sign === "−" ? "−" : "+"}
          {formatPeso(bucket.total)}
        </span>
      </summary>
      {hint && <p className="form-hint">{hint}</p>}
      <ul className="money-people">
        {bucket.entries.map(({ reg, amount, owes, paid }) => (
          <li key={reg.id}>
            <span>{reg.name || reg.email || reg.id}</span>
            <span>
              {formatPeso(amount)}
              {owes !== undefined && (
                <span className="money-detail">
                  {" "}
                  (paid {formatPeso(paid)}, owes {formatPeso(owes)})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function MoneyReconciliationCard({
  regs,
  climb,
  serviceGroups = {},
  donationsInPayments = 0,
  expensesTotal = 0,
}) {
  const r = reconcileClimbMoney(regs, climb, serviceGroups);
  if (r.activeCount === 0 && r.keptFromCancelled.entries.length === 0) return null;
  const clubCollected = r.verified - donationsInPayments;

  return (
    <div className="admin-card money-card">
      <div className="admin-card-title">Where the Money Stands</div>
      <p className="form-hint">
        From what active registrants owe to what has been verified. Open a line
        to see who is behind it.
      </p>
      <div className="money-row money-start">
        <span>
          Owed by {r.activeCount} active registrant{r.activeCount === 1 ? "" : "s"}
        </span>
        <span className="money-amount">{formatPeso(r.expected)}</span>
      </div>
      <Step
        sign="−"
        label="Awaiting payment review"
        hint="Declared by the member but not yet verified — review them in the table below."
        bucket={r.awaitingReview}
      />
      <Step sign="−" label="Still owed" bucket={r.stillOwed} />
      <Step
        sign="+"
        label="Paid more than they owe"
        hint="Often a payment for someone else — split it to them — or a fee that dropped after they paid. Otherwise record a refund."
        bucket={r.overpaid}
      />
      <Step
        sign="+"
        label="Kept from cancelled registrations"
        hint="Money from people who cancelled. Record the refund if it was returned, or leave it if it was non-refundable."
        bucket={r.keptFromCancelled}
      />
      <div className="money-row money-total">
        <span>Verified collected</span>
        <span className="money-amount">{formatPeso(r.verified)}</span>
      </div>
      {(donationsInPayments > 0 || expensesTotal > 0) && (
        <div className="money-after">
          {donationsInPayments > 0 && (
            <div className="money-row">
              <span>− Donations paid with fees (the beneficiary&rsquo;s, not the club&rsquo;s)</span>
              <span className="money-amount">−{formatPeso(donationsInPayments)}</span>
            </div>
          )}
          {expensesTotal > 0 && (
            <div className="money-row">
              <span>− Expenses logged</span>
              <span className="money-amount">−{formatPeso(expensesTotal)}</span>
            </div>
          )}
          <div className="money-row money-total">
            <span>Club net funds</span>
            <span className="money-amount">{formatPeso(clubCollected - expensesTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
