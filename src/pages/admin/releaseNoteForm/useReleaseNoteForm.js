import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverTimestamp } from "@/services/firestore";
import { createReleaseNote, getReleaseNote, updateReleaseNote } from "@/services/releaseNotes";
import { logFailedRequest } from "@/services/logFailedRequest";

const EMPTY_FORM = { title: "", body: "", status: "draft" };

// Load/save state for the release-note form. `id` is undefined when creating.
export default function useReleaseNoteForm(id, currentUser) {
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sourceCommit, setSourceCommit] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    getReleaseNote(id).then((found) => {
      if (found) {
        const { id: _id, ...data } = found;
        setForm({ ...EMPTY_FORM, ...data });
        setNote(found);
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  const setField = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  function applyDraft({ title, body, sourceCommit: sha }) {
    setForm((p) => ({ ...p, title: title || p.title, body: body || p.body }));
    setSourceCommit(sha || null);
  }

  function buildPayload() {
    const payload = { title: form.title, body: form.body, status: form.status, updatedAt: serverTimestamp() };
    if (form.status === "published" && note?.status !== "published") payload.publishedAt = serverTimestamp();
    if (!isEdit && sourceCommit) payload.sourceCommit = sourceCommit;
    return payload;
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) await updateReleaseNote(id, payload);
      else await createReleaseNote({ ...payload, createdAt: serverTimestamp(), createdBy: currentUser.uid });
      navigate("/admin/release-notes");
    } catch (err) {
      setError("Save failed: " + err.message);
      logFailedRequest({
        type: "firestore",
        source: "ReleaseNoteForm.jsx:save",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
      });
    } finally {
      setSaving(false);
    }
  }

  return { isEdit, form, note, loading, saving, error, sourceCommit, setField, applyDraft, save };
}
