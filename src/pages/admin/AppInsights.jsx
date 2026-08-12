import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResponsiveTable from "@/components/admin/ResponsiveTable";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function Card({ title, children, right }) {
  return (
    <div className="admin-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="admin-card-title" style={{ marginBottom: 0 }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, count, max, color }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 3 : 0) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.78rem",
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 99,
          background: "var(--surface-alt)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color || "var(--green-dark)",
            borderRadius: 99,
          }}
        />
      </div>
    </div>
  );
}

function StatTile({ value, label, color }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-num" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

export default function AppInsights() {
  const [regs, setRegs] = useState([]);
  const [climbs, setClimbs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [failedRequests, setFailedRequests] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [emailStats, setEmailStats] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [storageStats, setStorageStats] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [storageLoading, setStorageLoading] = useState(false);

  const [functionHealth, setFunctionHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [billingCost, setBillingCost] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [regsSnap, climbsSnap, notifSnap, failSnap, auditSnap, usersSnap] =
        await Promise.all([
          getDocs(collection(db, "registrations")),
          getDocs(collection(db, "climbs")),
          getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(500))),
          getDocs(query(collection(db, "failedRequests"), orderBy("createdAt", "desc"), limit(300))),
          getDocs(query(collection(db, "auditLog"), orderBy("createdAt", "desc"), limit(50))),
          getDocs(collection(db, "users")),
        ]);
      setRegs(regsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setClimbs(climbsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setNotifications(notifSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFailedRequests(failSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAuditLog(auditSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  async function loadEmailStats() {
    setEmailLoading(true);
    setEmailError("");
    try {
      const fn = httpsCallable(functions, "getEmailStats");
      const res = await fn({ days: 30 });
      setEmailStats(res.data);
    } catch (err) {
      setEmailError(err.message || "Failed to load email stats.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function loadStorageStats() {
    setStorageLoading(true);
    setStorageError("");
    try {
      const fn = httpsCallable(functions, "getStorageUsage");
      const res = await fn();
      setStorageStats(res.data);
    } catch (err) {
      setStorageError(err.message || "Failed to load storage usage.");
    } finally {
      setStorageLoading(false);
    }
  }

  async function loadFunctionHealth() {
    setHealthLoading(true);
    try {
      const fn = httpsCallable(functions, "getFunctionHealth");
      const res = await fn();
      setFunctionHealth(res.data);
    } catch (err) {
      setFunctionHealth({ configured: false, reason: err.message });
    } finally {
      setHealthLoading(false);
    }
  }

  async function loadBillingCost() {
    setBillingLoading(true);
    try {
      const fn = httpsCallable(functions, "getBillingCost");
      const res = await fn();
      setBillingCost(res.data);
    } catch (err) {
      setBillingCost({ configured: false, reason: err.message });
    } finally {
      setBillingLoading(false);
    }
  }

  // These hit paid/rate-limited external calls (Brevo, GCS, Cloud Functions
  // introspection, BigQuery billing export), so they used to require a
  // manual "Load" click. Firing them once on mount instead means the page
  // always shows a complete picture up front; the buttons still work as a
  // manual "Refresh".
  useEffect(() => {
    loadEmailStats();
    loadStorageStats();
    loadFunctionHealth();
    loadBillingCost();
  }, []);

  const paymentBreakdown = useMemo(() => {
    const map = { unpaid: 0, submitted: 0, verified: 0, rejected: 0 };
    for (const r of regs) {
      if (r.status === "cancelled") continue;
      map[r.paymentStatus || "unpaid"] = (map[r.paymentStatus || "unpaid"] || 0) + 1;
    }
    return map;
  }, [regs]);

  const activeRegs = useMemo(
    () => regs.filter((r) => r.status !== "cancelled"),
    [regs],
  );

  const waiverRate = useMemo(() => {
    if (activeRegs.length === 0) return 0;
    const signed = activeRegs.filter((r) => r.waiverSigned).length;
    return Math.round((signed / activeRegs.length) * 100);
  }, [activeRegs]);

  const docCompliance = useMemo(() => {
    const climbMap = Object.fromEntries(climbs.map((c) => [c.id, c]));
    const stats = REQUIRED_DOC_TYPES.map((docType) => ({
      docType,
      required: 0,
      done: 0,
    }));
    for (const r of activeRegs) {
      const climb = climbMap[r.climbId];
      if (!climb) continue;
      for (const stat of stats) {
        if (!climb[stat.docType.requiresField]) continue;
        stat.required++;
        if (r[stat.docType.uploadField]?.url) stat.done++;
      }
    }
    return stats;
  }, [activeRegs, climbs]);

  const paymentTurnaround = useMemo(() => {
    const durations = [];
    for (const r of regs) {
      const submitted = toDate(r.paymentSubmittedAt);
      const verified = toDate(r.verifiedAt);
      if (r.paymentStatus === "verified" && submitted && verified) {
        durations.push((verified.getTime() - submitted.getTime()) / 86400000);
      }
    }
    if (durations.length === 0) return null;
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    return { avgDays: avg, count: durations.length };
  }, [regs]);

  const notifByType = useMemo(() => {
    const map = {};
    for (const n of notifications) {
      map[n.type || "other"] = (map[n.type || "other"] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [notifications]);

  const overdueUnpaid = useMemo(() => {
    const now = Date.now();
    return activeRegs
      .filter((r) => r.paymentStatus === "unpaid" || r.paymentStatus === "rejected")
      .map((r) => ({
        ...r,
        ageDays: r.createdAt?.toDate
          ? Math.floor((now - r.createdAt.toDate().getTime()) / 86400000)
          : null,
      }))
      .filter((r) => r.ageDays !== null)
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 10);
  }, [activeRegs]);

  const failedByDay = useMemo(() => {
    const map = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    for (const f of failedRequests) {
      const d = toDate(f.createdAt);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (key in map) map[key]++;
    }
    return Object.entries(map);
  }, [failedRequests]);

  const repeatedFailures = useMemo(() => {
    const map = {};
    for (const f of failedRequests) {
      const key = `${f.source || "unknown"}::${f.message || ""}`;
      map[key] = map[key] || { source: f.source, message: f.message, count: 0 };
      map[key].count++;
    }
    return Object.values(map)
      .filter((x) => x.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [failedRequests]);

  const staleDrafts = useMemo(() => {
    const now = Date.now();
    return climbs
      .filter((c) => c.status === "draft")
      .map((c) => ({
        ...c,
        ageDays: c.createdAt?.toDate
          ? Math.floor((now - c.createdAt.toDate().getTime()) / 86400000)
          : null,
      }))
      .filter((c) => c.ageDays !== null && c.ageDays >= 30)
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [climbs]);

  const oldestPending = useMemo(() => {
    const pending = activeRegs.filter((r) => r.status === "pending" && r.createdAt?.toDate);
    if (pending.length === 0) return null;
    return pending.reduce((oldest, r) =>
      r.createdAt.toDate() < oldest.createdAt.toDate() ? r : oldest,
    );
  }, [activeRegs]);

  const regsByWeek = useMemo(() => {
    const map = {};
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = `Wk of ${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
      map[key] = { start: new Date(d.getTime() - 6 * 86400000), end: d, count: 0 };
    }
    const keys = Object.keys(map);
    for (const r of regs) {
      const d = toDate(r.createdAt);
      if (!d) continue;
      for (const key of keys) {
        if (d >= map[key].start && d <= map[key].end) {
          map[key].count++;
          break;
        }
      }
    }
    return keys.map((k) => [k, map[k].count]);
  }, [regs]);

  if (loading) return <LoadingSpinner fullPage />;

  const maxWeek = Math.max(...regsByWeek.map(([, c]) => c), 1);
  const maxFailDay = Math.max(...failedByDay.map(([, c]) => c), 1);
  const maxNotif = Math.max(...notifByType.map(([, c]) => c), 1);

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>App Insights</span>
        </div>
        <div className="admin-page-header">
          <div className="admin-page-title">App Insights</div>
        </div>

        {/* Overview */}
        <div className="admin-stats" style={{ marginBottom: 24 }}>
          <StatTile value={climbs.length} label="Total Climbs" />
          <StatTile value={activeRegs.length} label="Active Registrations" />
          <StatTile value={users.length} label="Total Users" />
          <StatTile value={`${waiverRate}%`} label="Waiver Completion" />
          <StatTile
            value={paymentTurnaround ? `${paymentTurnaround.avgDays.toFixed(1)}d` : "—"}
            label="Avg. Payment Turnaround"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <Card title="Registrations — Last 8 Weeks">
            {regsByWeek.map(([label, count]) => (
              <BarRow key={label} label={label} count={count} max={maxWeek} />
            ))}
          </Card>

          <Card title="Payment Status Breakdown">
            <BarRow label="Verified" count={paymentBreakdown.verified} max={activeRegs.length} color="var(--green-dark)" />
            <BarRow label="Submitted (awaiting review)" count={paymentBreakdown.submitted} max={activeRegs.length} color="var(--gold)" />
            <BarRow label="Unpaid" count={paymentBreakdown.unpaid} max={activeRegs.length} color="#b91c1c" />
            <BarRow label="Rejected" count={paymentBreakdown.rejected} max={activeRegs.length} color="#b91c1c" />
          </Card>

          <Card title="Required Document Compliance">
            {docCompliance.every((stat) => stat.required === 0) ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No climbs currently require any documents.
              </p>
            ) : (
              <>
                {docCompliance
                  .filter((stat) => stat.required > 0)
                  .map((stat) => (
                    <BarRow
                      key={stat.docType.key}
                      label={`${stat.docType.label} Uploaded`}
                      count={stat.done}
                      max={stat.required}
                    />
                  ))}
              </>
            )}
          </Card>

          <Card title="Notification Volume by Type (last 500)">
            {notifByType.map(([type, count]) => (
              <BarRow key={type} label={type} count={count} max={maxNotif} color="#0070E0" />
            ))}
          </Card>

          <Card title="Failed Requests — Last 14 Days">
            {failedByDay.map(([day, count]) => (
              <BarRow
                key={day}
                label={day.slice(5)}
                count={count}
                max={maxFailDay}
                color="#b91c1c"
              />
            ))}
          </Card>

          <Card title="Oldest Unpaid / Rejected Registrations">
            {overdueUnpaid.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No outstanding unpaid registrations. 🎉
              </p>
            ) : (
              <table className="admin-table">
                <tbody>
                  {overdueUnpaid.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                        {r.climbTitle}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {r.ageDays}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Tier 2: Email + Storage */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <Card
            title="Email Delivery (Brevo, last 30 days)"
            right={
              <button
                className="btn btn-outline btn-sm"
                onClick={loadEmailStats}
                disabled={emailLoading}
              >
                {emailLoading ? "Loading…" : emailStats ? "Refresh" : "Load"}
              </button>
            }
          >
            {emailError && <div className="alert alert-error">{emailError}</div>}
            {emailLoading && !emailStats && !emailError && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                Fetching delivery stats from Brevo…
              </p>
            )}
            {emailStats && (
              <div className="admin-stats">
                <StatTile value={emailStats.requests} label="Sent" />
                <StatTile value={emailStats.delivered} label="Delivered" color="var(--green-dark)" />
                <StatTile value={emailStats.hardBounces + emailStats.softBounces} label="Bounced" color="#b91c1c" />
                <StatTile value={emailStats.opens} label="Opens" />
              </div>
            )}
          </Card>

          <Card
            title="Storage Usage by Folder"
            right={
              <button
                className="btn btn-outline btn-sm"
                onClick={loadStorageStats}
                disabled={storageLoading}
              >
                {storageLoading ? "Loading…" : storageStats ? "Refresh" : "Load"}
              </button>
            }
          >
            {storageError && <div className="alert alert-error">{storageError}</div>}
            {storageLoading && !storageStats && !storageError && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                Scanning Firebase Storage…
              </p>
            )}
            {storageStats && (
              <>
                <p style={{ fontWeight: 800, marginBottom: 10 }}>
                  Total: {formatBytes(storageStats.totalBytes)} across{" "}
                  {storageStats.totalFiles} files
                </p>
                {(storageStats.folders || []).map((f) => (
                  <BarRow
                    key={f.folder}
                    label={`${f.folder} (${f.fileCount})`}
                    count={f.bytes}
                    max={storageStats.totalBytes || 1}
                    color="#7b2d8b"
                  />
                ))}
              </>
            )}
          </Card>

          <Card
            title="Cloud Functions Health (last 24h)"
            right={
              <button
                className="btn btn-outline btn-sm"
                onClick={loadFunctionHealth}
                disabled={healthLoading}
              >
                {healthLoading ? "Loading…" : functionHealth ? "Refresh" : "Load"}
              </button>
            }
          >
            {healthLoading && !functionHealth && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                Checking Cloud Functions execution health…
              </p>
            )}
            {functionHealth && !functionHealth.configured && (
              <div className="alert alert-warning">{functionHealth.reason}</div>
            )}
            {functionHealth?.configured && (
              <div className="admin-stats">
                <StatTile value={functionHealth.executionCount} label="Executions" />
                <StatTile
                  value={functionHealth.errorCount}
                  label="Errors"
                  color={functionHealth.errorCount > 0 ? "#b91c1c" : undefined}
                />
              </div>
            )}
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--ink-soft)",
                marginTop: 10,
              }}
            >
              For deeper diagnostics, see the{" "}
              <a
                href="https://console.firebase.google.com/project/_/functions"
                target="_blank"
                rel="noopener noreferrer"
              >
                Firebase Console
              </a>
              .
            </p>
          </Card>

          <Card
            title="Cloud Billing Cost (this month)"
            right={
              <button
                className="btn btn-outline btn-sm"
                onClick={loadBillingCost}
                disabled={billingLoading}
              >
                {billingLoading ? "Loading…" : billingCost ? "Refresh" : "Load"}
              </button>
            }
          >
            {billingLoading && !billingCost && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                Querying the billing export…
              </p>
            )}
            {billingCost && !billingCost.configured && (
              <div className="alert alert-warning">{billingCost.reason}</div>
            )}
            {billingCost?.configured && (
              <>
                <p style={{ fontWeight: 800, marginBottom: 10 }}>
                  {billingCost.month}: ${billingCost.totalCost.toFixed(2)}{" "}
                  {billingCost.currency}
                </p>
                {billingCost.byService.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                    No billed usage yet this month.
                  </p>
                ) : (
                  billingCost.byService.map((s) => (
                    <BarRow
                      key={s.service}
                      label={s.service}
                      count={Number(s.cost.toFixed(2))}
                      max={billingCost.totalCost || 1}
                      color="#0d9488"
                    />
                  ))
                )}
              </>
            )}
          </Card>
        </div>

        {/* Governance */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <Card title="Stale Draft Climbs (30+ days)">
            {staleDrafts.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No stale drafts.
              </p>
            ) : (
              <table className="admin-table">
                <tbody>
                  {staleDrafts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/climbs/${c.id}/edit`}>{c.title}</Link>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {c.ageDays}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Repeated Failures (3+ occurrences)">
            {repeatedFailures.length === 0 ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No repeated failure patterns.
              </p>
            ) : (
              <table className="admin-table">
                <tbody>
                  {repeatedFailures.map((f, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: "0.78rem" }}>{f.source}</td>
                      <td
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--ink-soft)",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.message}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {f.count}×
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Data Retention">
            {oldestPending ? (
              <p style={{ fontSize: "0.85rem" }}>
                Oldest pending registration:{" "}
                <strong>{oldestPending.name}</strong> for{" "}
                <strong>{oldestPending.climbTitle}</strong>, waiting since{" "}
                {toDate(oldestPending.createdAt)?.toLocaleDateString("en-PH")}.
              </p>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No pending registrations awaiting action.
              </p>
            )}
          </Card>
        </div>

        <Card title="Recent Admin Activity">
          {auditLog.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
              No admin actions logged yet.
            </p>
          ) : (
            <ResponsiveTable>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                      {toDate(a.createdAt)?.toLocaleString("en-PH") || "—"}
                    </td>
                    <td>{a.actorName}</td>
                    <td style={{ fontSize: "0.8rem" }}>{a.action}</td>
                    <td style={{ fontSize: "0.8rem" }}>{a.targetLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ResponsiveTable>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
