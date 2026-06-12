import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const DAYS_WINDOW = 30;
const MAX_VIEWS = 5000;

function daysAgoTimestamp(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function startOfDayTimestamp(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function endOfDayTimestamp(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${m}/${d}`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: color || "var(--ink)",
          lineHeight: 1,
        }}
      >
        {value.toLocaleString()}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const [views, setViews] = useState([]);
  const [climbTitles, setClimbTitles] = useState({});
  const [userNames, setUserNames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch recent page views (last MAX_VIEWS, ordered by time desc)
        const q = query(
          collection(db, "pageViews"),
          orderBy("timestamp", "desc"),
          limit(MAX_VIEWS),
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setViews(data);

        // Resolve climb titles for any climbId found
        const climbIds = [
          ...new Set(data.map((v) => v.climbId).filter(Boolean)),
        ];
        if (climbIds.length > 0) {
          const climbSnaps = await getDocs(collection(db, "climbs"));
          const titles = {};
          climbSnaps.docs.forEach((d) => {
            titles[d.id] = d.data().title || d.id;
          });
          setClimbTitles(titles);
        }

        // Resolve display names for all logged-in visitors
        const userIds = [...new Set(data.map((v) => v.userId).filter(Boolean))];
        if (userIds.length > 0) {
          const userSnaps = await getDocs(collection(db, "users"));
          const names = {};
          userSnaps.docs.forEach((d) => {
            names[d.id] = d.data().displayName || d.data().email || d.id;
          });
          setUserNames(names);
        }
      } catch (err) {
        console.error("Analytics load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  // --- Aggregations ---
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);
  monthStart.setHours(0, 0, 0, 0);

  const ts = (v) => v.timestamp?.toDate?.() ?? new Date(0);

  const totalViews = views.length;
  const todayViews = views.filter((v) => ts(v) >= todayStart).length;
  const weekViews = views.filter((v) => ts(v) >= weekStart).length;
  const monthViews = views.filter((v) => ts(v) >= monthStart).length;

  const guestViews = views.filter((v) => v.userRole === "guest").length;
  const memberViews = views.filter((v) => v.userRole === "member").length;
  const adminViews = views.filter((v) => v.userRole === "admin").length;

  // Unique sessions
  const uniqueSessions = new Set(views.map((v) => v.sessionId).filter(Boolean))
    .size;
  const todaySessions = new Set(
    views
      .filter((v) => ts(v) >= todayStart)
      .map((v) => v.sessionId)
      .filter(Boolean),
  ).size;

  // Unique users (logged-in) with visit counts
  const uniqueUsers = new Set(views.map((v) => v.userId).filter(Boolean)).size;
  const userVisitMap = {};
  views.forEach((v) => {
    if (!v.userId) return;
    if (!userVisitMap[v.userId])
      userVisitMap[v.userId] = { count: 0, role: v.userRole };
    userVisitMap[v.userId].count++;
  });
  const uniqueUserList = Object.entries(userVisitMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([uid, { count, role }]) => ({
      uid,
      count,
      role,
      name: userNames[uid] || uid,
    }));

  // Top 5 event pages
  const eventViewMap = {};
  views.forEach((v) => {
    if (!v.climbId) return;
    eventViewMap[v.climbId] = (eventViewMap[v.climbId] || 0) + 1;
  });
  const topEvents = Object.entries(eventViewMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count, title: climbTitles[id] || id }));
  const maxEventViews = topEvents[0]?.count || 1;

  // Top pages (non-event)
  const pageViewMap = {};
  views.forEach((v) => {
    const key = v.path || "/";
    pageViewMap[key] = (pageViewMap[key] || 0) + 1;
  });
  const topPages = Object.entries(pageViewMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));
  const maxPageViews = topPages[0]?.count || 1;

  // Daily views for last 30 days
  const dailyMap = {};
  for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = 0;
  }
  views.forEach((v) => {
    const d = ts(v);
    if (d < monthStart) return;
    const key = d.toISOString().split("T")[0];
    if (key in dailyMap) dailyMap[key]++;
  });
  const dailyData = Object.entries(dailyMap).map(([date, count]) => ({
    date,
    count,
  }));
  const maxDaily = Math.max(...dailyData.map((d) => d.count), 1);

  // Guest vs member daily (last 30 days)
  const dailyGuestMap = {
    ...Object.fromEntries(dailyData.map((d) => [d.date, 0])),
  };
  const dailyMemberMap = {
    ...Object.fromEntries(dailyData.map((d) => [d.date, 0])),
  };
  views.forEach((v) => {
    const d = ts(v);
    if (d < monthStart) return;
    const key = d.toISOString().split("T")[0];
    if (!(key in dailyGuestMap)) return;
    if (v.userRole === "guest") dailyGuestMap[key]++;
    else dailyMemberMap[key]++;
  });

  // Traffic source split %
  const guestPct = totalViews ? Math.round((guestViews / totalViews) * 100) : 0;
  const memberPct = totalViews
    ? Math.round((memberViews / totalViews) * 100)
    : 0;
  const adminPct = totalViews ? Math.round((adminViews / totalViews) * 100) : 0;

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Site Analytics</div>
            <div className="admin-page-subtitle">
              Page views &amp; visitor breakdown — last{" "}
              {MAX_VIEWS.toLocaleString()} records
            </div>
          </div>
        </div>

        {/* Volume Stats */}
        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Volume
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <StatCard
              label="Total Views"
              value={totalViews}
              sub={`${uniqueSessions.toLocaleString()} unique sessions`}
              color="var(--gold)"
            />
            <StatCard
              label="Today"
              value={todayViews}
              sub={`${todaySessions} sessions today`}
            />
            <StatCard label="Last 7 Days" value={weekViews} />
            <StatCard label="Last 30 Days" value={monthViews} />
            <StatCard
              label="Unique Users"
              value={uniqueUsers}
              sub="Logged-in accounts"
              color="var(--green-dark)"
            />
          </div>
        </section>

        {/* Unique Members / Admins List */}
        {uniqueUserList.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 12,
              }}
            >
              Logged-in Visitors
            </div>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "var(--surface-alt, #f8f5ee)",
                    }}
                  >
                    <th
                      style={{
                        padding: "9px 16px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "var(--ink-soft)",
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        padding: "9px 16px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "var(--ink-soft)",
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Role
                    </th>
                    <th
                      style={{
                        padding: "9px 16px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--ink-soft)",
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Views
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueUserList.map(({ uid, name, role, count }, i) => {
                    const roleColor = role === "admin" ? "#7b2d8b" : "#0070E0";
                    return (
                      <tr
                        key={uid}
                        style={{
                          borderBottom:
                            i < uniqueUserList.length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          background:
                            i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 16px",
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}
                        >
                          {name}
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 99,
                              background: `${roleColor}18`,
                              color: roleColor,
                            }}
                          >
                            {role}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "8px 16px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {count.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Visitor Type */}
        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Visitor Type
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <StatCard
              label="Guest Visits"
              value={guestViews}
              sub={`${guestPct}% of total`}
              color="#888"
            />
            <StatCard
              label="Member Visits"
              value={memberViews}
              sub={`${memberPct}% of total`}
              color="#0070E0"
            />
            <StatCard
              label="Admin Visits"
              value={adminViews}
              sub={`${adminPct}% of total`}
              color="#7b2d8b"
            />
          </div>
          {/* Stacked bar */}
          {totalViews > 0 && (
            <div
              style={{
                marginTop: 14,
                display: "flex",
                borderRadius: 6,
                overflow: "hidden",
                height: 18,
              }}
            >
              {guestViews > 0 && (
                <div
                  style={{
                    width: `${guestPct}%`,
                    background: "#ccc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "#555",
                  }}
                  title={`Guest ${guestPct}%`}
                >
                  {guestPct > 8 ? `${guestPct}%` : ""}
                </div>
              )}
              {memberViews > 0 && (
                <div
                  style={{
                    width: `${memberPct}%`,
                    background: "#0070E0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                  title={`Member ${memberPct}%`}
                >
                  {memberPct > 8 ? `${memberPct}%` : ""}
                </div>
              )}
              {adminViews > 0 && (
                <div
                  style={{
                    width: `${adminPct}%`,
                    background: "#7b2d8b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                  title={`Admin ${adminPct}%`}
                >
                  {adminPct > 8 ? `${adminPct}%` : ""}
                </div>
              )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              fontSize: "0.72rem",
              color: "var(--ink-soft)",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "#ccc",
                  marginRight: 4,
                }}
              />
              Guest
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "#0070E0",
                  marginRight: 4,
                }}
              />
              Member
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "#7b2d8b",
                  marginRight: 4,
                }}
              />
              Admin
            </span>
          </div>
        </section>

        {/* Daily Chart */}
        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Daily Views — Last 30 Days
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 16px 12px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 3,
                height: 120,
                overflowX: "auto",
              }}
            >
              {dailyData.map(({ date, count }) => {
                const gCount = dailyGuestMap[date] || 0;
                const mCount = dailyMemberMap[date] || 0;
                const totalH = Math.round((count / maxDaily) * 100);
                const gH =
                  count > 0 ? Math.round((gCount / count) * totalH) : 0;
                const mH = totalH - gH;
                const isToday = date === now.toISOString().split("T")[0];
                return (
                  <div
                    key={date}
                    title={`${formatDate(date)}: ${count} views (${gCount} guest, ${mCount} member)`}
                    style={{
                      flex: "1 0 auto",
                      minWidth: 10,
                      maxWidth: 28,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0,
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        height: 100,
                      }}
                    >
                      {count === 0 ? (
                        <div
                          style={{
                            width: "100%",
                            height: 2,
                            background: "var(--border)",
                            borderRadius: 2,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            borderRadius: "3px 3px 0 0",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: mH,
                              background: isToday ? "#0055bb" : "#0070E0",
                              width: "100%",
                            }}
                          />
                          <div
                            style={{
                              height: gH,
                              background: isToday ? "#aaa" : "#ccc",
                              width: "100%",
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {(dailyData.indexOf(
                      dailyData.find((d) => d.date === date),
                    ) %
                      5 ===
                      0 ||
                      isToday) && (
                      <div
                        style={{
                          fontSize: "0.55rem",
                          color: isToday ? "var(--accent)" : "var(--ink-soft)",
                          marginTop: 3,
                          whiteSpace: "nowrap",
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {formatDate(date)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {/* Top Events */}
          <section>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 12,
              }}
            >
              Top 5 Most Viewed Events
            </div>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {topEvents.length === 0 ? (
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  No event views tracked yet.
                </p>
              ) : (
                topEvents.map(({ id, count, title }, i) => (
                  <div
                    key={id}
                    style={{ marginBottom: i < topEvents.length - 1 ? 14 : 0 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.83rem",
                          fontWeight: 600,
                          color: "var(--ink)",
                          maxWidth: "75%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {i + 1}. {title}
                      </span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--gold)",
                        }}
                      >
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--border)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((count / maxEventViews) * 100)}%`,
                          background: "var(--gold)",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Top Pages */}
          <section>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 12,
              }}
            >
              Top Pages
            </div>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {topPages.length === 0 ? (
                <p
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.85rem",
                    margin: 0,
                  }}
                >
                  No views tracked yet.
                </p>
              ) : (
                topPages.map(({ path, count }, i) => (
                  <div
                    key={path}
                    style={{ marginBottom: i < topPages.length - 1 ? 10 : 0 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontFamily: "monospace",
                          color: "var(--ink-soft)",
                          maxWidth: "75%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {path}
                      </span>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "var(--border)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((count / maxPageViews) * 100)}%`,
                          background: "#0070E0",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Recent Activity */}
        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginBottom: 12,
            }}
          >
            Recent Activity — Last 50 Views
          </div>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface-alt, #f8f5ee)",
                  }}
                >
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Time
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Path
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    User
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontSize: "0.68rem",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Session
                  </th>
                </tr>
              </thead>
              <tbody>
                {views.slice(0, 50).map((v, i) => {
                  const t = ts(v);
                  const timeStr =
                    t.getFullYear() > 1970
                      ? t.toLocaleString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                  const roleColor =
                    v.userRole === "admin"
                      ? "#7b2d8b"
                      : v.userRole === "member"
                        ? "#0070E0"
                        : "#888";
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom:
                          i < 49 ? "1px solid var(--border)" : "none",
                        background:
                          i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 16px",
                          color: "var(--ink-soft)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {timeStr}
                      </td>
                      <td
                        style={{
                          padding: "8px 16px",
                          fontFamily: "monospace",
                          color: "var(--ink)",
                          maxWidth: 240,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.path || "/"}
                      </td>
                      <td style={{ padding: "8px 16px" }}>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: `${roleColor}18`,
                            color: roleColor,
                          }}
                        >
                          {v.userRole || "guest"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 16px",
                          fontSize: "0.8rem",
                          color: v.userId ? "var(--ink)" : "var(--ink-soft)",
                          fontWeight: v.userId ? 500 : 400,
                        }}
                      >
                        {v.userId ? userNames[v.userId] || v.userId : "—"}
                      </td>
                      <td
                        style={{
                          padding: "8px 16px",
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {v.sessionId?.slice(0, 8) || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {views.length === 0 && (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  fontSize: "0.85rem",
                }}
              >
                No views recorded yet. Analytics will appear here once visitors
                start browsing.
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
