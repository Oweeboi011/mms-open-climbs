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
import { db, storage } from "@/firebase/config";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
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
  memberType: "joiner",
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
  const [paymentFiles, setPaymentFiles] = useState([]);
  const [paymentPreviews, setPaymentPreviews] = useState([]);
  const [paymentUploading, setPaymentUploading] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [optionalFeeSelections, setOptionalFeeSelections] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);

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
    if (paymentFiles.length === 0) {
      setError("Please upload your proof of payment before submitting.");
      return;
    }
    const parsedAmount = parseFloat(String(amountPaid).replace(/[^0-9.]/g, ""));
    if (!amountPaid || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter the exact amount you paid via GCash.");
      return;
    }

    setSubmitting(true);
    let paymentProofs = [];
    try {
      setPaymentUploading(true);
      const timestamp = Date.now();
      paymentProofs = await Promise.all(
        paymentFiles.map(async (file) => {
          const fileRef = storageRef(
            storage,
            `payment-proofs/${climbId}/${currentUser.uid}/${timestamp}_${file.name}`,
          );
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          return { url, fileName: file.name };
        }),
      );
      setPaymentUploading(false);
    } catch (uploadErr) {
      setPaymentUploading(false);
      setSubmitting(false);
      setError("Failed to upload proof of payment. Please try again.");
      return;
    }

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
        // Payment
        paymentProofs,
        paymentStatus: "submitted",
        amountPaid: parseFloat(String(amountPaid).replace(/[^0-9.]/g, "")),
        feeBreakdown: (climb.expenses || []).map((exp) => {
          const isGuestFee = /guest/i.test(exp.label);
          if (!exp.optional)
            return {
              label: exp.label,
              amount: exp.amount,
              optional: false,
              selected: true,
            };
          // Guest fee is required for joiners, not applicable for members
          if (isGuestFee)
            return {
              label: exp.label,
              amount: exp.amount,
              optional: true,
              selected: form.memberType === "joiner",
            };
          return {
            label: exp.label,
            amount: exp.amount,
            optional: true,
            selected: !!optionalFeeSelections[exp.label],
          };
        }),
        // Status
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "registrations"), regData);
      setSuccessRegId(docRef.id);
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

        {/* Trail Photos Strip */}
        {climb.trailImages?.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              padding: "12px 0 4px",
              scrollbarWidth: "thin",
              marginBottom: 8,
            }}
          >
            {climb.trailImages.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${climb.title} trail photo ${i + 1}`}
                style={{
                  height: 160,
                  width: "auto",
                  minWidth: 220,
                  objectFit: "cover",
                  borderRadius: 10,
                  flexShrink: 0,
                  border: "1px solid var(--border)",
                  display: "block",
                }}
              />
            ))}
          </div>
        )}

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

          {/* Fee Breakdown */}
          {climb.expenses?.length > 0 &&
            (() => {
              const isJoiner = form.memberType === "joiner";
              // Guest Fee is always treated by memberType, regardless of optional field in data
              const required = climb.expenses.filter((e) => {
                if (/guest/i.test(e.label)) return isJoiner;
                return !e.optional;
              });
              // Optional: optional fees excluding guest fee (guest fee is never a checkbox)
              const optional = climb.expenses.filter((e) => {
                if (/guest/i.test(e.label)) return false;
                return !!e.optional;
              });
              let expectedTotal = 0;
              let hasTba = false;
              [
                ...required,
                ...optional.filter((e) => optionalFeeSelections[e.label]),
              ].forEach((e) => {
                const n = parseFloat(String(e.amount).replace(/[^0-9.]/g, ""));
                if (!isNaN(n)) expectedTotal += n;
                else hasTba = true;
              });
              const totalDisplay = hasTba
                ? `₱${expectedTotal.toLocaleString("en-PH")} + TBA`
                : `₱${expectedTotal.toLocaleString("en-PH")}`;
              return (
                <div className="register-form-card">
                  <div className="form-section-title">Fee Breakdown</div>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-soft)",
                      marginBottom: 14,
                    }}
                  >
                    Review all fees below. Check any optional services you will
                    be availing.
                  </p>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.88rem",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ width: 28 }}></th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "6px 0",
                            fontWeight: 700,
                            color: "var(--ink-soft)",
                            fontSize: "0.68rem",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                          }}
                        >
                          Item
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "6px 0",
                            fontWeight: 700,
                            color: "var(--ink-soft)",
                            fontSize: "0.68rem",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                          }}
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {required.map((exp, i) => (
                        <tr
                          key={`req-${i}`}
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <td style={{ padding: "10px 0", paddingRight: 8 }}>
                            <span
                              style={{
                                color: "var(--green-dark)",
                                fontWeight: 800,
                                fontSize: "1rem",
                              }}
                            >
                              ✓
                            </span>
                          </td>
                          <td style={{ padding: "10px 0" }}>
                            <div style={{ fontWeight: 600 }}>{exp.label}</div>
                            {exp.note && (
                              <div
                                style={{
                                  fontSize: "0.74rem",
                                  color: "var(--ink-soft)",
                                  marginTop: 2,
                                }}
                              >
                                {exp.note}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--ink-soft)",
                                marginTop: 2,
                                fontStyle: "italic",
                              }}
                            >
                              Required
                            </div>
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              textAlign: "right",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {exp.amount || "TBA"}
                          </td>
                        </tr>
                      ))}
                      {optional.map((exp, i) => {
                        const checked = !!optionalFeeSelections[exp.label];
                        return (
                          <tr
                            key={`opt-${i}`}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              background: checked
                                ? "var(--surface-alt)"
                                : "transparent",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              setOptionalFeeSelections((p) => ({
                                ...p,
                                [exp.label]: !p[exp.label],
                              }))
                            }
                          >
                            <td style={{ padding: "10px 0", paddingRight: 8 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setOptionalFeeSelections((p) => ({
                                    ...p,
                                    [exp.label]: !p[exp.label],
                                  }))
                                }
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: 16,
                                  height: 16,
                                  cursor: "pointer",
                                }}
                              />
                            </td>
                            <td style={{ padding: "10px 0" }}>
                              <div style={{ fontWeight: 600 }}>{exp.label}</div>
                              {exp.note && (
                                <div
                                  style={{
                                    fontSize: "0.74rem",
                                    color: "var(--ink-soft)",
                                    marginTop: 2,
                                  }}
                                >
                                  {exp.note}
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--ink-soft)",
                                  marginTop: 2,
                                  fontStyle: "italic",
                                }}
                              >
                                Optional — check if availing
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "10px 0",
                                textAlign: "right",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                color: checked
                                  ? "var(--ink)"
                                  : "var(--ink-soft)",
                              }}
                            >
                              {exp.amount || "TBA"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)" }}>
                        <td></td>
                        <td
                          style={{
                            padding: "12px 0",
                            fontWeight: 800,
                            fontSize: "0.95rem",
                          }}
                        >
                          Expected Total
                          <div
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 400,
                              color: "var(--ink-soft)",
                            }}
                          >
                            Based on your selections above
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "12px 0",
                            textAlign: "right",
                            fontWeight: 900,
                            fontSize: "1.1rem",
                            color: "var(--green-dark)",
                          }}
                        >
                          {totalDisplay}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <p
                    style={{
                      fontSize: "0.74rem",
                      color: "var(--ink-soft)",
                      marginTop: 10,
                    }}
                  >
                    * Amounts are estimates. Final amounts will be confirmed by
                    the climb officers.
                  </p>
                </div>
              );
            })()}

          {/* GCash Payment */}
          <div className="register-form-card">
            <div className="form-section-title">Payment via GCash</div>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Send your registration fee via GCash, then upload your screenshot
              or photo of the receipt below.
            </p>

            {climb.gcashQrUrl || climb.gcashNumber || climb.gcashName ? (
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  flexWrap: "wrap",
                  marginBottom: 20,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <img
                    src={climb.gcashQrUrl || "/gcash-qr-placeholder.svg"}
                    alt="GCash QR Code"
                    style={{
                      width: 160,
                      height: 160,
                      objectFit: "contain",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "#fff",
                      display: "block",
                      cursor: "zoom-in",
                    }}
                    onClick={() => setQrModalOpen(true)}
                  />
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--ink-soft)",
                      marginTop: 4,
                    }}
                  >
                    {climb.gcashQrUrl
                      ? "Tap to enlarge & scan"
                      : "QR code coming soon"}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  {climb.gcashName && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 2,
                        }}
                      >
                        Account Name
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                        {climb.gcashName}
                      </div>
                    </div>
                  )}
                  {climb.gcashNumber && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 2,
                        }}
                      >
                        GCash Number
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "1.1rem",
                          letterSpacing: 1,
                        }}
                      >
                        {climb.gcashNumber}
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--ink-soft)",
                      marginTop: 4,
                    }}
                  >
                    Please use your full name as the payment reference/note.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 20,
                  flexWrap: "wrap",
                  marginBottom: 20,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <img
                    src="/gcash-qr-placeholder.svg"
                    alt="GCash QR Code Placeholder"
                    style={{
                      width: 160,
                      height: 160,
                      objectFit: "contain",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "#fff",
                      display: "block",
                      opacity: 0.75,
                      cursor: "zoom-in",
                    }}
                    onClick={() => setQrModalOpen(true)}
                  />
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--ink-soft)",
                      marginTop: 4,
                    }}
                  >
                    QR code coming soon
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--ink-soft)",
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    GCash payment details are being set up by the organizer.
                    Please contact the climb officers for the GCash number. You
                    may still complete and submit this registration form —
                    attach your proof of payment once available.
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label required">
                Amount Paid via GCash
              </label>
              <div style={{ position: "relative", maxWidth: 220 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--ink-soft)",
                    pointerEvents: "none",
                  }}
                >
                  ₱
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  className="form-input"
                  placeholder="0.00"
                  required
                  style={{ paddingLeft: 28, fontWeight: 700, fontSize: "1rem" }}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
              <div className="form-hint">
                Enter the exact amount you sent via GCash. This must match your
                receipt.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">
                Upload Proof of Payment
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="form-input"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length === 0) return;
                  setPaymentFiles(files);
                  Promise.all(
                    files.map(
                      (file) =>
                        new Promise((resolve) => {
                          if (file.type.startsWith("image/")) {
                            const reader = new FileReader();
                            reader.onload = (ev) =>
                              resolve({
                                name: file.name,
                                preview: ev.target.result,
                                isImage: true,
                              });
                            reader.readAsDataURL(file);
                          } else {
                            resolve({
                              name: file.name,
                              preview: null,
                              isImage: false,
                            });
                          }
                        }),
                    ),
                  ).then(setPaymentPreviews);
                }}
              />
              <div className="form-hint">
                You can select multiple files. Accepted formats: images (JPG,
                PNG) or PDF.
              </div>
              {paymentPreviews.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {paymentPreviews.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "var(--surface-alt)",
                      }}
                    >
                      {item.isImage ? (
                        <img
                          src={item.preview}
                          alt={item.name}
                          style={{
                            width: 110,
                            height: 110,
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 110,
                            height: 110,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: "2rem" }}>&#128196;</span>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--ink-soft)",
                              padding: "0 6px",
                              textAlign: "center",
                              wordBreak: "break-all",
                            }}
                          >
                            PDF
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--ink-soft)",
                          padding: "4px 6px",
                          maxWidth: 110,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {paymentFiles.length > 0 && (
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--green-dark)",
                    marginTop: 6,
                  }}
                >
                  &#10003; {paymentFiles.length} file
                  {paymentFiles.length > 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          </div>

          <button
            className="btn btn-primary btn-block btn-lg"
            type="submit"
            disabled={
              submitting ||
              !waiverAgreed ||
              paymentFiles.length === 0 ||
              !amountPaid
            }
          >
            {submitting ? (
              <>
                <span className="spinner spinner-sm" />{" "}
                {paymentUploading ? "Uploading payment…" : "Submitting…"}
              </>
            ) : (
              "Submit Registration"
            )}
          </button>
        </form>
      </div>

      <Footer />

      {/* GCash QR Modal */}
      {qrModalOpen && (
        <div
          onClick={() => setQrModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>
              GCash QR Code
            </div>
            {climb.gcashName && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--ink-soft)",
                  marginBottom: 12,
                }}
              >
                {climb.gcashName}
                {climb.gcashNumber ? ` · ${climb.gcashNumber}` : ""}
              </div>
            )}
            {climb?.gcashQrUrl ? (
              <img
                src={climb.gcashQrUrl}
                alt="GCash QR Code"
                style={{
                  width: "100%",
                  maxWidth: 280,
                  height: "auto",
                  objectFit: "contain",
                  borderRadius: 8,
                  display: "block",
                  margin: "0 auto 16px",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "24px 0 20px",
                  color: "var(--ink-soft)",
                  fontSize: "0.85rem",
                }}
              >
                QR code has not been uploaded yet.
                <br />
                Please contact the climb officers for the GCash number.
              </div>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setQrModalOpen(false)}
              style={{ width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
