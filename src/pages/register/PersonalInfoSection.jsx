import { FieldError } from "@/pages/register/registerShared";

export default function PersonalInfoSection({
  bindField,
  fieldErrors,
  form,
  inputClass,
  setField,
}) {
  return (
    <>
      {/* Personal Information */}
      <div className="register-form-card">
        <div className="form-section-title">Personal Information</div>
        <div className="form-group">
          <label className="form-label required">Full Name</label>
          <input
            type="text"
            ref={bindField("fullName")}
            className={inputClass("fullName")}
            required
            aria-invalid={!!fieldErrors.fullName}
            value={form.fullName}
            onChange={(e) => setField("fullName", e.target.value)}
          />
          <FieldError message={fieldErrors.fullName} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">Mobile Number</label>
            <input
              type="tel"
              ref={bindField("mobile")}
              className={inputClass("mobile")}
              required
              aria-invalid={!!fieldErrors.mobile}
              placeholder="+63 9XX XXX XXXX"
              value={form.mobile}
              onChange={(e) => setField("mobile", e.target.value)}
            />
            <FieldError message={fieldErrors.mobile} />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input
              type="date"
              className="form-input"
              value={form.dateOfBirth}
              onChange={(e) => setField("dateOfBirth", e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input
            type="text"
            className="form-input"
            placeholder="City, Province"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label required">Experience Level</label>
          <select
            className="form-select"
            required
            value={form.experienceLevel}
            onChange={(e) => setField("experienceLevel", e.target.value)}
          >
            <option value="beginner">Beginner (0–5 climbs)</option>
            <option value="intermediate">Intermediate (5–20 climbs)</option>
            <option value="experienced">Experienced (20+ climbs)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">Participant Type</label>
          <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              <input
                type="radio"
                name="memberType"
                value="member"
                checked={form.memberType === "member"}
                onChange={() => setField("memberType", "member")}
              />
              MMS Member
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              <input
                type="radio"
                name="memberType"
                value="joiner"
                checked={form.memberType === "joiner"}
                onChange={() => setField("memberType", "joiner")}
              />
              Joiner
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
