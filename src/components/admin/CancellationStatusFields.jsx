export default function CancellationStatusFields({ form, setForm }) {
  // "Cancelled" lives on the climb's Status dropdown, so this control only
  // covers postponement — otherwise two dropdowns on the same form could
  // disagree about whether the climb is cancelled.
  const isCancelled = form.status === "cancelled";
  const effective = isCancelled ? "cancelled" : form.cancellationStatus;

  return (
    <>
      <div className="form-row">
        {!isCancelled && (
          <div className="form-group">
            <label className="form-label">Postponement</label>
            <select
              className="form-select"
              value={form.cancellationStatus === "postponed" ? "postponed" : ""}
              onChange={(e) => {
                const value = e.target.value;
                setForm((p) => ({
                  ...p,
                  cancellationStatus: value,
                  cancellationReason: value ? p.cancellationReason : "",
                }));
              }}
            >
              <option value="">Not postponed</option>
              <option value="postponed">Postponed</option>
            </select>
          </div>
        )}
        {effective && (
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
      {effective && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          Saving will email and notify every active registrant that this climb
          has been <strong>{effective}</strong>.
        </div>
      )}
    </>
  );
}
