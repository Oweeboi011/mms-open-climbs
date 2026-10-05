import { addDoc, orderBy, updateDoc, where } from "firebase/firestore";
import { colRef, docRef, fetchDoc, watchAll } from "@/services/firestore";

const COL = "releaseNotes";

export const getReleaseNote = (id) => fetchDoc(COL, id);

export async function createReleaseNote(data) {
  const ref = await addDoc(colRef(COL), data);
  return ref.id;
}

export const updateReleaseNote = (id, patch) => updateDoc(docRef(COL, id), patch);

export const subscribeToPublishedReleaseNotes = (onData, onError) =>
  watchAll(COL, [where("status", "==", "published"), orderBy("publishedAt", "desc")], onData, onError);

export const subscribeToAllReleaseNotes = (onData, onError) =>
  watchAll(COL, [orderBy("createdAt", "desc")], onData, onError);
