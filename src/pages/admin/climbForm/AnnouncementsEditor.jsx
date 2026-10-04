export default function AnnouncementsEditor({ addListItem, form, removeListItem, updateListItem }) {
  return (
    <>
      {/* ── Announcements ── */}
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
            Announcements
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              addListItem("announcements", {
                message: "",
                pinned: false,
                createdAt: Date.now(),
              })
            }
          >
            + Add Announcement
          </button>
        </div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          Shown on the climb's public page, right under Mountain Profile —
          use this for updates and reminders all joiners need to see
          (schedule changes, weather advisories, what to prepare, etc.).
          Plain text works as typed. Optional formatting:{" "}
          <strong>**bold**</strong>, <em>*italic*</em>,{" "}
          <code>[link text](https://…)</code>, lines starting with{" "}
          <code>-</code> or <code>1.</code> for lists, <code>#</code> for a
          heading, <code>---</code> for a divider, and{" "}
          <code>| pipe | tables |</code>.
        </p>
        {(form.announcements || []).map((note, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <textarea
              className="form-input"
              rows={5}
              placeholder="Announcement text"
              value={note.message}
              onChange={(e) =>
                updateListItem("announcements", i, {
                  ...note,
                  message: e.target.value,
                })
              }
              style={{ flex: "1 1 260px", resize: "vertical" }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              title="Pin important reminders to the top, highlighted"
            >
              <input
                type="checkbox"
                checked={!!note.pinned}
                onChange={(e) =>
                  updateListItem("announcements", i, {
                    ...note,
                    pinned: e.target.checked,
                  })
                }
              />
              Pin as reminder
            </label>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("announcements", i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
