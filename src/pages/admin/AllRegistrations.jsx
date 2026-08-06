import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import FeeBreakdownTable from "@/components/FeeBreakdownTable";
import PaymentHistory from "@/components/admin/PaymentHistory";
import { logAuditEvent } from "@/utils/auditLog";
import {
  getPaymentEntries,
  setEntryStatus,
  setAllEntryStatuses,
} from "@/utils/payments";
import {
  getOutstanding,
  toggleTransportationEntry,
} from "@/utils/registrationFees";

const STATUS_OPTIONS = ["pending", "confirmed", "waitlisted", "cancelled"];

// A registrant is missing required documents when their climb requires a
// registration form and/or medical cert and the corresponding upload hasn't
// been submitted yet.
function hasMissingRequiredDocs(reg, climb) {
  if (!climb) return false;
  if (climb.requiresRegistrationForm && !reg.registrationFormUpload?.url)
    return true;
  if (climb.requiresMedicalCert && !reg.medicalCertUpload?.url) return true;
  return false;
}

export default function AllRegistrations() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [regs, setRegs] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClimb, setFilterClimb] = useState(
    searchParams.get("climb") || "all",
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState(() => {
    const f = searchParams.get("filter");
    if (f === "payment") return "submitted";
    if (f === "unpaid") return "unpaid";
    return "all";
  });
  const [filterDocs, setFilterDocs] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editingReg, setEditingReg] = useState(null);

  const [scope, setScope] = useState("active");

  useEffect(() => {
    // Load all climbs for the filter dropdown and per-registration lookups
    // (fee schedule + required-document flags).
    getDocs(collection(db, "climbs")).then((snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          title: d.data().title,
          dateLabel: d.data().dateLabel,
          status: d.data().status,
          startDate: d.data().startDate,
          fees: d.data().fees || [],
          requiresRegistrationForm: !!d.data().requiresRegistrationForm,
          requiresMedicalCert: !!d.data().requiresMedicalCert,
        }))
        .sort((a, b) => {
          const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
          const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
          return da - db2;
        });
      setClimbs(list);
    });

    const q = query(
      collection(db, "registrations"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

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
    });
  }

  // One verdict across every payment on the registration — the rolled-up
  // status and the payments behind it always agree.
  async function changePaymentStatus(regId, paymentStatus) {
    const reg = regs.find((r) => r.id === regId);
    await updateDoc(doc(db, "registrations", regId), {
      ...setAllEntryStatuses(reg || {}, paymentStatus),
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_status_${paymentStatus}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
    });
  }

  // Review a single payment without touching the rest of the history.
  async function changeEntryStatus(reg, index, status) {
    await updateDoc(doc(db, "registrations", reg.id), {
      ...setEntryStatus(reg, index, status),
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_entry_${status}`,
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
    });
  }

  async function deleteRegistration(reg) {
    if (
      !window.confirm(
        `Delete registration for "${reg.name}" on "${reg.climbTitle || "this climb"}"? This cannot be undone.`,
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
    });
  }

  // Toggle a registrant's transportation selection (availing organized
  // transport vs. arranging their own) directly from the row. Falls back to
  // the climb's fee schedule when the registrant's own feeBreakdown snapshot
  // doesn't have a transportation line item yet, so the toggle shows for
  // every registrant on a climb that offers transportation, not just those
  // whose snapshot happens to include it.
  async function toggleTransportation(reg) {
    const climb = climbs.find((c) => c.id === reg.climbId);
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
      details: `Transportation set to ${nowSelected ? "availing" : "own transport"}`,
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
    });
    setEditingReg(null);
  }

  const climbById = useMemo(() => {
    const map = {};
    for (const c of climbs) map[c.id] = c;
    return map;
  }, [climbs]);
  const climbStatusById = useMemo(() => {
    const map = {};
    for (const c of climbs) map[c.id] = c.status;
    return map;
  }, [climbs]);

  const isPastReg = (r) => climbStatusById[r.climbId] === "completed";

  const scoped = useMemo(
    () => regs.filter((r) => (scope === "past" ? isPastReg(r) : !isPastReg(r))),
    [regs, climbStatusById, scope],
  );

  const filtered = useMemo(() => {
    return scoped.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.climbTitle?.toLowerCase().includes(q);
      const matchClimb = filterClimb === "all" || r.climbId === filterClimb;
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchPayment =
        filterPayment === "all" || r.paymentStatus === filterPayment;
      const matchDocs =
        filterDocs !== "missing" ||
        hasMissingRequiredDocs(r, climbById[r.climbId]);
      return matchSearch && matchClimb && matchStatus && matchPayment && matchDocs;
    });
  }, [scoped, search, filterClimb, filterStatus, filterPayment, filterDocs, climbById]);

  const stats = useMemo(
    () => ({
      total: scoped.length,
      pending: scoped.filter((r) => r.status === "pending").length,
      confirmed: scoped.filter((r) => r.status === "confirmed").length,
      paymentPending: scoped.filter(
        (r) => r.paymentStatus === "submitted" && r.status === "pending",
      ).length,
      missingDocs: scoped.filter((r) =>
        hasMissingRequiredDocs(r, climbById[r.climbId]),
      ).length,
    }),
    [scoped, climbById],
  );

  const activeCount = useMemo(
    () => regs.filter((r) => !isPastReg(r)).length,
    [regs, climbStatusById],
  );
  const pastCount = useMemo(
    () => regs.filter((r) => isPastReg(r)).length,
    [regs, climbStatusById],
  );

  function exportCSV() {
    const headers = [
      "#",
      "Name",
      "Email",
      "Mobile",
      "Climb",
      "Climb Date",
      "Experience",
      "Participant Type",
      "Status",
      "Payment Status",
      "Waiver Signed As",
      "Registered",
      "Admin Notes",
    ];
    const rows = filtered.map((r, i) => [
      i + 1,
      r.name,
      r.email,
      r.mobile || "",
      r.climbTitle || "",
      r.climbDate || "",
      r.experienceLevel || "",
      r.memberType || "",
      r.status,
      r.paymentStatus || "",
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
    a.download = `${scope}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>All Registrations</span>
        </div>

        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">All Registrations</div>
            <div className="admin-page-subtitle">
              Across all climbs — upcoming and past events
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <button
              className="btn btn-outline btn-sm"
              onClick={exportCSV}
              title="Download the current filtered list as a CSV file"
            >
              &#128229; Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Active / Past scope tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                className={`btn btn-sm ${scope === "active" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setScope("active")}
              >
                Active Registrations ({activeCount})
              </button>
              <button
                className={`btn btn-sm ${scope === "past" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setScope("past")}
              >
                Past Registrations ({pastCount})
              </button>
            </div>

            {/* Stats */}
            <div className="admin-stats">
              <div className="admin-stat-card accent">
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
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.paymentPending}</div>
                <div className="admin-stat-label">Awaiting Payment Review</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.missingDocs}</div>
                <div className="admin-stat-label">Missing Required Docs</div>
              </div>
            </div>

            {/* Filters */}
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
                placeholder="Search name, email, or climb…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: "1 1 220px", maxWidth: 320 }}
              />
              <select
                className="form-select"
                value={filterClimb}
                onChange={(e) => setFilterClimb(e.target.value)}
                style={{ flex: "1 1 200px", maxWidth: 280 }}
              >
                <option value="all">All Climbs</option>
                {climbs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.dateLabel ? ` — ${c.dateLabel}` : ""}
                  </option>
                ))}
              </select>
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
                <option value="unpaid">Unpaid</option>
                <option value="submitted">Payment Submitted</option>
                <option value="verified">Payment Verified</option>
                <option value="rejected">Payment Rejected</option>
              </select>
              <select
                className="form-select"
                value={filterDocs}
                onChange={(e) => setFilterDocs(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Documents</option>
                <option value="missing">Missing Required Docs</option>
              </select>
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginBottom: 8,
              }}
            >
              Showing {filtered.length} of {scoped.length}{" "}
              {scope === "past" ? "past" : "active"} registrations
            </div>

            {/* Table */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: "1%" }}>#</th>
                    <th>Participant</th>
                    <th>Climb</th>
                    <th style={{ width: "1%" }}>Payment</th>
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
                        colSpan={8}
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
                      <React.Fragment key={reg.id}>
                        <tr
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setExpandedId((p) => (p === reg.id ? null : reg.id))
                          }
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
                            {reg.memberType && (
                              <div
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--ink-soft)",
                                  marginTop: 1,
                                  textTransform: "capitalize",
                                }}
                              >
                                {reg.memberType === "member"
                                  ? "MMS Member"
                                  : "Joiner"}
                              </div>
                            )}
                          </td>
                          <td>
                            <div
                              style={{ fontWeight: 600, fontSize: "0.85rem" }}
                            >
                              {reg.climbTitle || "—"}
                            </div>
                            {reg.climbDate && (
                              <div
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                {reg.climbDate}
                              </div>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {reg.paymentStatus ? (
                              <select
                                className="form-select"
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "0.75rem",
                                  width: "auto",
                                }}
                                value={reg.paymentStatus}
                                onChange={(e) =>
                                  changePaymentStatus(reg.id, e.target.value)
                                }
                              >
                                <option value="unpaid">Unpaid</option>
                                <option value="submitted">Submitted</option>
                                <option value="verified">Verified</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            ) : (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              fontSize: "0.85rem",
                              whiteSpace: "nowrap",
                              color:
                                getOutstanding(reg, climbById[reg.climbId]) === 0
                                  ? "var(--ink-soft)"
                                  : "#b91c1c",
                            }}
                          >
                            {getOutstanding(reg, climbById[reg.climbId]) === 0
                              ? "—"
                              : `₱${getOutstanding(reg, climbById[reg.climbId]).toLocaleString("en-PH")}`}
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
                                changeStatus(reg.id, e.target.value)
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
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "nowrap",
                              }}
                            >
                              <Link
                                to={`/waiver/${reg.id}`}
                                className="btn btn-outline btn-sm"
                                target="_blank"
                                title="Open the printable waiver for this participant"
                              >
                                Waiver
                              </Link>
                              <Link
                                to={`/admin/climbs/${reg.climbId}`}
                                className="btn btn-outline btn-sm"
                                title="Go to the climb registrations page"
                              >
                                Climb
                              </Link>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => setEditingReg(reg)}
                                title="Edit this registrant's details"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedId === reg.id && (
                          <tr key={`${reg.id}-detail`}>
                            <td
                              colSpan={8}
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
                                    "repeat(auto-fill, minmax(200px, 1fr))",
                                  gap: "14px 24px",
                                  marginBottom: getPaymentEntries(reg).length
                                    ? 16
                                    : 0,
                                }}
                              >
                                <InfoCell label="Mobile" value={reg.mobile} />
                                <InfoCell
                                  label="Amount Paid"
                                  value={
                                    reg.amountPaid
                                      ? `₱${Number(reg.amountPaid).toLocaleString("en-PH")}`
                                      : null
                                  }
                                />
                                <InfoCell
                                  label="Date of Birth"
                                  value={reg.dateOfBirth}
                                />
                                <InfoCell label="Address" value={reg.address} />
                                <InfoCell
                                  label="Experience"
                                  value={reg.experienceLevel}
                                  capitalize
                                />
                                <InfoCell
                                  label="Emergency Contact"
                                  value={
                                    reg.emergencyContact?.name
                                      ? `${reg.emergencyContact.name} (${reg.emergencyContact.relationship}) — ${reg.emergencyContact.mobile}`
                                      : null
                                  }
                                />
                                <InfoCell
                                  label="Medical"
                                  value={
                                    reg.medicalConditions || "None declared"
                                  }
                                />
                                <InfoCell
                                  label="Waiver Signed As"
                                  value={reg.waiverSignedName}
                                />
                                <InfoCell
                                  label="Waiver Date"
                                  value={reg.waiverSignedAt
                                    ?.toDate?.()
                                    .toLocaleDateString("en-PH")}
                                />
                                {reg.adminNotes && (
                                  <InfoCell
                                    label="Admin Notes"
                                    value={reg.adminNotes}
                                  />
                                )}
                              </div>

                              {/* Fee Breakdown */}
                              <div style={{ marginBottom: 16 }}>
                                <FeeBreakdownTable
                                  reg={reg}
                                  climb={climbById[reg.climbId]}
                                  title="Fee Breakdown (current fees)"
                                />
                              </div>

                              {/* Transportation + required documents */}
                              <div
                                style={{
                                  display: "flex",
                                  gap: 24,
                                  flexWrap: "wrap",
                                  marginBottom: 16,
                                }}
                              >
                                {(() => {
                                  const transpoIdx = (
                                    reg.feeBreakdown || []
                                  ).findIndex((f) => /transport/i.test(f.label));
                                  const climbHasTranspoFee = (
                                    climbById[reg.climbId]?.fees || []
                                  ).some((f) => /transport/i.test(f.label));
                                  if (transpoIdx === -1 && !climbHasTranspoFee)
                                    return null;
                                  const availing =
                                    transpoIdx !== -1
                                      ? reg.feeBreakdown[transpoIdx].selected
                                      : false;
                                  return (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: "0.68rem",
                                          fontWeight: 700,
                                          letterSpacing: 2,
                                          textTransform: "uppercase",
                                          color: "var(--ink-soft)",
                                          marginBottom: 4,
                                        }}
                                      >
                                        Transportation
                                      </div>
                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          cursor: "pointer",
                                          fontSize: "0.85rem",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!availing}
                                          onChange={() => toggleTransportation(reg)}
                                        />
                                        {availing
                                          ? "Availing organized transport"
                                          : "Own transport"}
                                      </label>
                                    </div>
                                  );
                                })()}

                                {(() => {
                                  const climb = climbById[reg.climbId];
                                  if (
                                    !climb?.requiresRegistrationForm &&
                                    !climb?.requiresMedicalCert
                                  )
                                    return null;
                                  return (
                                    <div>
                                      <div
                                        style={{
                                          fontSize: "0.68rem",
                                          fontWeight: 700,
                                          letterSpacing: 2,
                                          textTransform: "uppercase",
                                          color: "var(--ink-soft)",
                                          marginBottom: 4,
                                        }}
                                      >
                                        Required Documents
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 14,
                                          fontSize: "0.82rem",
                                        }}
                                      >
                                        {climb.requiresRegistrationForm && (
                                          reg.registrationFormUpload?.url ? (
                                            <a
                                              href={reg.registrationFormUpload.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ color: "#1a6b2c" }}
                                            >
                                              &#10003; Reg. Form
                                            </a>
                                          ) : (
                                            <span style={{ color: "#b91c1c" }}>
                                              &#10005; Reg. Form Missing
                                            </span>
                                          )
                                        )}
                                        {climb.requiresMedicalCert && (
                                          reg.medicalCertUpload?.url ? (
                                            <a
                                              href={reg.medicalCertUpload.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ color: "#1a6b2c" }}
                                            >
                                              &#10003; Med. Cert
                                            </a>
                                          ) : (
                                            <span style={{ color: "#b91c1c" }}>
                                              &#10005; Med. Cert Missing
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Payment history — one block per submission */}
                              {getPaymentEntries(reg).length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      letterSpacing: 2,
                                      textTransform: "uppercase",
                                      color: "var(--ink-soft)",
                                      marginBottom: 8,
                                    }}
                                  >
                                    Payments (
                                    {getPaymentEntries(reg).length} submission
                                    {getPaymentEntries(reg).length > 1 ? "s" : ""})
                                  </div>
                                  <PaymentHistory
                                    reg={reg}
                                    thumbSize={120}
                                    onEntryStatusChange={changeEntryStatus}
                                  />
                                  <div
                                    style={{
                                      marginTop: 12,
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() =>
                                        changePaymentStatus(reg.id, "verified")
                                      }
                                      disabled={
                                        reg.paymentStatus === "verified"
                                      }
                                    >
                                      &#10003; Verify Payment
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() =>
                                        changePaymentStatus(reg.id, "rejected")
                                      }
                                      disabled={
                                        reg.paymentStatus === "rejected"
                                      }
                                    >
                                      &#10005; Reject Payment
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div
                                style={{
                                  marginTop: 16,
                                  paddingTop: 12,
                                  borderTop: "1px solid var(--border)",
                                }}
                              >
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => deleteRegistration(reg)}
                                >
                                  &#128465; Delete Registration
                                </button>
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

function InfoCell({ label, value, capitalize }) {
  if (!value) return null;
  return (
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
        {label}
      </div>
      <div
        style={{
          fontSize: "0.85rem",
          textTransform: capitalize ? "capitalize" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
