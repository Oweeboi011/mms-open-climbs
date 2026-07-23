import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";

// Fire-and-forget — failure logging must never affect the user.
export function logFailedRequest({
  type,
  source,
  message,
  path = null,
  userId = null,
  userRole = null,
  climbId = null,
  registrationId = null,
}) {
  addDoc(collection(db, "failedRequests"), {
    type,
    source,
    message: String(message ?? "Unknown error").slice(0, 500),
    path,
    userId,
    userRole,
    climbId,
    registrationId,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}
