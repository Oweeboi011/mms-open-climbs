import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import RegistrantRow from "@/components/admin/RegistrantRow";
import AddJoinerModal from "@/components/admin/AddJoinerModal";
import { STATUS_OPTIONS } from "@/components/admin/registrantShared";
import { logFailedRequest } from "@/utils/logFailedRequest";
import { logAuditEvent } from "@/utils/auditLog";
import {
  getExpectedTotal as getExpectedTotalShared,
  getOutstanding as getOutstandingShared,
  toggleTransportationEntry,
} from "@/utils/registrationFees";

export default function AdminClimbDetail() {
  const { id } = useParams();
  const { currentUser } = useAuth();

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
  const [addJoinerOpen, setAddJoinerOpen] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [feedback, setFeedback] = useState([]);

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

    const feedbackQ = query(
      collection(db, "feedback"),
      where("climbId", "==", id),
    );
    const unsubFeedback = onSnapshot(feedbackQ, (snap) => {
      setFeedback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsubFeedback();
    };
  }, [id]);

  async function changeStatus(regId, status) {
    await updateDoc(doc(db, "registrations", regId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
    });
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `registration_status_${status}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details: `Status set to "${status}" for ${climb?.title || "climb"}`,
    });
  }

  async function changePaymentStatus(regId, paymentStatus) {
    await updateDoc(doc(db, "registrations", regId), {
      paymentStatus,
      updatedAt: serverTimestamp(),
    });
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_status_${paymentStatus}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details: `Payment status set to "${paymentStatus}" for ${climb?.title || "climb"}`,
    });
  }

  // Toggle a registrant's transportation selection (availing organized
  // transport vs. arranging their own) directly from the registrants table.
  // Falls back to the climb's fee schedule when the registrant's own
  // feeBreakdown snapshot doesn't have a transportation line item yet, so
  // the toggle shows for every registrant, not just those whose snapshot
  // happens to include it.
  async function toggleTransportation(reg) {
    const updated = toggleTransportationEntry(reg, climb);
    if (!updated) return;
    const nowSelected = updated.find((f) => /transport/i.test(f.label))?.selected;
    await updateDoc(doc(db, "registrations", reg.id), {
      feeBreakdown: updated,
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "transportation_toggled",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `Transportation set to ${nowSelected ? "availing" : "own transport"} for ${climb?.title || "climb"}`,
    });
  }

  async function saveRegistrationEdit(regId, patch) {
    await updateDoc(doc(db, "registrations", regId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "registration_edited",
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details: `Edited registration for ${climb?.title || "climb"}`,
    });
    setEditingReg(null);
  }

  async function deleteRegistration(reg) {
    if (
      !window.confirm(
        `Delete registration for "${reg.name}"? This cannot be undone.`,
      )
    )
      return;
    await deleteDoc(doc(db, "registrations", reg.id));
    if (expandedId === reg.id) setExpandedId(null);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "registration_deleted",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `Deleted registration for ${climb?.title || "climb"}`,
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
      "Type",
      "EC Name",
      "EC Relationship",
      "EC Mobile",
      "Medical Conditions",
      "Status",
      "Payment Status",
      "Amount Paid",
      "Payment Submitted",
      "Payment Verified",
      "Verified By",
      "Registration Form Uploaded",
      "Medical Cert Uploaded",
      "Waiver Signed As",
      "Waiver Date",
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
      r.memberType || "",
      r.emergencyContact?.name || "",
      r.emergencyContact?.relationship || "",
      r.emergencyContact?.mobile || "",
      r.medicalConditions || "",
      r.status,
      r.paymentStatus || "",
      r.amountPaid ?? "",
      r.paymentSubmittedAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.paymentStatus === "verified"
        ? r.verifiedAt?.toDate?.().toLocaleDateString("en-PH") || ""
        : "",
      r.paymentStatus === "verified" ? r.verifiedBy?.name || "" : "",
      r.registrationFormUpload?.url ? "Yes" : "No",
      r.medicalCertUpload?.url ? "Yes" : "No",
      r.waiverSignedName || "",
      r.waiverSignedAt?.toDate?.().toLocaleDateString("en-PH") || "",
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

  const filtered = useMemo(
    () =>
      regs.filter((r) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q);
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        const matchPayment =
          filterPayment === "all" ||
          (filterPayment === "outstanding"
            ? r.status !== "cancelled" && r.paymentStatus !== "verified"
            : r.paymentStatus === filterPayment);
        return matchSearch && matchStatus && matchPayment;
      }),
    [regs, search, filterStatus, filterPayment],
  );

  const getExpectedTotal = (reg) => getExpectedTotalShared(reg, climb);
  const getOutstanding = (reg) => getOutstandingShared(reg, climb);

  const stats = useMemo(
    () => ({
      total: regs.length,
      confirmed: regs.filter((r) => r.status === "confirmed").length,
      pending: regs.filter((r) => r.status === "pending").length,
      waitlisted: regs.filter((r) => r.status === "waitlisted").length,
      cancelled: regs.filter((r) => r.status === "cancelled").length,
      awaitingPayment: regs.filter((r) => r.paymentStatus === "submitted")
        .length,
      totalPaid: regs
        .filter((r) => r.paymentStatus === "verified")
        .reduce((s, r) => s + (Number(r.amountPaid) || 0), 0),
      totalMissing: regs
        .filter((r) => r.status !== "cancelled")
        .reduce((s, r) => s + getOutstanding(r), 0),
    }),
    [regs, climb],
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
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={lightboxUrl}
              alt="Proof of payment"
              style={{
                maxWidth: "92vw",
                maxHeight: "90vh",
                borderRadius: 8,
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: "fixed",
                top: 20,
                right: 24,
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                color: "#fff",
                fontSize: "1.2rem",
                cursor: "pointer",
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
            <div className="admin-page-subtitle">
              {climb?.dateLabel} &bull; {climb?.location}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <Link
              to={`/event/${id}`}
              className="btn btn-outline btn-sm"
              target="_blank"
              title="Open the public event page in a new tab"
            >
              View Page
            </Link>
            <button
              className="btn btn-outline btn-sm"
              onClick={exportCSV}
              title="Download all registrations for this climb as a CSV file"
            >
              &#128229; Export CSV
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => setAddJoinerOpen(true)}
              title="Manually add a participant who wasn't registered through the app — e.g. a walk-in joiner on a completed climb"
            >
              + Add Joiner
            </button>
            <Link
              to={`/admin/climbs/${id}/edit`}
              className="btn btn-accent btn-sm"
              title="Edit climb details, officers, itinerary, and settings"
            >
              Edit Climb
            </Link>
          </div>
        </div>

        {addJoinerOpen && (
          <AddJoinerModal
            climb={climb}
            climbId={id}
            onClose={() => setAddJoinerOpen(false)}
            onAdded={() => setAddJoinerOpen(false)}
          />
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
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
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">
                  ₱{stats.totalPaid.toLocaleString("en-PH")}
                </div>
                <div className="admin-stat-label">Total Paid</div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-num">
                  ₱{stats.totalMissing.toLocaleString("en-PH")}
                </div>
                <div className="admin-stat-label">Total Outstanding</div>
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

            {/* Officers */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  Climb Officers
                </div>
                {(!climb?.officers || climb.officers.length === 0) && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: "#fce8e8",
                      color: "#b91c1c",
                      border: "1px solid #fca5a5",
                    }}
                  >
                    &#9888; No officers assigned
                  </span>
                )}
                <Link
                  to={`/admin/climbs/${id}/edit`}
                  title="Go to the edit page to add or update officers"
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.78rem",
                    color: "var(--ink-soft)",
                    textDecoration: "none",
                  }}
                >
                  + Manage Officers
                </Link>
              </div>

              {climb?.officers?.length > 0 ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {climb.officers.map((o, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "10px 16px",
                        minWidth: 180,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        {o.name || "—"}
                      </div>
                      {o.role && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          {o.role}
                        </div>
                      )}
                      {o.contact && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          {o.contact}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "14px 18px",
                    borderRadius: 8,
                    background: "#fce8e8",
                    border: "1px solid #fca5a5",
                    fontSize: "0.85rem",
                    color: "#b91c1c",
                  }}
                >
                  This climb has no officers assigned yet. Please{" "}
                  <Link
                    to={`/admin/climbs/${id}/edit`}
                    style={{ color: "#b91c1c", fontWeight: 700 }}
                  >
                    edit the climb
                  </Link>{" "}
                  to add officers.
                </div>
              )}
            </div>

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
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
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Payments</option>
                <option value="outstanding">Has Outstanding Balance</option>
                <option value="unpaid">Unpaid</option>
                <option value="submitted">Payment Submitted</option>
                <option value="verified">Payment Verified</option>
                <option value="rejected">Payment Rejected</option>
              </select>
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginBottom: 8,
              }}
            >
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
                    {(climb?.requiresRegistrationForm ||
                      climb?.requiresMedicalCert) && (
                      <th style={{ width: "1%" }}>Docs</th>
                    )}
                    <th style={{ width: "1%" }}>Payment</th>
                    <th style={{ width: "1%" }}>Paid</th>
                    <th style={{ width: "1%" }}>Outstanding</th>
                    <th style={{ width: "1%" }}>Status</th>
                    <th style={{ width: "1%" }}>Registered</th>
                    <th style={{ width: "1%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          climb?.requiresRegistrationForm ||
                          climb?.requiresMedicalCert
                            ? 11
                            : 10
                        }
                        style={{
                          textAlign: "center",
                          color: "var(--ink-soft)",
                          padding: "32px 0",
                        }}
                      >
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => (
                      <RegistrantRow
                        key={reg.id}
                        reg={reg}
                        idx={idx}
                        climb={climb}
                        expandedId={expandedId}
                        toggleExpand={toggleExpand}
                        changeStatus={changeStatus}
                        changePaymentStatus={changePaymentStatus}
                        toggleTransportation={toggleTransportation}
                        onEdit={setEditingReg}
                        deleteRegistration={deleteRegistration}
                        editNotes={editNotes}
                        setEditNotes={setEditNotes}
                        startNoteEdit={startNoteEdit}
                        saveNote={saveNote}
                        savingNote={savingNote}
                        setLightboxUrl={setLightboxUrl}
                        getOutstanding={getOutstanding}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {feedback.length > 0 && (
          <div className="admin-card" style={{ marginTop: 24 }}>
            <div className="admin-card-title">
              Climb Feedback ({feedback.length})
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginBottom: 16 }}>
              Average rating:{" "}
              <strong>
                {(
                  feedback.reduce((sum, f) => sum + (f.rating || 0), 0) /
                  feedback.length
                ).toFixed(1)}
                /5
              </strong>
            </p>
            <table className="admin-table">
              <tbody>
                {feedback
                  .slice()
                  .sort(
                    (a, b) =>
                      (b.createdAt?.toDate?.()?.getTime() || 0) -
                      (a.createdAt?.toDate?.()?.getTime() || 0),
                  )
                  .map((f) => (
                    <tr key={f.id}>
                      <td style={{ width: "1%", whiteSpace: "nowrap" }}>
                        {f.name || "Anonymous"}
                      </td>
                      <td style={{ width: "1%", whiteSpace: "nowrap", color: "var(--gold)" }}>
                        {"★".repeat(f.rating || 0)}
                        {"☆".repeat(5 - (f.rating || 0))}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {f.comments || (
                          <span style={{ color: "var(--ink-soft)" }}>
                            No comments
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editingReg && (
        <EditRegistrationModal
          reg={editingReg}
          onClose={() => setEditingReg(null)}
          onSave={saveRegistrationEdit}
        />
      )}

      <Footer />
    </div>
  );
}
