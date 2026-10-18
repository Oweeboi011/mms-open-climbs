import { useState } from "react";
import { serverTimestamp } from "@/services/firestore";
import { uploadRegistrationFile } from "@/services/storage";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { logFailedRequest } from "@/services/logFailedRequest";
import DocumentUploadModal from "@/components/DocumentUploadModal";

// Lets an admin submit or replace a required document on a participant's
// behalf — for a walk-in with no phone on them, or a physical copy handed
// over at the jump-off. Mirrors the member-facing DocumentPrompt in
// MyRegistrations.jsx (both render DocumentUploadModal): already-submitted
// docs show as a read-only checklist with an Update toggle, and file inputs
// are shown for missing docs (or any doc the admin chose to update). Unlike
// the member flow, saving doesn't require every field to be filled —
// whichever ones have a file chosen get uploaded, so an admin can submit one
// now and come back for the rest later. A document seen but not filed (shown
// on climb day, handed over on paper) can be marked received without a file,
// with a note — see isDocSubmitted in data/requiredDocTypes.
function OfflineReceipt({ docType, note, onChange }) {
  const marked = note !== undefined;
  return (
    <div className="offline-receipt">
      <label className="offline-receipt-toggle">
        <input
          type="checkbox"
          checked={marked}
          onChange={(e) => onChange(e.target.checked ? "" : null)}
        />{" "}
        Received without a file
      </label>
      {marked && (
        <input
          type="text"
          className="form-input"
          aria-label={`How the ${docType.label.toLowerCase()} was received`}
          placeholder="e.g. shown at the jump-off on climb day"
          value={note}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function AdminDocumentModal({
  reg,
  climb,
  currentUser,
  onClose,
  onSave,
}) {
  const missingDocs = REQUIRED_DOC_TYPES.filter(
    (docType) => climb?.[docType.requiresField] && !reg[docType.uploadField],
  );
  const submittedDocs = REQUIRED_DOC_TYPES.filter(
    (docType) => climb?.[docType.requiresField] && reg[docType.uploadField],
  );

  const [docFiles, setDocFiles] = useState({});
  // docType.key → note, for documents marked received without a file.
  const [offline, setOffline] = useState({});
  const [updatingKeys, setUpdatingKeys] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const uploadableDocs = [
    ...missingDocs,
    ...submittedDocs.filter((docType) => updatingKeys.has(docType.key)),
  ];

  function toggleUpdating(key) {
    setUpdatingKeys((p) => {
      const next = new Set(p);
      if (next.has(key)) {
        next.delete(key);
        setDocFiles((f) => {
          const { [key]: _removed, ...rest } = f;
          return rest;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const toUpload = uploadableDocs.filter((docType) => docFiles[docType.key]);
    const toMark = uploadableDocs.filter(
      (docType) => !docFiles[docType.key] && docType.key in offline,
    );
    if (toUpload.length === 0 && toMark.length === 0) {
      setError("Choose a file, or mark a document as received without one.");
      return;
    }
    if (toMark.some((docType) => !offline[docType.key].trim())) {
      setError("Add a note saying how each document was received.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const patch = {};
      for (const docType of toUpload) {
        patch[docType.uploadField] = await uploadRegistrationFile(
          docType.storagePrefixUpload,
          reg,
          docFiles[docType.key],
        );
      }
      for (const docType of toMark) {
        patch[docType.uploadField] = {
          receivedOffline: true,
          note: offline[docType.key].trim(),
          markedBy: currentUser?.displayName || currentUser?.email || "Admin",
          markedAt: serverTimestamp(),
        };
      }
      await onSave(reg, patch);
    } catch (err) {
      setError("Failed to upload one of your files. Please try again.");
      logFailedRequest({
        type: "upload",
        source: "AdminDocumentModal.jsx",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: reg.climbId,
        registrationId: reg.id,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <DocumentUploadModal
      title="Manage Required Documents"
      subtitle={
        <>
          For <strong>{reg.name}</strong> — use this to submit a document on
          their behalf, or replace one they already uploaded.
        </>
      }
      reg={reg}
      uploadableDocs={uploadableDocs}
      submittedDocs={submittedDocs}
      updatingKeys={updatingKeys}
      toggleUpdating={toggleUpdating}
      setDocFiles={setDocFiles}
      error={error}
      saving={saving}
      onClose={onClose}
      onSubmit={handleSubmit}
      getLabel={(docType) => docType.label}
      getHint={() => "Not yet submitted."}
      renderExtra={(docType) => (
        <OfflineReceipt
          docType={docType}
          note={offline[docType.key]}
          onChange={(note) =>
            setOffline((p) => {
              const { [docType.key]: _removed, ...rest } = p;
              return note === null ? rest : { ...rest, [docType.key]: note };
            })
          }
        />
      )}
      saveLabel="Save"
      savingLabel="Saving…"
    />
  );
}
