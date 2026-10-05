import { Link } from "react-router-dom";
import WaiverText from "@/components/WaiverText";
import { FieldError } from "@/pages/register/registerShared";
import "./register.css";

export default function WaiverSection({
  bindField,
  clearFieldError,
  climb,
  fieldErrors,
  inputClass,
  privacyConsent,
  setPrivacyConsent,
  setSigName,
  setWaiverAgreed,
  sigName,
  waiverAgreed,
}) {
  return (
    <>
      {/* Waiver */}
      <div className="register-form-card">
        <div className="form-section-title">Waiver &amp; Release of Liability</div>
        <p className="waiver-intro">Please read the following waiver carefully before signing.</p>
        <div className="waiver-box">
          <WaiverText climbTitle={climb.title} climbDate={climb.dateLabel} climbLocation={climb.location} />
        </div>

        <label className="waiver-check">
          <input
            type="checkbox"
            ref={bindField("waiverAgreed")}
            required
            aria-invalid={!!fieldErrors.waiverAgreed}
            checked={waiverAgreed}
            onChange={(e) => {
              setWaiverAgreed(e.target.checked);
              clearFieldError("waiverAgreed");
            }}
          />
          <span className="waiver-check-label">
            I have read, understood, and voluntarily agree to all terms of this Waiver and Release of Liability. I
            confirm that all information provided in this registration is accurate and complete.
          </span>
        </label>
        <FieldError message={fieldErrors.waiverAgreed} />

        <label className="waiver-check">
          <input
            type="checkbox"
            ref={bindField("privacyConsent")}
            required
            aria-invalid={!!fieldErrors.privacyConsent}
            checked={privacyConsent}
            onChange={(e) => {
              setPrivacyConsent(e.target.checked);
              clearFieldError("privacyConsent");
            }}
          />
          <span className="waiver-check-label">
            I consent to MMS collecting and processing my personal and health information for this climb, as described
            in the{" "}
            <Link to="/privacy" target="_blank" rel="noopener">
              Privacy Notice
            </Link>
            .
          </span>
        </label>
        <FieldError message={fieldErrors.privacyConsent} />

        <div className="form-group">
          <label className="form-label required">Digital Signature — Type your full name</label>
          <input
            type="text"
            ref={bindField("sigName")}
            className={`${inputClass("sigName")} waiver-signature-input`}
            required
            aria-invalid={!!fieldErrors.sigName}
            placeholder="Type your complete legal name"
            value={sigName}
            onChange={(e) => {
              setSigName(e.target.value);
              clearFieldError("sigName");
            }}
          />
          <div className="form-hint">
            By typing your name above you are signing this waiver electronically. This is legally equivalent to a
            handwritten signature.
          </div>
        </div>
      </div>
    </>
  );
}
