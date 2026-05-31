import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const EXPERIENCE_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  experienced: "Experienced",
};

const STATUS_OPTIONS = ["pending", "confirmed", "waitlisted", "cancelled"];
const STATUS_CLASS = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  cancelled: "status-cancelled",
  waitlisted: "status-waitlisted",
};

export default function AdminClimbDetail() {
  const { id } = useParams();

  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editNotes, setEditNotes] = useState({}); // regId → draft note string
  const [savingNote, setSavingNote] = useState(null); // regId being saved

  useEffect(() => {
    getDoc(doc(db, "climbs", id)).then((snap) => {
      if (snap.exists()) setClimb({ id: snap.id, ...snap.data() });
    });

    const q = query(
      collection(db, "registrations"),
      where("climbId", "==", id),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [id]);

  async function changeRegStatus(regId, status) {
    await updateDoc(doc(db, "registrations", regId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
    });
  }

  function toggleExpand(regId) {
    setExpandedId((prev) => (prev === regId ? null : regId));
  }

  function startNoteEdit(reg) {
    setEditNotes((prev) => ({
      ...prev,
      [reg.id]: prev[reg.id] ?? (reg.adminNotes || ""),
    }));
  }

  async function saveNote(regId) {
    setSavingNote(regId);
    try {
      await updateDoc(doc(db, "registrations", regId), {
        adminNotes: editNotes[regId],
        updatedAt: serverTimestamp(),
      });
      setEditNotes((prev) => {
        const n = { ...prev };
        delete n[regId];
        return n;
      });
    } finally {
      setSavingNote(null);
    }
  }

  function exportCSV() {
    const headers = [
      "#",
      "Name",
      "Email",
      "Mobile",
      "Date of Birth",
      "Address",
      "Experience",
      "EC Name",
      "EC Relationship",
      "EC Mobile",
      "Medical Conditions",
      "Status",
      "Waiver Signed As",
      "Registered",
      "Admin Notes",
    ];
    const rows = regs.map((r, i) => [
      i + 1,
      r.name,
      r.email,
      r.mobile,
      r.dateOfBirth || "",
      r.address || "",
      r.experienceLevel,
      r.emergencyContact?.name || "",
      r.emergencyContact?.relationship || "",
      r.emergencyContact?.mobile || "",
      r.medicalConditions || "",
      r.status,
      r.waiverSignedName || "",
      r.createdAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.adminNotes || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${climb?.title || "registrants"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = regs.filter((r) => {
    const matchSearch =
      !search ||
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "all" || r.status === filter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: regs.length,
    confirmed: regs.filter((r) => r.status === "confirmed").length,
    pending: regs.filter((r) => r.status === "pending").length,
    waitlisted: regs.filter((r) => r.status === "waitlisted").length,
    cancelled: regs.filter((r) => r.status === "cancelled").length,
  };

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/climbs">Climbs</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{climb?.title || "…"}</span>
        </div>

        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">{climb?.title || "…"}</div>
            <div className="admin-page-subtitle">
              {climb?.dateLabel} &bull; {climb?.location}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              to={`/event/${id}`}
              className="btn btn-outline btn-sm"
              target="_blank"
            >
              View Page
            </Link>
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>
              &#128229; Export CSV
            </button>
            <Link
              to={`/admin/climbs/${id}/edit`}
              className="btn btn-accent btn-sm"
            >
              Edit Climb
            </Link>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="admin-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.total}</div>
                <div className="admin-stat-label">Total</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.confirmed}</div>
                <div className="admin-stat-label">Confirmed</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.pending}</div>
                <div className="admin-stat-label">Pending</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">{stats.waitlisted}</div>
                <div className="admin-stat-label">Waitlisted</div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-num">{stats.cancelled}</div>
                <div className="admin-stat-label">Cancelled</div>
              </div>
              {climb?.maxParticipants && (
                <div className="admin-stat-card">
                  <div className="admin-stat-num">
                    {climb.maxParticipants - stats.confirmed}
                  </div>
                  <div className="admin-stat-label">Open Slots</div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <input
                type="search"
                className="form-input"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <select
                className="form-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Participant</th>
                    <th>Mobile</th>
                    <th>Experience</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--ink-soft)",
                        }}
                      >
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => (
                      <React.Fragment key={reg.id}>
                        <tr
                          key={reg.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleExpand(reg.id)}
                        >
                          <td
                            style={{
                              color: "var(--ink-soft)",
                              fontSize: "0.78rem",
                            }}
                          >
                            {idx + 1}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{reg.name}</div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--ink-soft)",
                              }}
                            >
                              {reg.email}
                            </div>
                            {reg.adminNotes && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--gold)",
                                  marginTop: 2,
                                }}
                              >
                                &#128203; Note
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>{reg.mobile}</td>
                          <td
                            style={{
                              fontSize: "0.82rem",
                              textTransform: "capitalize",
                            }}
                          >
                            {EXPERIENCE_LABELS[reg.experienceLevel] ||
                              reg.experienceLevel}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="form-select"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                width: "auto",
                              }}
                              value={reg.status}
                              onChange={(e) =>
                                changeRegStatus(reg.id, e.target.value)
                              }
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td
                            style={{
                              fontSize: "0.78rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {reg.createdAt
                              ?.toDate?.()
                              .toLocaleDateString("en-PH") || "—"}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <Link
                              to={`/waiver/${reg.id}`}
                              className="btn btn-outline btn-sm"
                              target="_blank"
                            >
                              Waiver
                            </Link>
                          </td>
                        </tr>
                        {expandedId === reg.id && (
                          <tr key={`${reg.id}-detail`}>
                            <td
                              colSpan={7}
                              style={{
                                background: "var(--surface)",
                                padding: "16px 20px",
                                borderBottom: "2px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fill, minmax(220px, 1fr))",
                                  gap: "16px 24px",
                                  marginBottom: 16,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Date of Birth
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.dateOfBirth || "—"}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Address
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.address || "—"}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Emergency Contact
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.emergencyContact?.name ? (
                                      <>
                                        {reg.emergencyContact.name}{" "}
                                        <span
                                          style={{ color: "var(--ink-soft)" }}
                                        >
                                          ({reg.emergencyContact.relationship})
                                        </span>
                                        <br />
                                        {reg.emergencyContact.mobile}
                                      </>
                                    ) : (
                                      "—"
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Medical Conditions
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.medicalConditions || "None declared"}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Waiver Signed As
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.waiverSignedName || "—"}
                                  </div>
                                </div>
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    Signed On
                                  </div>
                                  <div style={{ fontSize: "0.88rem" }}>
                                    {reg.waiverSignedAt
                                      ?.toDate?.()
                                      .toLocaleDateString("en-PH") || "—"}
                                  </div>
                                </div>
                              </div>
                              {/* Admin Notes */}
                              <div>
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    letterSpacing: 2,
                                    textTransform: "uppercase",
                                    color: "var(--ink-soft)",
                                    marginBottom: 6,
                                  }}
                                >
                                  Admin Notes
                                </div>
                                {editNotes[reg.id] !== undefined ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "flex-start",
                                    }}
                                  >
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      style={{
                                        flex: 1,
                                        resize: "vertical",
                                        fontSize: "0.85rem",
                                      }}
                                      value={editNotes[reg.id]}
                                      onChange={(e) =>
                                        setEditNotes((prev) => ({
                                          ...prev,
                                          [reg.id]: e.target.value,
                                        }))
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      className="btn btn-primary btn-sm"
                                      disabled={savingNote === reg.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveNote(reg.id);
                                      }}
                                    >
                                      {savingNote === reg.id
                                        ? "Saving…"
                                        : "Save"}
                                    </button>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditNotes((prev) => {
                                          const n = { ...prev };
                                          delete n[reg.id];
                                          return n;
                                        });
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.85rem",
                                        color: reg.adminNotes
                                          ? "var(--ink)"
                                          : "var(--ink-soft)",
                                        flex: 1,
                                      }}
                                    >
                                      {reg.adminNotes || "No notes."}
                                    </span>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startNoteEdit(reg);
                                      }}
                                    >
                                      {reg.adminNotes
                                        ? "Edit Note"
                                        : "+ Add Note"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
