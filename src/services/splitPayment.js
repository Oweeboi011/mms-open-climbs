import { serverTimestamp } from "firebase/firestore";
import { logAuditEvent } from "@/services/auditLog";
import { updateRegistrationsAtomically } from "@/services/registrations";
import { buildSplitPatches, buildUndoSplitPatches } from "@/utils/splitPayment";

// The writes behind utils/splitPayment's pure patch builders — see there for
// how a split and its undo are modelled.

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

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

  await updateRegistrationsAtomically([
    { id: payer.id, patch: { ...payerPatch, updatedAt: serverTimestamp() } },
    ...recipients.map(({ reg, patch }) => ({
      id: reg.id,
      patch: { ...patch, updatedAt: serverTimestamp() },
    })),
  ]);

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

export async function undoSplitPayment(
  payer,
  recipient,
  share,
  { currentUser, climbTitle } = {},
) {
  const { payerPatch, recipientPatch, amount } = buildUndoSplitPatches(
    payer,
    recipient,
    share,
  );

  await updateRegistrationsAtomically([
    { id: payer.id, patch: { ...payerPatch, updatedAt: serverTimestamp() } },
    ...(recipientPatch
      ? [{ id: recipient.id, patch: { ...recipientPatch, updatedAt: serverTimestamp() } }]
      : []),
  ]);

  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: currentUser?.displayName || currentUser?.email,
    action: "payment_split_undone",
    targetType: "registration",
    targetId: payer.id,
    targetLabel: payer.name || payer.id,
    details:
      `Undid the ${peso(amount)} split to ` +
      `${recipient?.name || share.recipientName || share.recipientId} for ` +
      `${climbTitle || payer.climbTitle || "climb"} — returned to ` +
      `${payer.name || payer.id}'s payment`,
  });
}
