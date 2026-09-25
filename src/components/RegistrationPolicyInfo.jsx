import {
  formatDueDate,
  getCancellationPolicy,
  getPaymentDueDate,
} from "@/utils/registrationPolicy";

// The climb's payment due date and cancellation policy, wherever a member
// is deciding to register or pay. Both fall back to the club defaults (due
// 5 days before the climb; the club-wide policy).
export default function RegistrationPolicyInfo({ climb, className = "policy-info" }) {
  const due = formatDueDate(getPaymentDueDate(climb));
  const policy = getCancellationPolicy(climb);
  return (
    <div className={className}>
      {due && (
        <p className="policy-due">
          Payment due by <strong>{due}</strong>
        </p>
      )}
      {policy && (
        <>
          <p className="policy-heading">Cancellation &amp; refund policy</p>
          <p className="policy-text">{policy}</p>
        </>
      )}
    </div>
  );
}
