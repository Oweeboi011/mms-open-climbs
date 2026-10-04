import ReorderButtons from "@/components/admin/ReorderButtons";
import ThingsToBringFields from "@/components/admin/ThingsToBringFields";

export default function ItineraryEditor({
  addDay,
  addEntry,
  form,
  moveEntry,
  moveListItem,
  removeDay,
  removeEntry,
  setForm,
  updateDay,
  updateEntry,
}) {
  return (
    <>
      {/* ── Itinerary ── */}
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
            Itinerary
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={addDay}
          >
            + Add Day
          </button>
        </div>
        {form.itinerary.length === 0 && (
          <p className="tbd-note">
            No itinerary added yet. Click &ldquo;Add Day&rdquo; to start.
          </p>
        )}
        {form.itinerary.map((day, dayIdx) => (
          <div
            key={dayIdx}
            style={{
              marginBottom: 20,
              padding: 16,
              background: "var(--surface)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 10,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Day label, e.g. Day 1 — Saturday, July 4"
                value={day.day}
                onChange={(e) => updateDay(dayIdx, e.target.value)}
                style={{ flex: 1 }}
              />
              <ReorderButtons
                index={dayIdx}
                count={form.itinerary.length}
                onMove={(from, to) => moveListItem("itinerary", from, to)}
                label="day"
              />
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeDay(dayIdx)}
              >
                Remove Day
              </button>
            </div>
            {day.entries.map((entry, entryIdx) => (
              <div
                key={entryIdx}
                style={{ display: "flex", gap: 8, marginBottom: 6 }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Time e.g. 04:00"
                  value={entry.time}
                  onChange={(e) =>
                    updateEntry(dayIdx, entryIdx, "time", e.target.value)
                  }
                  style={{ width: 100, flexShrink: 0 }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Activity"
                  value={entry.activity}
                  onChange={(e) =>
                    updateEntry(
                      dayIdx,
                      entryIdx,
                      "activity",
                      e.target.value,
                    )
                  }
                  style={{ flex: 1 }}
                />
                <ReorderButtons
                  index={entryIdx}
                  count={day.entries.length}
                  onMove={(from, to) => moveEntry(dayIdx, from, to)}
                  label="entry"
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeEntry(dayIdx, entryIdx)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => addEntry(dayIdx)}
              style={{ marginTop: 4 }}
            >
              + Add Entry
            </button>
          </div>
        ))}
      </div>

      <ThingsToBringFields form={form} setForm={setForm} />
    </>
  );
}
