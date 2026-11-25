// The places organized transport picks people up from. Admins then assign each
// rider one in Edit Participant, and the climb page lists riders by point.
export default function PickupPointsEditor({ form, set }) {
  const points = form.pickupPoints || [];
  const change = (next) => set("pickupPoints", next);
  return (
    <div className="admin-card form-card">
      <div className="admin-card-title">Transportation Pickup Points</div>
      <p className="form-hint">
        Only needed when the climb sells transportation. Assign each rider a
        point from Edit Participant.
      </p>
      {points.map((point, i) => (
        <div className="pickup-row" key={i}>
          <input
            type="text"
            className="form-input"
            aria-label={`Pickup point ${i + 1}`}
            maxLength={60}
            value={point}
            onChange={(e) =>
              change(points.map((p, j) => (j === i ? e.target.value : p)))
            }
          />
          <button
            type="button"
            className="btn btn-danger btn-sm"
            aria-label={`Remove pickup point ${i + 1}`}
            onClick={() => change(points.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => change([...points, ""])}
      >
        + Add pickup point
      </button>
    </div>
  );
}
