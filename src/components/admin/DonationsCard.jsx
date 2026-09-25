import { Link } from "react-router-dom";
import { formatPeso } from "@/utils/feeSummary";
import { buildDonationCollection } from "@/utils/donations";

// Admin ClimbDetail summary of the climb's donation drive — how far along it
// is — linking to the Donations page, where leads work the collection list
// and record what each person handed over.
export default function DonationsCard({ climb, regs, paidWithFees = () => 0 }) {
  const { items, cash, people } = buildDonationCollection(regs, climb, paidWithFees);
  const toCollect = people.filter((p) => !p.collected).length;
  const short = items.filter((i) => i.stillNeeded > 0);

  return (
    <div className="admin-card donations-card">
      <div className="admin-card-title">
        Donations — {climb.donationDrive?.beneficiary || "outreach"}
      </div>
      <div className="donations-totals">
        {climb.donationDrive?.acceptsCash !== false && (
          <span>
            Cash received: <strong>{formatPeso(cash.received)}</strong>
            {cash.goal > 0 && ` of ${formatPeso(cash.goal)}`}
          </span>
        )}
        {cash.toCollectOnDay > 0 && (
          <span>
            To collect on the day: <strong>{formatPeso(cash.toCollectOnDay)}</strong>
          </span>
        )}
        <span>
          <strong>{toCollect}</strong> {toCollect === 1 ? "person" : "people"} still to collect from
        </span>
      </div>
      {items.length > 0 && (
        <p className="form-hint">
          {short.length === 0
            ? "Every needed item has been received."
            : `Still needed: ${short.map((i) => `${i.stillNeeded} ${i.unit || ""} ${i.name}`.replace(/\s+/g, " ")).join(", ")}.`}
        </p>
      )}
      <Link to={`/admin/climbs/${climb.id}/donations`} className="btn btn-outline btn-sm">
        Open Donations &amp; collection list &rarr;
      </Link>
    </div>
  );
}
