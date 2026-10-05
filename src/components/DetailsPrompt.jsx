import { useState } from "react";
import { serverTimestamp } from "@/services/firestore";
import { updateRegistration } from "@/services/registrations";
import { logFailedRequest } from "@/services/logFailedRequest";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";

// An admin registering someone can only record their best guess at a mobile
// number, next of kin and medical history — so the participant confirms their
// own. Editable any time, not once-only like the waiver: numbers change.
export function detailsIncomplete(reg) {
  return (
    !reg.mobile?.trim() ||
    !reg.emergencyContact?.name?.trim() ||
    !reg.emergencyContact?.mobile?.trim() ||
    !reg.emergencyContact?.relationship?.trim() ||
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
      await updateRegistration(reg.id, {
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
    <Modal
      onClose={onClose}
      labelledBy="details-prompt-title"
      size="md"
    >
      <div>
        <h3
          id="details-prompt-title"
          style={{ margin: "0 0 4px", fontSize: "1.05rem" }}
        >
          Your Details
        </h3>
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
          <TextField
            label="Mobile Number"
            required
            value={form.mobile}
            onChange={(v) => set("mobile", v)}
            type="tel"
            placeholder="+63 9XX XXX XXXX"
          />
          <TextField
            label="Emergency Contact Name"
            required
            value={form.ecName}
            onChange={(v) => set("ecName", v)}
          />
          <div className="form-row">
            <TextField
              label="Contact Mobile"
              required
              value={form.ecMobile}
              onChange={(v) => set("ecMobile", v)}
              type="tel"
              placeholder="+63 9XX XXX XXXX"
            />
            <TextField
              label="Relationship"
              required
              value={form.ecRelationship}
              onChange={(v) => set("ecRelationship", v)}
              placeholder="e.g. Parent, Spouse"
            />
          </div>
          <TextField
            label="Medical Conditions / Allergies"
            required
            value={form.medicalConditions}
            onChange={(v) => set("medicalConditions", v)}
            rows={2}
            placeholder='e.g. asthma, peanut allergy — or "None"'
            hint={
              <>
                Confidential and used only in an emergency. Write <strong>None</strong> if you
                have none.
              </>
            }
          />

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
    </Modal>
  );
}
