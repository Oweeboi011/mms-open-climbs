import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import { getExperienceLevel, TRAIL_CLASS_LABELS } from "@/utils/trailClass";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { getEffectiveStatus } from "@/utils/climbStatus";

const BADGE_CLASS = {
  minor: "badge-minor",
  major: "badge-major",
  special: "badge-special",
};
const TYPE_LABEL = { minor: "Minor", major: "Major", special: "Special" };

const STATUS_LABEL = {
  open: "Open",
  closed: "Closed",
  completed: "Completed",
  draft: "Draft",
};
const CORNER_LABEL = {
  cancelled: "Cancelled",
  postponed: "Postponed",
  completed: "Completed",
  closed: "Closed",
};
const STATUS_CLASS = {
  open: "card-status-open",
  closed: "card-status-closed",
  completed: "card-status-completed",
  draft: "card-status-closed",
};

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

const EXACT_TEAM_LEADER_RE = /^team leader$/i;
const SENIOR_TEAM_LEADER_RE = /^(senior|sr\.?)\s*team leader$/i;
const ASSISTANT_LEADER_RE = /^(assistant|asst\.?)\s*team leader$/i;

function getLeadOfficers(officers) {
  if (!officers?.length) return [];
  const teamLeader =
    officers.find((o) => EXACT_TEAM_LEADER_RE.test(o.role || "")) ||
    officers.find((o) => SENIOR_TEAM_LEADER_RE.test(o.role || ""));
  const assistantLeader = officers.find((o) =>
    ASSISTANT_LEADER_RE.test(o.role || ""),
  );
  return [teamLeader, assistantLeader].filter(Boolean);
}

function isClimbOngoing(climb) {
  const start = toDate(climb.startDate);
  if (!start) return false;
  const end = toDate(climb.endDate) || start;
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return todayDay >= startDay && todayDay <= endDay;
}

export default function ClimbCard({ climb }) {
  const hasCap = Boolean(climb.maxParticipants);
  const registered = climb.registrationCount ?? 0;
  const seatsLeft = climb.maxParticipants - registered;
  const isActive = climb.status === "open";
  const isFull = hasCap && isActive && seatsLeft <= 0;
  const isLow = hasCap && isActive && seatsLeft > 0 && seatsLeft <= 5;
  const effectiveStatus = getEffectiveStatus(climb);
  const isCancelled = effectiveStatus === "cancelled";
  const isPostponed = climb.cancellationStatus === "postponed";
  // Terminal and on-hold states describe the whole card rather than a
  // detail inside it, so they get the corner tab and are rendered
  // nowhere else — no flag tag, no footer status tag.
  const cornerState = isCancelled
    ? "cancelled"
    : isPostponed
      ? "postponed"
      : effectiveStatus === "completed" || effectiveStatus === "closed"
        ? effectiveStatus
        : null;
  const isOngoing =
    climb.status !== "completed" && !isCancelled && isClimbOngoing(climb);
  const level = getExperienceLevel(climb);
  const leads = getLeadOfficers(climb.officers);
  const hasAnnouncement = climb.announcements?.length > 0;
  const docsRequired = REQUIRED_DOC_TYPES.filter(
    (docType) => climb[docType.requiresField],
  ).map((docType) => docType.label);
  const docsRequiredShort = REQUIRED_DOC_TYPES.filter(
    (docType) => climb[docType.requiresField],
  ).map((docType) => docType.badgeLabel);
  const docsComplete = climb.docsCompleteCount ?? 0;

  return (
    <Link
      to={`/event/${climb.id}`}
      className={`card-link${climb.isWide ? " card-wide" : ""}`}
    >
      <div className={`card ${climb.color || "c-slate"}`}>
        {cornerState && (
          <span className={`card-corner card-corner-${cornerState}`}>
            {CORNER_LABEL[cornerState]}
          </span>
        )}
        <div>
          <div className="card-month">{(climb.month || "").toUpperCase()}</div>
          <div className="card-date">{climb.dateLabel || "—"}</div>
          <div className="card-name">{climb.title}</div>
          <div className="card-location">{climb.location || "\u00A0"}</div>

          <span className="card-level-badge">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: level.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {level.label}
          </span>

          {(climb.elevation ||
            climb.difficulty ||
            climb.trailClass ||
            climb.roundTripDistance) && (
            <div className="card-stats">
              {climb.elevation && (
                <span className="card-stat">
                  <Icon name="mountain" size={12} />
                  {climb.elevation}m
                </span>
              )}
              {climb.difficulty && (
                <span className="card-stat">
                  <Icon name="gauge" size={12} />
                  {climb.difficulty}
                </span>
              )}
              {climb.trailClass && (
                <span
                  className="card-stat"
                  title={TRAIL_CLASS_LABELS[climb.trailClass] || ""}
                >
                  <Icon name="activity" size={12} />
                  Class {climb.trailClass}
                </span>
              )}
              {climb.roundTripDistance && (
                <span className="card-stat">
                  <Icon name="route" size={12} />
                  {climb.roundTripDistance}
                </span>
              )}
            </div>
          )}

          {leads.length > 0 ? (
            leads.map((lead, i) => (
              <div className="card-lead" key={i}>
                <Icon name="users" size={12} />
                <span>
                  {lead.role || "Team Leader"}: <strong>{lead.name}</strong>
                </span>
              </div>
            ))
          ) : (
            <div className="card-lead">
              <Icon name="users" size={12} />
              <span>No Officers Yet</span>
            </div>
          )}

          {hasCap && (
            <div className="card-headcount">
              <Icon name="users" size={12} />
              <span>
                {registered}/{climb.maxParticipants} joined
              </span>
              {isFull && (
                <strong style={{ color: "#ff8a80" }}>&middot; Full</strong>
              )}
              {isLow && !isFull && (
                <strong style={{ color: "#ffd580" }}>
                  &middot; {seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left
                </strong>
              )}
            </div>
          )}

          <div
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}
          >
            {climb.itinerary?.length > 0 ? (
              <span className="card-itinerary-ready">
                &#10003; Itinerary Available
              </span>
            ) : (
              <span className="card-itinerary-tag">
                <Icon name="clock" size={11} />
                Itinerary Coming Soon
              </span>
            )}

            {isOngoing && (
              <span className="card-status-tag card-status-ongoing">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "currentColor",
                    display: "inline-block",
                  }}
                />
                Happening Now
              </span>
            )}

            {hasAnnouncement && (
              <span className="card-flag-tag card-flag-announcement">
                <Icon name="megaphone" size={11} />
                Announcement
              </span>
            )}

            {docsRequired.length > 0 && (
              <span
                className="card-flag-tag card-flag-docs"
                title={`Required: ${docsRequired.join(", ")}`}
              >
                <Icon name="fileCheck" size={11} />
                {registered > 0
                  ? `${docsComplete}/${registered} Submitted — ${docsRequiredShort.join(", ")}`
                  : `${docsRequiredShort.join(", ")} Required`}
              </span>
            )}
          </div>
        </div>

        <div className="card-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={`card-badge ${BADGE_CLASS[climb.type] || "badge-minor"}`}
            >
              {TYPE_LABEL[climb.type] || climb.type}
            </span>
            {/* Open/draft only — the corner tab owns every other state. */}
            {!cornerState && (
              <span
                className={`card-status-tag ${STATUS_CLASS[climb.status] || "card-status-open"}`}
              >
                {STATUS_LABEL[climb.status] || climb.status}
              </span>
            )}
          </div>
          <span className="card-arrow">&#8594;</span>
        </div>
      </div>
    </Link>
  );
}
