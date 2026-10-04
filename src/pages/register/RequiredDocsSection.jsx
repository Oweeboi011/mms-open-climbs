import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { FieldError } from "@/pages/register/registerShared";

export default function RequiredDocsSection({
  bindField,
  clearFieldError,
  climb,
  fieldErrors,
  inputClass,
  setDocFiles,
}) {
  return (
    <>
      {/* Required Documents */}
      {REQUIRED_DOC_TYPES.some((docType) => climb[docType.requiresField]) && (
        <div className="register-form-card">
          <div className="form-section-title">Required Documents</div>
          <p className="form-hint" style={{ marginBottom: 16 }}>
            You can upload these now, or later from{" "}
            <strong>My Climbs</strong> — we&rsquo;ll remind you in the
            notification bell until they&rsquo;re in.
          </p>

          {REQUIRED_DOC_TYPES.filter(
            (docType) => climb[docType.requiresField],
          ).map((docType) => (
            <div className="form-group" key={docType.key}>
              <label className="form-label">{docType.registerLabel}</label>
              {climb[docType.sampleUrlField] && (
                <div style={{ marginBottom: 8 }}>
                  <a
                    href={climb[docType.sampleUrlField]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    &#128196; {docType.downloadButtonLabel}
                  </a>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                ref={bindField(docType.key)}
                className={inputClass(docType.key)}
                aria-invalid={!!fieldErrors[docType.key]}
                onChange={(e) => {
                  setDocFiles((p) => ({
                    ...p,
                    [docType.key]: e.target.files[0] || null,
                  }));
                  clearFieldError(docType.key);
                }}
              />
              <FieldError message={fieldErrors[docType.key]} />
              <div className="form-hint">{docType.registerHint}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
