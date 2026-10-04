import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { chunk } from "@/utils/climbHistory";

// Shared plumbing for the collection services. Everything a service returns
// is a plain `{ id, ...data }` object — never a snapshot — so nothing above
// src/services needs to know Firestore exists (ADR 0004).

// Value types callers may put in a patch (e.g. `updatedAt: serverTimestamp()`).
// Query builders deliberately stay inside the services.
export { serverTimestamp, Timestamp, arrayUnion } from "firebase/firestore";

export const docRef = (col, id) => doc(db, col, id);
export const colRef = (col) => collection(db, col);

const toObject = (snap, id) => (snap?.exists?.() ? { id: id ?? snap.id, ...snap.data() } : null);
const toObjects = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export async function fetchDoc(col, id) {
  return toObject(await getDoc(doc(db, col, id)), id);
}

export async function fetchAll(col, ...constraints) {
  return toObjects(await getDocs(query(collection(db, col), ...constraints)));
}

export function watchDoc(col, id, onData, onError) {
  return onSnapshot(doc(db, col, id), (snap) => onData(toObject(snap, id)), onError);
}

export function watchAll(col, constraints, onData, onError) {
  return onSnapshot(
    query(collection(db, col), ...constraints),
    (snap) => onData(toObjects(snap)),
    onError,
  );
}

// `in` queries cap at 30 values, so larger id lists fan out in chunks.
export async function fetchWhereIn(col, field, values, ...constraints) {
  if (!values.length) return [];
  const parts = await Promise.all(
    chunk(values).map((part) => fetchAll(col, where(field, "in", part), ...constraints)),
  );
  return parts.flat();
}

// Server-side aggregate: billed as one read per 1000 docs counted, not per doc.
export async function countAll(col, ...constraints) {
  const snap = await getCountFromServer(query(collection(db, col), ...constraints));
  return snap.data().count;
}
