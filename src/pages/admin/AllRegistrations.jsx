import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_OPTIONS = ["pending", "confirmed", "waitlisted", "cancelled"];
const STATUS_CLASS = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  cancelled: "status-cancelled",
  waitlisted: "status-waitlisted",
};
const PAYMENT_CLASS = {
  submitted: "status-pending",
  verified: "status-confirmed",
  rejected: "status-cancelled",
};

export default function AllRegistrations() {
  const [searchParams] = useSearchParams();
  const [regs, setRegs] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClimb, setFilterClimb] = useState(searchParams.get("climb") || "all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState(searchParams.get("filter") === "payment" ? "submitted" : "all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    // Load all climbs for the filter dropdown
    getDocs(collection(db, "climbs")).then((snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, title: d.data().title, dateLabel: d.data().dateLabel }))
        .sort((a, b) => a.title.localeCompare(b.title));
      setClimbs(list);
    });

    const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
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
  }

  async function changePaymentStatus(regId, paymentStatus) {
    await updateDoc(doc(db, "registrations", regId), {
      paymentStatus,
      updatedAt: serverTimestamp(),
    });
  }

  const filtered = useMemo(() => {
    return regs.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.climbTitle?.toLowerCase().includes(q);
      const matchClimb = filterClimb === "all" || r.climbId === filterClimb;
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchPayment = filterPayment === "all" || r.paymentStatus === filterPayment;
      return matchSearch && matchClimb && matchStatus && matchPayment;
    });
  }, [regs, search, filterClimb, filterStatus, filterPayment]);

  const stats = useMemo(() => ({
    total: regs.length,
    pending: regs.filter((r) => r.status === "pending").length,
    confirmed: regs.filter((r) => r.status === "confirmed").length,
    paymentPending: regs.filter((r) => r.paymentStatus === "submitted" && r.status === "pending").length,
  }), [regs]);

  function exportCSV() {
    const headers = [
      "#", "Name", "Email", "Mobile", "Climb", "Climb Date",
      "Experience", "Participant Type", "Status", "Payment Status",
      "Waiver Signed As", "Registered", "Admin Notes",
    ];
    const rows = filtered.map((r, i) => [
      i + 1, r.name, r.email, r.mobile || "",
      r.climbTitle || "", r.climbDate || "",
      r.experienceLevel || "", r.memberType || "",
      r.status, r.paymentStatus || "",
      r.waiverSignedName || "",
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
    a.download = "all-registrations.csv";
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
            <div className="admin-page-subtitle">Across all climbs</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>
            &#128229; Export CSV
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
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
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
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
                    {c.title}{c.dateLabel ? ` — ${c.dateLabel}` : ""}
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
                  <option key={s} value={s}>{s}</option>
                ))}
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
              Showing {filtered.length} of {regs.length} registrations
            </div>

            {/* Table */}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Participant</th>
                    <th>Climb</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)", padding: "32px 0" }}>
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => (
                      <React.Fragment key={reg.id}>
                        <tr
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedId((p) => (p === reg.id ? null : reg.id))}
                        >
                          <td style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>{idx + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{reg.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{reg.email}</div>
                            {reg.memberType && (
                              <div style={{ fontSize: "0.68rem", color: "var(--ink-soft)", marginTop: 1, textTransform: "capitalize" }}>
                                {reg.memberType === "member" ? "MMS Member" : "Joiner"}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{reg.climbTitle || "—"}</div>
                            {reg.climbDate && (
                              <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>{reg.climbDate}</div>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {reg.paymentStatus ? (
                              <select
                                className="form-select"
                                style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                                value={reg.paymentStatus}
                                onChange={(e) => changePaymentStatus(reg.id, e.target.value)}
                              >
                                <option value="submitted">Submitted</option>
                                <option value="verified">Verified</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>—</span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="form-select"
                              style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                              value={reg.status}
                              onChange={(e) => changeStatus(reg.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                            {reg.createdAt?.toDate?.().toLocaleDateString("en-PH") || "—"}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Link
                                to={`/waiver/${reg.id}`}
                                className="btn btn-outline btn-sm"
                                target="_blank"
                              >
                                Waiver
                              </Link>
                              <Link
                                to={`/admin/climbs/${reg.climbId}`}
                                className="btn btn-outline btn-sm"
                              >
                                Climb
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expandedId === reg.id && (
                          <tr key={`${reg.id}-detail`}>
                            <td
                              colSpan={7}
                              style={{ background: "var(--surface)", padding: "16px 20px", borderBottom: "2px solid var(--border)" }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                  gap: "14px 24px",
                                  marginBottom: reg.paymentProofs?.length ? 16 : 0,
                                }}
                              >
                                <InfoCell label="Mobile" value={reg.mobile} />
                                <InfoCell label="Date of Birth" value={reg.dateOfBirth} />
                                <InfoCell label="Address" value={reg.address} />
                                <InfoCell label="Experience" value={reg.experienceLevel} capitalize />
                                <InfoCell
                                  label="Emergency Contact"
                                  value={
                                    reg.emergencyContact?.name
                                      ? `${reg.emergencyContact.name} (${reg.emergencyContact.relationship}) — ${reg.emergencyContact.mobile}`
                                      : null
                                  }
                                />
                                <InfoCell label="Medical" value={reg.medicalConditions || "None declared"} />
                                <InfoCell label="Waiver Signed As" value={reg.waiverSignedName} />
                                <InfoCell
                                  label="Waiver Date"
                                  value={reg.waiverSignedAt?.toDate?.().toLocaleDateString("en-PH")}
                                />
                                {reg.adminNotes && (
                                  <InfoCell label="Admin Notes" value={reg.adminNotes} />
                                )}
                              </div>

                              {/* Payment proof attachments */}
                              {reg.paymentProofs?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                                    Proof of Payment ({reg.paymentProofs.length} file{reg.paymentProofs.length > 1 ? "s" : ""})
                                  </div>
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    {reg.paymentProofs.map((proof, i) => (
                                      <a
                                        key={i}
                                        href={proof.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: "block", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", textDecoration: "none" }}
                                      >
                                        {proof.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                          <img
                                            src={proof.url}
                                            alt={proof.fileName}
                                            style={{ width: 120, height: 120, objectFit: "cover", display: "block" }}
                                          />
                                        ) : (
                                          <div style={{ width: 120, height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--surface-alt)" }}>
                                            <span style={{ fontSize: "2rem" }}>&#128196;</span>
                                            <span style={{ fontSize: "0.65rem", color: "var(--ink-soft)" }}>PDF</span>
                                          </div>
                                        )}
                                        <div style={{ fontSize: "0.65rem", color: "var(--ink-soft)", padding: "4px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {proof.fileName || `File ${i + 1}`}
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => changePaymentStatus(reg.id, "verified")}
                                      disabled={reg.paymentStatus === "verified"}
                                    >
                                      &#10003; Verify Payment
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => changePaymentStatus(reg.id, "rejected")}
                                      disabled={reg.paymentStatus === "rejected"}
                                    >
                                      &#10005; Reject Payment
                                    </button>
                                  </div>
                                </div>
                              )}
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

function InfoCell({ label, value, capitalize }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: "0.85rem", textTransform: capitalize ? "capitalize" : undefined }}>
        {value}
      </div>
    </div>
  );
}
