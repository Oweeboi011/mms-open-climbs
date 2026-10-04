import Icon from "@/components/Icon";

// Registrants + admins only (see climbPrivate).
export default function PreClimbMeetings({ privateInfo }) {
  return (
    <>
      {/* Pre-Climb Meetings — registrants + admins only (see climbPrivate) */}
      {privateInfo?.preClimbMeetings?.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="calendar" size={17} />
            </span>
            <h3>
              Pre-Climb Meeting
              {privateInfo.preClimbMeetings.length > 1 ? "s" : ""}
            </h3>
          </div>
          <div className="section-body">
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 14,
              }}
            >
              Briefings before the climb — gear check, orientation, final
              headcount. Join via the meeting link or catch up with the
              recording if you can't make it live.
            </p>
            {[...privateInfo.preClimbMeetings]
              .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
              .map((meeting, i) => (
                <div
                  key={i}
                  style={{
                    paddingTop: i > 0 ? 14 : 0,
                    marginTop: i > 0 ? 14 : 0,
                    borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.86rem",
                      lineHeight: 1.7,
                      color: "var(--ink)",
                    }}
                  >
                    <strong>
                      {meeting.date
                        ? new Date(
                            `${meeting.date}T00:00:00`,
                          ).toLocaleDateString("en-PH", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Date TBA"}
                    </strong>
                    {meeting.time && ` — ${meeting.time}`}
                    {meeting.location && (
                      <>
                        <br />
                        {meeting.location}
                      </>
                    )}
                  </div>
                  {meeting.notes && (
                    <div
                      style={{
                        fontSize: "0.82rem",
                        lineHeight: 1.6,
                        color: "var(--ink-soft)",
                        marginTop: 8,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {meeting.notes}
                    </div>
                  )}
                  {(meeting.link || meeting.recordingLink) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      {meeting.link && (
                        <a
                          href={meeting.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-accent btn-sm"
                        >
                          Join Meeting
                        </a>
                      )}
                      {meeting.recordingLink && (
                        <a
                          href={meeting.recordingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          Watch Recording
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
