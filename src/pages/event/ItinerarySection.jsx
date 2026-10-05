import Icon from "@/components/Icon";
import SectionCard from "@/components/SectionCard";
import LockedCard from "@/pages/event/LockedCard";
import "./event.css";

function Days({ itinerary }) {
  return itinerary.map((day, i) => (
    <div className="day-block" key={i}>
      <div className="day-label">{day.day}</div>
      {day.entries?.map((e, j) => (
        <div className="time-entry" key={j}>
          <span className="time-label">{e.time}</span>
          <span className="time-activity">{e.activity}</span>
        </div>
      ))}
    </div>
  ));
}

export default function ItinerarySection({ climb, currentUser, setShowSignInModal }) {
  let body;
  if (!currentUser) {
    body = <LockedCard label="Sign in to view the itinerary" onUnlock={() => setShowSignInModal(true)} />;
  } else if (climb.itinerary?.length > 0) {
    body = <Days itinerary={climb.itinerary} />;
  } else {
    body = (
      <p className="tbd-note event-note-inline">
        <Icon name="clock" size={14} />
        Detailed itinerary will be available soon.
      </p>
    );
  }
  return (
    <SectionCard icon="map" title="Itinerary">
      {body}
    </SectionCard>
  );
}
