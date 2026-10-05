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

async function runJob(jobId, job, deps = {}) {
  const jobRef = db.doc(`releaseNoteEmailJobs/${jobId}`);
  const noteRef = db.doc(`releaseNotes/${job.releaseNoteId}`);
  const setStatus = async (status, extra = {}) => {
    await jobRef.update({ status, ...extra });
    await noteRef.update({ emailJob: { id: jobId, status } });
  };

  const noteSnap = await noteRef.get();
  if (!noteSnap.exists) {
    await jobRef.update({ status: "failed", error: "Release note no longer exists." });
    return;
  }
  const { subject, html } = renderReleaseNoteEmail(noteSnap.data());
  const recipients = await emailRecipients();
  await setStatus("sending", { total: recipients.length });

  const result = await sendInBatches(recipients, {
    send: (u) => sendEmail({ to: u.email, toName: u.displayName || u.email, subject, html }),
    onProgress: ({ sent, failed }) => jobRef.update({ sent, failed }),
    onFailure: (u, message) =>
      logFailedRequest({ type: "email", source: "releaseNoteEmailJobs", message, userId: u.id }),
    ...deps,
  });

  await setStatus("done", { finishedAt: FieldValue.serverTimestamp() });
  await noteRef.update({ emailSentAt: FieldValue.serverTimestamp(), emailSentCount: result.sent });
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
      await db.doc(`releaseNoteEmailJobs/${jobId}`).update({ status: "failed", error: err.message.slice(0, 300) });
      await logFailedRequest({ type: "email", source: "releaseNoteEmailJobs", message: err.message });
    }
  },
);
