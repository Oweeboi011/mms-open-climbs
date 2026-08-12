// Generates the timestamp prefix used in Storage upload paths (e.g.
// `payment-proofs/{climbId}/{userId}/{timestamp}_{filename}`). Pulled out of
// component bodies so `Date.now()` isn't called inline during render — it's
// only ever invoked from inside upload event handlers.
export function makeUploadTimestamp() {
  return Date.now();
}
