import { getNeededItems } from "@/utils/donations";

// ClimbForm section: switch on an outreach donation drive for this climb and
// say what it's collecting — needed items with target quantities, and an
// optional cash goal. Public: shown on the event page with what's still
// needed. Leads work the collection from the climb's Donations page.
export const EMPTY_DONATION_DRIVE = {
  enabled: false,
  beneficiary: "",
  description: "",
  acceptsCash: true,
  acceptsInKind: true,
  cashGoal: "",
  neededItems: [],
};

export default function DonationDriveFields({ form, setForm }) {
  const drive = { ...EMPTY_DONATION_DRIVE, ...(form.donationDrive || {}) };
  // Drives saved before targets existed carry a free-text list; edit it as rows.
  const rows = drive.neededItems?.length ? drive.neededItems : getNeededItems(drive);

  const set = (field, value) =>
    setForm((p) => ({
      ...p,
      donationDrive: { ...EMPTY_DONATION_DRIVE, ...(p.donationDrive || {}), [field]: value },
    }));
  const setRows = (next) => {
    set("neededItems", next);
    set("suggestedItems", "");
  };
  const updateRow = (i, field, value) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div className="admin-card">
      <div className="admin-card-title">Outreach &amp; Donations</div>
      <p className="form-hint">
        For climbs with a community or outreach activity. Members pledge cash
        (with their GCash payment or on the day) and the items below; leads
        track the collection from the climb&rsquo;s Donations page. Donations
        never count toward fees or the club&rsquo;s funds.
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
              Accepts cash
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
          {drive.acceptsCash && (
            <div className="form-group donation-goal">
              <label className="form-label">Cash goal (₱, optional)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={drive.cashGoal ?? ""}
                onChange={(e) => set("cashGoal", e.target.value)}
                placeholder="e.g. 10000"
              />
            </div>
          )}
          {drive.acceptsInKind && (
            <div className="form-group">
              <label className="form-label">Needed items</label>
              <p className="form-hint">
                What to collect and how many. Members pledge quantities against
                these, and the Donations page shows what&rsquo;s still needed.
              </p>
              {rows.map((row, i) => (
                <div className="needed-item-row" key={i}>
                  <input
                    className="form-input"
                    aria-label={`Item ${i + 1}`}
                    placeholder="Item, e.g. Notebooks"
                    value={row.name}
                    onChange={(e) => updateRow(i, "name", e.target.value)}
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    aria-label={`Target for item ${i + 1}`}
                    placeholder="Target"
                    value={row.target || ""}
                    onChange={(e) => updateRow(i, "target", Number(e.target.value) || 0)}
                  />
                  <input
                    className="form-input"
                    aria-label={`Unit for item ${i + 1}`}
                    placeholder="Unit (pcs, kg, packs)"
                    value={row.unit || ""}
                    onChange={(e) => updateRow(i, "unit", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setRows([...rows, { name: "", target: 0, unit: "" }])}
              >
                + Add item
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
