import { MEDICAL_CERT as MED_CERT } from "@/data/requiredDocTypes";

// The medical certificate upload shown inside the Submit Payment modal when
// the climb asks for one and the registration doesn't have it yet.
export default function MedCertField({ climb, file, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label required" htmlFor="pay-medcert">
        {MED_CERT.registerLabel}
      </label>
      {climb[MED_CERT.sampleUrlField] && (
        <div className="required-doc-row">
          <a
            href={climb[MED_CERT.sampleUrlField]}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
          >
            &#128196; {MED_CERT.downloadButtonLabel}
          </a>
        </div>
      )}
      <input
        id="pay-medcert"
        type="file"
        accept=".pdf,.doc,.docx,image/*"
        className="form-input"
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
      {file && <div className="form-hint">&#10003; {file.name}</div>}
      <div className="form-hint">
        Required to submit a payment. {MED_CERT.registerHint}
      </div>
    </div>
  );
}
