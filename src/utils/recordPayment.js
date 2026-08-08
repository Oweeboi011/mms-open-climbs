import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { getPaymentEntries, buildPaymentPatch } from "@/utils/payments";
import { logAuditEvent } from "@/utils/auditLog";

/**
 * Log a payment the club received outside the app — cash at the jump-off, a
 * bank transfer, someone settling a friend's balance.
 *
 * It appends to the same history members build up with their GCash
 * submissions rather than overwriting `amountPaid`, so the recorded total
 * stays the sum of actual payments instead of a hand-typed figure with no
 * receipt behind it. `buildPaymentPatch` re-derives the rolled-up status from
 * the whole set, so a cash top-up on a part-verified registration lands
 * correctly without the caller reasoning about statuses.
 *
 * Shared by every admin surface that can take money (climb detail, all
 * registrations, manage payments) so the write and its audit entry can't
 * drift between them.
 */
export async function recordManualPayment(
  reg,
  { amount, note, markVerified },
  { currentUser, climbTitle } = {},
) {
  const payments = [
    ...getPaymentEntries(reg),
    {
      amount,
      proofs: [],
      submittedAt: Timestamp.now(),
      status: markVerified ? "verified" : "submitted",
      recordedBy: currentUser?.displayName || currentUser?.email || "admin",
      ...(note ? { note } : {}),
    },
  ];

  await updateDoc(doc(db, "registrations", reg.id), {
    ...buildPaymentPatch(payments),
    updatedAt: serverTimestamp(),
  });

  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: currentUser?.displayName || currentUser?.email,
    action: "payment_recorded",
    targetType: "registration",
    targetId: reg.id,
    targetLabel: reg.name || reg.id,
    details:
      `Recorded a ₱${Number(amount).toLocaleString("en-PH")} payment` +
      ` for ${climbTitle || reg.climbTitle || "climb"}` +
      `${markVerified ? " (verified)" : " (awaiting review)"}` +
      `${note ? ` — ${note}` : ""}`,
  });
}
