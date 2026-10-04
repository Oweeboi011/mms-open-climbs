export default function ResourcesEditor({
  addListItem,
  form,
  removeListItem,
  updateListItem,
}) {
  return (
    <>
      {/* ── Climb Resources ── */}
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
            Climb Resources
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              addListItem("resources", { label: "", url: "" })
            }
          >
            + Add Resource
          </button>
        </div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          Links registered participants need to check — trackers,
          shared sheets, packing lists, etc. Only visible to registered
          participants and admins.
        </p>
        {(form.resources || []).map((res, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Label (e.g. Packing Tracker)"
              value={res.label}
              onChange={(e) =>
                updateListItem("resources", i, { ...res, label: e.target.value })
              }
              style={{ flex: "1 1 200px" }}
            />
            <input
              type="url"
              className="form-input"
              placeholder="https://docs.google.com/spreadsheets/…"
              value={res.url}
              onChange={(e) =>
                updateListItem("resources", i, { ...res, url: e.target.value })
              }
              style={{ flex: "2 1 260px" }}
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("resources", i)}
            >
              Remove
            </button>
          </div>
        ))}
        {(form.resources || []).length === 0 && (
          <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            No resources added yet.
          </p>
        )}
      </div>
    </>
  );
}
