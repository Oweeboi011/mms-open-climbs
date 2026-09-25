import { getNeededItems } from "@/utils/donations";

// A member's optional donation pledge — on the registration form and in the
// My Climbs pledge editor. Only the kinds the drive accepts are offered;
// items the drive needs get a quantity each, anything else goes in free text.
export default function DonationPledgeFields({ drive, value, onChange, stillNeeded = {} }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const needed = getNeededItems(drive);
  const qty = value.itemQty || {};
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
            aria-label="Cash pledge (₱)"
            value={value.cashPledge ?? ""}
            onChange={(e) => set("cashPledge", e.target.value)}
            placeholder="0"
          />
          <label className="form-check">
            <input
              type="checkbox"
              checked={value.payWithFees !== false}
              onChange={(e) => set("payWithFees", e.target.checked)}
            />
            Add it to my GCash payment
          </label>
          <p className="form-hint">
            {value.payWithFees !== false
              ? "It's added to your amount due as a separate donation line, so the leads can total it."
              : "You'll hand it to the climb leads on the day."}
          </p>
        </div>
      )}
      {drive.acceptsInKind && needed.length > 0 && (
        <div className="form-group">
          <label className="form-label">Items you&rsquo;ll bring</label>
          {needed.map((item) => (
            <div className="pledge-item-row" key={item.name}>
              <span>
                {item.name}
                {item.target > 0 && (
                  <span className="form-hint">
                    {" "}
                    — {stillNeeded[item.name] ?? item.target} {item.unit || ""} still needed
                  </span>
                )}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                className="form-input"
                aria-label={`How many ${item.name}`}
                value={qty[item.name] ?? ""}
                onChange={(e) => set("itemQty", { ...qty, [item.name]: e.target.value })}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}
      {drive.acceptsInKind && (
        <div className="form-group">
          <label className="form-label">
            {needed.length ? "Anything else?" : "Items you’ll carry up"}
          </label>
          <textarea
            className="form-input"
            rows={2}
            maxLength={500}
            value={value.inKind ?? ""}
            onChange={(e) => set("inKind", e.target.value)}
            placeholder="e.g. 1 box of crayons"
          />
        </div>
      )}
    </>
  );
}
