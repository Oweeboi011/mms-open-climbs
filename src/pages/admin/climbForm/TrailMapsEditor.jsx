import EmbedCodeField from "@/components/admin/EmbedCodeField";

// Alternate trail options, each with Google Maps, AllTrails and Komoot links.
export default function TrailMapsEditor({ addListItem, form, removeListItem, updateListItem }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          marginBottom: 12,
        }}
      >
        <div
          className="admin-card-title"
          style={{ fontSize: "0.75rem", marginBottom: 0 }}
        >
          Map &amp; Trail Data
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() =>
            addListItem("trailMaps", {
              label: "",
              googleMapsUrl: "",
              allTrailsUrl: "",
              komootUrl: "",
            })
          }
        >
          + Add Trail
        </button>
      </div>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--ink-soft)",
          marginBottom: 12,
        }}
      >
        Add more than one trail if there's more than one route being
        considered — registrants will see a tab to switch between them
        on the event page.
      </p>
      {(form.trailMaps || []).length === 0 && (
        <div className="form-hint" style={{ marginBottom: 12 }}>
          No trail added yet. Click "+ Add Trail" to add a Google Maps
          link and/or AllTrails or Komoot embed code.
        </div>
      )}
      {(form.trailMaps || []).map((trail, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder={`Trail label (e.g. "Trail A — Ambangeg")`}
              value={trail.label}
              onChange={(e) =>
                updateListItem("trailMaps", i, {
                  ...trail,
                  label: e.target.value,
                })
              }
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("trailMaps", i)}
            >
              ✕
            </button>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Google Maps URL</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://www.google.com/maps/@15.717,119.935,14z"
              value={trail.googleMapsUrl}
              onChange={(e) =>
                updateListItem("trailMaps", i, {
                  ...trail,
                  googleMapsUrl: e.target.value,
                })
              }
            />
          </div>
          <EmbedCodeField
            site="alltrails"
            value={trail.allTrailsUrl}
            onChange={(value) =>
              updateListItem("trailMaps", i, { ...trail, allTrailsUrl: value })
            }
          />
          <EmbedCodeField
            site="komoot"
            value={trail.komootUrl}
            onChange={(value) =>
              updateListItem("trailMaps", i, { ...trail, komootUrl: value })
            }
          />
        </div>
      ))}
    </>
  );
}
