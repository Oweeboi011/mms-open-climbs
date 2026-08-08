import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { logFailedRequest } from "@/utils/logFailedRequest";
import WaiverText from "@/components/WaiverText";

// Signing after the fact. Self-registration signs the waiver as part of the
// form, but an admin adding someone to a climb can't sign on their behalf —
// so those registrations arrive unsigned and this is the only way to
// complete them. Mirrors the waiver card in Register.jsx: the same text, the
// same explicit agreement, the same typed signature.
export default function SignWaiverPrompt({
  reg,
  climb,
  currentUser,
  onClose,
  onSaved,
}) {
  const [agreed, setAgreed] = useState(false);
  const [sigName, setSigName] = useState(reg.name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("You must agree to the waiver before signing.");
      return;
    }
    if (sigName.trim().length < 3) {
      setError("Type your complete name — at least 3 characters.");
      return;
    }
    setSaving(true);
    try {
      // These four fields are exactly what the firestore rule allows an owner
      // to write, and only while the waiver is still unsigned.
      await updateDoc(doc(db, "registrations", reg.id), {
        waiverSigned: true,
        waiverSignedName: sigName.trim(),
        waiverSignedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } catch (err) {
      setError("Failed to record your signature. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "MyRegistrations.jsx:SignWaiverPrompt",
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
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Sign Waiver &amp; Release of Liability
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.climbTitle}</strong> — please read it carefully
          before signing. You can only sign once.
        </p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="waiver-box">
            <WaiverText
              climbTitle={reg.climbTitle || climb?.title}
              climbDate={reg.climbDate || climb?.dateLabel}
              climbLocation={reg.climbLocation || climb?.location}
            />
          </div>

          <label className="waiver-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
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
              {saving ? "Signing…" : "Sign Waiver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
