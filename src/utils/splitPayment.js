import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { getPaymentEntries, buildPaymentPatch } from "@/utils/payments";
import { logAuditEvent } from "@/utils/auditLog";

// One joiner often sends a single GCash payment covering friends on the same
// climb. Left as-is, the payer looks overpaid and everyone they paid for
// still shows a balance. Splitting moves each person's share off the payer's
// entry and onto the other registrant's own history, carrying the receipt and
// the review verdict with it, so every record's balance reflects who is
// actually covered.

const round2 = (n) => Math.round(n * 100) / 100;
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

// `allocations` is `[{ reg, amount }]`. Returns the Firestore patches for the
// payer and each recipient; throws with an admin-readable message when the
// split doesn't add up.
export function buildSplitPatches(payer, index, allocations, { actorName } = {}) {
  const entries = getPaymentEntries(payer);
  const entry = entries[index];
  if (!entry) throw new Error("That payment no longer exists.");
  if (entry.status === "rejected") {
    throw new Error("A rejected payment can't be split.");
  }

  const shares = (allocations || [])
    .map((a) => ({ reg: a.reg, amount: round2(Number(a.amount) || 0) }))
    .filter((a) => a.amount > 0);
  if (shares.length === 0) {
    throw new Error("Choose who else this payment covers and how much.");
  }
  if (shares.some((a) => a.reg.id === payer.id)) {
    throw new Error("A payment can't be split onto the person who paid it.");
  }

  const moved = round2(shares.reduce((sum, a) => sum + a.amount, 0));
  if (moved > entry.amount + 0.005) {
    throw new Error(`Only ${peso(entry.amount)} is left on this payment to split.`);
  }

  const originalAmount = entry.originalAmount ?? entry.amount;
  const payerEntries = entries.map((e, i) =>
    i === index
      ? {
          ...e,
          amount: round2(entry.amount - moved),
          originalAmount,
          splitTo: [
            ...(entry.splitTo || []),
            ...shares.map((a) => ({
              registrationId: a.reg.id,
              name: a.reg.name || "",
              amount: a.amount,
            })),
          ],
        }
      : e,
  );

  const recipients = shares.map((a) => {
    const received = {
      amount: a.amount,
      proofs: entry.proofs,
      submittedAt: entry.submittedAt,
      status: entry.status,
      paidBy: { registrationId: payer.id, name: payer.name || "" },
      note: `Paid by ${payer.name || "another registrant"} — part of their ${peso(originalAmount)} payment`,
      ...(actorName ? { recordedBy: actorName } : {}),
      ...(entry.reviewedBy ? { reviewedBy: entry.reviewedBy } : {}),
      ...(entry.reviewedAt ? { reviewedAt: entry.reviewedAt } : {}),
    };
    return {
      reg: a.reg,
      amount: a.amount,
      patch: buildPaymentPatch([...getPaymentEntries(a.reg), received]),
    };
  });

  return { payerPatch: buildPaymentPatch(payerEntries), recipients, moved };
}

// Writes the split in one batch — money must never leave the payer without
// landing on the recipients, or the other way round.
export async function splitPayment(
  payer,
  index,
  allocations,
  { currentUser, climbTitle } = {},
) {
  const actorName = currentUser?.displayName || currentUser?.email || "admin";
  const { payerPatch, recipients, moved } = buildSplitPatches(
    payer,
    index,
    allocations,
    { actorName },
  );

  const batch = writeBatch(db);
  batch.update(doc(db, "registrations", payer.id), {
    ...payerPatch,
    updatedAt: serverTimestamp(),
  });
  recipients.forEach(({ reg, patch }) => {
    batch.update(doc(db, "registrations", reg.id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: currentUser?.displayName || currentUser?.email,
    action: "payment_split",
    targetType: "registration",
    targetId: payer.id,
    targetLabel: payer.name || payer.id,
    details:
      `Split ${peso(moved)} of payment ${index + 1} for ` +
      `${climbTitle || payer.climbTitle || "climb"}: ` +
      recipients
        .map((r) => `${peso(r.amount)} to ${r.reg.name || r.reg.id}`)
        .join(", "),
  });
}
