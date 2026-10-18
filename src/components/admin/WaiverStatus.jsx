import { useState } from "react";
import { Link } from "react-router-dom";

const formatWhen = (ts) => ts?.toDate?.().toLocaleString("en-PH") || "Date not recorded";

// The waiver block in a registrant's expanded row: signed in the app, received
// offline (an admin recorded a paper or in-person waiver), or still missing.
// An offline record never poses as a digital signature: waiverSigned stays
// false and the note says how it was obtained.
export default function WaiverStatus({ reg, onMarkOffline }) {
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const offline = reg.waiverReceivedOffline;
  const done = !!reg.waiverSigned || !!offline;

  async function save() {
    if (!note.trim()) {
      setError("Say how the waiver was received, e.g. signed paper waiver at the jump-off.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onMarkOffline(reg, note.trim());
      setNote(null);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`waiver-status ${done ? "is-done" : "is-missing"}`}>
      <div className="waiver-status-body">
        <div className="waiver-status-label">
          {done ? "✓" : "⚠"} Waiver &amp; Release of Liability
        </div>
        {reg.waiverSigned && (
          <>
            <div className="waiver-status-headline">
              &#10003; Signed as &ldquo;{reg.waiverSignedName}&rdquo;
            </div>
            <div className="waiver-status-meta">{formatWhen(reg.waiverSignedAt)}</div>
          </>
        )}
        {!reg.waiverSigned && offline && (
          <>
            <div className="waiver-status-headline">&#10003; Received offline</div>
            <div className="waiver-status-meta">
              Marked by {offline.markedBy || "an admin"}, {formatWhen(offline.markedAt)}: {offline.note}
            </div>
          </>
        )}
        {!done && <div className="waiver-status-headline">&#10005; Waiver not yet signed</div>}
        {!done && onMarkOffline && note === null && (
          <button type="button" className="btn btn-outline btn-sm waiver-status-action" onClick={() => setNote("")}>
            Mark received offline
          </button>
        )}
        {note !== null && (
          <div className="waiver-status-form">
            <input
              type="text"
              className="form-input"
              aria-label="How the waiver was received"
              placeholder="e.g. signed paper waiver at the jump-off"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setNote(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        )}
        {error && (
          <div className="waiver-status-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <Link to={`/waiver/${reg.id}`} className="btn btn-outline btn-sm" target="_blank">
        View / Print Waiver
      </Link>
    </div>
  );
}
