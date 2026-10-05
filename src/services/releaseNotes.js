import { addDoc, deleteDoc, limit, orderBy, updateDoc, where } from "firebase/firestore";
import { colRef, docRef, fetchDoc, watchAll, watchDoc } from "@/services/firestore";

const COL = "releaseNotes";

export const RELEASE_NOTES_PAGE = 20;

export const getReleaseNote = (id) => fetchDoc(COL, id);

export async function createReleaseNote(data) {
  const ref = await addDoc(colRef(COL), data);
  return ref.id;
}

export const updateReleaseNote = (id, patch) => updateDoc(docRef(COL, id), patch);

export const deleteReleaseNote = (id) => deleteDoc(docRef(COL, id));

// Newest first, `count` at a time — the history page asks for more as the
// reader scrolls, so it never loads every season's notes up front.
export const subscribeToPublishedReleaseNotes = (onData, onError, count = RELEASE_NOTES_PAGE) =>
  watchAll(COL, [where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(count)], onData, onError);

export const subscribeToAllReleaseNotes = (onData, onError) =>
  watchAll(COL, [orderBy("createdAt", "desc")], onData, onError);

// Live progress of an all-member email send (written by the Functions job).
export const subscribeToEmailJob = (jobId, onData, onError) =>
  watchDoc("releaseNoteEmailJobs", jobId, onData, onError);
