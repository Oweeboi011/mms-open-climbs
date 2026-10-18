import { setDoc } from "firebase/firestore";
import { docRef, fetchDoc, serverTimestamp } from "@/services/firestore";

// A member's saved details (see firebase/firestore.rules: memberDetails).
// Returns null when nothing is saved yet.
export const getMemberDetails = (uid) => fetchDoc("memberDetails", uid);

// Saved from My Details, so it no longer names a climb as its source.
export const saveMemberDetails = (uid, details) =>
  setDoc(
    docRef("memberDetails", uid),
    { ...details, sourceClimbTitle: "", updatedAt: serverTimestamp() },
    { merge: true },
  );
