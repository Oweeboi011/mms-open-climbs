import { Column } from "@/components/admin/ClimberColumns";
import { groupByAccommodation, guestStays } from "@/utils/climbers";

// Who is staying in each accommodation option, from the fees chosen. Guests
// follow their member unless taken off that stay; counts include guests.
export default function AccommodationCard({ regs, climb }) {
  const { options, none } = groupByAccommodation(regs, climb);
  if (options.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Accommodation</div>
      <p className="climbers-note">
        Based on the accommodation each registrant has chosen. Anyone who
        hasn&apos;t chosen one yet appears under &quot;No accommodation
        chosen&quot;, which includes people who plan to find their own.
      </p>
      <div className="climbers-grid">
        {options.map(({ fee, regs: stay }) => (
          <Column
            key={fee.label}
            title={fee.label.trim()}
            regs={stay}
            climb={climb}
            keep={(g) => guestStays(g, fee.label)}
            labels={[fee.label]}
          />
        ))}
        <Column title="No accommodation chosen" regs={none} climb={climb} />
      </div>
    </div>
  );
}
