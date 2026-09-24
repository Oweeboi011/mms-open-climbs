// ClimbForm section: switch on an outreach donation drive for this climb.
// Everything here is public (it shows on the event page).
export const EMPTY_DONATION_DRIVE = {
  enabled: false,
  beneficiary: "",
  description: "",
  acceptsCash: true,
  acceptsInKind: true,
  suggestedItems: "",
};

export default function DonationDriveFields({ form, setForm }) {
  const drive = { ...EMPTY_DONATION_DRIVE, ...(form.donationDrive || {}) };
  const set = (field, value) =>
    setForm((p) => ({
      ...p,
      donationDrive: { ...EMPTY_DONATION_DRIVE, ...(p.donationDrive || {}), [field]: value },
    }));

  return (
    <div className="admin-card">
      <div className="admin-card-title">Outreach &amp; Donations</div>
      <p className="form-hint">
        For climbs with a community or outreach activity. Members can pledge
        cash (handed to the leads on climb day) and/or items they&rsquo;ll carry
        up. Donations never count toward fees, balances or the club&rsquo;s funds.
      </p>
      <label className="form-check">
        <input
          type="checkbox"
          checked={drive.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
        This climb has a donation drive
      </label>
      {drive.enabled && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Beneficiary</label>
              <input
                className="form-input"
                required
                value={drive.beneficiary}
                onChange={(e) => set("beneficiary", e.target.value)}
                placeholder="e.g. Brgy. Tanglag Elementary School"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">What it&rsquo;s for</label>
            <textarea
              className="form-input"
              rows={3}
              value={drive.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. School supplies for 60 pupils, handed over at the jump-off"
            />
          </div>
          <div className="form-row">
            <label className="form-check">
              <input
                type="checkbox"
                checked={drive.acceptsCash}
                onChange={(e) => set("acceptsCash", e.target.checked)}
              />
              Accepts cash (to the leads on climb day)
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                checked={drive.acceptsInKind}
                onChange={(e) => set("acceptsInKind", e.target.checked)}
              />
              Accepts carry-on items
            </label>
          </div>
          {drive.acceptsInKind && (
            <div className="form-group">
              <label className="form-label">Suggested items (one per line)</label>
              <textarea
                className="form-input"
                rows={3}
                value={drive.suggestedItems}
                onChange={(e) => set("suggestedItems", e.target.value)}
                placeholder={"Notebooks\nPencils\nCanned goods"}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
