import { FieldError } from "@/pages/register/registerShared";

export default function EmergencyContactSection({
  bindField,
  fieldErrors,
  form,
  inputClass,
  setField,
}) {
  return (
    <>
      {/* Emergency Contact */}
      <div className="register-form-card">
        <div className="form-section-title">Emergency Contact</div>
        <div className="form-group">
          <label className="form-label required">Contact Name</label>
          <input
            type="text"
            ref={bindField("ecName")}
            className={inputClass("ecName")}
            required
            aria-invalid={!!fieldErrors.ecName}
            value={form.ecName}
            onChange={(e) => setField("ecName", e.target.value)}
          />
          <FieldError message={fieldErrors.ecName} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">Contact Mobile</label>
            <input
              type="tel"
              ref={bindField("ecMobile")}
              className={inputClass("ecMobile")}
              required
              aria-invalid={!!fieldErrors.ecMobile}
              placeholder="+63 9XX XXX XXXX"
              value={form.ecMobile}
              onChange={(e) => setField("ecMobile", e.target.value)}
            />
            <FieldError message={fieldErrors.ecMobile} />
          </div>
          <div className="form-group">
            <label className="form-label required">Relationship</label>
            <input
              type="text"
              ref={bindField("ecRelationship")}
              className={inputClass("ecRelationship")}
              required
              aria-invalid={!!fieldErrors.ecRelationship}
              placeholder="e.g. Parent, Spouse"
              value={form.ecRelationship}
              onChange={(e) => setField("ecRelationship", e.target.value)}
            />
            <FieldError message={fieldErrors.ecRelationship} />
          </div>
        </div>
      </div>
    </>
  );
}
