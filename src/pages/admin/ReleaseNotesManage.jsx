import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { deleteReleaseNote, subscribeToAllReleaseNotes } from "@/services/releaseNotes";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import StatusPill from "@/components/StatusPill";
import ConfirmDialog from "@/components/ConfirmDialog";
import "./releaseNoteForm/releaseNotes.css";

export default function AdminReleaseNotesManage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    return subscribeToAllReleaseNotes(
      (docs) => {
        setNotes(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  async function confirmDelete() {
    setBusy(true);
    setDeleteError("");
    try {
      await deleteReleaseNote(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Release Notes</span>
        </div>
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Release Notes</div>
            <div className="admin-page-subtitle">
              {notes.length} note{notes.length !== 1 ? "s" : ""} total
            </div>
          </div>
          <div className="rn-admin-actions">
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <Link to="/admin/release-notes/new" className="btn btn-primary">
              + New Release Note
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveTable>
            <table className="admin-table table-min-620 rn-admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Emailed</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rn-admin-empty">
                      No release notes yet.
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr key={note.id}>
                      <td className="rn-admin-title">{note.title}</td>
                      <td>
                        <StatusPill tone={note.status === "published" ? "success" : "neutral"}>
                          {note.status}
                        </StatusPill>
                      </td>
                      <td className="rn-admin-small">
                        {note.emailSentAt ? `${note.emailSentCount ?? 0} sent` : <span className="rn-admin-none">—</span>}
                      </td>
                      <td className="rn-admin-small">
                        {note.createdAt?.toDate?.().toLocaleDateString("en-PH") || "—"}
                      </td>
                      <td className="rn-admin-row-actions">
                        <Link to={`/admin/release-notes/${note.id}/edit`} className="btn btn-accent btn-sm">
                          Edit
                        </Link>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDeleting(note)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </main>
      <Footer />
      {deleting && (
        <ConfirmDialog
          title="Delete this release note?"
          confirmLabel="Delete"
          danger
          busy={busy}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleting(null);
            setDeleteError("");
          }}
        >
          &ldquo;{deleting.title}&rdquo; disappears from the history page. Emails already sent can&rsquo;t be recalled.
        </ConfirmDialog>
      )}
    </div>
  );
}
