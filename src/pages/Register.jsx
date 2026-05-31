import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import WaiverText from "@/components/WaiverText";

const INITIAL_FORM = {
  fullName: "",
  mobile: "",
  dateOfBirth: "",
  address: "",
  ecName: "",
  ecMobile: "",
  ecRelationship: "",
  medicalConditions: "",
  experienceLevel: "beginner",
  memberType: "member",
};

export default function Register() {
  const { climbId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [climb, setClimb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [sigName, setSigName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successRegId, setSuccessRegId] = useState(null);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "climbs", climbId));
      if (!snap.exists() || snap.data().status !== "open") {
        navigate("/");
        return;
      }

      // Check not already registered
      const regQ = query(
        collection(db, "registrations"),
        where("climbId", "==", climbId),
        where("userId", "==", currentUser.uid),
      );
      const regSnap = await getDocs(regQ);
      if (!regSnap.empty && regSnap.docs[0].data().status !== "cancelled") {
        navigate(`/my-registrations`);
        return;
      }

      setClimb({ id: snap.id, ...snap.data() });
      setForm((p) => ({
        ...p,
        fullName: userProfile?.displayName || currentUser.displayName || "",
      }));
      setLoading(false);
    }
    load();
  }, [climbId, currentUser, userProfile, navigate]);

  function setField(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!waiverAgreed) {
      setError("You must agree to the waiver to continue.");
      return;
    }
    if (!sigName.trim()) {
      setError("Please enter your full name as your digital signature.");
      return;
    }
    if (sigName.trim().length < 3) {
      setError("Please enter your complete name as your signature.");
      return;
    }

    setSubmitting(true);
    try {
      const regData = {
        climbId,
        climbTitle: climb.title,
        climbDate: climb.dateLabel || "",
        climbLocation: climb.location || "",
        userId: currentUser.uid,
        email: currentUser.email,
        // Personal
        name: form.fullName,
        mobile: form.mobile,
        dateOfBirth: form.dateOfBirth,
        address: form.address,
        // Emergency contact
        emergencyContact: {
          name: form.ecName,
          mobile: form.ecMobile,
          relationship: form.ecRelationship,
        },
        // Health
        medicalConditions: form.medicalConditions,
        experienceLevel: form.experienceLevel,
        memberType: form.memberType,
        // Waiver
        waiverSigned: true,
        waiverSignedAt: serverTimestamp(),
        waiverSignedName: sigName.trim(),
        // Status
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "registrations"), regData);
      setSuccessRegId(ref.id);
    } catch (err) {
      console.error(err);
      setError("Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;
  if (!climb) return null;

  if (successRegId) {
    return (
      <div
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <Header />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>&#10003;</div>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontSize: "1.8rem",
              fontWeight: 900,
              textTransform: "uppercase",
              color: "var(--green-dark)",
              marginBottom: 8,
            }}
          >
            Registration Submitted!
          </h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 8 }}>
            Your registration for <strong>{climb.title}</strong> is{" "}
            <strong>pending confirmation</strong>.
          </p>
          <p
            style={{
              color: "var(--ink-soft)",
              marginBottom: 28,
              fontSize: "0.88rem",
            }}
          >
            A confirmation email has been sent to{" "}
            <strong>{currentUser.email}</strong>. A climb officer will confirm
            your spot soon.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <a href={`/waiver/${successRegId}`} className="btn btn-primary">
              Print Waiver
            </a>
            <a href="/my-registrations" className="btn btn-outline">
              View My Registrations
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="register-page">
      <Header />

      <nav className="back-nav">
        <button className="back-btn" onClick={() => navigate(-1)}>
          &#8592; Back
        </button>
      </nav>

      <div className="register-content">
        <div className="register-climb-banner">
          <div>
            <div className="register-climb-name">{climb.title}</div>
            <div className="register-climb-date">
              &#128197; {climb.dateLabel} &nbsp;|&nbsp; &#128205;{" "}
              {climb.location}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <div className="register-form-card">
            <div className="form-section-title">Personal Information</div>
            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Mobile Number</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  placeholder="+63 9XX XXX XXXX"
                  value={form.mobile}
                  onChange={(e) => setField("mobile", e.target.value)}
                />
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

          {/* Emergency Contact */}
          <div className="register-form-card">
            <div className="form-section-title">Emergency Contact</div>
            <div className="form-group">
              <label className="form-label required">Contact Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.ecName}
                onChange={(e) => setField("ecName", e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Contact Mobile</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  placeholder="+63 9XX XXX XXXX"
                  value={form.ecMobile}
                  onChange={(e) => setField("ecMobile", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Relationship</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Parent, Spouse"
                  value={form.ecRelationship}
                  onChange={(e) => setField("ecRelationship", e.target.value)}
                />
              </div>
            </div>
          </div>

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

          {/* Waiver */}
          <div className="register-form-card">
            <div className="form-section-title">
              Waiver &amp; Release of Liability
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginBottom: 12,
              }}
            >
              Please read the following waiver carefully before signing.
            </p>
            <div className="waiver-box">
              <WaiverText
                climbTitle={climb.title}
                climbDate={climb.dateLabel}
                climbLocation={climb.location}
              />
            </div>

            <label className="waiver-check">
              <input
                type="checkbox"
                required
                checked={waiverAgreed}
                onChange={(e) => setWaiverAgreed(e.target.checked)}
              />
              <span className="waiver-check-label">
                I have read, understood, and voluntarily agree to all terms of
                this Waiver and Release of Liability. I confirm that all
                information provided in this registration is accurate and
                complete.
              </span>
            </label>

            <div className="form-group">
              <label className="form-label required">
                Digital Signature — Type your full name
              </label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="Type your complete legal name"
                style={{ fontStyle: "italic", fontSize: "1rem" }}
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
              />
              <div className="form-hint">
                By typing your name above you are signing this waiver
                electronically. This is legally equivalent to a handwritten
                signature.
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block btn-lg"
            type="submit"
            disabled={submitting || !waiverAgreed}
          >
            {submitting ? (
              <>
                <span className="spinner spinner-sm" /> Submitting…
              </>
            ) : (
              "Submit Registration"
            )}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  );
}
