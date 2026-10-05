import { limit, orderBy, updateDoc, where } from "firebase/firestore";
import { docRef, fetchAll, watchAll } from "@/services/firestore";

export const subscribeToUserNotifications = (uid, max, onData, onError) =>
  watchAll(
    "notifications",
    [where("userId", "==", uid), orderBy("createdAt", "desc"), limit(max)],
    onData,
    onError,
  );

export const markNotificationRead = (id) => updateDoc(docRef("notifications", id), { read: true });

export const listRecentNotifications = (max) =>
  fetchAll("notifications", orderBy("createdAt", "desc"), limit(max));
