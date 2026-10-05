"use strict";

// Sends to a recipient list in small parallel batches, retrying each failed
// send once after a pause, and reports progress after every batch. Pure: the
// sender, the progress callback and the sleep are injected, so it is tested
// without Brevo or timers.

const BATCH_SIZE = 10;
const RETRY_DELAY_MS = 1500;
const BATCH_PAUSE_MS = 250;

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithRetry(send, recipient, sleep) {
  try {
    await send(recipient);
    return { ok: true };
  } catch {
    await sleep(RETRY_DELAY_MS);
    try {
      await send(recipient);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }
}

async function sendInBatches(recipients, { send, onProgress = async () => {}, onFailure = async () => {}, sleep = realSleep, batchSize = BATCH_SIZE } = {}) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((r) => sendWithRetry(send, r, sleep)));
    for (const [j, result] of results.entries()) {
      if (result.ok) sent++;
      else {
        failed++;
        await onFailure(batch[j], result.error);
      }
    }
    await onProgress({ sent, failed, total: recipients.length });
    if (i + batchSize < recipients.length) await sleep(BATCH_PAUSE_MS);
  }
  return { sent, failed, total: recipients.length };
}

module.exports = { sendInBatches };
