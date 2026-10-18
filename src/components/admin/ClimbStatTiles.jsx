import { sumPaymentsByStatus } from "@/utils/payments";

function Tile({ value, label, tone = "", title }) {
  return (
    <div className={`admin-stat-card ${tone}`.trim()} title={title}>
      <div className="admin-stat-num">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

const peso = (n) => `₱${n.toLocaleString("en-PH")}`;

// The headline numbers at the top of one climb's registrant page. Members and
// guests count active registrations; anyone not marked a member is a guest
// (joiner), the same rule the Guest Fee follows.
export default function ClimbStatTiles({ stats, climb, regs, docs }) {
  const active = regs.filter((r) => r.status !== "cancelled");
  const members = active.filter((r) => r.memberType === "member").length;
  const payments = sumPaymentsByStatus(regs);
  return (
    <div className="admin-stats">
      <Tile value={stats.total} label="Total" />
      <Tile value={members} label="Members" title="MMS members, cancelled registrations excluded" />
      <Tile
        value={active.length - members}
        label="Guests"
        title="Joiners (non-members, who pay the Guest Fee), cancelled registrations excluded"
      />
      <Tile value={stats.confirmed} label="Confirmed" />
      <Tile value={stats.pending} label="Pending" tone="gold" />
      <Tile value={stats.waitlisted} label="Waitlisted" tone="accent" />
      <Tile value={stats.cancelled} label="Cancelled" tone="danger" />
      <Tile value={stats.awaitingPayment} label="Awaiting Payment Review" tone="gold" />
      <Tile
        value={peso(payments.verified.amount)}
        label={`Verified Payments (${payments.verified.count})`}
        tone="accent"
        title="Payments an officer has checked and accepted, before refunds"
      />
      <Tile
        value={peso(payments.submitted.amount)}
        label={`Unverified Payments (${payments.submitted.count})`}
        tone="gold"
        title="Payments submitted but not yet reviewed: check each receipt in the registrant list"
      />
      <Tile value={peso(stats.totalMissing)} label="Total Outstanding" tone="danger" />
      {climb?.maxParticipants && (
        <Tile value={climb.maxParticipants - stats.confirmed} label="Open Slots" />
      )}
      {stats.noShows > 0 && <Tile value={stats.noShows} label="No-shows" tone="danger" />}
      {docs.expected > 0 && (
        <Tile
          value={
            <>
              {docs.submitted}
              <span className="admin-stat-of">/{docs.expected}</span>
            </>
          }
          label="Required Docs In"
          tone={docs.complete ? "" : "gold"}
          title={`${docs.submitted} of ${docs.expected} expected requirement documents have been submitted across ${docs.types.length} required document type${docs.types.length === 1 ? "" : "s"}. Cancelled registrants are excluded.`}
        />
      )}
    </div>
  );
}
