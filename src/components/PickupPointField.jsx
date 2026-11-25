// Admin's choice of transportation pickup point for one rider; renders
// nothing when the climb has no pickup points.
export default function PickupPointField({ points = [], value, onChange }) {
  if (points.length === 0) return null;
  return (
    <div className="form-group">
      <label className="form-label" htmlFor="edit-pickup-point">
        Transportation pickup point
      </label>
      <select
        id="edit-pickup-point"
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Not set</option>
        {points.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
