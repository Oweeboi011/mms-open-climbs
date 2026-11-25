import { getGuestAge, getGuests, getHeadcount } from "@/utils/guests";
import {
  getOwnTransport,
  getTransportRiders,
  groupClimbersByTrail,
  groupRidersByPickup,
} from "@/utils/climbers";

const PAY_LABEL = { paid: "paid", partial: "partly paid", unpaid: "not paid" };

const headcount = (regs) => regs.reduce((n, reg) => n + getHeadcount(reg), 0);

// Guests ride on their member's registration, so they follow the member:
// the same trails, the same transport and pickup point.
function GuestLines({ reg, climb }) {
  return getGuests(reg).map((g, i) => {
    const age = getGuestAge(g, climb);
    return (
      <div className="climbers-guest" key={i}>
        + {g.name} (guest{age === null ? "" : `, ${age}`})
      </div>
    );
  });
}

function NameList({ regs, climb }) {
  return (
    <ul className="climbers-list">
      {regs.map((reg) => (
        <li key={reg.id}>
          {reg.name}
          <GuestLines reg={reg} climb={climb} />
        </li>
      ))}
    </ul>
  );
}

function RiderItems({ riders, climb }) {
  return (
    <ul className="climbers-list">
      {riders.map(({ reg, payStatus }) => (
        <li key={reg.id}>
          {reg.name}{" "}
          <span className="climbers-pay">({PAY_LABEL[payStatus]})</span>
          <GuestLines reg={reg} climb={climb} />
        </li>
      ))}
    </ul>
  );
}

function Column({ title, regs, riders, climb }) {
  const list = riders || regs;
  const people = riders ? headcount(riders.map((r) => r.reg)) : headcount(regs);
  return (
    <div className="climbers-col">
      <div className="climbers-col-title">
        {title} — {people}
      </div>
      {list.length === 0 && <p>—</p>}
      {list.length > 0 &&
        (riders ? (
          <RiderItems riders={riders} climb={climb} />
        ) : (
          <NameList regs={regs} climb={climb} />
        ))}
    </div>
  );
}

// Transport riders, split by pickup point when the climb has any.
function TransportColumns({ riders, climb }) {
  const { groups, unset } = groupRidersByPickup(riders, climb);
  if (groups.length === 0) {
    return <Column title="Transportation" riders={riders} climb={climb} />;
  }
  return (
    <>
      {groups.map((g) => (
        <Column
          key={g.name}
          title={`Pickup: ${g.name}`}
          riders={g.riders}
          climb={climb}
        />
      ))}
      {unset.length > 0 && (
        <Column
          title="Transportation, no pickup set"
          riders={unset}
          climb={climb}
        />
      )}
    </>
  );
}

// Who is climbing each trail and who is riding the organized transport, from
// the fees each registrant has chosen. Counts are people, guests included.
export default function ClimbersByTrailCard({
  regs,
  climb,
  serviceGroups = {},
}) {
  const { trails, none } = groupClimbersByTrail(regs, climb);
  const riders = getTransportRiders(regs, climb, serviceGroups);
  const own = riders.length ? getOwnTransport(regs, climb, serviceGroups) : [];
  if (trails.length === 0 && riders.length === 0) return null;
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Who&apos;s Climbing</div>
      <p className="climbers-note">
        Based on the fees each registrant has chosen. Guests are listed under
        the member who registered them and follow that member&apos;s trails and
        transport; counts include guests. The payment tag shows whether the
        member&apos;s payment covers their whole bill. Anyone who hasn&apos;t
        chosen fees yet appears under &quot;No trail fees chosen&quot; and
        &quot;Own transportation&quot;.
      </p>
      <div className="climbers-grid">
        {trails.map((t) => (
          <Column key={t.name} title={t.name} regs={t.climbers} climb={climb} />
        ))}
        {riders.length > 0 && (
          <TransportColumns riders={riders} climb={climb} />
        )}
        {riders.length > 0 && (
          <Column title="Own transportation" regs={own} climb={climb} />
        )}
        {trails.length > 0 && (
          <Column title="No trail fees chosen" regs={none} climb={climb} />
        )}
      </div>
    </div>
  );
}
