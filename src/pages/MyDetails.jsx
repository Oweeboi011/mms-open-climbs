import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import TextField from "@/components/TextField";
import { useAuth } from "@/contexts/AuthContext";
import { getMemberDetails, saveMemberDetails } from "@/services/memberDetails";
import { MEMBER_DETAIL_FIELDS, detailsToFormFields } from "@/utils/memberDetails";

const BLANK = Object.fromEntries(MEMBER_DETAIL_FIELDS.map((field) => [field, ""]));
const DEFAULTS = { ...BLANK, experienceLevel: "beginner", memberType: "joiner" };

function SelectField({ label, value, onChange, options }) {
  const id = useId();
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <select id={id} className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

// The member's saved details: filled in from their registrations and used to
// fill in the next one. Editing here changes future forms only; registrations
// already made keep what was submitted.
export default function MyDetails() {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: "", error: "" });

  useEffect(() => {
    getMemberDetails(currentUser.uid)
      .then((saved) => setForm({ ...DEFAULTS, ...detailsToFormFields(saved) }))
      .catch(() => setStatus((s) => ({ ...s, error: "Couldn't load your saved details. You can still enter them below." })))
      .finally(() => setLoading(false));
  }, [currentUser.uid]);

  const field = (name) => ({
    value: form[name],
    onChange: (value) => {
      setForm((p) => ({ ...p, [name]: value }));
      setStatus((s) => ({ ...s, message: "" }));
    },
  });

  async function handleSave(e) {
    e.preventDefault();
    setStatus({ saving: true, message: "", error: "" });
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await saveMemberDetails(currentUser.uid, trimmed);
      setStatus({ saving: false, message: "Saved. Your next registration will start with these details.", error: "" });
    } catch {
      setStatus({ saving: false, message: "", error: "Couldn't save your details. Check your connection and try again." });
    }
  }

  return (
    <div className="privacy-page">
      <Header />
      <main className="privacy-content">
        <h1>My Details</h1>
        <p className="mydetails-intro">
          We use these to fill in your climb registrations, so you don&rsquo;t have to type them
          every time. Changes here apply to future registrations; to correct a climb you&rsquo;ve
          already registered for, use <b>Update Details</b> on its card in{" "}
          <Link to="/my-registrations">My Climbs</Link>.
        </p>
        <p className="mydetails-account">
          {userProfile?.displayName || "Your name"} · {currentUser.email}
          <span className="form-hint"> Name and email come from your account.</span>
        </p>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <form onSubmit={handleSave} noValidate>
            <div className="register-form-card">
              <div className="form-section-title">Personal Information</div>
              <div className="form-row">
                <TextField label="Mobile Number" type="tel" placeholder="+63 9XX XXX XXXX" {...field("mobile")} />
                <TextField label="Date of Birth" type="date" {...field("dateOfBirth")} />
              </div>
              <TextField label="Address" placeholder="City, Province" {...field("address")} />
              <div className="form-row">
                <SelectField
                  label="Experience Level"
                  options={[
                    ["beginner", "Beginner (0–5 climbs)"],
                    ["intermediate", "Intermediate (5–20 climbs)"],
                    ["experienced", "Experienced (20+ climbs)"],
                  ]}
                  {...field("experienceLevel")}
                />
                <SelectField
                  label="Participant Type"
                  options={[
                    ["member", "MMS Member"],
                    ["joiner", "Joiner (guest)"],
                  ]}
                  {...field("memberType")}
                />
              </div>
            </div>

            <div className="register-form-card">
              <div className="form-section-title">Emergency Contact</div>
              <TextField label="Contact Name" {...field("ecName")} />
              <div className="form-row">
                <TextField label="Contact Mobile" type="tel" placeholder="+63 9XX XXX XXXX" {...field("ecMobile")} />
                <TextField label="Relationship" placeholder="e.g. Parent, Spouse" {...field("ecRelationship")} />
              </div>
            </div>

            <div className="register-form-card">
              <div className="form-section-title">Medical Information</div>
              <TextField
                label="Medical conditions, allergies or medications"
                rows={3}
                hint="Confidential: only climb officers and admins see this, for emergencies. Write 'None' if not applicable."
                {...field("medicalConditions")}
              />
            </div>

            {status.error && (
              <div className="alert alert-error" role="alert">
                {status.error}
              </div>
            )}
            {status.message && (
              <div className="alert alert-success" role="status">
                {status.message}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={status.saving}>
              {status.saving ? "Saving…" : "Save My Details"}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
