import { Column } from "@/components/admin/ClimberColumns";
import {
  getOwnTransport,
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
          />
        )}
        <Column title="Own transportation" regs={own} climb={climb} />
      </div>
    </div>
  );
}
