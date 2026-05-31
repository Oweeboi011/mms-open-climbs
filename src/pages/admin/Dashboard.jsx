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
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { SCHEDULE_2026 } from "@/data/schedule2026";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    climbs: 0,
    totalRegs: 0,
    pending: 0,
    users: 0,
  });
  const [recentRegs, setRecentRegs] = useState([]);
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
    async function loadStats() {
      const [climbsSnap, totalRegsSnap, pendingSnap, usersSnap] =
        await Promise.all([
          getCountFromServer(collection(db, "climbs")),
          getCountFromServer(collection(db, "registrations")),
          getCountFromServer(
            query(
              collection(db, "registrations"),
              where("status", "==", "pending"),
            ),
          ),
          getCountFromServer(collection(db, "users")),
        ]);
      setStats({
        climbs: climbsSnap.data().count,
        totalRegs: totalRegsSnap.data().count,
        pending: pendingSnap.data().count,
        users: usersSnap.data().count,
      });
    }

    const q = query(
      collection(db, "registrations"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentRegs(
        snap.docs.slice(0, 10).map((d) => ({ id: d.id, ...d.data() })),
      );
      loadStats().finally(() => setLoading(false));
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
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Dashboard</div>
            <div className="admin-page-subtitle">
              MMS Open Climbs 2026 — Admin Portal
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/admin/climbs/new" className="btn btn-primary">
              + New Climb
            </Link>
            <Link to="/admin/users" className="btn btn-outline">
              Manage Users
            </Link>
            {!loading && stats.climbs === 0 && (
              <button
                className="btn btn-gold btn-sm"
                onClick={handleSeed}
                disabled={seeding}
              >
                {seeding ? "Importing…" : "⬇ Import 2026 Schedule"}
              </button>
            )}
          </div>
          {seedResult && (
            <div className="alert alert-success" style={{ marginTop: 10 }}>
              {seedResult}
            </div>
          )}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="admin-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.climbs}</div>
                <div className="admin-stat-label">Total Climbs</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">{stats.totalRegs}</div>
                <div className="admin-stat-label">Registrations</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.pending}</div>
                <div className="admin-stat-label">Pending Confirmation</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.users}</div>
                <div className="admin-stat-label">Users</div>
              </div>
            </div>

            <div className="admin-section-bar">
              <span className="admin-section-label">Recent Registrations</span>
              <Link to="/admin/climbs" className="btn btn-outline btn-sm">
                All Climbs
              </Link>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Climb</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRegs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-table-empty">
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
