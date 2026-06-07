import { useState, useEffect } from "react";
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
  });
  const [recentRegs, setRecentRegs] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [climbRegStats, setClimbRegStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState("");

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
      } catch {
        fail++;
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
          };
        }
        breakdown[reg.climbId].total++;
        if (reg.status)
          breakdown[reg.climbId][reg.status] =
            (breakdown[reg.climbId][reg.status] || 0) + 1;
        if (reg.paymentStatus === "submitted")
          breakdown[reg.climbId].paymentSubmitted++;
      }
      setClimbRegStats(breakdown);

      // Global stats
      const [totalRegsSnap, pendingSnap, usersSnap, awaitingSnap] =
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
        ]);
      setStats({
        climbs: climbList.length,
        totalRegs: totalRegsSnap.data().count,
        pending: pendingSnap.data().count,
        users: usersSnap.data().count,
        awaitingPayment: awaitingSnap.data().count,
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
              icon: "⛰",
              color: "var(--green-dark)",
            },
            {
              to: "/admin/registrations",
              label: "Manage Registrations",
              desc: "Review & approve participants",
              icon: "📋",
              color: "#0070E0",
            },
            {
              to: "/admin/payments",
              label: "Manage Payments",
              desc: "Cash flow, QR & transport per climb",
              icon: "💳",
              color: "#e67e00",
            },
            {
              to: "/admin/users",
              label: "Manage Users",
              desc: "Admin & member accounts",
              icon: "👥",
              color: "#7b2d8b",
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
              <div style={{ fontSize: "1.8rem", lineHeight: 1, flexShrink: 0 }}>
                {icon}
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
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.pending}</div>
                <div className="admin-stat-label">Pending Confirmation</div>
              </div>
            </div>

            {/* Climbs Overview Table */}
            <div className="admin-section-bar">
              <span className="admin-section-label">Climbs Overview</span>
              <Link to="/admin/climbs" className="btn btn-outline btn-sm">
                Manage Climbs
              </Link>
            </div>
            <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Climb</th>
                    <th style={{ width: "1%" }}>Date</th>
                    <th style={{ width: "1%" }}>Type</th>
                    <th style={{ width: "1%" }}>Status</th>
                    <th style={{ textAlign: "center", width: "1%" }}>Slots</th>
                    <th style={{ textAlign: "center", width: "1%" }}>
                      Confirmed
                    </th>
                    <th style={{ textAlign: "center", width: "1%" }}>
                      Pending
                    </th>
                    <th>Officers</th>
                    <th style={{ width: "1%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {climbs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="admin-table-empty">
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
                      return (
                        <tr key={climb.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{climb.title}</div>
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--ink-soft)",
                              }}
                            >
                              {climb.location}
                            </div>
                          </td>
                          <td
                            style={{
                              whiteSpace: "nowrap",
                              fontSize: "0.82rem",
                            }}
                          >
                            {climb.dateLabel || "—"}
                          </td>
                          <td
                            style={{
                              textTransform: "capitalize",
                              fontSize: "0.82rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {climb.type || "—"}
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
                          <td style={{ textAlign: "center" }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "var(--green-dark)",
                              }}
                            >
                              {s.confirmed || 0}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{ fontWeight: 700, color: "#e67e00" }}>
                              {s.pending || 0}
                            </span>
                          </td>
                          <td>
                            {climb.officers?.length > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 3,
                                }}
                              >
                                {climb.officers.map((o, i) => (
                                  <div key={i} style={{ fontSize: "0.78rem" }}>
                                    <span style={{ fontWeight: 700 }}>
                                      {o.name}
                                    </span>
                                    {o.role && (
                                      <span
                                        style={{
                                          color: "var(--ink-soft)",
                                          marginLeft: 4,
                                        }}
                                      >
                                        ({o.role})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span
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
                                None
                              </span>
                            )}
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
                              className={`status-badge ${reg.paymentStatus === "verified" ? "status-confirmed" : reg.paymentStatus === "rejected" ? "status-cancelled" : "status-pending"}`}
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
