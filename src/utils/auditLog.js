import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";

// Records an admin action for the App Insights audit trail. Never throws —
// a logging failure must not block the action it's describing.
export async function logAuditEvent({
  actorUid,
  actorName,
  action,
  targetType,
  targetId,
  targetLabel,
  details,
}) {
  try {
    await addDoc(collection(db, "auditLog"), {
      actorUid: actorUid || null,
      actorName: actorName || "Admin",
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      targetLabel: targetLabel || "",
      details: details || "",
      createdAt: serverTimestamp(),
    });
  } catch {
    // Best-effort only.
  }
}
