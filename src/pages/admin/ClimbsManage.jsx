import React, { useState, useEffect } from "react";
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
import DetailCell from "@/components/DetailCell";
import { getMissingFields } from "@/utils/climbCompleteness";
import { getFeeSummary } from "@/utils/feeSummary";

const STATUS_OPTIONS = ["draft", "open", "closed", "completed"];
const TRAIL_CLASS_LABELS = {
  1: "Easy day hike",
  2: "Moderate day hike",
  3: "Strenuous day hike",
  4: "Minor climb",
  5: "Major climb",
  6: "Technical climb",
  7: "Very technical",
  8: "Extreme",
  9: "Super extreme",
};

export default function AdminClimbsManage() {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

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

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <Link to="/admin/climbs/new" className="btn btn-primary">
              + New Climb
            </Link>
          </div>
        </div>

        <div
          className="admin-search"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            type="search"
            className="form-input"
            placeholder="Search climbs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              setExpandedIds((prev) =>
                prev.size === filtered.length
                  ? new Set()
                  : new Set(filtered.map((c) => c.id)),
              )
            }
          >
            {expandedIds.size === filtered.length && filtered.length > 0
              ? "Collapse All"
              : "Expand All"}
          </button>
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
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>
                    Elevation
                  </th>
                  <th style={{ width: "1%" }}>Difficulty</th>
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>
                    Trail Class
                  </th>
                  <th style={{ width: "1%", whiteSpace: "nowrap" }}>
                    Distance (RT)
                  </th>
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
                      colSpan={11}
                      style={{ textAlign: "center", color: "var(--ink-soft)" }}
                    >
                      No climbs found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((climb) => {
                    const seatsLeft =
                      climb.maxParticipants - (climb.registrationCount ?? 0);
                    const isOpen = expandedIds.has(climb.id);
                    const missing = getMissingFields(climb);
                    return (
                      <React.Fragment key={climb.id}>
                        <tr>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 6,
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
                                  marginTop: 1,
                                  transform: isOpen
                                    ? "rotate(90deg)"
                                    : "none",
                                  transition: "transform 0.15s",
                                }}
                              >
                                &#9656;
                              </button>
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>
                                    {climb.title}
                                  </span>
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
                                      title={missing.join(", ")}
                                      style={{
                                        fontSize: "0.62rem",
                                        color: "#b45309",
                                        fontWeight: 700,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      &#9888; {missing.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {climb.dateLabel}
                        </td>
                        <td style={{ textTransform: "capitalize" }}>
                          {climb.type}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {climb.elevation ? (
                            <span style={{ fontWeight: 600 }}>
                              {climb.elevation}m
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-soft)" }}>—</span>
                          )}
                        </td>
                        <td>
                          {climb.difficulty || (
                            <span style={{ color: "var(--ink-soft)" }}>—</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {climb.trailClass ? (
                            <span style={{ fontWeight: 600 }}>
                              Class {climb.trailClass}
                              {TRAIL_CLASS_LABELS[climb.trailClass] && (
                                <span
                                  style={{
                                    fontWeight: 400,
                                    color: "var(--ink-soft)",
                                  }}
                                >
                                  {" "}
                                  &middot;{" "}
                                  {TRAIL_CLASS_LABELS[climb.trailClass]}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-soft)" }}>—</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {climb.roundTripDistance || (
                            <span style={{ color: "var(--ink-soft)" }}>—</span>
                          )}
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
                        <td style={{ maxWidth: 220 }}>
                          {climb.officers?.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                            >
                              {climb.officers.map((o, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: 5,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span style={{ fontWeight: 700 }}>
                                    {o.name}
                                  </span>
                                  {o.role && (
                                    <span
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--ink-soft)",
                                      }}
                                    >
                                      {o.role}
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

                      {isOpen && (
                        <tr>
                          <td
                            colSpan={11}
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
                                          o.role ? `${o.name} (${o.role})` : o.name,
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
                                        .join(" — ") ||
                                      "QR uploaded"
                                    : null
                                }
                              />
                            </div>

                            <div
                              style={{
                                fontSize: "0.64rem",
                                fontWeight: 700,
                                letterSpacing: 1.5,
                                textTransform: "uppercase",
                                color: "var(--ink-soft)",
                                marginBottom: 6,
                              }}
                            >
                              Completeness Check
                            </div>
                            {missing.length === 0 ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 10px",
                                  borderRadius: 20,
                                  fontSize: "0.72rem",
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
                                  gap: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                {missing.map((label) => (
                                  <span
                                    key={label}
                                    style={{
                                      display: "inline-block",
                                      padding: "3px 10px",
                                      borderRadius: 20,
                                      fontSize: "0.72rem",
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
        )}
      </main>
      <Footer />
    </div>
  );
}
