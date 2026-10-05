import Icon from "@/components/Icon";
import LockedCard from "@/pages/event/LockedCard";

export default function ItinerarySection({ climb, currentUser, setShowSignInModal }) {
  return (
    <>
      {/* Itinerary */}
      <div className="section-card">
        <div className="section-header">
          <span className="icon">
            <Icon name="map" size={17} />
          </span>
          <h3>Itinerary</h3>
        </div>
        <div className="section-body">
          {!currentUser ? (
            <LockedCard
              label="Sign in to view the itinerary"
              onUnlock={() => setShowSignInModal(true)}
            />
          ) : climb.itinerary?.length > 0 ? (
            climb.itinerary.map((day, i) => (
              <div className="day-block" key={i}>
                <div className="day-label">{day.day}</div>
                {day.entries?.map((e, j) => (
                  <div className="time-entry" key={j}>
                    <span className="time-label">{e.time}</span>
                    <span className="time-activity">{e.activity}</span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p
              className="tbd-note"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon name="clock" size={14} />
              Detailed itinerary will be available soon.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
