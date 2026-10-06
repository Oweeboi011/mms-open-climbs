import { useEffect, useState } from "react";
import { callFunction } from "@/services/callables";
import { subscribeToEmailJob } from "@/services/releaseNotes";
import ConfirmDialog from "@/components/ConfirmDialog";
import { emailJobState } from "@/utils/releaseNoteEmail";

const ACTIVE = ["queued", "sending"];

function JobProgress({ job, state }) {
  if (!job) return null;
  const done = (job.sent || 0) + (job.failed || 0);
  if (state === "superseded") return <div className="alert alert-info">This send was replaced by a newer one.</div>;
  if (state === "failed") return <div className="alert alert-error">Sending stopped: {job.error || "unknown error"}.</div>;
  if (state === "stalled") {
    return (
      <div className="alert alert-warning">
        This send stopped after {done} of {job.total} members. Sending again carries on from where it stopped.
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="alert alert-success">
        Sent to {job.sent} of {job.total} members{job.failed ? ` — ${job.failed} failed (see Failed requests)` : ""}.
      </div>
    );
  }
  return (
    <div className="rn-progress">
      <progress className="rn-progress-bar" max={job.total || 1} value={done} />
      <div className="rn-progress-label">
        {job.status === "queued" ? "Queued…" : `Sending… ${done} of ${job.total}`}
      </div>
    </div>
  );
}

function blockedReason(published, canEmail) {
  if (!published) return "Publish this release note before emailing it.";
  if (!canEmail) {
    return "Emailing every member needs the “Can email members” permission, which the project owner grants (see Users › your profile).";
  }
  return "";
}

function LastSent({ note }) {
  if (!note?.emailSentAt) return null;
  return (
    <p className="rn-email-last">
      Last sent to {note.emailSentCount ?? 0} member(s) on {note.emailSentAt?.toDate?.().toLocaleString("en-PH") || "—"}.
    </p>
  );
}

// Preview the real email, confirm the recipient count, then queue the send and
// watch its progress. Needs `canEmailMembers`, granted by the project owner.
export default function EmailMembersCard({ noteId, note, published, canEmail }) {
  const [jobId, setJobId] = useState(note?.emailJob?.id || null);
  const [job, setJob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => (jobId ? subscribeToEmailJob(jobId, setJob) : undefined), [jobId]);

  // A stalled job writes nothing more, so re-check the clock while one is live.
  const [now, setNow] = useState(() => Date.now());
  const live = ACTIVE.includes(job?.status);
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [live]);

  const state = emailJobState(job, now);
  const running = ACTIVE.includes(state);

  async function openPreview() {
    setBusy(true);
    setError("");
    try {
      setPreview(await callFunction("previewReleaseNoteEmail", { releaseNoteId: noteId }));
    } catch (err) {
      setError(err?.message || "Couldn't build the preview.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await callFunction("sendReleaseNoteEmail", { releaseNoteId: noteId });
      setJobId(result.jobId);
      setPreview(null);
    } catch (err) {
      setError(err?.message || "Failed to queue the email.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = blockedReason(published, canEmail);
  const label = note?.emailSentAt ? "Preview & Re-send" : "Preview & Send to All Members";

  return (
    <div className="admin-card rn-email-card">
      <div className="admin-card-title">Send Email to Members</div>
      {error && !preview && <div className="alert alert-error">{error}</div>}
      <JobProgress job={job} state={state} />
      {!running && <LastSent note={note} />}
      {blocked && <p className="form-hint">{blocked}</p>}
      <button type="button" className="btn btn-gold" disabled={Boolean(blocked) || running || busy} onClick={openPreview}>
        {busy && !preview ? "Preparing preview…" : label}
      </button>

      {preview && (
        <ConfirmDialog
          title="Email every member?"
          confirmLabel={
            preview.resuming ? `Send to the remaining ${preview.recipients} members` : `Send to ${preview.recipients} members`
          }
          busy={busy}
          error={error}
          onConfirm={send}
          onCancel={() => setPreview(null)}
        >
          {preview.resuming && (
            <p className="form-hint">
              An earlier send stopped after reaching {preview.alreadySent} members; this carries on with the rest.
            </p>
          )}
          <p className="rn-preview-subject">
            <strong>Subject:</strong> {preview.subject}
          </p>
          <iframe className="rn-preview-frame" title="Email preview" sandbox="" srcDoc={preview.html} />
        </ConfirmDialog>
      )}
    </div>
  );
}
