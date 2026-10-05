import { addDoc, limit, orderBy, serverTimestamp, where } from "firebase/firestore";
import { colRef, fetchAll, fetchWhereIn } from "@/services/firestore";

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
    await addDoc(colRef("auditLog"), {
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

// Everything logged against any of these targets (climb and registration ids).
export const listAuditEntriesForTargets = (targetIds) =>
  fetchWhereIn("auditLog", "targetId", targetIds);

export const listAuditEntriesByActor = (uid, max) =>
  fetchAll("auditLog", where("actorUid", "==", uid), limit(max));

export const listRecentAuditEntries = (max) =>
  fetchAll("auditLog", orderBy("createdAt", "desc"), limit(max));
