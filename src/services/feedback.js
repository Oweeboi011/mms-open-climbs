import { setDoc, where } from "firebase/firestore";
import { docRef, fetchAll, fetchDoc, watchAll } from "@/services/firestore";

// One feedback doc per member per climb, keyed `${climbId}_${uid}`, so a
// resubmission overwrites rather than duplicates.
const feedbackId = (climbId, uid) => `${climbId}_${uid}`;

export const getFeedback = (climbId, uid) => fetchDoc("feedback", feedbackId(climbId, uid));

export const saveFeedback = (climbId, uid, data) =>
  setDoc(docRef("feedback", feedbackId(climbId, uid)), data);

export const listFeedbackByUser = (uid) => fetchAll("feedback", where("userId", "==", uid));

export const subscribeToClimbFeedback = (climbId, onData, onError) =>
  watchAll("feedback", [where("climbId", "==", climbId)], onData, onError);
