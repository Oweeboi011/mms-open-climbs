import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { logFailedRequest } from "@/utils/logFailedRequest";
import { STATUS_OPTIONS } from "@/components/admin/registrantShared";

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "experienced"];
const PAYMENT_OPTIONS = ["unpaid", "submitted", "verified", "rejected"];

export default function AddJoinerModal({ climb, climbId, onClose, onAdded }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    ecName: "",
    ecMobile: "",
    ecRelationship: "",
    medicalConditions: "",
    memberType: "joiner",
    experienceLevel: "beginner",
    status: "confirmed",
    paymentStatus: "unpaid",
    amountPaid: "",
    adminNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("displayName"))).then(
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
  }, []);

  function setField(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function selectExistingUser(userId) {
    setSelectedUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (user) {
      setForm((p) => ({
        ...p,
        name: user.displayName || "",
        email: user.email || "",
      }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    // Officers rely on these on the trail, so they're required here just as
    // they are on the self-registration form. The member can correct them
    // later from My Climbs — an admin is only ever recording their best
    // information.
    const missing = [];
    if (!form.name.trim()) missing.push("Full Name");
    if (!form.mobile.trim()) missing.push("Mobile");
    if (!form.ecName.trim()) missing.push("Emergency Contact Name");
    if (!form.ecMobile.trim()) missing.push("Emergency Contact Mobile");
    if (!form.ecRelationship.trim()) missing.push("Relationship");
    if (!form.medicalConditions.trim()) {
      missing.push('Medical Conditions (write "None" if there are none)');
    }
    if (missing.length) {
      setError(`Please complete: ${missing.join(", ")}.`);
      return;
    }
    const parsedAmount = parseFloat(
      String(form.amountPaid).replace(/[^0-9.]/g, ""),
    );
    setSaving(true);
    try {
      await addDoc(collection(db, "registrations"), {
        climbId,
        climbTitle: climb?.title || "",
        climbDate: climb?.dateLabel || "",
        climbLocation: climb?.location || "",
        userId: selectedUserId || null,
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        emergencyContact: {
          name: form.ecName.trim(),
          mobile: form.ecMobile.trim(),
          relationship: form.ecRelationship.trim(),
        },
        medicalConditions: form.medicalConditions.trim(),
        experienceLevel: form.experienceLevel,
        memberType: form.memberType,
        waiverSigned: false,
        status: form.status,
        paymentStatus: form.paymentStatus,
        amountPaid:
          form.amountPaid && !isNaN(parsedAmount) ? parsedAmount : null,
        paymentProofs: [],
        payments:
          form.amountPaid && !isNaN(parsedAmount)
            ? [
                {
                  amount: parsedAmount,
                  proofs: [],
                  submittedAt: Timestamp.now(),
                  status:
                    form.paymentStatus === "unpaid"
                      ? "submitted"
                      : form.paymentStatus,
                  recordedBy: "admin",
                },
              ]
            : [],
        adminNotes:
          form.adminNotes.trim() ||
          "Added manually by admin — not self-registered.",
        addedByAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(form.status === "confirmed"
          ? { confirmedAt: serverTimestamp() }
          : {}),
      });
      onAdded();
    } catch (err) {
      setError("Failed to add participant. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "ClimbDetail.jsx:addParticipant",
        message: err?.message,
        path: window.location.pathname,
        userRole: "admin",
        climbId,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Add Participant
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 12,
          }}
        >
          Register someone into this climb yourself — an existing member who
          asked to be signed up, or a walk-in joiner who never used the app.
        </p>
        {/* A waiver binds the person who signs it, so an admin can't sign on
            their behalf. Linking to a member's account is what lets them
            finish it themselves from My Climbs. */}
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          {selectedUserId ? (
            <>
              They&rsquo;ll still need to <strong>sign the waiver</strong>{" "}
              themselves — it appears on their My Climbs page as soon as you
              add them.
            </>
          ) : (
            <>
              A manual entry has <strong>no waiver</strong> and no account to
              sign one from. Pick the member&rsquo;s account above if they
              have one, so they can sign it themselves.
            </>
          )}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Existing Member</label>
            <select
              className="form-select"
              value={selectedUserId}
              onChange={(e) => selectExistingUser(e.target.value)}
            >
              <option value="">— Manual entry —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName || u.email} ({u.email})
                </option>
              ))}
            </select>
            <div className="form-hint">
              Pick a registered member to link this registration to their
              account, or leave as manual entry for a non-member joiner.
            </div>
          </div>
          <div className="form-group">
            <label className="form-label required">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Mobile</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+63 9XX XXX XXXX"
                value={form.mobile}
                onChange={(e) => setField("mobile", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">
              Emergency Contact Name
            </label>
            <input
              type="text"
              className="form-input"
              value={form.ecName}
              onChange={(e) => setField("ecName", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">
                Emergency Contact Mobile
              </label>
              <input
                type="tel"
                className="form-input"
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
                placeholder="e.g. Parent, Spouse"
                value={form.ecRelationship}
                onChange={(e) => setField("ecRelationship", e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label required">
              Medical Conditions / Allergies
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder='e.g. asthma, peanut allergy — or "None"'
              value={form.medicalConditions}
              onChange={(e) => setField("medicalConditions", e.target.value)}
            />
            <div className="form-hint">
              Required so a blank never has to be read as either &ldquo;nothing
              to declare&rdquo; or &ldquo;nobody asked&rdquo;. Write{" "}
              <strong>None</strong> if there are none. The participant can
              correct this themselves from My Climbs.
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Participant Type</label>
              <select
                className="form-select"
                value={form.memberType}
                onChange={(e) => setField("memberType", e.target.value)}
              >
                <option value="member">MMS Member</option>
                <option value="joiner">Joiner</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Experience Level</label>
              <select
                className="form-select"
                value={form.experienceLevel}
                onChange={(e) => setField("experienceLevel", e.target.value)}
              >
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Registration Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select
                className="form-select"
                value={form.paymentStatus}
                onChange={(e) => setField("paymentStatus", e.target.value)}
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Amount Paid</label>
            <input
              type="number"
              min="0"
              step="any"
              className="form-input"
              placeholder="0.00"
              value={form.amountPaid}
              onChange={(e) => setField("amountPaid", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Admin Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="e.g. Walk-in joiner, paid cash on-site"
              value={form.adminNotes}
              onChange={(e) => setField("adminNotes", e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? "Adding…" : "Add to Climb"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
