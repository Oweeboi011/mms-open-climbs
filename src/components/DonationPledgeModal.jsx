import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import Modal from "@/components/Modal";
import DonationPledgeFields from "@/components/DonationPledgeFields";
import { normalizePledge } from "@/utils/donations";
import { logFailedRequest } from "@/utils/logFailedRequest";

// My Climbs: add, change or withdraw a donation pledge after registering.
export default function DonationPledgeModal({ reg, drive, currentUser, onClose }) {
  const [value, setValue] = useState({
    cashPledge: reg.donation?.cashPledge ?? "",
    inKind: reg.donation?.inKind ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // Exactly the fields the firestore rule lets an owner write here.
      await updateDoc(doc(db, "registrations", reg.id), {
        donation: normalizePledge(value),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      setError("Couldn't save your pledge. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "DonationPledgeModal",
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
    <Modal onClose={onClose} labelledBy="pledge-title" contentStyle={{ maxWidth: 440 }}>
      <h3 id="pledge-title" className="modal-heading">
        Donation pledge
      </h3>
      <p className="form-hint">
        For <strong>{drive.beneficiary}</strong> on {reg.climbTitle}. Leave both
        blank to withdraw your pledge.
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={save}>
        <DonationPledgeFields drive={drive} value={value} onChange={setValue} />
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save pledge"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
