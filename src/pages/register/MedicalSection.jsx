export default function MedicalSection({ form, setField }) {
  return (
    <>
      {/* Medical */}
      <div className="register-form-card">
        <div className="form-section-title">Medical Information</div>
        <div className="form-group">
          <label className="form-label">
            Medical Conditions / Allergies
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="List any medical conditions, allergies, or medications relevant to outdoor activities. Write 'None' if not applicable."
            value={form.medicalConditions}
            onChange={(e) => setField("medicalConditions", e.target.value)}
          />
          <div className="form-hint">
            This information is confidential and used only for emergency
            purposes.
          </div>
        </div>
      </div>
    </>
  );
}
