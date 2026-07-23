import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logFailedRequest } from "@/utils/logFailedRequest";

const sendReleaseNoteEmailFn = httpsCallable(functions, "sendReleaseNoteEmail");
const getReleaseNoteCommitOptionsFn = httpsCallable(
  functions,
  "getReleaseNoteCommitOptions",
);
const generateReleaseNoteDraftFn = httpsCallable(
  functions,
  "generateReleaseNoteDraft",
);

const EMPTY_FORM = {
  title: "",
  body: "",
  status: "draft",
};

export default function AdminReleaseNoteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendOk, setSendOk] = useState("");

  const [sourceCommit, setSourceCommit] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [commitOptions, setCommitOptions] = useState(null);
  const [selectedSha, setSelectedSha] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "releaseNotes", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setForm({ ...EMPTY_FORM, ...data });
        setNote({ id: snap.id, ...data });
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function openPicker() {
    setShowPicker(true);
    setPickerError("");
    setGenerateError("");
    if (commitOptions) return;
    setPickerLoading(true);
    try {
      const result = await getReleaseNoteCommitOptionsFn();
      const commits = result.data?.commits || [];
      setCommitOptions({ since: result.data?.since || null, commits });
      if (commits.length > 0) setSelectedSha(commits[0].sha);
    } catch (err) {
      setPickerError(err?.message || "Failed to load commits.");
    } finally {
      setPickerLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedSha) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const result = await generateReleaseNoteDraftFn({ until: selectedSha });
      const { title, body, sourceCommit: sc, commitCount } = result.data || {};
      if (!commitCount) {
        setGenerateError("No user-facing commits found in that range.");
        return;
      }
      setForm((p) => ({ ...p, title: title || p.title, body: body || p.body }));
      setSourceCommit(sc || null);
      setShowPicker(false);
    } catch (err) {
      setGenerateError(err?.message || "Failed to generate draft.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const wasPublished = note?.status === "published";
      const payload = {
        title: form.title,
        body: form.body,
        status: form.status,
        updatedAt: serverTimestamp(),
      };
      if (form.status === "published" && !wasPublished) {
        payload.publishedAt = serverTimestamp();
      }
      if (!isEdit && sourceCommit) {
        payload.sourceCommit = sourceCommit;
      }
      if (isEdit) {
        await updateDoc(doc(db, "releaseNotes", id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser.uid;
        await addDoc(collection(db, "releaseNotes"), payload);
      }
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

  async function handleSendEmail() {
    if (
      !window.confirm(
        "Send an email about this release note to every registered member? This cannot be undone.",
      )
    )
      return;
    setSending(true);
    setSendError("");
    setSendOk("");
    try {
      const result = await sendReleaseNoteEmailFn({ releaseNoteId: id });
      setSendOk(
        `Email sent to ${result.data?.sent ?? 0} of ${result.data?.total ?? 0} members.`,
      );
    } catch (err) {
      setSendError(err?.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/release-notes">Release Notes</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{isEdit ? "Edit" : "New Release Note"}</span>
        </div>
        <div className="admin-page-header">
          <div className="admin-page-title">
            {isEdit ? "Edit Release Note" : "New Release Note"}
          </div>
          <Link to="/admin/release-notes" className="btn btn-outline btn-sm">
            &larr; Back to Release Notes
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!isEdit && (
          <div className="admin-card">
            <div className="admin-card-title">Generate from Git History</div>
            {!showPicker ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={openPicker}
              >
                Generate from Git History
              </button>
            ) : (
              <>
                {pickerLoading ? (
                  <LoadingSpinner />
                ) : pickerError ? (
                  <div className="alert alert-error">{pickerError}</div>
                ) : (
                  <>
                    <p className="form-hint" style={{ marginTop: 0 }}>
                      {commitOptions?.since
                        ? `Showing commits after the last release note's checkpoint (${commitOptions.since.slice(0, 7)}). Pick how far up to include:`
                        : "No prior release note checkpoint found — showing recent commits. Pick how far up to include:"}
                    </p>
                    <div
                      style={{
                        maxHeight: 260,
                        overflowY: "auto",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      {(commitOptions?.commits || []).map((c) => (
                        <label
                          key={c.sha}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            padding: "8px 12px",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="commitUntil"
                            value={c.sha}
                            checked={selectedSha === c.sha}
                            onChange={() => setSelectedSha(c.sha)}
                          />
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "var(--ink-soft)",
                            }}
                          >
                            {c.shortSha}
                          </span>
                          <span style={{ flex: 1 }}>{c.subject}</span>
                        </label>
                      ))}
                      {(commitOptions?.commits || []).length === 0 && (
                        <div style={{ padding: 12, color: "var(--ink-soft)" }}>
                          No commits found.
                        </div>
                      )}
                    </div>
                    {generateError && (
                      <div className="alert alert-error">{generateError}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        disabled={!selectedSha || generating}
                        onClick={handleGenerate}
                      >
                        {generating ? "Generating…" : "Generate Draft"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowPicker(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            {sourceCommit && !showPicker && (
              <p className="form-hint">
                Draft generated up to commit{" "}
                <span style={{ fontFamily: "monospace" }}>
                  {sourceCommit.slice(0, 7)}
                </span>
                . Review the title/body below before saving.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="admin-card">
            <div className="admin-card-title">Content</div>
            <div className="form-group">
              <label className="form-label required">Title</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Body</label>
              <textarea
                className="form-input"
                rows={8}
                required
                placeholder="What's new, in plain language. Separate paragraphs with a blank line."
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Status</label>
              <select
                className="form-select"
                required
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <div className="form-hint">
                Only published notes appear in the member "what's new" popup,
                the history page, and can be emailed out.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner spinner-sm" /> Saving…
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Release Note"
              )}
            </button>
            <button
              className="btn btn-outline btn-lg"
              type="button"
              onClick={() => navigate("/admin/release-notes")}
            >
              Cancel
            </button>
          </div>
        </form>

        {isEdit && (
          <div className="admin-card" style={{ marginTop: 24 }}>
            <div className="admin-card-title">Send Email to Members</div>
            {sendError && <div className="alert alert-error">{sendError}</div>}
            {sendOk && <div className="alert alert-success">{sendOk}</div>}
            {note?.emailSentAt && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginBottom: 12 }}>
                Last sent to {note.emailSentCount ?? 0} member(s) on{" "}
                {note.emailSentAt?.toDate?.().toLocaleString("en-PH") || "—"}.
              </p>
            )}
            <button
              type="button"
              className="btn btn-gold"
              disabled={form.status !== "published" || sending}
              title={
                form.status !== "published"
                  ? "Publish this release note before emailing it"
                  : "Email all registered members about this release note"
              }
              onClick={handleSendEmail}
            >
              {sending
                ? "Sending…"
                : note?.emailSentAt
                  ? "Re-send to All Members"
                  : "Send Email to All Members"}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
