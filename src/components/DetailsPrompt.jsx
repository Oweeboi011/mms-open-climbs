import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { logFailedRequest } from "@/utils/logFailedRequest";

// An admin registering someone can only record their best guess at a mobile
// number, next of kin and medical history — so the participant confirms their
// own. Editable any time, not once-only like the waiver: numbers change.
export function detailsIncomplete(reg) {
  return (
    !reg.mobile?.trim() ||
    !reg.emergencyContact?.name?.trim() ||
    !reg.emergencyContact?.mobile?.trim() ||
    !reg.medicalConditions?.trim()
  );
}

export default function DetailsPrompt({ reg, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    mobile: reg.mobile || "",
    ecName: reg.emergencyContact?.name || "",
    ecMobile: reg.emergencyContact?.mobile || "",
    ecRelationship: reg.emergencyContact?.relationship || "",
    medicalConditions: reg.medicalConditions || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const missing = [];
    if (!form.mobile.trim()) missing.push("your mobile number");
    if (!form.ecName.trim()) missing.push("your emergency contact's name");
    if (!form.ecMobile.trim()) missing.push("their mobile number");
    if (!form.ecRelationship.trim()) missing.push("your relationship to them");
    if (!form.medicalConditions.trim()) {
      missing.push('medical conditions (write "None" if you have none)');
    }
    if (missing.length) {
      setError(`Please provide ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      // Exactly the fields the firestore rule allows an owner to write.
      await updateDoc(doc(db, "registrations", reg.id), {
        mobile: form.mobile.trim(),
        emergencyContact: {
          name: form.ecName.trim(),
          mobile: form.ecMobile.trim(),
          relationship: form.ecRelationship.trim(),
        },
        medicalConditions: form.medicalConditions.trim(),
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } catch (err) {
      setError("Failed to save your details. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "MyRegistrations.jsx:DetailsPrompt",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        climbId: reg.climbId,
        registrationId: reg.id,
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
          maxWidth: 460,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>Your Details</h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.climbTitle}</strong> — climb officers rely on these
          on the trail, so please make sure they&rsquo;re right.
        </p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Mobile Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+63 9XX XXX XXXX"
              value={form.mobile}
              onChange={(e) => set("mobile", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">
              Emergency Contact Name
            </label>
            <input
              type="text"
              className="form-input"
              value={form.ecName}
              onChange={(e) => set("ecName", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Contact Mobile</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+63 9XX XXX XXXX"
                value={form.ecMobile}
                onChange={(e) => set("ecMobile", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Relationship</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Parent, Spouse"
                value={form.ecRelationship}
                onChange={(e) => set("ecRelationship", e.target.value)}
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
              onChange={(e) => set("medicalConditions", e.target.value)}
            />
            <div className="form-hint">
              Confidential and used only in an emergency. Write{" "}
              <strong>None</strong> if you have none.
            </div>
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
              {saving ? "Saving…" : "Save Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
