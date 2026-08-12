export default function CancellationStatusFields({ form, setForm }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cancellation Status</label>
          <select
            className="form-select"
            value={form.cancellationStatus || ""}
            onChange={(e) => {
              const value = e.target.value;
              setForm((p) => ({
                ...p,
                cancellationStatus: value,
                cancellationReason: value ? p.cancellationReason : "",
              }));
            }}
          >
            <option value="">None</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {form.cancellationStatus && (
          <div className="form-group">
            <label className="form-label required">
              Reason (shown to participants)
            </label>
            <textarea
              className="form-input"
              rows={2}
              required
              value={form.cancellationReason || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, cancellationReason: e.target.value }))
              }
              placeholder="e.g. Typhoon signal raised over the jump-off area"
            />
          </div>
        )}
      </div>
      {form.cancellationStatus && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          Saving will email and notify every active registrant that this
          climb has been <strong>{form.cancellationStatus}</strong>.
        </div>
      )}
    </>
  );
}
