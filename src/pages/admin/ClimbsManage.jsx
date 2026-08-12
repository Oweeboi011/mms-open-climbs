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
import ClimbFeeBreakdown from "@/components/ClimbFeeBreakdown";
import { getMissingFields } from "@/utils/climbCompleteness";
import {
  getFeeSummary,
  getClimbFeeModel,
  formatPeso,
} from "@/utils/feeSummary";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import ClimbRatingCells from "@/components/admin/ClimbRatingCells";
import { TRAIL_CLASS_LABELS } from "@/utils/trailClass";

const STATUS_OPTIONS = ["draft", "open", "closed", "completed"];

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

  const filtered = climbs.filter(
    (c) =>
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by status for clear auditing — ordered by urgency/relevance.
  const STATUS_GROUP_ORDER = [
    "open",
    "draft",
    "closed",
    "completed",
    "cancelled",
  ];
  const STATUS_GROUP_LABELS = {
    open: "Open",
    draft: "Draft",
    closed: "Closed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const toDate = (d) => d?.toDate?.() ?? new Date(d ?? 0);
  const groups = STATUS_GROUP_ORDER.map((status) => {
    const list = filtered.filter((c) => (c.status || "draft") === status);
    // Completed/cancelled: most recent first; others: soonest first
    const desc = status === "completed" || status === "cancelled";
    list.sort((a, b) => {
      const da = toDate(a.startDate);
      const db2 = toDate(b.startDate);
      return desc ? db2 - da : da - db2;
    });
    return { title: STATUS_GROUP_LABELS[status] || status, status, list };
  }).filter((g) => g.list.length > 0);

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
          <ResponsiveTable>
            <table className="admin-table table-min-880">
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>Climb</th>
                  <th style={{ minWidth: 85 }}>Date</th>
                  <th style={{ minWidth: 150 }}>Rating</th>
                  <th style={{ minWidth: 75 }}>Slots</th>
                  <th style={{ minWidth: 90, whiteSpace: "nowrap" }}>
                    Status
                  </th>
                  <th style={{ minWidth: 130 }}>Officers</th>
                  <th style={{ minWidth: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", color: "var(--ink-soft)" }}
                    >
                      No climbs found.
                    </td>
                  </tr>
                ) : (
                  groups.flatMap(({ title, status, list }) => {
                    const groupColor =
                      {
                        open: "#1a6b2c",
                        draft: "#b45309",
                        closed: "#b91c1c",
                        completed: "#6d5a00",
                        cancelled: "#6b7280",
                      }[status] || "var(--ink-soft)";
                    return [
                      <tr key={`group-${title}`}>
                        <td
                          colSpan={7}
                          style={{
                            background: "var(--surface-alt)",
                            fontSize: "0.66rem",
                            fontWeight: 800,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            color: groupColor,
                            borderLeft: `3px solid ${groupColor}`,
                          }}
                        >
                          {title}{" "}
                          <span style={{ fontWeight: 400 }}>{list.length}</span>
                        </td>
                      </tr>,
                      ...(list.length === 0
                        ? [
                            <tr key={`empty-${title}`}>
                              <td
                                colSpan={7}
                                style={{ color: "var(--ink-soft)" }}
                              >
                                None.
                              </td>
                            </tr>,
                          ]
                        : list.map((climb) => {
                            const seatsLeft =
                              climb.maxParticipants -
                              (climb.registrationCount ?? 0);
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
                                          isOpen
                                            ? "Collapse details"
                                            : "Expand details"
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
                                            flexWrap: "wrap",
                                            gap: 6,
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
                                        {(climb.requiresRegistrationForm ||
                                          climb.requiresMedicalCert) && (
                                          <div
                                            style={{
                                              display: "flex",
                                              gap: 4,
                                              marginTop: 4,
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            {climb.requiresRegistrationForm && (
                                              <span
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 3,
                                                  fontSize: "0.58rem",
                                                  fontWeight: 700,
                                                  padding: "1px 7px",
                                                  borderRadius: 6,
                                                  background: "#e3f2fd",
                                                  color: "#1565c0",
                                                  border: "1px solid #90caf9",
                                                  whiteSpace: "nowrap",
                                                }}
                                              >
                                                &#128196; Form Required
                                              </span>
                                            )}
                                            {climb.requiresMedicalCert && (
                                              <span
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 3,
                                                  fontSize: "0.58rem",
                                                  fontWeight: 700,
                                                  padding: "1px 7px",
                                                  borderRadius: 6,
                                                  background: "#fce4ec",
                                                  color: "#c62828",
                                                  border: "1px solid #ef9a9a",
                                                  whiteSpace: "nowrap",
                                                }}
                                              >
                                                &#9764; Med Cert Required
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div
                                      style={{
                                        fontWeight: 500,
                                        fontSize: "0.82rem",
                                      }}
                                    >
                                      {climb.dateLabel}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--ink-soft)",
                                        textTransform: "capitalize",
                                        marginTop: 1,
                                      }}
                                    >
                                      {[
                                        climb.type,
                                        climb.difficulty,
                                        climb.roundTripDistance
                                          ? `${climb.roundTripDistance} RT`
                                          : climb.distanceToSummit
                                            ? `${climb.distanceToSummit} to summit`
                                            : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                    {(() => {
                                      const model = getClimbFeeModel(climb);
                                      if (!model.fees.length) return null;
                                      const label = model.requiredHasAmount
                                        ? `${formatPeso(model.requiredTotal)}${model.requiredHasTBA ? "+" : ""}`
                                        : "TBA";
                                      return (
                                        <div
                                          style={{
                                            fontSize: "0.66rem",
                                            fontWeight: 700,
                                            color: "var(--green-dark)",
                                            marginTop: 2,
                                            fontFamily: "var(--font-head)",
                                          }}
                                        >
                                          {label}
                                          {model.guestAmount !== null && (
                                            <span
                                              style={{
                                                color: "var(--ink-soft)",
                                                fontWeight: 600,
                                              }}
                                            >
                                              {" "}
                                              +{formatPeso(
                                                model.guestAmount,
                                              )}{" "}
                                              joiner
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <ClimbRatingCells climb={climb} />
                                  <td>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          fontSize: "0.84rem",
                                          fontFamily: "var(--font-head)",
                                        }}
                                      >
                                        {climb.registrationCount ?? 0}
                                      </span>
                                      <span
                                        style={{
                                          color: "var(--ink-soft)",
                                          fontSize: "0.72rem",
                                        }}
                                      >
                                        / {climb.maxParticipants ?? "∞"}
                                      </span>
                                    </div>
                                    {climb.maxParticipants > 0 &&
                                      (() => {
                                        const pct = Math.min(
                                          100,
                                          ((climb.registrationCount ?? 0) /
                                            climb.maxParticipants) *
                                            100,
                                        );
                                        const level =
                                          pct >= 100
                                            ? "full"
                                            : pct >= 75
                                              ? "low"
                                              : "ok";
                                        return (
                                          <span className="slot-bar">
                                            <span
                                              className={`slot-bar-fill ${level}`}
                                              style={{ width: `${pct}%` }}
                                            />
                                          </span>
                                        );
                                      })()}
                                    {seatsLeft <= 0 &&
                                      climb.maxParticipants && (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            marginTop: 3,
                                            padding: "1px 8px",
                                            borderRadius: 20,
                                            fontSize: "0.6rem",
                                            fontWeight: 700,
                                            background: "#fce8e8",
                                            color: "#b91c1c",
                                            border: "1px solid #fca5a5",
                                            textTransform: "uppercase",
                                            letterSpacing: 0.5,
                                          }}
                                        >
                                          Full
                                        </span>
                                      )}
                                  </td>
                                  <td>
                                    {(() => {
                                      const statusStyle = {
                                        open: {
                                          bg: "#e8f5e9",
                                          color: "#1a6b2c",
                                          border: "#a7d7b2",
                                        },
                                        closed: {
                                          bg: "#fce8e8",
                                          color: "#b91c1c",
                                          border: "#fca5a5",
                                        },
                                        completed: {
                                          bg: "#f5f0e0",
                                          color: "#6d5a00",
                                          border: "#d4c682",
                                        },
                                        draft: {
                                          bg: "#fff8e1",
                                          color: "#b45309",
                                          border: "#fde68a",
                                        },
                                        cancelled: {
                                          bg: "#fce8e8",
                                          color: "#b91c1c",
                                          border: "#fca5a5",
                                        },
                                      };
                                      const s =
                                        statusStyle[climb.status] ||
                                        statusStyle.draft;
                                      return (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "2px 10px",
                                            borderRadius: 20,
                                            fontSize: "0.68rem",
                                            fontWeight: 700,
                                            letterSpacing: 0.5,
                                            textTransform: "uppercase",
                                            whiteSpace: "nowrap",
                                            background: s.bg,
                                            color: s.color,
                                            border: `1px solid ${s.border}`,
                                          }}
                                        >
                                          {climb.status}
                                        </span>
                                      );
                                    })()}
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
                                          <div
                                            key={i}
                                            style={{ lineHeight: 1.25 }}
                                            title={o.role || ""}
                                          >
                                            <span
                                              style={{
                                                fontWeight: 700,
                                                fontSize: "0.78rem",
                                                whiteSpace: "nowrap",
                                              }}
                                            >
                                              {o.name}
                                            </span>
                                            {o.role && (
                                              <span
                                                style={{
                                                  display: "block",
                                                  fontSize: "0.64rem",
                                                  color: "var(--ink-soft)",
                                                  whiteSpace: "nowrap",
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
                                      colSpan={7}
                                      style={{
                                        background: "var(--green-pale)",
                                        padding: "12px 16px",
                                        borderLeft:
                                          "3px solid var(--green-light)",
                                      }}
                                    >
                                      {/* Status change + expand controls */}
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 10,
                                          flexWrap: "wrap",
                                          alignItems: "center",
                                          marginBottom: 12,
                                          paddingBottom: 10,
                                          borderBottom:
                                            "1px solid var(--border)",
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
                                          Change Status
                                        </span>
                                        <select
                                          className="form-select"
                                          style={{
                                            padding: "4px 8px",
                                            fontSize: "0.75rem",
                                            width: "auto",
                                          }}
                                          value={climb.status}
                                          onChange={(e) =>
                                            changeStatus(
                                              climb.id,
                                              e.target.value,
                                            )
                                          }
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
                                          display: "grid",
                                          gridTemplateColumns:
                                            "repeat(auto-fill, minmax(150px, 1fr))",
                                          gap: "6px 16px",
                                          marginBottom: 8,
                                        }}
                                      >
                                        <DetailCell
                                          label="Elevation"
                                          value={
                                            climb.elevation
                                              ? `${climb.elevation}m`
                                              : null
                                          }
                                        />
                                        <DetailCell
                                          label="Trail Class"
                                          value={
                                            climb.trailClass
                                              ? `Class ${climb.trailClass}${TRAIL_CLASS_LABELS[climb.trailClass] ? ` · ${TRAIL_CLASS_LABELS[climb.trailClass]}` : ""}`
                                              : null
                                          }
                                        />
                                        <DetailCell
                                          label="Distance (RT)"
                                          value={
                                            climb.roundTripDistance || null
                                          }
                                        />
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
                                              ? [
                                                  climb.gcashName,
                                                  climb.gcashNumber,
                                                ]
                                                  .filter(Boolean)
                                                  .join(" — ") || "QR uploaded"
                                              : null
                                          }
                                        />
                                      </div>

                                      <div style={{ marginBottom: 12 }}>
                                        <ClimbFeeBreakdown climb={climb} />
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
                          })),
                    ];
                  })
                )}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </main>
      <Footer />
    </div>
  );
}
