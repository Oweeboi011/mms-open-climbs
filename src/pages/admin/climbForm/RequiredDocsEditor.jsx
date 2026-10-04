import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

export default function RequiredDocsEditor({ docUploading, form, handleDocUpload, set }) {
  return (
    <>
      {/* ── Required Documents ── */}
      <div className="admin-card">
        <div className="admin-card-title">Required Documents</div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          Optionally require participants to download a template or
          sample, then upload their own copy when they register.
        </p>

        {REQUIRED_DOC_TYPES.map((docType, idx) => (
          <div key={docType.key}>
            <div
              className="form-group"
              style={idx > 0 ? { marginTop: 20 } : undefined}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form[docType.requiresField]}
                  onChange={(e) =>
                    set(docType.requiresField, e.target.checked)
                  }
                />
                {docType.checkboxLabel}
              </label>
            </div>
            {form[docType.requiresField] && (
              <div className="form-group">
                <label className="form-label">{docType.sampleLabel}</label>
                {form[docType.sampleUrlField] && (
                  <div style={{ marginBottom: 8 }}>
                    <a
                      href={form[docType.sampleUrlField]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      &#128196;{" "}
                      {form[docType.sampleFileNameField] ||
                        "View current template"}
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="form-input"
                  onChange={(e) =>
                    handleDocUpload(
                      e,
                      docType.sampleUrlField,
                      docType.sampleFileNameField,
                      docType.storagePrefixTemplate,
                    )
                  }
                  disabled={docUploading[docType.sampleUrlField]}
                />
                {docUploading[docType.sampleUrlField] && (
                  <div className="form-hint">Uploading template…</div>
                )}
                {form[docType.sampleUrlField] &&
                  !docUploading[docType.sampleUrlField] && (
                    <div
                      className="form-hint"
                      style={{ color: "var(--green-dark)" }}
                    >
                      Template uploaded. Joiners will see a download link
                      and a required upload field when they register.
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
