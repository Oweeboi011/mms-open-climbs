import ReorderButtons, { moveItem } from "@/components/admin/ReorderButtons";

export default function ThingsToBringFields({ form, setForm }) {
  const items = form.thingsToBring;
  const setItems = (fn) => setForm((p) => ({ ...p, thingsToBring: fn(p.thingsToBring) }));

  return (
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
          Things to Bring
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setItems((arr) => [...arr, ""])}
        >
          + Add Item
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Item"
            value={item}
            onChange={(e) =>
              setItems((arr) => arr.map((v, idx) => (idx === i ? e.target.value : v)))
            }
          />
          <ReorderButtons
            index={i}
            count={items.length}
            onMove={(from, to) => setItems((arr) => moveItem(arr, from, to))}
            label="item"
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
