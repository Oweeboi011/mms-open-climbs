import { Link } from "react-router-dom";

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
  const seatsLeft = climb.maxParticipants - (climb.registrationCount ?? 0);
  const isFull = seatsLeft <= 0;
  const isLow = seatsLeft > 0 && seatsLeft <= 5;
  const isOngoing = climb.status !== "completed" && isClimbOngoing(climb);

  return (
    <Link
      to={`/event/${climb.id}`}
      className={`card-link${climb.isWide ? " card-wide" : ""}`}
    >
      <div className={`card ${climb.color || "c-slate"}`}>
        <div>
          <div className="card-month">{(climb.month || "").toUpperCase()}</div>
          <div className="card-date">{climb.dateLabel || "—"}</div>
          <div className="card-name">{climb.title}</div>
          <div className="card-location">{climb.location || "\u00A0"}</div>

          {(climb.elevation || climb.difficulty || climb.roundTripDistance) && (
            <div className="card-stats">
              {climb.elevation && (
                <span className="card-stat">📉{climb.elevation}m</span>
              )}
              {climb.difficulty && (
                <span className="card-stat">🏔️{climb.difficulty}</span>
              )}
              {climb.roundTripDistance && (
                <span className="card-stat">📍{climb.roundTripDistance}</span>
              )}
            </div>
          )}

          {climb.itinerary?.length > 0 ? (
            <span className="card-itinerary-ready">
              &#10003; Itinerary Available
            </span>
          ) : (
            <span className="card-itinerary-tag">
              &#8987; Itinerary Coming Soon
            </span>
          )}

          {isFull && (
            <span className="card-seats-tag" style={{ marginLeft: 4 }}>
              &#128683; Full
            </span>
          )}
          {isLow && !isFull && (
            <span className="card-seats-tag" style={{ marginLeft: 4 }}>
              &#9888; {seatsLeft} seat{seatsLeft !== 1 ? "s" : ""} left
            </span>
          )}
          {isOngoing && (
            <span
              className="card-status-tag card-status-ongoing"
              style={{ marginLeft: 4 }}
            >
              &#128992; Happening Now
            </span>
          )}
        </div>

        <div className="card-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={`card-badge ${BADGE_CLASS[climb.type] || "badge-minor"}`}
            >
              {TYPE_LABEL[climb.type] || climb.type}
            </span>
            <span
              className={`card-status-tag ${STATUS_CLASS[climb.status] || "card-status-open"}`}
            >
              {STATUS_LABEL[climb.status] || climb.status}
            </span>
          </div>
          <span className="card-arrow">&#8594;</span>
        </div>
      </div>
    </Link>
  );
}
