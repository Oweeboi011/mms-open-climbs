import { useState } from "react";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { storage } from "@/firebase/config";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { logFailedRequest } from "@/utils/logFailedRequest";

// Lets an admin submit or replace a required document on a participant's
// behalf — for a walk-in with no phone on them, or a physical copy handed
// over at the jump-off. Mirrors the member-facing DocumentPrompt in
// MyRegistrations.jsx: already-submitted docs show as a read-only checklist
// with an Update toggle, and file inputs are shown for missing docs (or any
// doc the admin chose to update). Unlike the member flow, saving doesn't
// require every field to be filled — whichever ones have a file chosen get
// uploaded, so an admin can submit one now and come back for the rest later.
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
      const timestamp = Date.now();
      for (const docType of toUpload) {
        const file = docFiles[docType.key];
        const fileRef = storageRef(
          storage,
          `${docType.storagePrefixUpload}/${reg.climbId}/${reg.userId}/${timestamp}_${file.name}`,
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
          maxWidth: 420,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Manage Required Documents
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.name}</strong> — use this to submit a document on
          their behalf, or replace one they already uploaded.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {submittedDocs.filter((d) => !updatingKeys.has(d.key)).length > 0 && (
          <ul
            className="info-list"
            style={{
              margin: "0 0 16px",
              padding: 0,
              listStyle: "none",
              fontSize: "0.82rem",
            }}
          >
            {submittedDocs
              .filter((docType) => !updatingKeys.has(docType.key))
              .map((docType) => (
                <li
                  key={docType.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--green-dark)" }}>
                    &#10003;{" "}
                    <a
                      href={reg[docType.uploadField].url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {docType.label}
                    </a>{" "}
                    already submitted
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginLeft: "auto", padding: "1px 8px" }}
                    onClick={() => toggleUpdating(docType.key)}
                  >
                    Update
                  </button>
                </li>
              ))}
          </ul>
        )}

        <form onSubmit={handleSubmit}>
          {uploadableDocs.map((docType) => (
            <div className="form-group" key={docType.key}>
              <label className="form-label">{docType.label}</label>
              {submittedDocs.some((d) => d.key === docType.key) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ float: "right", padding: "1px 8px" }}
                  onClick={() => toggleUpdating(docType.key)}
                >
                  Cancel Update
                </button>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="form-input"
                onChange={(e) =>
                  setDocFiles((p) => ({
                    ...p,
                    [docType.key]: e.target.files[0] || null,
                  }))
                }
              />
              <div className="form-hint">Not yet submitted.</div>
            </div>
          ))}

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
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
