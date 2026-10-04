export default function PreClimbMeetingsEditor({
  addListItem,
  form,
  removeListItem,
  updateListItem,
}) {
  return (
    <>
      {/* ── Pre-Climb Meetings ── */}
      <div className="admin-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div className="admin-card-title" style={{ marginBottom: 0 }}>
            Pre-Climb Meetings
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              addListItem("preClimbMeetings", {
                date: "",
                time: "",
                location: "",
                link: "",
                recordingLink: "",
                notes: "",
              })
            }
          >
            + Add Meeting
          </button>
        </div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          Optional briefings before the climb (gear check, orientation,
          final headcount) — add one entry per session. Only visible to
          registered participants and admins, never on the public climb
          page.
        </p>
        {(form.preClimbMeetings || []).map((meeting, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Meeting Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={meeting.date}
                  onChange={(e) =>
                    updateListItem("preClimbMeetings", i, {
                      ...meeting,
                      date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Meeting Time</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 6:00 PM"
                  value={meeting.time}
                  onChange={(e) =>
                    updateListItem("preClimbMeetings", i, {
                      ...meeting,
                      time: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Meeting Location</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. MMS Clubhouse, Quezon City"
                value={meeting.location}
                onChange={(e) =>
                  updateListItem("preClimbMeetings", i, {
                    ...meeting,
                    location: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">MS Teams / Zoom Link</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://teams.microsoft.com/… or https://zoom.us/j/…"
                value={meeting.link}
                onChange={(e) =>
                  updateListItem("preClimbMeetings", i, {
                    ...meeting,
                    link: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Meeting Recording Link</label>
              <input
                type="url"
                className="form-input"
                placeholder="YouTube (unlisted) or Google Drive link, once available"
                value={meeting.recordingLink}
                onChange={(e) =>
                  updateListItem("preClimbMeetings", i, {
                    ...meeting,
                    recordingLink: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Meeting Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What to bring or expect at the meeting"
                value={meeting.notes}
                onChange={(e) =>
                  updateListItem("preClimbMeetings", i, {
                    ...meeting,
                    notes: e.target.value,
                  })
                }
                style={{ resize: "vertical" }}
              />
            </div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("preClimbMeetings", i)}
            >
              Remove
            </button>
          </div>
        ))}
        {(form.preClimbMeetings || []).length === 0 && (
          <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            No pre-climb meetings scheduled yet.
          </p>
        )}
      </div>
    </>
  );
}
