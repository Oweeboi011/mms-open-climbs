import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { buildClimbHistory, chunk } from "@/utils/climbHistory";

const PAGE = 50;

// Everything that happened on this climb, loaded on request so opening the
// page doesn't pay for a potentially long audit trail.
export default function ClimbHistoryCard({ climbId, regs }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const ids = [climbId, ...regs.map((r) => r.id)];
      const snaps = await Promise.all(
        chunk(ids).map((part) =>
          getDocs(query(collection(db, "auditLog"), where("targetId", "in", part))),
        ),
      );
      const entries = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEvents(buildClimbHistory(entries, regs));
    } catch (err) {
      setError(err?.message || "Couldn't load the history.");
    } finally {
      setLoading(false);
    }
  }

  const visible = (events || []).filter((e) => filter === "all" || e.source === filter);

  return (
    <div className="admin-card history-card">
      <div className="admin-card-title">History</div>
      {!events ? (
        <>
          <p className="form-hint">
            Who did what on this climb — admin actions, members registering,
            paying and cancelling, and automatic waitlist changes.
          </p>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Load history"}
          </button>
          {error && <p className="alert alert-error">{error}</p>}
        </>
      ) : (
        <>
          <div className="history-filters">
            {[
              ["all", "Everything"],
              ["admin", "Admins"],
              ["member", "Members"],
              ["system", "Automatic"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-outline"}`}
                onClick={() => {
                  setFilter(value);
                  setShown(PAGE);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="form-hint">Nothing recorded yet.</p>
          ) : (
            <ol className="history-list">
              {visible.slice(0, shown).map((e) => (
                <li key={e.key}>
                  <time>
                    {new Date(e.at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <span>
                    <strong>{e.who}</strong> — {e.what}
                    {e.subject && e.subject !== e.who && <> · {e.subject}</>}
                    {e.detail && <span className="history-detail"> {e.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {visible.length > shown && (
            <button className="btn btn-outline btn-sm" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({visible.length - shown} older)
            </button>
          )}
        </>
      )}
    </div>
  );
}
