import { formatDueDate } from "@/utils/registrationPolicy";

// The climb's payment due date and cancellation policy, wherever a member
// is deciding to register or pay. Renders nothing if neither is set.
export default function RegistrationPolicyInfo({ climb, className = "policy-info" }) {
  const due = formatDueDate(climb?.paymentDueDate);
  const policy = climb?.cancellationPolicy?.trim();
  if (!due && !policy) return null;
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
