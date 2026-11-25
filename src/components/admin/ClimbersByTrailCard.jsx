import { groupClimbersByTrail } from "@/utils/climbers";

function NameList({ regs }) {
  return (
    <ul className="climbers-list">
      {regs.map((reg) => (
        <li key={reg.id}>{reg.name}</li>
      ))}
    </ul>
  );
}

// Who is climbing each trail of a multi-trail climb, from the trail fees on
// each registrant's bill. Renders nothing when the climb has no trail fees.
export default function ClimbersByTrailCard({ regs, climb }) {
  const { trails, none } = groupClimbersByTrail(regs, climb);
  if (trails.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Who&apos;s Climbing</div>
      <p className="climbers-note">
        Based on the trail fees (entrance, guide, certificate) each registrant
        has chosen. Someone who hasn&apos;t chosen any yet is listed under
        &quot;No trail fees chosen&quot;.
      </p>
      <div className="climbers-grid">
        {trails.map((t) => (
          <div key={t.name} className="climbers-col">
            <div className="climbers-col-title">
              {t.name} — {t.climbers.length}
            </div>
            {t.climbers.length ? <NameList regs={t.climbers} /> : <p>—</p>}
          </div>
        ))}
        <div className="climbers-col">
          <div className="climbers-col-title">
            No trail fees chosen — {none.length}
          </div>
          {none.length ? <NameList regs={none} /> : <p>—</p>}
        </div>
      </div>
    </div>
  );
}
