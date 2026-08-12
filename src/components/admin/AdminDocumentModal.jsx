import { useState } from "react";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { storage } from "@/firebase/config";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { logFailedRequest } from "@/utils/logFailedRequest";
import { makeUploadTimestamp } from "@/utils/uploadTimestamp";
import DocumentUploadModal from "@/components/DocumentUploadModal";

// Lets an admin submit or replace a required document on a participant's
// behalf — for a walk-in with no phone on them, or a physical copy handed
// over at the jump-off. Mirrors the member-facing DocumentPrompt in
// MyRegistrations.jsx (both render DocumentUploadModal): already-submitted
// docs show as a read-only checklist with an Update toggle, and file inputs
// are shown for missing docs (or any doc the admin chose to update). Unlike
// the member flow, saving doesn't require every field to be filled —
// whichever ones have a file chosen get uploaded, so an admin can submit one
// now and come back for the rest later.
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
    if (toUpload.length === 0) {
      setError("Choose at least one file to upload.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const patch = {};
      for (const docType of toUpload) {
        const file = docFiles[docType.key];
        const fileRef = storageRef(
          storage,
          `${docType.storagePrefixUpload}/${reg.climbId}/${reg.userId}/${makeUploadTimestamp()}_${file.name}`,
        );
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        patch[docType.uploadField] = { url, fileName: file.name };
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
      saveLabel="Save"
      savingLabel="Saving…"
    />
  );
}
