import { getGuestAge, getGuests, getHeadcount } from "@/utils/guests";

// Name columns shared by the "Who's Climbing" and transportation breakdown
// cards. Counts are people, guests included.
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

export function Column({ title, regs, riders, climb }) {
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
