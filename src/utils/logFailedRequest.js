import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";

// Deleted by Firestore's TTL policy on `expireAt` after this long.
const FAILED_REQUEST_RETENTION_DAYS = 90;

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
    expireAt: Timestamp.fromMillis(
      Date.now() + FAILED_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ),
  }).catch(() => {});
}
