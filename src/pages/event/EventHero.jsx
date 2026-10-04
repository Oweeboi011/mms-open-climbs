import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import { authLinkWithRedirect } from "@/utils/authRedirect";
import { getSlotSummary, stillTakingPlaces } from "@/utils/slotSummary";

const TYPE_LABEL = {
  minor: "Minor Climb",
  major: "Major Climb",
  special: "Special Climb",
};

// Title, key facts, slot bar and the register / sign-in calls to action.
export default function EventHero({
  climb,
  climbId,
  currentUser,
  isCancelled,
  isPostponed,
  registerCta,
}) {
  const { seatsLeft, isFull, fillPct, fillClass } = getSlotSummary(climb);
  return (
    <>
      <section className="event-hero">
        <div className="event-hero-inner">
          <div className="event-badge">
            {TYPE_LABEL[climb.type] || climb.type}
          </div>
          {(isCancelled || isPostponed) && (
            <div
              className={`alert ${isCancelled ? "alert-error" : "alert-warning"}`}
              style={{ marginBottom: 16, display: "inline-flex" }}
            >
              {isCancelled ? "Cancelled" : "Postponed"}
              {climb.cancellationReason ? ` — ${climb.cancellationReason}` : ""}
            </div>
          )}
          <h2>
            <em>{climb.dateLabel}</em>
            {climb.title}
          </h2>
          <div className="event-meta">
            <div className="event-meta-item">
              <Icon name="calendar" size={16} />
              <span>
                <strong>{climb.dateLabel}</strong>
              </span>
            </div>
            <div className="event-meta-item">
              <Icon name="pin" size={16} />
              <span>{climb.location}</span>
            </div>
            {climb.elevation && (
              <div className="event-meta-item">
                <Icon name="mountain" size={16} />
                <span>
                  <strong>{climb.elevation} MASL</strong>
                  {climb.difficulty
                    ? ` \u2022 Difficulty ${climb.difficulty}`
                    : ""}
                </span>
              </div>
            )}
            {climb.maxParticipants && (
              <div className="event-meta-item">
                <Icon name="users" size={16} />
                <span>
                  <strong>{climb.registrationCount ?? 0}</strong> /{" "}
                  {climb.maxParticipants} slots
                </span>
              </div>
            )}
          </div>

          {climb.maxParticipants && stillTakingPlaces(climb) && (
            <div className="seats-bar" style={{ maxWidth: 280, marginTop: 16 }}>
              <div className="seats-bar-label">
                {isFull
                  ? "All slots filled"
                  : `${seatsLeft} slot${seatsLeft !== 1 ? "s" : ""} remaining`}
              </div>
              <div className="seats-bar-track">
                <div
                  className={`seats-bar-fill ${fillClass}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          )}

          {registerCta}

          {!currentUser && (
            <div className="visitor-event-prompt">
              <div className="visitor-event-prompt-icon">
                <Icon name="lock" size={22} />
              </div>
              <div className="visitor-event-prompt-text">
                <strong>Sign in to access full event details</strong> — the
                trail map, itinerary, climb officers, and participant list
                are visible to registered members. Fees and what to bring
                are shown below.
              </div>
              {/* Returns to this event page after auth (same as the LockedCard
                  sign-in modal further down) — this prompt is about seeing the
                  page, not registering. The primary CTA above keeps
                  /register/:id. */}
              <div className="visitor-event-prompt-actions">
                <Link
                  to={authLinkWithRedirect("/signup", `/event/${climbId}`)}
                  className="btn btn-gold"
                >
                  Create Account
                </Link>
                <Link
                  to={authLinkWithRedirect("/login", `/event/${climbId}`)}
                  className="btn btn-outline"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
