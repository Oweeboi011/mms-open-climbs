import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_OPTIONS = ["draft", "open", "closed", "completed"];

export default function AdminClimbsManage() {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "climbs"), orderBy("startDate", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setClimbs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function changeStatus(id, status) {
    await updateDoc(doc(db, "climbs", id), { status });
  }

  const filtered = climbs
    .filter(
      (c) =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.location?.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
      const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
      return da - db2;
    });

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Climbs</span>
        </div>
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Climbs</div>
            <div className="admin-page-subtitle">
              {climbs.length} climb{climbs.length !== 1 ? "s" : ""} total
            </div>
          </div>
          <Link to="/admin/climbs/new" className="btn btn-primary">
            + New Climb
          </Link>
        </div>

        <div className="admin-search">
          <input
            type="search"
            className="form-input"
            placeholder="Search climbs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Climb</th>
                  <th style={{ width: "1%" }}>Date</th>
                  <th style={{ width: "1%" }}>Type</th>
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>Elevation</th>
                  <th style={{ width: "1%" }}>Difficulty</th>
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>Distance (RT)</th>
                  <th style={{ width: "1%" }}>Slots</th>
                  <th>Status</th>
                  <th>Officers</th>
                  <th style={{ width: "1%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      style={{ textAlign: "center", color: "var(--ink-soft)" }}
                    >
                      No climbs found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((climb) => {
                    const seatsLeft =
                      climb.maxParticipants - (climb.registrationCount ?? 0);
                    return (
                      <tr key={climb.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{climb.title}</div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--ink-soft)",
                            }}
                          >
                            {climb.location}
                          </div>
                        </td>
                        <td
                          style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}
                        >
                          {climb.dateLabel}
                        </td>
                        <td style={{ textTransform: "capitalize" }}>
                          {climb.type}
                        </td>
                        <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                          {climb.elevation ? <span style={{ fontWeight: 600 }}>{climb.elevation}m</span> : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {climb.difficulty || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                        </td>
                        <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                          {climb.roundTripDistance || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {climb.registrationCount ?? 0}
                          </span>
                          <span style={{ color: "var(--ink-soft)" }}>
                            {" "}
                            / {climb.maxParticipants ?? "∞"}
                          </span>
                          {seatsLeft <= 0 && climb.maxParticipants && (
                            <span
                              className="status-badge status-closed"
                              style={{ marginLeft: 6 }}
                            >
                              Full
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.75rem",
                              width: "auto",
                            }}
                            value={climb.status}
                            onChange={(e) =>
                              changeStatus(climb.id, e.target.value)
                            }
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {climb.officers?.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {climb.officers.map((o, i) => (
                                <div key={i} style={{ fontSize: "0.78rem" }}>
                                  <span style={{ fontWeight: 700 }}>{o.name}</span>
                                  {o.role && <span style={{ color: "var(--ink-soft)", marginLeft: 4 }}>({o.role})</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 20,
                              fontSize: "0.68rem", fontWeight: 700,
                              background: "#fce8e8", color: "#b91c1c", border: "1px solid #fca5a5",
                            }}>
                              None
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="admin-table-actions">
                            <Link
                              to={`/event/${climb.id}`}
                              className="btn btn-outline btn-sm"
                              target="_blank"
                              title="Open the public event page in a new tab"
                            >
                              View
                            </Link>
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
        )}
      </main>
      <Footer />
    </div>
  );
}
