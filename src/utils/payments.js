// A registration's payment history.
//
// Members don't always settle in one go — a downpayment first and the
// balance later, or an extra optional fee (transportation, guest fee) added
// after they already paid. Each submission is appended to the registration's
// `payments` array as its own entry, so admins reviewing a climb can see how
// much came in when, with the receipts that came with it.
//
// `amountPaid` stays the running total of those entries: every existing
// balance/outstanding calculation reads it, and admins can still override it
// by hand from the edit modal.
//
// Registrations created before `payments` existed only carry the flattened
// `paymentProofs` list and a single `amountPaid` — those surface as one
// entry so the views can render both shapes the same way.

function parseAmount(amount) {
  const n = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export const ENTRY_STATUSES = ["submitted", "verified", "rejected"];

function normalizeStatus(status, fallback = "submitted") {
  return ENTRY_STATUSES.includes(status) ? status : fallback;
}

export function hasPaymentHistory(reg) {
  return Array.isArray(reg?.payments) && reg.payments.length > 0;
}

// Every payment submission on this registration, oldest first. Returns
// storage-shaped entries, so an updated history can be written straight back
// as `[...getPaymentEntries(reg), newEntry]`.
export function getPaymentEntries(reg) {
  if (hasPaymentHistory(reg)) {
    return reg.payments.map((p) => ({
      amount: parseAmount(p?.amount),
      proofs: p?.proofs || [],
      submittedAt: p?.submittedAt ?? null,
      status: normalizeStatus(p?.status),
      ...(p?.note ? { note: p.note } : {}),
      ...(p?.recordedBy ? { recordedBy: p.recordedBy } : {}),
    }));
  }
  const amount = parseAmount(reg?.amountPaid);
  const proofs = reg?.paymentProofs || [];
  if (!amount && proofs.length === 0) return [];
  return [
    {
      amount,
      proofs,
      submittedAt: reg?.paymentSubmittedAt ?? null,
      // A pre-`payments` registration only ever had one review verdict, so
      // the registration's own status is that lone payment's status.
      status: normalizeStatus(reg?.paymentStatus),
    },
  ];
}

export function getPaymentsTotal(reg) {
  return getPaymentEntries(reg).reduce((sum, e) => sum + e.amount, 0);
}

// What counts toward the balance: a rejected payment wasn't accepted, so it
// doesn't reduce what's owed. Payments still awaiting review do count — the
// member has declared them, and an officer chasing balances needs to see the
// declared position, not pretend the money isn't there.
export function getCountedTotal(reg) {
  return getPaymentEntries(reg)
    .filter((e) => e.status !== "rejected")
    .reduce((sum, e) => sum + e.amount, 0);
}

// The registration-level `paymentStatus`, rolled up from the individual
// payments. Anything still awaiting review keeps the whole registration in
// the admin's review queue; once every payment is reviewed, the registration
// is verified as long as at least one payment was accepted.
export function derivePaymentStatus(entries) {
  if (!entries || entries.length === 0) return "unpaid";
  if (entries.some((e) => normalizeStatus(e.status) === "submitted"))
    return "submitted";
  if (entries.some((e) => normalizeStatus(e.status) === "verified"))
    return "verified";
  return "rejected";
}

// The full Firestore patch for a changed history — the three fields always
// move together, so every write site goes through here and none of them can
// drift out of sync.
export function buildPaymentPatch(entries) {
  return {
    payments: entries,
    amountPaid: entries
      .filter((e) => normalizeStatus(e.status) !== "rejected")
      .reduce((sum, e) => sum + parseAmount(e.amount), 0),
    paymentStatus: derivePaymentStatus(entries),
  };
}

// Patch that reviews a single payment. Legacy registrations normalize into a
// one-entry history on the way through, so reviewing them works the same.
export function setEntryStatus(reg, index, status) {
  const entries = getPaymentEntries(reg).map((e, i) =>
    i === index ? { ...e, status: normalizeStatus(status) } : e,
  );
  return buildPaymentPatch(entries);
}

// Patch that applies one verdict to every payment — what the registration-
// level Verify/Reject buttons and the status dropdown do.
export function setAllEntryStatuses(reg, status) {
  const entries = getPaymentEntries(reg).map((e) => ({
    ...e,
    status: normalizeStatus(status),
  }));
  if (entries.length === 0) return { paymentStatus: status };
  return buildPaymentPatch(entries);
}

// True when `amountPaid` no longer matches the sum of the recorded entries —
// i.e. an admin edited the total by hand. Shown as a hint so a reviewer
// isn't left wondering why the receipts don't add up to the amount.
export function hasAdjustedTotal(reg) {
  if (!hasPaymentHistory(reg)) return false;
  // Compared against the counted total, not the gross one — a rejected
  // payment legitimately drops out of `amountPaid` and isn't an override.
  return Math.abs(getCountedTotal(reg) - parseAmount(reg?.amountPaid)) > 0.005;
}

// All receipts across every payment, for the places that just need a count
// or a flat list. Falls back to the legacy `paymentProofs` field.
export function getAllProofs(reg) {
  if (hasPaymentHistory(reg)) {
    return reg.payments.flatMap((p) => p?.proofs || []);
  }
  return reg?.paymentProofs || [];
}
