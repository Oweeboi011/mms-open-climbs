import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  getCountFromServer,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { SCHEDULE_2026 } from "@/data/schedule2026";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import DetailCell from "@/components/DetailCell";
import { logFailedRequest } from "@/utils/logFailedRequest";
import { getMissingFields } from "@/utils/climbCompleteness";
import { getFeeSummary } from "@/utils/feeSummary";

function NavIcon({ path, color }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

const NAV_ICON_PATHS = {
  climbs: (
    <path d="M3 20 L9 8 L13 15 L16 10 L21 20 Z" />
  ),
  registrations: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6.5" y1="14.5" x2="10" y2="14.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M15.8 14.7c2.4.3 4.2 2.3 4.2 5.3" />
    </>
  ),
  analytics: (
    <>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </>
  ),
  releaseNotes: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <line x1="7.5" y1="9" x2="16.5" y2="9" />
      <line x1="7.5" y1="12.5" x2="16.5" y2="12.5" />
      <line x1="7.5" y1="16" x2="13" y2="16" />
    </>
  ),
};

const STATUS_LABEL = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  completed: "Completed",
};
const STATUS_COLOR = {
  draft: "#888",
  open: "var(--green-dark)",
  closed: "var(--ink-soft)",
  completed: "#0070E0",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    climbs: 0,
    totalRegs: 0,
    pending: 0,
    users: 0,
    awaitingPayment: 0,
    unpaid: 0,
  });
  const [recentRegs, setRecentRegs] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [climbRegStats, setClimbRegStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSeed() {
    if (
      !window.confirm(
        `Import all ${SCHEDULE_2026.length} climbs from the 2026 schedule? This cannot be undone.`,
      )
    )
      return;
    setSeeding(true);
    setSeedResult("");
    let ok = 0;
    let fail = 0;
    for (const climb of SCHEDULE_2026) {
      try {
        await addDoc(collection(db, "climbs"), {
          ...climb,
          registrationCount: 0,
          createdAt: serverTimestamp(),
        });
        ok++;
      } catch (err) {
        fail++;
        logFailedRequest({
          type: "firestore",
          source: "Dashboard.jsx:seedSchedule",
          message: err?.message,
          path: window.location.pathname,
          userRole: "admin",
        });
      }
    }
    setSeeding(false);
    setSeedResult(
      `Done — ${ok} climbs added${fail ? `, ${fail} failed` : ""}.`,
    );
  }

  useEffect(() => {
    async function loadAll() {
      // Load climbs
      const climbsSnap = await getDocs(
        query(collection(db, "climbs"), orderBy("startDate", "asc")),
      );
      const climbList = climbsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
          const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
          return da - db2;
        });
      setClimbs(climbList);

      // Load all registrations once for per-climb stats
      const regsSnap = await getDocs(collection(db, "registrations"));
      const allRegs = regsSnap.docs.map((d) => d.data());

      // Build per-climb breakdown
      const breakdown = {};
      for (const reg of allRegs) {
        if (!reg.climbId) continue;
        if (!breakdown[reg.climbId]) {
          breakdown[reg.climbId] = {
            total: 0,
            confirmed: 0,
            pending: 0,
            waitlisted: 0,
            cancelled: 0,
            paymentSubmitted: 0,
            paymentUnpaid: 0,
          };
        }
        breakdown[reg.climbId].total++;
        if (reg.status)
          breakdown[reg.climbId][reg.status] =
            (breakdown[reg.climbId][reg.status] || 0) + 1;
        if (reg.paymentStatus === "submitted")
          breakdown[reg.climbId].paymentSubmitted++;
        if (reg.paymentStatus === "unpaid" && reg.status !== "cancelled")
          breakdown[reg.climbId].paymentUnpaid++;
      }
      setClimbRegStats(breakdown);

      // Global stats
      const [totalRegsSnap, pendingSnap, usersSnap, awaitingSnap, unpaidSnap] =
        await Promise.all([
          getCountFromServer(collection(db, "registrations")),
          getCountFromServer(
            query(
              collection(db, "registrations"),
              where("status", "==", "pending"),
            ),
          ),
          getCountFromServer(collection(db, "users")),
          getCountFromServer(
            query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "submitted"),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "unpaid"),
            ),
          ),
        ]);
      setStats({
        climbs: climbList.length,
        totalRegs: totalRegsSnap.data().count,
        pending: pendingSnap.data().count,
        users: usersSnap.data().count,
        awaitingPayment: awaitingSnap.data().count,
        unpaid: unpaidSnap.data().count,
      });
    }

    const q = query(
      collection(db, "registrations"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentRegs(
        snap.docs.slice(0, 20).map((d) => ({ id: d.id, ...d.data() })),
      );
      loadAll().finally(() => setLoading(false));
    });
    return unsub;
  }, []);

  const STATUS_CLASS = {
    pending: "status-pending",
    confirmed: "status-confirmed",
    cancelled: "status-cancelled",
    waitlisted: "status-waitlisted",
  };

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        {/* Page Header */}
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Dashboard</div>
            <div className="admin-page-subtitle">
              MMS Open Climbs 2026 — Admin Portal
            </div>
          </div>
          {!loading && stats.climbs === 0 && (
            <button
              className="btn btn-gold btn-sm"
              onClick={handleSeed}
              disabled={seeding}
              title="One-click import all climbs from the 2026 schedule into Firestore"
            >
              {seeding ? "Importing…" : "⬇ Import 2026 Schedule"}
            </button>
          )}
          {seedResult && (
            <div className="alert alert-success" style={{ marginTop: 10 }}>
              {seedResult}
            </div>
          )}
        </div>

        {/* Admin Nav Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {[
            {
              to: "/admin/climbs",
              label: "Manage Climbs",
              desc: "View, edit, create climbs",
              icon: "climbs",
              color: "var(--green-dark)",
            },
            {
              to: "/admin/registrations",
              label: "Manage Registrations",
              desc: "Review & approve participants",
              icon: "registrations",
              color: "#0070E0",
            },
            {
              to: "/admin/payments",
              label: "Manage Payments",
              desc: "Cash flow, QR & transport per climb",
              icon: "payments",
              color: "#e67e00",
            },
            {
              to: "/admin/users",
              label: "Manage Users",
              desc: "Admin & member accounts",
              icon: "users",
              color: "#7b2d8b",
            },
            {
              to: "/admin/analytics",
              label: "Analytics",
              desc: "Site visits & event views",
              icon: "analytics",
              color: "#e74c3c",
            },
            {
              to: "/admin/release-notes",
              label: "Release Notes",
              desc: "Publish updates & email members",
              icon: "releaseNotes",
              color: "#0d2b12",
            },
          ].map(({ to, label, desc, icon, color }) => (
            <Link
              key={to}
              to={to}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                textDecoration: "none",
                color: "var(--ink)",
                transition: "box-shadow 0.15s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 4px 16px rgba(0,0,0,0.12)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")
              }
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <NavIcon path={NAV_ICON_PATHS[icon]} color={color} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.9rem", color }}>
                  {label}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {desc}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Global Stats */}
            <div className="admin-stats" style={{ marginBottom: 28 }}>
              <Link
                to="/admin/climbs"
                className="admin-stat-card"
                style={{ textDecoration: "none" }}
              >
                <div className="admin-stat-num">{stats.climbs}</div>
                <div className="admin-stat-label">Total Climbs</div>
              </Link>
              <Link
                to="/admin/registrations"
                className="admin-stat-card accent"
                style={{ textDecoration: "none" }}
              >
                <div className="admin-stat-num">{stats.totalRegs}</div>
                <div className="admin-stat-label">Registrations</div>
              </Link>
              <Link
                to="/admin/registrations?filter=payment"
                className="admin-stat-card gold"
                style={{ textDecoration: "none" }}
              >
                <div className="admin-stat-num">{stats.awaitingPayment}</div>
                <div className="admin-stat-label">Awaiting Payment Review</div>
              </Link>
              <Link
                to="/admin/registrations?filter=unpaid"
                className="admin-stat-card danger"
                style={{ textDecoration: "none" }}
              >
                <div className="admin-stat-num">{stats.unpaid}</div>
                <div className="admin-stat-label">Unpaid Registrations</div>
              </Link>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.pending}</div>
                <div className="admin-stat-label">Pending Confirmation</div>
              </div>
            </div>

            {/* Climbs Overview Table */}
            <div className="admin-section-bar">
              <span className="admin-section-label">Climbs Overview</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    setExpandedIds((prev) =>
                      prev.size === climbs.length
                        ? new Set()
                        : new Set(climbs.map((c) => c.id)),
                    )
                  }
                >
                  {expandedIds.size === climbs.length && climbs.length > 0
                    ? "Collapse All"
                    : "Expand All"}
                </button>
                <Link to="/admin/climbs" className="btn btn-outline btn-sm">
                  Manage Climbs
                </Link>
              </div>
            </div>
            <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Climb</th>
                    <th style={{ width: "1%" }}>Date</th>
                    <th style={{ width: "1%" }}>Status</th>
                    <th style={{ textAlign: "center", width: "1%" }}>Slots</th>
                    <th
                      style={{ textAlign: "center", width: "1%" }}
                      title="Confirmed · Pending · Unpaid"
                    >
                      Reg. (C&middot;P&middot;U)
                    </th>
                    <th style={{ width: "1%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {climbs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        No climbs yet.
                      </td>
                    </tr>
                  ) : (
                    climbs.map((climb) => {
                      const s = climbRegStats[climb.id] || {};
                      const total = s.total || 0;
                      const max = climb.maxParticipants ?? null;
                      const slotsLeft =
                        max != null ? max - (s.confirmed || 0) : null;
                      const isFull = slotsLeft != null && slotsLeft <= 0;
                      const missing = getMissingFields(climb);
                      const isOpen = expandedIds.has(climb.id);
                      return (
                        <React.Fragment key={climb.id}>
                        <tr>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpanded(climb.id)}
                                aria-label={
                                  isOpen ? "Collapse details" : "Expand details"
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 1,
                                  color: "var(--ink-soft)",
                                  fontSize: "0.75rem",
                                  lineHeight: 1,
                                  transform: isOpen
                                    ? "rotate(90deg)"
                                    : "none",
                                  transition: "transform 0.15s",
                                }}
                              >
                                &#9656;
                              </button>
                              <span style={{ fontWeight: 700 }}>
                                {climb.title}
                              </span>
                              {climb.type && (
                                <span
                                  style={{
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    color: "var(--ink-soft)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    padding: "1px 6px",
                                  }}
                                >
                                  {climb.type}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                {climb.location}
                              </span>
                              {missing.length > 0 && (
                                <span
                                  title={`Missing: ${missing.join(", ")}`}
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "#b45309",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  &#9888; {missing.length} missing
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {climb.dateLabel || "—"}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 99,
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                background:
                                  climb.status === "open"
                                    ? "#e6f4ec"
                                    : "var(--surface-alt)",
                                color:
                                  STATUS_COLOR[climb.status] ||
                                  "var(--ink-soft)",
                                border: `1px solid ${STATUS_COLOR[climb.status] || "var(--border)"}22`,
                              }}
                            >
                              {STATUS_LABEL[climb.status] || climb.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontWeight: 700 }}>{total}</span>
                            {max && (
                              <span
                                style={{
                                  color: "var(--ink-soft)",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {" "}
                                / {max}
                              </span>
                            )}
                            {isFull && (
                              <span
                                className="status-badge status-closed"
                                style={{ marginLeft: 6, fontSize: "0.65rem" }}
                              >
                                Full
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              title="Confirmed"
                              style={{
                                fontWeight: 700,
                                color: "var(--green-dark)",
                              }}
                            >
                              {s.confirmed || 0}
                            </span>
                            <span style={{ color: "var(--border)", margin: "0 4px" }}>
                              &middot;
                            </span>
                            <span
                              title="Pending"
                              style={{ fontWeight: 700, color: "#e67e00" }}
                            >
                              {s.pending || 0}
                            </span>
                            <span style={{ color: "var(--border)", margin: "0 4px" }}>
                              &middot;
                            </span>
                            <span
                              title="Unpaid"
                              style={{ fontWeight: 700, color: "#b91c1c" }}
                            >
                              {s.paymentUnpaid || 0}
                            </span>
                          </td>
                          <td>
                            <div className="admin-table-actions">
                              <Link
                                to={`/admin/climbs/${climb.id}`}
                                className="btn btn-outline btn-sm"
                                title="View and manage all registrations for this climb"
                              >
                                Registrants
                              </Link>
                              <Link
                                to={`/admin/climbs/${climb.id}/edit`}
                                className="btn btn-accent btn-sm"
                                title="Edit climb details, officers, and settings"
                              >
                                Edit
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td
                              colSpan={6}
                              style={{
                                background: "var(--surface)",
                                padding: "8px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fill, minmax(150px, 1fr))",
                                  gap: "6px 16px",
                                  marginBottom: 8,
                                }}
                              >
                                <DetailCell
                                  label="Jump-off Point"
                                  value={climb.jumpOff}
                                />
                                <DetailCell
                                  label="Distance to Summit"
                                  value={climb.distanceToSummit}
                                />
                                <DetailCell
                                  label="Elevation Gain"
                                  value={climb.elevationGain}
                                />
                                <DetailCell
                                  label="Recommended Days"
                                  value={climb.recommendedDays}
                                />
                                <DetailCell
                                  label="Climb Officers"
                                  value={
                                    climb.officers?.length
                                      ? climb.officers
                                          .map((o) =>
                                            o.role
                                              ? `${o.name} (${o.role})`
                                              : o.name,
                                          )
                                          .join(", ")
                                      : null
                                  }
                                />
                                <DetailCell
                                  label="Itinerary Days"
                                  value={
                                    climb.itinerary?.length
                                      ? `${climb.itinerary.length} day(s) set`
                                      : null
                                  }
                                />
                                <DetailCell
                                  label="Expenses"
                                  value={getFeeSummary(climb)}
                                />
                                <DetailCell
                                  label="Trail Photos"
                                  value={
                                    climb.trailImages?.length
                                      ? `${climb.trailImages.length} photo(s)`
                                      : null
                                  }
                                />
                                <DetailCell
                                  label="GCash Details"
                                  value={
                                    climb.gcashQrUrl ||
                                    climb.gcashName ||
                                    climb.gcashNumber
                                      ? [climb.gcashName, climb.gcashNumber]
                                          .filter(Boolean)
                                          .join(" — ") || "QR uploaded"
                                      : null
                                  }
                                />
                              </div>

                              <div
                                style={{
                                  fontSize: "0.6rem",
                                  fontWeight: 700,
                                  letterSpacing: 1.2,
                                  textTransform: "uppercase",
                                  color: "var(--ink-soft)",
                                  marginBottom: 4,
                                }}
                              >
                                Completeness Check
                              </div>
                              {missing.length === 0 ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: 20,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    background: "#e8f5e9",
                                    color: "#1a6b2c",
                                    border: "1px solid #a7d7b2",
                                  }}
                                >
                                  &#10003; All details complete
                                </span>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 4,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {missing.map((label) => (
                                    <span
                                      key={label}
                                      style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        borderRadius: 20,
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        background: "#fce8e8",
                                        color: "#b91c1c",
                                        border: "1px solid #fca5a5",
                                      }}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent Registrations */}
            <div className="admin-section-bar">
              <span className="admin-section-label">Recent Registrations</span>
              <Link
                to="/admin/registrations"
                className="btn btn-outline btn-sm"
              >
                View All
              </Link>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Climb</th>
                    <th style={{ width: "1%" }}>Payment</th>
                    <th style={{ width: "1%" }}>Status</th>
                    <th style={{ width: "1%" }}>Date</th>
                    <th style={{ width: "1%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRegs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        No registrations yet.
                      </td>
                    </tr>
                  ) : (
                    recentRegs.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <div className="admin-table-name">{reg.name}</div>
                          <div className="admin-table-sub">{reg.email}</div>
                        </td>
                        <td>{reg.climbTitle}</td>
                        <td>
                          {reg.paymentStatus ? (
                            <span
                              className={`status-badge status-payment-${reg.paymentStatus}`}
                            >
                              {reg.paymentStatus}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--ink-soft)",
                                fontSize: "0.78rem",
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${STATUS_CLASS[reg.status] || ""}`}
                          >
                            {reg.status}
                          </span>
                        </td>
                        <td className="admin-table-date">
                          {reg.createdAt
                            ?.toDate?.()
                            .toLocaleDateString("en-PH") || "—"}
                        </td>
                        <td>
                          <Link
                            to={`/admin/climbs/${reg.climbId}`}
                            className="btn btn-outline btn-sm"
                            title="View all registrations for this climb"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
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
