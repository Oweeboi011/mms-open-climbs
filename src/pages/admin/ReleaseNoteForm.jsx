import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import TextField from "@/components/TextField";
import useReleaseNoteForm from "./releaseNoteForm/useReleaseNoteForm";
import CommitPicker from "./releaseNoteForm/CommitPicker";
import EmailMembersCard from "./releaseNoteForm/EmailMembersCard";
import "./releaseNoteForm/releaseNotes.css";

export default function AdminReleaseNoteForm() {
  const { id } = useParams();
  const { currentUser, userProfile } = useAuth();
  const { isEdit, form, note, loading, saving, error, sourceCommit, setField, applyDraft, save } = useReleaseNoteForm(
    id,
    currentUser,
  );

  if (loading) return <LoadingSpinner fullPage />;

  const heading = isEdit ? "Edit Release Note" : "New Release Note";

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
          <div className="admin-page-title">{heading}</div>
          <Link to="/admin/release-notes" className="btn btn-outline btn-sm">
            &larr; Back to Release Notes
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!isEdit && <CommitPicker sourceCommit={sourceCommit} onDraft={applyDraft} />}

        <form onSubmit={save}>
          <div className="admin-card">
            <div className="admin-card-title">Content</div>
            <TextField label="Title" required value={form.title} onChange={(v) => setField("title", v)} />
            <TextField
              label="Body"
              required
              rows={8}
              placeholder="What's new, in plain language. Separate paragraphs with a blank line."
              value={form.body}
              onChange={(v) => setField("body", v)}
            />
            <div className="form-group">
              <label className="form-label required" htmlFor="rn-status">
                Status
              </label>
              <select
                id="rn-status"
                className="form-select"
                required
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <div className="form-hint">Only published notes appear on the Release Notes page and can be emailed.</div>
            </div>
          </div>

          <div className="rn-form-actions">
            <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
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
            <Link className="btn btn-outline btn-lg" to="/admin/release-notes">
              Cancel
            </Link>
          </div>
        </form>

        {isEdit && (
          <EmailMembersCard
            noteId={id}
            note={note}
            published={form.status === "published" && note?.status === "published"}
            canEmail={userProfile?.canEmailMembers === true}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
