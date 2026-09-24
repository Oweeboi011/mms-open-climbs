import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import Modal from "@/components/Modal";
import RegistrationPolicyInfo from "@/components/RegistrationPolicyInfo";
import { buildMemberCancelPatch } from "@/utils/registrationPolicy";
import { logFailedRequest } from "@/utils/logFailedRequest";

// My Climbs: a member withdraws from a climb. Frees their seat for the
// waitlist; the status-change trigger emails them and the officers.
export default function CancelRegistrationModal({ reg, climb, currentUser, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirmCancel() {
    setSaving(true);
    setError("");
    try {
      await updateDoc(
        doc(db, "registrations", reg.id),
        buildMemberCancelPatch(serverTimestamp()),
      );
      onClose();
    } catch (err) {
      setError("Couldn't cancel your registration. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "CancelRegistrationModal",
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
    <Modal onClose={onClose} labelledBy="cancel-reg-title" contentStyle={{ maxWidth: 460 }}>
      <h3 id="cancel-reg-title" className="modal-heading">
        Cancel your registration?
      </h3>
      <p className="form-hint">
        You&rsquo;ll give up your place on <strong>{reg.climbTitle}</strong>.
        This can&rsquo;t be undone from the app — to rejoin you&rsquo;d register
        again (and may land on the waitlist).
      </p>
      <RegistrationPolicyInfo climb={climb} />
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Keep my registration
        </button>
        <button className="btn btn-danger" disabled={saving} onClick={confirmCancel}>
          {saving ? "Cancelling…" : "Cancel registration"}
        </button>
      </div>
    </Modal>
  );
}
