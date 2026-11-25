import {
  getOwnTransport,
  getTransportRiders,
  groupClimbersByTrail,
  groupRidersByPickup,
} from "@/utils/climbers";

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

function RiderItems({ riders }) {
  return (
    <ul className="climbers-list">
      {riders.map(({ reg, payStatus }) => (
        <li key={reg.id}>
          {reg.name} <span className="climbers-pay">({PAY_LABEL[payStatus]})</span>
        </li>
      ))}
    </ul>
  );
}

// Transport riders, split by pickup point when the climb has any.
function TransportColumns({ riders, climb }) {
  const { groups, unset } = groupRidersByPickup(riders, climb);
  if (groups.length === 0) {
    return (
      <div className="climbers-col">
        <div className="climbers-col-title">Transportation — {riders.length}</div>
        <RiderItems riders={riders} />
      </div>
    );
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.name} className="climbers-col">
          <div className="climbers-col-title">
            Pickup: {g.name} — {g.riders.length}
          </div>
          {g.riders.length ? <RiderItems riders={g.riders} /> : <p>—</p>}
        </div>
      ))}
      {unset.length > 0 && (
        <div className="climbers-col">
          <div className="climbers-col-title">
            Transportation, no pickup set — {unset.length}
          </div>
          <RiderItems riders={unset} />
        </div>
      )}
    </>
  );
}

export default function ClimbersByTrailCard({ regs, climb, serviceGroups = {} }) {
  const { trails, none } = groupClimbersByTrail(regs, climb);
  const riders = getTransportRiders(regs, climb, serviceGroups);
  const own = riders.length ? getOwnTransport(regs, climb, serviceGroups) : [];
  if (trails.length === 0 && riders.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Who&apos;s Climbing</div>
      <p className="climbers-note">
        Based on the fees each registrant has chosen. Own transportation is everyone without the Transportation Fee, including anyone who hasn't chosen fees yet. Transportation shows
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
        {riders.length > 0 && <TransportColumns riders={riders} climb={climb} />}
        {riders.length > 0 && (
          <div className="climbers-col">
            <div className="climbers-col-title">
              Own transportation — {own.length}
            </div>
            {own.length ? <NameList regs={own} /> : <p>—</p>}
          </div>
        )}
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
