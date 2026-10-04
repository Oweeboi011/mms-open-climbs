import { addDoc, limit, orderBy, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { colRef, fetchAll } from "@/services/firestore";

// Firestore's TTL policy on `expireAt` deletes views after this long, so the
// collection (and every admin read of it) stops growing without bound.
const PAGE_VIEW_RETENTION_DAYS = 90;

// Fire-and-forget — tracking errors must never affect the user.
export function recordPageView(view) {
  addDoc(colRef("pageViews"), {
    ...view,
    timestamp: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + PAGE_VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  }).catch(() => {});
}

export const listPageViewsByUser = (uid, max) =>
  fetchAll("pageViews", where("userId", "==", uid), limit(max));

export const listRecentFailedRequests = (max) =>
  fetchAll("failedRequests", orderBy("createdAt", "desc"), limit(max));

const daysAgo = (days) => Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);

// Newest first, bounded by both a time window and a cap: every read is billed.
export const listPageViewsSince = (days, max) =>
  fetchAll("pageViews", where("timestamp", ">=", daysAgo(days)), orderBy("timestamp", "desc"), limit(max));

export const listFailedRequestsSince = (days, max) =>
  fetchAll("failedRequests", where("createdAt", ">=", daysAgo(days)), orderBy("createdAt", "desc"), limit(max));
