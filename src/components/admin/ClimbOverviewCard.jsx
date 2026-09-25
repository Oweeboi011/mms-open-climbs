import { Link } from "react-router-dom";
import { getEffectiveStatus } from "@/utils/climbStatus";
import { getFeeSummary } from "@/utils/feeSummary";
import {
  formatDueDate,
  getPaymentDueDate,
  isDefaultDueDate,
  isDefaultPolicy,
} from "@/utils/registrationPolicy";
import { getSetupGaps, nextMeeting, requiredDocLabels } from "@/utils/climbSetup";

// The climb itself, at a glance, on the admin climb page — so checking a
// setting doesn't mean opening the edit form — plus what's still missing.
function Fact({ label, children }) {
  return (
    <div className="overview-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function ClimbOverviewCard({ climb, climbPrivate, officerEmails, stats }) {
  if (!climb) return null;
  const status = getEffectiveStatus(climb);
  const gaps = getSetupGaps(climb, climbPrivate || {}, officerEmails);
  const meeting = nextMeeting(climbPrivate?.preClimbMeetings || []);
  const docs = requiredDocLabels(climb);
  const max = Number(climb.maxParticipants) || 0;

  return (
    <div className="admin-card overview-card">
      <div className="admin-card-title">Climb at a Glance</div>
      <dl className="overview-facts">
        <Fact label="Status">
          <span className={`overview-status overview-status-${status}`}>{status}</span>
          {climb.cancellationStatus === "postponed" && " · postponed"}
        </Fact>
        <Fact label="When / where">
          {[climb.dateLabel, climb.location].filter(Boolean).join(" · ") || "—"}
        </Fact>
        <Fact label="Slots">
          {max ? `${stats.confirmed + stats.pending} of ${max} taken` : "No limit"}
          {stats.waitlisted > 0 && ` · ${stats.waitlisted} waitlisted`}
          {max > 0 &&
            (climb.waitlistAutoPromote === false
              ? " · manual waitlist"
              : " · auto-promotes from waitlist")}
        </Fact>
        <Fact label="Fees">{getFeeSummary(climb) || "—"}</Fact>
        <Fact label="Payment due">
          {getPaymentDueDate(climb)
            ? `${formatDueDate(getPaymentDueDate(climb))}${isDefaultDueDate(climb) ? " (default: 5 days before)" : ""}`
            : "Set climb dates first"}
        </Fact>
        <Fact label="Cancellation policy">
          {isDefaultPolicy(climb) ? (
            "Club default"
          ) : (
            <span className="overview-clamp">{climb.cancellationPolicy}</span>
          )}
        </Fact>
        <Fact label="Required documents">{docs.length ? docs.join(", ") : "None"}</Fact>
        <Fact label="Officers">
          {climb.officers?.length
            ? climb.officers.map((o) => `${o.name}${o.role ? ` (${o.role})` : ""}`).join(", ")
            : "None assigned"}
        </Fact>
        <Fact label="Next pre-climb meeting">
          {meeting
            ? `${meeting.date}${meeting.time ? ` ${meeting.time}` : ""}${meeting.location ? ` · ${meeting.location}` : ""}`
            : "None scheduled"}
        </Fact>
        <Fact label="Donation drive">
          {climb.donationDrive?.enabled
            ? `On — for ${climb.donationDrive.beneficiary || "(beneficiary not set)"}`
            : "Off"}
        </Fact>
      </dl>

      {gaps.length > 0 && (
        <div className="overview-gaps">
          <strong>Still to set up</strong>
          <ul>
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overview-links">
        <Link to={`/event/${climb.id}`} target="_blank" rel="noopener">
          View public event page ↗
        </Link>
        <Link to={`/admin/climbs/${climb.id}/edit`}>Edit settings</Link>
      </div>
    </div>
  );
}
