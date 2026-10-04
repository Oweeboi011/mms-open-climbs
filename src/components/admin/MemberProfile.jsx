import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPageViewsByUser } from "@/services/analytics";
import { listAuditEntriesByActor, listAuditEntriesForTargets } from "@/services/auditLog";
import { getClimb, getClimbPrivate, listClimbsLedBy } from "@/services/climbs";
import { listFeedbackByUser } from "@/services/feedback";
import { listRegistrationsForUser } from "@/services/registrations";
import { getUserProfile } from "@/services/users";
import { formatPeso } from "@/utils/feeSummary";
import {
  buildMemberClimbs,
  lastSeen,
  latestSafetyDetails,
} from "@/utils/memberProfile";
import { auditEntriesToEvents, buildClimbHistory } from "@/utils/climbHistory";

const fmtDate = (ms) =>
  ms
    ? new Date(ms).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "—";
const toMs = (t) => t?.toMillis?.() ?? (t?.toDate ? t.toDate().getTime() : 0);

// One member's whole record, shown inside the user modal on the users list:
// every climb they joined with what they paid and whether they showed up,
// feedback, and a single activity timeline. Read-only — the modal above it
// handles name/email/role edits. Loaded when the modal opens.
export default function MemberProfile({ uid }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(40);

  useEffect(() => {
    async function load() {
      try {
        const [user, regs, officerClimbs, feedback, views, actorEntries] = await Promise.all([
          getUserProfile(uid),
          listRegistrationsForUser(uid),
          listClimbsLedBy(uid),
          listFeedbackByUser(uid),
          listPageViewsByUser(uid, 500),
          listAuditEntriesByActor(uid, 200),
        ]);
        const climbIds = [...new Set(regs.map((r) => r.climbId).filter(Boolean))];
        const [climbs, privates, targetEntries] = await Promise.all([
          Promise.all(climbIds.map(getClimb)),
          Promise.all(climbIds.map(getClimbPrivate)),
          listAuditEntriesForTargets(regs.map((r) => r.id)),
        ]);
        const climbsById = {};
        const privateById = {};
        climbIds.forEach((id, i) => {
          if (climbs[i]) climbsById[id] = climbs[i];
          if (privates[i]) privateById[id] = privates[i];
        });
        setData({
          user,
          regs,
          climbsById,
          privateById,
          officerClimbs,
          feedback,
          pageViews: views,
          aboutThem: targetEntries,
          byThem: actorEntries,
        });
      } catch (err) {
        setError(err?.message || "Couldn't load this member.");
      }
    }
    load();
  }, [uid]);

  const derived = useMemo(() => {
    if (!data) return null;
    const { rows, totals } = buildMemberClimbs(data.regs, data.climbsById, data.privateById);
    // Their own actions as an admin, tagged so they read as "did to others".
    const byThem = auditEntriesToEvents(
      data.byThem.filter((e) => !data.aboutThem.some((a) => a.id === e.id)),
    ).map((e) => ({ ...e, source: "by-them" }));
    const timeline = [...buildClimbHistory(data.aboutThem, data.regs), ...byThem].sort(
      (a, b) => b.at - a.at,
    );
    return {
      rows,
      totals,
      timeline,
      safety: latestSafetyDetails(data.regs),
      seen: lastSeen(data.pageViews),
    };
  }, [data]);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!data || !derived) return <p className="form-hint">Loading climbs &amp; activity…</p>;

  const { user } = data;
  const { rows, totals, timeline, safety, seen } = derived;
  const name = user?.displayName || rows[0]?.reg?.name || "Member";

  return (
    <div className="member-profile">
      <p className="member-profile-meta">
        {user?.createdAt && `Joined ${fmtDate(toMs(user.createdAt))}`}
        {user?.addedBy && user.addedBy !== "self" && " (account created by an admin)"}
        {` · last active ${seen ? fmtDate(seen) : "not in the last 90 days"}`}
      </p>
      <div className="admin-stats">
        {[
          ["Climbs", totals.climbs],
          ["Attended", totals.attended],
          ["Cancelled", totals.cancelled],
          ["No-shows", totals.noShows],
          ["Total paid", formatPeso(totals.paid)],
          ["Still owed", formatPeso(totals.owed)],
          ["Donated", formatPeso(totals.donated)],
        ].map(([label, value]) => (
          <div className="admin-stat-card" key={label}>
            <div className="admin-stat-num">{value}</div>
            <div className="admin-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {safety && (
        <div className="admin-card member-safety">
          <div className="admin-card-title">Contact &amp; Safety Details</div>
          <p className="form-hint">As given on their latest registration ({safety.fromClimb}).</p>
          <dl className="overview-facts">
            <div className="overview-fact">
              <dt>Mobile</dt>
              <dd>{safety.mobile || "—"}</dd>
            </div>
            <div className="overview-fact">
              <dt>Emergency contact</dt>
              <dd>
                {safety.emergencyContact?.name
                  ? `${safety.emergencyContact.name}${safety.emergencyContact.relationship ? ` (${safety.emergencyContact.relationship})` : ""} · ${safety.emergencyContact.mobile || ""}`
                  : "—"}
              </dd>
            </div>
            <div className="overview-fact">
              <dt>Medical conditions</dt>
              <dd>{safety.medicalConditions || "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-title">Climbs ({rows.length})</div>
        {rows.length === 0 ? (
          <p className="form-hint">No registrations yet.</p>
        ) : (
          <div className="donations-table-wrap">
            <table className="admin-table member-climbs">
              <thead>
                <tr>
                  <th>Climb</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Paid</th>
                  <th>Owed</th>
                  <th>On the day</th>
                  <th>Waiver</th>
                  <th>Donation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reg.id}>
                    <td>
                      <Link to={`/admin/climbs/${r.climbId}`}>{r.title}</Link>
                      <div className="daysheet-muted">
                        {r.dateLabel}
                        {r.memberType && ` · ${r.memberType}`}
                      </div>
                    </td>
                    <td>{r.status}</td>
                    <td>{r.paymentStatus}</td>
                    <td>
                      {formatPeso(r.paid)}
                      {r.refunded > 0 && (
                        <div className="daysheet-muted">refunded {formatPeso(r.refunded)}</div>
                      )}
                    </td>
                    <td className={r.owed > 0 ? "daysheet-flag" : undefined}>
                      {r.owed > 0 ? formatPeso(r.owed) : "—"}
                    </td>
                    <td className={r.attendance === "no-show" ? "daysheet-flag" : undefined}>
                      {r.attendance}
                    </td>
                    <td>{r.waiverSigned ? "Signed" : "Not signed"}</td>
                    <td>
                      {r.donationReceived
                        ? `${formatPeso(r.donationReceived.cash)}${r.donationReceived.items ? " + items" : ""} received`
                        : r.donation
                          ? `Pledged ${r.donation.cashPledge ? formatPeso(r.donation.cashPledge) : ""}${r.donation.inKind ? " + items" : ""}`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.officerClimbs.length > 0 && (
        <div className="admin-card">
          <div className="admin-card-title">Officer on ({data.officerClimbs.length})</div>
          <ul className="member-list">
            {data.officerClimbs.map((c) => {
              const role = (c.officers || []).find((o) => o.userId === uid)?.role;
              return (
                <li key={c.id}>
                  <Link to={`/admin/climbs/${c.id}`}>{c.title}</Link>
                  {role && ` — ${role}`}
                  {c.dateLabel && <span className="daysheet-muted"> · {c.dateLabel}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.feedback.length > 0 && (
        <div className="admin-card">
          <div className="admin-card-title">Feedback ({data.feedback.length})</div>
          <ul className="member-list">
            {data.feedback.map((f) => (
              <li key={f.id}>
                <strong>{f.climbTitle || f.climbId}</strong> — {"★".repeat(f.rating || 0)}
                {f.comments && <div className="daysheet-muted">{f.comments}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-card history-card">
        <div className="admin-card-title">Activity</div>
        {timeline.length === 0 ? (
          <p className="form-hint">Nothing recorded yet.</p>
        ) : (
          <ol className="history-list">
            {timeline.slice(0, shown).map((e) => (
              <li key={e.key}>
                <time>{fmtDate(e.at)}</time>
                <span>
                  <strong>{e.source === "by-them" ? `${name} (as admin)` : e.who}</strong> —{" "}
                  {e.what}
                  {e.subject && e.subject !== e.who && <> · {e.subject}</>}
                  {e.detail && <span className="history-detail"> {e.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {timeline.length > shown && (
          <button className="btn btn-outline btn-sm" onClick={() => setShown((n) => n + 40)}>
            Show more ({timeline.length - shown} older)
          </button>
        )}
      </div>
    </div>
  );
}
