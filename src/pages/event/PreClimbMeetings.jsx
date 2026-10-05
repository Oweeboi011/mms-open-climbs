import SectionCard from "@/components/SectionCard";
import "./event.css";

const formatDate = (date) =>
  date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBA";

function Meeting({ meeting }) {
  return (
    <div className="meeting">
      <div className="meeting-when">
        <strong>{formatDate(meeting.date)}</strong>
        {meeting.time && ` — ${meeting.time}`}
        {meeting.location && (
          <>
            <br />
            {meeting.location}
          </>
        )}
      </div>
      {meeting.notes && <div className="meeting-notes">{meeting.notes}</div>}
      {(meeting.link || meeting.recordingLink) && (
        <div className="meeting-links">
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm">
              Join Meeting
            </a>
          )}
          {meeting.recordingLink && (
            <a href={meeting.recordingLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              Watch Recording
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Registrants + admins only (see climbPrivate).
export default function PreClimbMeetings({ privateInfo }) {
  const meetings = privateInfo?.preClimbMeetings || [];
  if (meetings.length === 0) return null;
  return (
    <SectionCard icon="calendar" title={meetings.length > 1 ? "Pre-Climb Meetings" : "Pre-Climb Meeting"}>
      <p className="event-lead">
        Briefings before the climb — gear check, orientation, final headcount. Join via the meeting link or catch up
        with the recording if you can&apos;t make it live.
      </p>
      {[...meetings]
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .map((meeting, i) => (
          <Meeting key={i} meeting={meeting} />
        ))}
    </SectionCard>
  );
}
