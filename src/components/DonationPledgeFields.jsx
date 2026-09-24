// A member's optional donation pledge — on the registration form and in the
// My Climbs pledge editor. Only the kinds the drive accepts are offered.
export default function DonationPledgeFields({ drive, value, onChange }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  return (
    <>
      {drive.acceptsCash && (
        <div className="form-group">
          <label className="form-label">Cash pledge (₱)</label>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            className="form-input"
            value={value.cashPledge ?? ""}
            onChange={(e) => set("cashPledge", e.target.value)}
            placeholder="0"
          />
          <p className="form-hint">
            Handed to the climb leads on the day — not paid through GCash and
            not part of your fees.
          </p>
        </div>
      )}
      {drive.acceptsInKind && (
        <div className="form-group">
          <label className="form-label">Items you&rsquo;ll carry up</label>
          <textarea
            className="form-input"
            rows={2}
            maxLength={500}
            value={value.inKind ?? ""}
            onChange={(e) => set("inKind", e.target.value)}
            placeholder="e.g. 10 notebooks, 1 box of pencils"
          />
        </div>
      )}
    </>
  );
}
