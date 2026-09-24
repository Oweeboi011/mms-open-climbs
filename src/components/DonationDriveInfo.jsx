import Icon from "@/components/Icon";
import { isDonationDriveOn } from "@/utils/donations";

// Event page section describing a climb's outreach donation drive, with the
// running total leads have recorded (published to the climb doc as
// `donationTotals` — individual donors are never shown).
export default function DonationDriveInfo({ climb }) {
  if (!isDonationDriveOn(climb)) return null;
  const drive = climb.donationDrive;
  const items = String(drive.suggestedItems || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const totals = climb.donationTotals;

  return (
    <div className="section-card">
      <div className="section-header">
        <span className="icon">
          <Icon name="heart" size={17} />
        </span>
        <h3>Outreach &amp; Donations</h3>
      </div>
      <div className="section-body">
        <p className="donation-beneficiary">
          For <strong>{drive.beneficiary}</strong>
        </p>
        {drive.description && <p>{drive.description}</p>}
        <ul className="info-list">
          {drive.acceptsCash && (
            <li>
              Cash donations can be added to your GCash payment with your fees,
              or handed to the climb leads on the day.
            </li>
          )}
          {drive.acceptsInKind && (
            <li>Carry-on donations: bring the items with you on the climb.</li>
          )}
        </ul>
        {drive.acceptsInKind && items.length > 0 && (
          <>
            <p className="donation-subhead">Suggested items</p>
            <ul className="info-list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {totals?.donors > 0 && (
          <p className="donation-tally">
            {totals.receivedCash > 0 &&
              `₱${Number(totals.receivedCash).toLocaleString("en-PH")} `}
            {totals.receivedCash > 0 && totals.itemDonations > 0 && "and "}
            {totals.itemDonations > 0 &&
              `items from ${totals.itemDonations} climber${totals.itemDonations === 1 ? "" : "s"} `}
            received so far — thank you!
          </p>
        )}
        <p className="form-hint">
          Optional, and separate from the climb fees. Pledge when you register
          or from My Climbs.
        </p>
      </div>
    </div>
  );
}
