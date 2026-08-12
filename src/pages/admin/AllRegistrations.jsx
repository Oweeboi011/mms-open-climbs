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
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import FeeBreakdownTable from "@/components/FeeBreakdownTable";
import { detailsIncomplete } from "@/components/DetailsPrompt";
import PaymentHistory from "@/components/admin/PaymentHistory";
import RecordPaymentModal from "@/components/admin/RecordPaymentModal";
import { logAuditEvent } from "@/utils/auditLog";
import { recordManualPayment } from "@/utils/recordPayment";
import {
  getPaymentEntries,
  setEntryStatus,
  setAllEntryStatuses,
} from "@/utils/payments";
import {
  getOutstanding,
  toggleOptionalFeeEntry,
  getServicesForRegistrant,
  isAvailing,
  describeMemberTypeChange,
} from "@/utils/registrationFees";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import {
  StatusBadge,
  InfoCell,
  ComplianceCheck,
  SectionLabel,
  PAYMENT_STYLE,
  STATUS_STYLE,
  EXPERIENCE_LABELS,
} from "@/components/admin/registrantShared";

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
  const [recordingPaymentFor, setRecordingPaymentFor] = useState(null);

  const [scope, setScope] = useState("active");

  useEffect(() => {
    // Climbs feed the filter dropdown and every per-registration lookup (fee
    // schedule + required-document flags). Kept live so a fee edited on the
    // climb shows up in each registrant's breakdown without a reload.
    const unsubClimbs = onSnapshot(collection(db, "climbs"), (snap) => {
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
    return () => {
      unsubClimbs();
      unsub();
    };
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
  // Who's making the verdict, stamped onto each payment it touches.
  function reviewer() {
    return {
      uid: currentUser?.uid,
      name: currentUser?.displayName || currentUser?.email || "admin",
      at: Timestamp.now(),
    };
  }

  async function changePaymentStatus(regId, paymentStatus) {
    const reg = regs.find((r) => r.id === regId);
    await updateDoc(doc(db, "registrations", regId), {
      ...setAllEntryStatuses(reg || {}, paymentStatus, reviewer()),
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
      ...setEntryStatus(reg, index, status, reviewer()),
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

  // Toggle whether a registrant is availing one of the climb's optional
  // services (transportation, porter, …) directly from the row. Falls back to
  // the climb's fee schedule when the registrant's own feeBreakdown snapshot
  // doesn't have that line item yet, so the toggle works for everyone on a
  // climb that offers the service, not just those who registered after it
  // was added.
  async function toggleOptionalFee(reg, label) {
    const climb = climbs.find((c) => c.id === reg.climbId);
    const updated = toggleOptionalFeeEntry(reg, climb, label);
    if (!updated) return;
    const nowSelected = updated.find((f) => f.label === label)?.selected;
    await updateDoc(doc(db, "registrations", reg.id), {
      feeBreakdown: updated,
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "optional_fee_toggled",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `${label} set to ${nowSelected ? "availing" : "not availing"}`,
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
      details: describeMemberTypeChange(reg, patch).trim(),
    });
    setEditingReg(null);
  }

  const climbById = useMemo(() => {
    const map = {};
    for (const c of climbs) map[c.id] = c;
    return map;
  }, [climbs]);

  // Money handed over in person still has to land in the same history as an
  // in-app GCash submission, from whichever page the admin happens to be on.
  async function recordPayment(reg, entry) {
    await recordManualPayment(reg, entry, {
      currentUser,
      climbTitle: climbById[reg.climbId]?.title || reg.climbTitle,
    });
    setRecordingPaymentFor(null);
  }
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
      return (
        matchSearch && matchClimb && matchStatus && matchPayment && matchDocs
      );
    });
  }, [
    scoped,
    search,
    filterClimb,
    filterStatus,
    filterPayment,
    filterDocs,
    climbById,
  ]);

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
            <ResponsiveTable>
              <table className="admin-table table-min-900">
                <thead>
                  <tr>
                    <th style={{ minWidth: 40 }}>#</th>
                    <th>Participant</th>
                    <th>Climb</th>
                    <th>Compliance</th>
                    <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>
                      Payment
                    </th>
                    <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>
                      Status
                    </th>
                    <th style={{ minWidth: 130, whiteSpace: "nowrap" }}>
                      Actions
                    </th>
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
                          padding: "32px 0",
                        }}
                      >
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => {
                      const climb = climbById[reg.climbId];
                      const outstanding = getOutstanding(reg, climb);
                      const hasWaiver = !!reg.waiverSignedName;
                      const hasForm =
                        !climb?.requiresRegistrationForm ||
                        !!reg.registrationFormUpload?.url;
                      const hasMedCert =
                        !climb?.requiresMedicalCert ||
                        !!reg.medicalCertUpload?.url;
                      // An admin-added participant starts with no waiver and
                      // no details, so both gaps have to show here.
                      const hasDetails = !detailsIncomplete(reg);
                      const allCompliant =
                        hasWaiver && hasForm && hasMedCert && hasDetails;

                      return (
                        <React.Fragment key={reg.id}>
                          <tr
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              setExpandedId((p) =>
                                p === reg.id ? null : reg.id,
                              )
                            }
                          >
                            {/* # */}
                            <td
                              style={{
                                color: "var(--ink-soft)",
                                fontSize: "0.74rem",
                                fontFamily: "var(--font-head)",
                                fontWeight: 600,
                              }}
                            >
                              {idx + 1}
                            </td>

                            {/* Participant */}
                            <td>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.84rem",
                                }}
                              >
                                {reg.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--ink-soft)",
                                  marginTop: 1,
                                }}
                              >
                                {reg.email}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 5,
                                  marginTop: 4,
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                }}
                              >
                                {reg.memberType && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                      fontSize: "0.58rem",
                                      fontWeight: 700,
                                      letterSpacing: 0.5,
                                      textTransform: "uppercase",
                                      background:
                                        reg.memberType === "member"
                                          ? "#e8f5e9"
                                          : "#fff3e0",
                                      color:
                                        reg.memberType === "member"
                                          ? "#1a6b2c"
                                          : "#c05c00",
                                      border: "1px solid",
                                      borderColor:
                                        reg.memberType === "member"
                                          ? "#a7d7b2"
                                          : "#ffd399",
                                      borderRadius: 99,
                                      padding: "1px 8px",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {reg.memberType === "member"
                                      ? "\u2605 Member"
                                      : "\u2606 Joiner"}
                                  </span>
                                )}
                                {reg.experienceLevel && (
                                  <span
                                    style={{
                                      fontSize: "0.56rem",
                                      fontWeight: 600,
                                      color: "var(--ink-soft)",
                                      textTransform: "uppercase",
                                      letterSpacing: 0.5,
                                    }}
                                  >
                                    {EXPERIENCE_LABELS[reg.experienceLevel] ||
                                      reg.experienceLevel}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Climb */}
                            <td>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.82rem",
                                }}
                              >
                                {reg.climbTitle || "\u2014"}
                              </div>
                              {reg.climbDate && (
                                <div
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "var(--ink-soft)",
                                    marginTop: 1,
                                  }}
                                >
                                  {reg.climbDate}
                                </div>
                              )}
                            </td>

                            {/* Compliance */}
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                <ComplianceCheck
                                  ok={hasWaiver}
                                  label="Waiver"
                                />
                                <ComplianceCheck
                                  ok={hasDetails}
                                  label="Details"
                                />
                                {climb?.requiresRegistrationForm && (
                                  <ComplianceCheck
                                    ok={!!reg.registrationFormUpload?.url}
                                    label="Form"
                                    href={
                                      reg.registrationFormUpload?.url ||
                                      undefined
                                    }
                                  />
                                )}
                                {climb?.requiresMedicalCert && (
                                  <ComplianceCheck
                                    ok={!!reg.medicalCertUpload?.url}
                                    label="Med Cert"
                                    href={
                                      reg.medicalCertUpload?.url || undefined
                                    }
                                  />
                                )}
                                {!allCompliant && (
                                  <span
                                    style={{
                                      fontSize: "0.62rem",
                                      color: "#b91c1c",
                                      fontWeight: 700,
                                    }}
                                    title="One or more required items are missing"
                                  >
                                    &#9888;
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Payment */}
                            <td>
                              <StatusBadge
                                status={reg.paymentStatus}
                                styleMap={PAYMENT_STYLE}
                              />
                              {outstanding > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.66rem",
                                    fontWeight: 700,
                                    color: "#b91c1c",
                                    marginTop: 3,
                                    fontFamily: "var(--font-head)",
                                  }}
                                >
                                  &#8369;
                                  {outstanding.toLocaleString("en-PH")} due
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td>
                              <StatusBadge
                                status={reg.status}
                                styleMap={STATUS_STYLE}
                              />
                            </td>

                            {/* Actions */}
                            <td onClick={(e) => e.stopPropagation()}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 5,
                                  flexWrap: "nowrap",
                                }}
                              >
                                <Link
                                  to={`/admin/climbs/${reg.climbId}`}
                                  className="btn btn-outline btn-sm"
                                  title="Go to the climb registrations page"
                                >
                                  View
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

                          {/* ── Expanded detail panel ── */}
                          {expandedId === reg.id && (
                            <tr key={`${reg.id}-detail`}>
                              <td
                                colSpan={7}
                                style={{
                                  background: "var(--green-pale)",
                                  padding: "16px 20px",
                                  borderBottom: "2px solid var(--border)",
                                  borderLeft: "3px solid var(--green-light)",
                                }}
                              >
                                {/* ── Quick actions bar ── */}
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 16,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    marginBottom: 14,
                                    paddingBottom: 10,
                                    borderBottom: "1px solid var(--border)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.64rem",
                                        fontWeight: 700,
                                        letterSpacing: 2,
                                        textTransform: "uppercase",
                                        color: "var(--ink-soft)",
                                      }}
                                    >
                                      Status
                                    </span>
                                    <select
                                      className="form-select"
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "0.75rem",
                                        width: "auto",
                                      }}
                                      value={reg.status}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        changeStatus(reg.id, e.target.value);
                                      }}
                                    >
                                      {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.64rem",
                                        fontWeight: 700,
                                        letterSpacing: 2,
                                        textTransform: "uppercase",
                                        color: "var(--ink-soft)",
                                      }}
                                    >
                                      Payment
                                    </span>
                                    <select
                                      className="form-select"
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "0.75rem",
                                        width: "auto",
                                      }}
                                      value={reg.paymentStatus || "unpaid"}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        changePaymentStatus(
                                          reg.id,
                                          e.target.value,
                                        );
                                      }}
                                    >
                                      <option value="unpaid">Unpaid</option>
                                      <option value="submitted">
                                        Submitted
                                      </option>
                                      <option value="verified">Verified</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                  </div>
                                  <div
                                    style={{
                                      marginLeft: "auto",
                                      display: "flex",
                                      gap: 6,
                                    }}
                                  >
                                    <button
                                      className="btn btn-outline btn-sm"
                                      title="Log a payment received outside the app (cash on-site, bank transfer) — it's added to this registrant's history and total"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRecordingPaymentFor(reg);
                                      }}
                                    >
                                      + Record Payment
                                    </button>
                                    <Link
                                      to={`/waiver/${reg.id}`}
                                      className="btn btn-outline btn-sm"
                                      target="_blank"
                                      title="Open the printable waiver"
                                    >
                                      &#128196; Waiver
                                    </Link>
                                    <Link
                                      to={`/admin/climbs/${reg.climbId}`}
                                      className="btn btn-outline btn-sm"
                                      title="Go to the climb detail page"
                                    >
                                      &#9968; Climb
                                    </Link>
                                  </div>
                                </div>

                                {/* ── Participant Details ── */}
                                <SectionLabel>
                                  &#128203; Participant Details
                                </SectionLabel>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: "10px 20px",
                                    marginBottom: 16,
                                  }}
                                >
                                  <InfoCell label="Mobile" value={reg.mobile} />
                                  <InfoCell
                                    label="Date of Birth"
                                    value={reg.dateOfBirth}
                                  />
                                  <InfoCell
                                    label="Address"
                                    value={reg.address}
                                  />
                                  <InfoCell
                                    label="Experience"
                                    value={reg.experienceLevel}
                                    capitalize
                                  />
                                  <InfoCell
                                    label="Registered"
                                    value={reg.createdAt
                                      ?.toDate?.()
                                      .toLocaleDateString("en-PH")}
                                  />
                                  <InfoCell
                                    label="Emergency Contact"
                                    value={
                                      reg.emergencyContact?.name
                                        ? `${reg.emergencyContact.name} (${reg.emergencyContact.relationship}) \u2014 ${reg.emergencyContact.mobile}`
                                        : "Not provided yet"
                                    }
                                  />
                                  {/* Never "None declared" for a blank:
                                      nothing was declared either way. */}
                                  <InfoCell
                                    label="Medical"
                                    value={
                                      reg.medicalConditions || "Not provided yet"
                                    }
                                  />
                                </div>

                                {/* ── Waiver ── */}
                                <SectionLabel>
                                  {hasWaiver ? "\u2713" : "\u26A0"} Waiver
                                </SectionLabel>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: "10px 20px",
                                    marginBottom: 16,
                                  }}
                                >
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
                                </div>

                                {/* ── Optional Services ── */}
                                {getServicesForRegistrant(reg, climb).length > 0 && (
                                  <>
                                    <SectionLabel>
                                      Optional Services
                                    </SectionLabel>
                                    <div style={{ marginBottom: 16 }}>
                                      {getServicesForRegistrant(reg, climb).map((svc) => {
                                        const availing = isAvailing(
                                          reg,
                                          svc.label,
                                        );
                                        return (
                                          <label
                                            key={svc.label}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              cursor: "pointer",
                                              fontSize: "0.85rem",
                                              marginBottom: 4,
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={availing}
                                              onChange={() =>
                                                toggleOptionalFee(
                                                  reg,
                                                  svc.label,
                                                )
                                              }
                                            />
                                            {availing
                                              ? `Availing ${svc.label}`
                                              : `Not availing ${svc.label}`}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}

                                {/* ── Required Documents ── */}
                                {(climb?.requiresRegistrationForm ||
                                  climb?.requiresMedicalCert) && (
                                  <>
                                    <SectionLabel>
                                      &#128196; Required Documents
                                    </SectionLabel>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        marginBottom: 16,
                                      }}
                                    >
                                      {climb.requiresRegistrationForm && (
                                        <ComplianceCheck
                                          ok={!!reg.registrationFormUpload?.url}
                                          label={
                                            reg.registrationFormUpload?.url
                                              ? "Reg. Form Uploaded"
                                              : "Reg. Form Missing"
                                          }
                                          href={
                                            reg.registrationFormUpload?.url ||
                                            undefined
                                          }
                                        />
                                      )}
                                      {climb.requiresMedicalCert && (
                                        <ComplianceCheck
                                          ok={!!reg.medicalCertUpload?.url}
                                          label={
                                            reg.medicalCertUpload?.url
                                              ? "Med. Cert Uploaded"
                                              : "Med. Cert Missing"
                                          }
                                          href={
                                            reg.medicalCertUpload?.url ||
                                            undefined
                                          }
                                        />
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* ── Fee Breakdown ── */}
                                <SectionLabel>
                                  &#128179; Fee Breakdown
                                </SectionLabel>
                                <div style={{ marginBottom: 16 }}>
                                  <FeeBreakdownTable
                                    reg={reg}
                                    climb={climb}
                                    title={null}
                                  />
                                </div>

                                {/* ── Payment History ── */}
                                {getPaymentEntries(reg).length > 0 && (
                                  <>
                                    <SectionLabel>
                                      &#128176; Payments (
                                      {getPaymentEntries(reg).length} submission
                                      {getPaymentEntries(reg).length > 1
                                        ? "s"
                                        : ""}
                                      )
                                    </SectionLabel>
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
                                          changePaymentStatus(
                                            reg.id,
                                            "verified",
                                          )
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
                                          changePaymentStatus(
                                            reg.id,
                                            "rejected",
                                          )
                                        }
                                        disabled={
                                          reg.paymentStatus === "rejected"
                                        }
                                      >
                                        &#10005; Reject Payment
                                      </button>
                                    </div>
                                  </>
                                )}

                                {/* ── Admin Notes ── */}
                                {reg.adminNotes && (
                                  <>
                                    <SectionLabel>
                                      &#128221; Admin Notes
                                    </SectionLabel>
                                    <div
                                      style={{
                                        fontSize: "0.82rem",
                                        padding: "8px 12px",
                                        background: "rgba(255,255,255,0.7)",
                                        borderRadius: 8,
                                        borderLeft: "3px solid var(--gold)",
                                        marginBottom: 16,
                                      }}
                                    >
                                      {reg.adminNotes}
                                    </div>
                                  </>
                                )}

                                {/* ── Danger zone ── */}
                                <div
                                  style={{
                                    marginTop: 8,
                                    paddingTop: 12,
                                    borderTop: "1px solid var(--border)",
                                    display: "flex",
                                    justifyContent: "flex-end",
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </ResponsiveTable>
          </>
        )}
      </main>

      {editingReg && (
        <EditRegistrationModal
          reg={editingReg}
          climb={climbById[editingReg.climbId]}
          onClose={() => setEditingReg(null)}
          onSave={saveRegistrationEdit}
        />
      )}

      {recordingPaymentFor && (
        <RecordPaymentModal
          reg={recordingPaymentFor}
          onClose={() => setRecordingPaymentFor(null)}
          onSave={recordPayment}
        />
      )}

      <Footer />
    </div>
  );
}
