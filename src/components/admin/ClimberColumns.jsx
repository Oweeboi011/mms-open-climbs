import { getGuestAge, getGuests } from "@/utils/guests";
import { certificateCount } from "@/utils/climbers";

// Name columns shared by the "Who's Climbing" and transportation breakdown
// cards. Counts are people, guests included.
const PAY_LABEL = { paid: "paid", partial: "partly paid", unpaid: "not paid" };

const everyGuest = () => true;
const guestsOf = (reg, keep) => getGuests(reg).filter((g) => keep(g));
const headcount = (regs, keep) =>
  regs.reduce((n, reg) => n + 1 + guestsOf(reg, keep).length, 0);

// Guests ride on their member's registration, so they follow the member:
// the same trails, the same transport and pickup point.
function GuestLines({ reg, climb, keep }) {
  return guestsOf(reg, keep).map((g, i) => {
    const age = getGuestAge(g, climb);
    return (
      <div className="climbers-guest" key={i}>
        + {g.name} (guest{age === null ? "" : `, ${age}`})
      </div>
    );
  });
}

// "(pays own)" when the party pays any of this column's fees directly.
function OwnTag({ reg, labels }) {
  const own = labels && (reg.selfPaidFees || []).some((l) => labels.includes(l));
  return own ? <span className="climbers-pay"> (pays own)</span> : null;
}

// Flags who asked for a finisher certificate on this trail.
function CertTag({ reg, climb, certLabels }) {
  const n = certificateCount(reg, climb, certLabels);
  if (n === 0) return null;
  return <span className="climbers-cert"> (certificate{n > 1 ? ` ×${n}` : ""})</span>;
}

function NameList({ regs, climb, keep, labels, certLabels }) {
  return (
    <ul className="climbers-list">
      {regs.map((reg) => (
        <li key={reg.id}>
          {reg.name}
          <OwnTag reg={reg} labels={labels} />
          <CertTag reg={reg} climb={climb} certLabels={certLabels} />
          <GuestLines reg={reg} climb={climb} keep={keep} />
        </li>
      ))}
    </ul>
  );
}

function RiderItems({ riders, climb, keep, labels }) {
  return (
    <ul className="climbers-list">
      {riders.map(({ reg, payStatus }) => (
        <li key={reg.id}>
          {reg.name}{" "}
          <span className="climbers-pay">({PAY_LABEL[payStatus]})</span>
          <OwnTag reg={reg} labels={labels} />
          <GuestLines reg={reg} climb={climb} keep={keep} />
        </li>
      ))}
    </ul>
  );
}

// `keep` decides which of a member's guests belong in this column.
export function Column({
  title,
  regs,
  riders,
  climb,
  keep = everyGuest,
  labels,
  certLabels,
}) {
  const list = riders || regs;
  const people = headcount(riders ? riders.map((r) => r.reg) : regs, keep);
  return (
    <div className="climbers-col">
      <div className="climbers-col-title">
        {title} — {people}
      </div>
      {list.length === 0 && <p>—</p>}
      {list.length > 0 &&
        (riders ? (
          <RiderItems riders={riders} climb={climb} keep={keep} labels={labels} />
        ) : (
          <NameList regs={regs} climb={climb} keep={keep} labels={labels} certLabels={certLabels} />
        ))}
    </div>
  );
}
