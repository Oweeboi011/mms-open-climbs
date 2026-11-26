import { Column } from "@/components/admin/ClimberColumns";
import { groupClimbersByTrail, guestJoinsTrail } from "@/utils/climbers";

// Who is climbing each trail, from the fees each registrant has chosen. Counts are people, guests included.
export default function ClimbersByTrailCard({ regs, climb }) {
  const { trails, none } = groupClimbersByTrail(regs, climb);
  if (trails.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Who&apos;s Climbing</div>
      <p className="climbers-note">
        Based on the fees each registrant has chosen. Guests are listed under
        the member who registered them and follow that member&apos;s trails;
        counts include guests. Anyone who hasn&apos;t chosen fees yet appears
        under &quot;No trail fees chosen&quot;.
      </p>
      <div className="climbers-grid">
        {trails.map((t) => (
          <Column
            key={t.name}
            title={t.name}
            regs={t.climbers}
            climb={climb}
            keep={(g) => guestJoinsTrail(g, climb, t.name)}
          />
        ))}
        <Column title="No trail fees chosen" regs={none} climb={climb} />
      </div>
    </div>
  );
}
