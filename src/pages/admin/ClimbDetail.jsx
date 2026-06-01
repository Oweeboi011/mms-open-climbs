import React, { useState, useEffect, useMemo } from "react";
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

const STATUS_STYLE = {
  pending:    { bg: "#fff8e1", color: "#b45309", border: "#fde68a" },
  confirmed:  { bg: "#e8f5e9", color: "#1a6b2c", border: "#a7d7b2" },
  waitlisted: { bg: "#fff3e0", color: "#c05c00", border: "#ffd399" },
  cancelled:  { bg: "#fce8e8", color: "#b91c1c", border: "#fca5a5" },
};

const PAYMENT_STYLE = {
  submitted: { bg: "#fff8e1", color: "#b45309", border: "#fde68a", label: "Submitted" },
  verified:  { bg: "#e8f5e9", color: "#1a6b2c", border: "#a7d7b2", label: "Verified" },
  rejected:  { bg: "#fce8e8", color: "#b91c1c", border: "#fca5a5", label: "Rejected" },
};

function StatusBadge({ status, styleMap }) {
  const s = styleMap?.[status];
  if (!s) return <span style={{ color: "var(--ink-soft)", fontSize: "0.75rem" }}>—</span>;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {s.label || status}
    </span>
  );
}

export default function AdminClimbDetail() {
  const { id } = useParams();

  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editNotes, setEditNotes] = useState({});
  const [savingNote, setSavingNote] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

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

  async function changeStatus(regId, status) {
    await updateDoc(doc(db, "registrations", regId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
    });
  }

  async function changePaymentStatus(regId, paymentStatus) {
    await updateDoc(doc(db, "registrations", regId), {
      paymentStatus,
      updatedAt: serverTimestamp(),
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
      "#", "Name", "Email", "Mobile", "Date of Birth", "Address",
      "Experience", "Type", "EC Name", "EC Relationship", "EC Mobile",
      "Medical Conditions", "Status", "Payment Status",
      "Waiver Signed As", "Waiver Date", "Registered", "Admin Notes",
    ];
    const rows = regs.map((r, i) => [
      i + 1, r.name, r.email, r.mobile, r.dateOfBirth || "",
      r.address || "", r.experienceLevel, r.memberType || "",
      r.emergencyContact?.name || "", r.emergencyContact?.relationship || "",
      r.emergencyContact?.mobile || "", r.medicalConditions || "",
      r.status, r.paymentStatus || "", r.waiverSignedName || "",
      r.waiverSignedAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.createdAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.adminNotes || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${climb?.title || "registrants"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => regs.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q);
    const matchStatus  = filterStatus  === "all" || r.status        === filterStatus;
    const matchPayment = filterPayment === "all" || r.paymentStatus === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  }), [regs, search, filterStatus, filterPayment]);

  const stats = useMemo(() => ({
    total:           regs.length,
    confirmed:       regs.filter((r) => r.status === "confirmed").length,
    pending:         regs.filter((r) => r.status === "pending").length,
    waitlisted:      regs.filter((r) => r.status === "waitlisted").length,
    cancelled:       regs.filter((r) => r.status === "cancelled").length,
    awaitingPayment: regs.filter((r) => r.paymentStatus === "submitted").length,
  }), [regs]);

  const statusStyleWithLabel = Object.fromEntries(
    Object.entries(STATUS_STYLE).map(([k, v]) => [k, { ...v, label: k }])
  );

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">

        {/* Image lightbox */}
        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
              zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={lightboxUrl}
              alt="Proof of payment"
              style={{ maxWidth: "92vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: "fixed", top: 20, right: 24, background: "rgba(255,255,255,0.15)",
                border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff",
                fontSize: "1.2rem", cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        )}

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
            <div className="admin-page-subtitle">{climb?.dateLabel} &bull; {climb?.location}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to={`/event/${id}`} className="btn btn-outline btn-sm" target="_blank" title="Open the public event page in a new tab">View Page</Link>
            <button className="btn btn-outline btn-sm" onClick={exportCSV} title="Download all registrations for this climb as a CSV file">&#128229; Export CSV</button>
            <Link to={`/admin/climbs/${id}/edit`} className="btn btn-accent btn-sm" title="Edit climb details, officers, itinerary, and settings">Edit Climb</Link>
          </div>
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
            {/* Stats */}
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
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.awaitingPayment}</div>
                <div className="admin-stat-label">Awaiting Payment Review</div>
              </div>
              {climb?.maxParticipants && (
                <div className="admin-stat-card">
                  <div className="admin-stat-num">{climb.maxParticipants - stats.confirmed}</div>
                  <div className="admin-stat-label">Open Slots</div>
                </div>
              )}
            </div>

            {/* Officers */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 10,
              }}>
                <div style={{
                  fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", color: "var(--ink-soft)",
                }}>
                  Climb Officers
                </div>
                {(!climb?.officers || climb.officers.length === 0) && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem",
                    fontWeight: 700, background: "#fce8e8", color: "#b91c1c",
                    border: "1px solid #fca5a5",
                  }}>
                    &#9888; No officers assigned
                  </span>
                )}
                <Link
                  to={`/admin/climbs/${id}/edit`}
                  title="Go to the edit page to add or update officers"
                  style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--ink-soft)", textDecoration: "none" }}
                >
                  + Manage Officers
                </Link>
              </div>

              {climb?.officers?.length > 0 ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {climb.officers.map((o, i) => (
                    <div key={i} style={{
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "10px 16px", minWidth: 180,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{o.name || "—"}</div>
                      {o.role && (
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>{o.role}</div>
                      )}
                      {o.contact && (
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>{o.contact}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: "14px 18px", borderRadius: 8,
                  background: "#fce8e8", border: "1px solid #fca5a5",
                  fontSize: "0.85rem", color: "#b91c1c",
                }}>
                  This climb has no officers assigned yet. Please{" "}
                  <Link to={`/admin/climbs/${id}/edit`} style={{ color: "#b91c1c", fontWeight: 700 }}>
                    edit the climb
                  </Link>{" "}
                  to add officers.
                </div>
              )}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                type="search"
                className="form-input"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: "1 1 200px", maxWidth: 280 }}
              />
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className="form-select"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Payments</option>
                <option value="submitted">Payment Submitted</option>
                <option value="verified">Payment Verified</option>
                <option value="rejected">Payment Rejected</option>
              </select>
            </div>

            <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 8 }}>
              Showing {filtered.length} of {regs.length}
            </div>

            {/* Table */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "1%" }}>#</th>
                    <th>Participant</th>
                    <th style={{ width: "1%" }}>Mobile</th>
                    <th style={{ width: "1%" }}>Waiver</th>
                    <th style={{ width: "1%" }}>Payment</th>
                    <th style={{ width: "1%" }}>Status</th>
                    <th style={{ width: "1%" }}>Registered</th>
                    <th style={{ width: "1%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)", padding: "32px 0" }}>
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => (
                      <React.Fragment key={reg.id}>
                        <tr
                          style={{
                            cursor: "pointer",
                            background: expandedId === reg.id ? "var(--surface)" : undefined,
                          }}
                          onClick={() => toggleExpand(reg.id)}
                        >
                          <td style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>{idx + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{reg.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{reg.email}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                              {reg.adminNotes && (
                                <span style={{ fontSize: "0.65rem", color: "var(--gold)" }}>&#128203; Note</span>
                              )}
                              {reg.memberType && (
                                <span style={{ fontSize: "0.65rem", color: "var(--ink-soft)" }}>
                                  {reg.memberType === "member" ? "MMS Member" : "Joiner"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>{reg.mobile || "—"}</td>
                          <td>
                            {reg.waiverSigned ? (
                              <span style={{ color: "#1a6b2c", fontWeight: 700, fontSize: "0.8rem" }}>&#10003; Signed</span>
                            ) : (
                              <span style={{ color: "#b91c1c", fontSize: "0.8rem" }}>&#10005; None</span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <StatusBadge status={reg.paymentStatus} styleMap={PAYMENT_STYLE} />
                            {reg.paymentProofs?.length > 0 && (
                              <div style={{ fontSize: "0.65rem", color: "var(--ink-soft)", marginTop: 2 }}>
                                {reg.paymentProofs.length} file{reg.paymentProofs.length > 1 ? "s" : ""}
                              </div>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="form-select"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                              value={reg.status}
                              onChange={(e) => changeStatus(reg.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                            {reg.createdAt?.toDate?.().toLocaleDateString("en-PH") || "—"}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <Link to={`/waiver/${reg.id}`} className="btn btn-outline btn-sm" target="_blank" title="Open the printable waiver for this participant">
                              Waiver
                            </Link>
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {expandedId === reg.id && (
                          <tr key={`${reg.id}-detail`}>
                            <td
                              colSpan={8}
                              style={{
                                background: "var(--surface)",
                                padding: 0,
                                borderBottom: "2px solid var(--border)",
                              }}
                            >
                              <div style={{ padding: "20px 24px" }}>

                                {/* Quick actions bar */}
                                <div style={{
                                  display: "flex", gap: 8, flexWrap: "wrap",
                                  marginBottom: 20, paddingBottom: 16,
                                  borderBottom: "1px solid var(--border)",
                                  alignItems: "center",
                                }}>
                                  <span style={{
                                    fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2,
                                    textTransform: "uppercase", color: "var(--ink-soft)", marginRight: 4,
                                  }}>
                                    Quick Actions:
                                  </span>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: "#1a6b2c", color: "#fff", border: "none" }}
                                    disabled={reg.status === "confirmed"}
                                    title="Confirm this registration — participant is officially accepted"
                                    onClick={(e) => { e.stopPropagation(); changeStatus(reg.id, "confirmed"); }}
                                  >
                                    &#10003; Confirm
                                  </button>
                                  <button
                                    className="btn btn-outline btn-sm"
                                    disabled={reg.status === "waitlisted"}
                                    title="Move this participant to the waitlist"
                                    onClick={(e) => { e.stopPropagation(); changeStatus(reg.id, "waitlisted"); }}
                                  >
                                    Waitlist
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    disabled={reg.status === "cancelled"}
                                    title="Cancel this registration"
                                    onClick={(e) => { e.stopPropagation(); changeStatus(reg.id, "cancelled"); }}
                                  >
                                    &#10005; Cancel
                                  </button>
                                  <span style={{ marginLeft: "auto" }}>
                                    <StatusBadge status={reg.status} styleMap={statusStyleWithLabel} />
                                  </span>
                                </div>

                                {/* Registration info */}
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                  gap: "14px 24px",
                                  marginBottom: 20,
                                }}>
                                  <InfoCell label="Date of Birth" value={reg.dateOfBirth} />
                                  <InfoCell label="Address" value={reg.address} />
                                  <InfoCell
                                    label="Experience"
                                    value={EXPERIENCE_LABELS[reg.experienceLevel] || reg.experienceLevel}
                                  />
                                  <InfoCell
                                    label="Participant Type"
                                    value={reg.memberType === "member" ? "MMS Member" : "Joiner"}
                                  />
                                  <InfoCell
                                    label="Emergency Contact"
                                    value={reg.emergencyContact?.name
                                      ? `${reg.emergencyContact.name} (${reg.emergencyContact.relationship}) — ${reg.emergencyContact.mobile}`
                                      : null}
                                  />
                                  <InfoCell label="Medical" value={reg.medicalConditions || "None declared"} />
                                </div>

                                {/* Waiver section */}
                                <div style={{
                                  background: reg.waiverSigned ? "#e8f5e9" : "#fce8e8",
                                  border: `1px solid ${reg.waiverSigned ? "#a7d7b2" : "#fca5a5"}`,
                                  borderRadius: 8, padding: "14px 16px", marginBottom: 16,
                                  display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{
                                      fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2,
                                      textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 4,
                                    }}>
                                      Waiver &amp; Release of Liability
                                    </div>
                                    {reg.waiverSigned ? (
                                      <>
                                        <div style={{ fontWeight: 700, color: "#1a6b2c", fontSize: "0.9rem" }}>
                                          &#10003; Signed as &ldquo;{reg.waiverSignedName}&rdquo;
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginTop: 2 }}>
                                          {reg.waiverSignedAt?.toDate?.().toLocaleString("en-PH") || "Date not recorded"}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: "0.9rem" }}>
                                        &#10005; Waiver not yet signed
                                      </div>
                                    )}
                                  </div>
                                  <Link
                                    to={`/waiver/${reg.id}`}
                                    className="btn btn-outline btn-sm"
                                    target="_blank"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View / Print Waiver
                                  </Link>
                                </div>

                                {/* Payment proof section */}
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{
                                    fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2,
                                    textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8,
                                    display: "flex", alignItems: "center", gap: 8,
                                  }}>
                                    Proof of Payment
                                    <StatusBadge status={reg.paymentStatus} styleMap={PAYMENT_STYLE} />
                                  </div>

                                  {reg.paymentProofs?.length > 0 ? (
                                    <>
                                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                                        {reg.paymentProofs.map((proof, i) => (
                                          <div
                                            key={i}
                                            style={{
                                              border: "1px solid var(--border)", borderRadius: 8,
                                              overflow: "hidden", background: "var(--surface-alt)",
                                            }}
                                          >
                                            {proof.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                              <img
                                                src={proof.url}
                                                alt={proof.fileName}
                                                style={{ width: 130, height: 130, objectFit: "cover", display: "block", cursor: "zoom-in" }}
                                                onClick={(e) => { e.stopPropagation(); setLightboxUrl(proof.url); }}
                                              />
                                            ) : (
                                              <a
                                                href={proof.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                  display: "flex", flexDirection: "column",
                                                  alignItems: "center", justifyContent: "center",
                                                  width: 130, height: 130, gap: 6, textDecoration: "none",
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <span style={{ fontSize: "2.2rem" }}>&#128196;</span>
                                                <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>Open PDF</span>
                                              </a>
                                            )}
                                            <div style={{
                                              fontSize: "0.65rem", color: "var(--ink-soft)",
                                              padding: "4px 8px", maxWidth: 130,
                                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                              {proof.fileName || `File ${i + 1}`}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                          className="btn btn-sm"
                                          style={{ background: "#1a6b2c", color: "#fff", border: "none" }}
                                          disabled={reg.paymentStatus === "verified"}
                                          title="Mark payment as verified — confirmed received"
                                          onClick={(e) => { e.stopPropagation(); changePaymentStatus(reg.id, "verified"); }}
                                        >
                                          &#10003; Verify Payment
                                        </button>
                                        <button
                                          className="btn btn-danger btn-sm"
                                          disabled={reg.paymentStatus === "rejected"}
                                          title="Reject this payment — participant will need to resubmit"
                                          onClick={(e) => { e.stopPropagation(); changePaymentStatus(reg.id, "rejected"); }}
                                        >
                                          &#10005; Reject Payment
                                        </button>
                                        <button
                                          className="btn btn-outline btn-sm"
                                          disabled={reg.paymentStatus === "submitted"}
                                          title="Reset payment status back to Submitted for re-review"
                                          onClick={(e) => { e.stopPropagation(); changePaymentStatus(reg.id, "submitted"); }}
                                        >
                                          Reset to Submitted
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
                                      No proof of payment uploaded.
                                    </div>
                                  )}
                                </div>

                                {/* Admin notes */}
                                <div>
                                  <div style={{
                                    fontSize: "0.72rem", fontWeight: 700, letterSpacing: 2,
                                    textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 6,
                                  }}>
                                    Admin Notes
                                  </div>
                                  {editNotes[reg.id] !== undefined ? (
                                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                      <textarea
                                        className="form-input"
                                        rows={2}
                                        style={{ flex: 1, resize: "vertical", fontSize: "0.85rem" }}
                                        value={editNotes[reg.id]}
                                        onChange={(e) => setEditNotes((prev) => ({ ...prev, [reg.id]: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        className="btn btn-primary btn-sm"
                                        disabled={savingNote === reg.id}
                                        title="Save the admin note for this participant"
                                        onClick={(e) => { e.stopPropagation(); saveNote(reg.id); }}
                                      >
                                        {savingNote === reg.id ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        title="Discard changes and close the note editor"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditNotes((prev) => { const n = { ...prev }; delete n[reg.id]; return n; });
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      <span style={{
                                        fontSize: "0.85rem",
                                        color: reg.adminNotes ? "var(--ink)" : "var(--ink-soft)",
                                        flex: 1,
                                      }}>
                                        {reg.adminNotes || "No notes."}
                                      </span>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        title={reg.adminNotes ? "Edit the existing admin note" : "Add an internal note for this participant"}
                                        onClick={(e) => { e.stopPropagation(); startNoteEdit(reg); }}
                                      >
                                        {reg.adminNotes ? "Edit Note" : "+ Add Note"}
                                      </button>
                                    </div>
                                  )}
                                </div>

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

function InfoCell({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{
        fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2,
        textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{ fontSize: "0.85rem" }}>{value}</div>
    </div>
  );
}
