import { Column } from "@/components/admin/ClimberColumns";
import { getGuests } from "@/utils/guests";
import {
  getOwnTransport,
  guestRides,
  getTransportRiders,
  groupRidersByPickup,
} from "@/utils/climbers";

// Who is taking the organized transport (by pickup point) and who is
// travelling on their own — the same column view as "Who's Climbing".
export default function TransportBreakdownCard({
  regs,
  climb,
  serviceGroups = {},
}) {
  const riders = getTransportRiders(regs, climb, serviceGroups);
  if (riders.length === 0) return null;
  const own = getOwnTransport(regs, climb, serviceGroups);
  const { groups, unset } = groupRidersByPickup(riders, climb);
  const rides = (g) => guestRides(g, climb);
  // A rider's guest who isn't taking the van travels on their own.
  const ownGuests = riders.flatMap(({ reg }) =>
    getGuests(reg)
      .filter((g) => !rides(g))
      .map((g, i) => ({
        id: `${reg.id}-guest-${i}`,
        name: `${g.name} (guest of ${reg.name})`,
        status: reg.status,
      })),
  );
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Transportation Breakdown</div>
      <p className="climbers-note">
        With transportation, by pickup point, and travelling on their own.
        Guests follow their member; counts include guests. Anyone who
        hasn&apos;t chosen fees yet appears under &quot;Own transportation&quot;.
      </p>
      <div className="climbers-grid">
        {groups.map((g) => (
          <Column
            key={g.name}
            title={`Pickup: ${g.name}`}
            riders={g.riders}
            climb={climb}
            keep={rides}
          />
        ))}
        {(groups.length === 0 || unset.length > 0) && (
          <Column
            title={
              groups.length === 0
                ? "With transportation"
                : "With transportation, no pickup set"
            }
            riders={unset}
            climb={climb}
            keep={rides}
          />
        )}
        <Column
          title="Own transportation"
          regs={[...own, ...ownGuests]}
          climb={climb}
        />
      </div>
    </div>
  );
}
