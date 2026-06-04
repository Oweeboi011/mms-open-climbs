import { Link } from "react-router-dom";

const BADGE_CLASS = {
  minor: "badge-minor",
  major: "badge-major",
  special: "badge-special",
};
const TYPE_LABEL = { minor: "Minor", major: "Major", special: "Special" };

export default function ClimbCard({ climb }) {
  const seatsLeft = climb.maxParticipants - (climb.registrationCount ?? 0);
  const isFull = seatsLeft <= 0;
  const isLow = seatsLeft > 0 && seatsLeft <= 5;

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
        </div>

        <div className="card-footer">
          <span
            className={`card-badge ${BADGE_CLASS[climb.type] || "badge-minor"}`}
          >
            {TYPE_LABEL[climb.type] || climb.type}
          </span>
          <span className="card-arrow">&#8594;</span>
        </div>
      </div>
    </Link>
  );
}
