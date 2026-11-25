import { getTransportRiders, groupClimbersByTrail } from "@/utils/climbers";

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
const PAY_LABEL = { paid: "paid", partial: "partly paid", unpaid: "not paid" };

function TransportColumn({ riders }) {
  return (
    <div className="climbers-col">
      <div className="climbers-col-title">Transportation — {riders.length}</div>
      <ul className="climbers-list">
        {riders.map(({ reg, payStatus }) => (
          <li key={reg.id}>
            {reg.name} <span className="climbers-pay">({PAY_LABEL[payStatus]})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ClimbersByTrailCard({ regs, climb, serviceGroups = {} }) {
  const { trails, none } = groupClimbersByTrail(regs, climb);
  const riders = getTransportRiders(regs, climb, serviceGroups);
  if (trails.length === 0 && riders.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Who&apos;s Climbing</div>
      <p className="climbers-note">
        Based on the fees each registrant has chosen. Transportation shows
        whether their payment covers their whole bill. Someone who hasn&apos;t chosen any yet is listed under
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
        {riders.length > 0 && <TransportColumn riders={riders} />}
        {trails.length > 0 && (
        <div className="climbers-col">
          <div className="climbers-col-title">
            No trail fees chosen — {none.length}
          </div>
          {none.length ? <NameList regs={none} /> : <p>—</p>}
        </div>
        )}
      </div>
    </div>
  );
}
