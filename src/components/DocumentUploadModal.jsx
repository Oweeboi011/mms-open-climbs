// Shared modal chrome + form for submitting/replacing required documents.
// Used by both the member-facing flow (MyRegistrations.jsx's DocumentPrompt)
// and the admin-on-behalf-of-participant flow (AdminDocumentModal.jsx) — the
// two differ only in copy, validation strictness, and how the upload result
// gets saved, all of which stay in the caller.
export default function DocumentUploadModal({
  title,
  subtitle,
  reg,
  uploadableDocs,
  submittedDocs,
  updatingKeys,
  toggleUpdating,
  setDocFiles,
  error,
  saving,
  onClose,
  onSubmit,
  getLabel,
  labelRequired = false,
  getHint,
  renderSampleLink,
  saveLabel = "Save",
  savingLabel = "Saving…",
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>{title}</h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          {subtitle}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        {submittedDocs.filter((d) => !updatingKeys.has(d.key)).length > 0 && (
          <ul
            className="info-list"
            style={{
              margin: "0 0 16px",
              padding: 0,
              listStyle: "none",
              fontSize: "0.82rem",
            }}
          >
            {submittedDocs
              .filter((docType) => !updatingKeys.has(docType.key))
              .map((docType) => (
                <li
                  key={docType.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--green-dark)" }}>
                    &#10003;{" "}
                    <a
                      href={reg[docType.uploadField].url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {getLabel(docType)}
                    </a>{" "}
                    already submitted
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginLeft: "auto", padding: "1px 8px" }}
                    onClick={() => toggleUpdating(docType.key)}
                  >
                    Update
                  </button>
                </li>
              ))}
          </ul>
        )}

        <form onSubmit={onSubmit}>
          {uploadableDocs.map((docType) => (
            <div className="form-group" key={docType.key}>
              <label
                className={`form-label${labelRequired ? " required" : ""}`}
              >
                {getLabel(docType)}
              </label>
              {submittedDocs.some((d) => d.key === docType.key) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ float: "right", padding: "1px 8px" }}
                  onClick={() => toggleUpdating(docType.key)}
                >
                  Cancel Update
                </button>
              )}
              {renderSampleLink?.(docType)}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="form-input"
                onChange={(e) =>
                  setDocFiles((p) => ({
                    ...p,
                    [docType.key]: e.target.files[0] || null,
                  }))
                }
              />
              <div className="form-hint">{getHint(docType)}</div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? savingLabel : saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
