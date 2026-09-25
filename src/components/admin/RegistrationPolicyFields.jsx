import { DEFAULT_CANCELLATION_POLICY } from "@/data/defaultCancellationPolicy";
import { DEFAULT_DUE_DAYS_BEFORE } from "@/utils/registrationPolicy";

// ClimbForm section: payment due date and the cancellation / refund policy.
// Both are public — members see them before registering and on My Climbs.
// Left blank, each falls back to the club default.
export default function RegistrationPolicyFields({ form, setForm }) {
  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  return (
    <div className="admin-card">
      <div className="admin-card-title">Waitlist, Payment Deadline &amp; Cancellation</div>
      <label className="form-check">
        <input
          type="checkbox"
          checked={form.waitlistAutoPromote !== false}
          onChange={(e) => set("waitlistAutoPromote", e.target.checked)}
        />
        When a slot opens, move the longest-waiting person off the waitlist
        automatically (they still need confirming)
      </label>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Payment due date</label>
          <input
            type="date"
            className="form-input"
            value={form.paymentDueDate || ""}
            onChange={(e) => set("paymentDueDate", e.target.value)}
          />
          <p className="form-hint">
            Shown to members and included in their daily payment reminders.
            Leave blank for the default: {DEFAULT_DUE_DAYS_BEFORE} days before
            the climb starts.
          </p>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Cancellation &amp; refund policy</label>
        <textarea
          className="form-input"
          rows={4}
          maxLength={2000}
          value={form.cancellationPolicy || ""}
          onChange={(e) => set("cancellationPolicy", e.target.value)}
          placeholder={DEFAULT_CANCELLATION_POLICY}
        />
        <p className="form-hint">
          Shown on the event page, the registration form, and when a member
          cancels from My Climbs. Leave blank to use the club default (shown
          above in grey).{" "}
          {!form.cancellationPolicy && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => set("cancellationPolicy", DEFAULT_CANCELLATION_POLICY)}
            >
              Start from the default
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
