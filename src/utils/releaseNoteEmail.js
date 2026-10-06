// A release-note email job's state as the admin should see it. A job killed
// mid-send (the trigger's 9-minute limit) never writes a final status, so a
// queued/sending job that has gone quiet is "stalled". The limits mirror
// isLocked in functions/src/callables/releaseNotes.js: past them the callable
// accepts a new send, which carries on where this one stopped.
const QUEUED_LIMIT_MS = 60 * 60 * 1000;
const SILENT_LIMIT_MS = 15 * 60 * 1000;

export function emailJobState(job, now) {
  if (!job) return "none";
  if (job.status !== "queued" && job.status !== "sending") return job.status;
  const since = job.queuedAt || job.createdAt?.toMillis?.() || 0;
  const quiet = job.status === "queued" ? now - since : now - (job.heartbeatAt || since);
  const limit = job.status === "queued" ? QUEUED_LIMIT_MS : SILENT_LIMIT_MS;
  return quiet < limit ? job.status : "stalled";
}
