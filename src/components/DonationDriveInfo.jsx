import Icon from "@/components/Icon";
import { getNeededItems, isDonationDriveOn } from "@/utils/donations";

// Event page section describing a climb's outreach donation drive: what it
// needs and how much of each is still missing, from the totals leads publish
// to the climb doc (`donationTotals`) — never who gave what.
export default function DonationDriveInfo({ climb }) {
  if (!isDonationDriveOn(climb)) return null;
  const drive = climb.donationDrive;
  const needed = getNeededItems(drive);
  const totals = climb.donationTotals || {};
  const progress = Object.fromEntries((totals.items || []).map((i) => [i.name, i]));
  const goal = Number(drive.cashGoal) || 0;

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
              {goal > 0 &&
                ` Goal: ₱${goal.toLocaleString("en-PH")} — ₱${Number(totals.receivedCash || 0).toLocaleString("en-PH")} received so far.`}
            </li>
          )}
          {drive.acceptsInKind && (
            <li>Carry-on donations: bring the items with you on the climb.</li>
          )}
        </ul>
        {drive.acceptsInKind && needed.length > 0 && (
          <>
            <p className="donation-subhead">What&rsquo;s needed</p>
            <ul className="donation-needs">
              {needed.map((item) => {
                const p = progress[item.name];
                const covered = Math.max(p?.pledged || 0, p?.received || 0);
                const left = item.target ? Math.max(0, item.target - covered) : null;
                return (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    {item.target > 0 && (
                      <span className={left === 0 ? "donation-need-met" : "donation-need-open"}>
                        {left === 0
                          ? "Covered — thank you!"
                          : `${left} of ${item.target} ${item.unit || ""} still needed`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {totals.donors > 0 && !goal && (
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
