"use strict";

// Works one queued release-note email job (created by sendReleaseNoteEmail):
// sends in batches with a retry, writes progress to the job after every
// batch, and stamps the note when done. A 9-minute budget at ~10 emails per
// batch covers a few thousand members per job.

const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const { sendEmail } = require("../email/sendEmail");
const { logFailedRequest } = require("../shared/registrationOps");
const { sendInBatches } = require("../shared/batchSend");
const { emailRecipients, renderReleaseNoteEmail } = require("../callables/releaseNotes");
const { db } = require("../shared/admin");

// Point the note at this job's status (plus any extra fields) — unless a
// newer job has taken over.
function setNoteJob(noteRef, jobId, status, extra = {}) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(noteRef);
    if (snap.exists && snap.data().emailJob?.id === jobId) tx.update(noteRef, { emailJob: { id: jobId, status }, ...extra });
  });
}

// Start only if this job is still queued and still the note's current job.
// A job whose lock expired and was replaced (or an event delivered twice)
// stops here instead of emailing everyone again.
function claim(jobRef, noteRef, jobId) {
  return db.runTransaction(async (tx) => {
    const job = (await tx.get(jobRef)).data();
    const note = await tx.get(noteRef);
    if (!note.exists) return "missing";
    if (note.data().status !== "published") {
      if (job?.status === "queued") tx.update(jobRef, { status: "failed", error: "Note was unpublished before sending." });
      return "skip";
    }
    // Already started or finished (e.g. a redelivered event): leave it be.
    if (job?.status !== "queued") return "skip";
    if (note.data().emailJob?.id !== jobId) {
      tx.update(jobRef, { status: "superseded" });
      return "skip";
    }
    tx.update(jobRef, { status: "sending", heartbeatAt: Date.now() });
    tx.update(noteRef, { emailJob: { id: jobId, status: "sending" } });
    return "claimed";
  });
}

async function runJob(jobId, job, deps = {}) {
  const jobRef = db.doc(`releaseNoteEmailJobs/${jobId}`);
  const noteRef = db.doc(`releaseNotes/${job.releaseNoteId}`);
  const claimed = await claim(jobRef, noteRef, jobId);
  if (claimed === "missing") {
    await jobRef.update({ status: "failed", error: "Release note no longer exists." });
    return;
  }
  if (claimed === "skip") {
    logger.info("[releaseNoteEmailJobs] Skipped: not queued or replaced", { jobId });
    return;
  }
  const noteSnap = await noteRef.get();
  const { subject, html } = renderReleaseNoteEmail(noteSnap.data());
  const recipients = (await emailRecipients()).filter((u) => !job.afterUid || u.id > job.afterUid);
  await jobRef.update({ total: recipients.length, heartbeatAt: Date.now() });

  const result = await sendInBatches(recipients, {
    send: (u) => sendEmail({ to: u.email, toName: u.displayName || u.email, subject, html }),
    onProgress: ({ sent, failed }) =>
      jobRef.update({ sent, failed, lastUid: recipients[sent + failed - 1].id, heartbeatAt: Date.now() }),
    onFailure: (u, message) =>
      logFailedRequest({ type: "email", source: "releaseNoteEmailJobs", message, userId: u.id }),
    ...deps,
  });

  await jobRef.update({ status: "done", heartbeatAt: Date.now(), finishedAt: FieldValue.serverTimestamp() });
  await setNoteJob(noteRef, jobId, "done", { emailSentAt: FieldValue.serverTimestamp(), emailSentCount: result.sent });
  logger.info("[releaseNoteEmailJobs] Done", { jobId, ...result });
}

exports.runReleaseNoteEmailJob = runJob;

exports.onReleaseNoteEmailJobCreated = onDocumentCreated(
  {
    document: "releaseNoteEmailJobs/{jobId}",
    database: "openclimbs",
    secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"],
    timeoutSeconds: 540,
    // One job at a time keeps the send rate predictable for Brevo.
    maxInstances: 1,
  },
  async (event) => {
    const jobId = event.params.jobId;
    try {
      await runJob(jobId, event.data.data());
    } catch (err) {
      logger.error("[releaseNoteEmailJobs] Failed", { jobId, err: err.message });
      const job = event.data.data();
      const jobRef = db.doc(`releaseNoteEmailJobs/${jobId}`);
      if ((await jobRef.get()).data()?.status === "done") {
        // Every email went out; only the closing stamp failed. Don't unlock a re-send.
        await logFailedRequest({ type: "email", source: "releaseNoteEmailJobs", message: `after done: ${err.message}` });
        return;
      }
      await jobRef.update({ status: "failed", error: err.message.slice(0, 300) });
      // Release the note so an admin can send again.
      if (job?.releaseNoteId) {
        await setNoteJob(db.doc(`releaseNotes/${job.releaseNoteId}`), jobId, "failed");
      }
      await logFailedRequest({ type: "email", source: "releaseNoteEmailJobs", message: err.message });
    }
  },
);
