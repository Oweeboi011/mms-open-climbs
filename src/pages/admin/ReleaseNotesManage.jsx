import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveTable from "@/components/admin/ResponsiveTable";

const STATUS_STYLE = {
  published: { background: "#e8f5e9", color: "#1a6b2c", border: "1px solid #a7d7b2" },
  draft: { background: "var(--surface-alt)", color: "var(--ink-soft)", border: "1px solid var(--border)" },
};

export default function AdminReleaseNotesManage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "releaseNotes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

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
          <div style={{ display: "flex", gap: 8 }}>
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
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th style={{ width: "1%" }}>Status</th>
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>
                    Emailed
                  </th>
                  <th style={{ width: "1%" }}>Created</th>
                  <th style={{ width: "1%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", color: "var(--ink-soft)" }}
                    >
                      No release notes yet.
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr key={note.id}>
                      <td style={{ fontWeight: 600 }}>{note.title}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 99,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            ...(STATUS_STYLE[note.status] || STATUS_STYLE.draft),
                          }}
                        >
                          {note.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {note.emailSentAt ? (
                          <span>
                            {note.emailSentCount ?? 0} sent
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-soft)" }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {note.createdAt?.toDate?.().toLocaleDateString("en-PH") ||
                          "—"}
                      </td>
                      <td>
                        <Link
                          to={`/admin/release-notes/${note.id}/edit`}
                          className="btn btn-accent btn-sm"
                        >
                          Edit
                        </Link>
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
    </div>
  );
}
