import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { logAuditEvent } from "@/utils/auditLog";
import { makeUploadTimestamp } from "@/utils/uploadTimestamp";
import { compressImage } from "@/utils/compressImage";

// Records money the club sent back to a registrant — typically the excess on
// a payment that covered more than they owed. Refunds live in their own
// `refunds` array (see getRefunds in utils/payments for why), which only
// admins can write; the member is notified by onRegistrationUpdated.

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;
const makeRefundId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export async function recordRefund(
  reg,
  { amount, note, files = [] },
  { currentUser, climbTitle } = {},
) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(value > 0)) throw new Error("Enter the amount refunded.");

  const proofs = await Promise.all(
    files.map(async (original) => {
      const file = await compressImage(original);
      const fileRef = storageRef(
        storage,
        `payment-proofs/${reg.climbId}/${reg.userId || reg.id}/${makeUploadTimestamp()}_refund_${file.name}`,
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return { url, fileName: file.name };
    }),
  );

  const refund = {
    id: makeRefundId(),
    amount: value,
    proofs,
    refundedAt: Timestamp.now(),
    recordedBy: currentUser?.displayName || currentUser?.email || "admin",
    ...(note ? { note } : {}),
  };

  await updateDoc(doc(db, "registrations", reg.id), {
    refunds: [...(Array.isArray(reg.refunds) ? reg.refunds : []), refund],
    updatedAt: serverTimestamp(),
  });

  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: currentUser?.displayName || currentUser?.email,
    action: "refund_recorded",
    targetType: "registration",
    targetId: reg.id,
    targetLabel: reg.name || reg.id,
    details:
      `Refunded ${peso(value)} for ${climbTitle || reg.climbTitle || "climb"}` +
      `${note ? ` — ${note}` : ""}`,
  });
}

// For a refund recorded by mistake: their excess comes back.
export async function removeRefund(
  reg,
  refundId,
  { currentUser, climbTitle } = {},
) {
  const refunds = Array.isArray(reg.refunds) ? reg.refunds : [];
  const removed = refunds.find((r) => r.id === refundId);
  if (!removed) throw new Error("That refund is no longer on this record.");

  await updateDoc(doc(db, "registrations", reg.id), {
    refunds: refunds.filter((r) => r.id !== refundId),
    updatedAt: serverTimestamp(),
  });

  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: currentUser?.displayName || currentUser?.email,
    action: "refund_removed",
    targetType: "registration",
    targetId: reg.id,
    targetLabel: reg.name || reg.id,
    details: `Removed a ${peso(removed.amount)} refund for ${climbTitle || reg.climbTitle || "climb"}`,
  });
}
