import { addDoc, deleteDoc, limit, orderBy, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/firebase/config";
import { colRef, countAll, docRef, fetchAll, fetchDoc, watchAll } from "@/services/firestore";

const COL = "registrations";

export const getRegistration = (id) => fetchDoc(COL, id);

export async function createRegistration(data) {
  const ref = await addDoc(colRef(COL), data);
  return ref.id;
}

export const updateRegistration = (id, patch) => updateDoc(docRef(COL, id), patch);

export const deleteRegistration = (id) => deleteDoc(docRef(COL, id));

// `[{ id, patch }]` in one batch: money moved between registrations must land
// on every side or none.
export async function updateRegistrationsAtomically(updates) {
  const batch = writeBatch(db);
  updates.forEach(({ id, patch }) => batch.update(docRef(COL, id), patch));
  await batch.commit();
}

export const listRegistrationsForUser = (uid) => fetchAll(COL, where("userId", "==", uid));

export const listRegistrationsForClimb = (climbId) =>
  fetchAll(COL, where("climbId", "==", climbId));

export const findUserRegistrationsForClimb = (climbId, uid) =>
  fetchAll(COL, where("climbId", "==", climbId), where("userId", "==", uid));

export const subscribeToAllRegistrations = (onData, onError) => watchAll(COL, [], onData, onError);

// Note: ordering by createdAt leaves out any doc without that field.
export const subscribeToRegistrationsNewestFirst = (onData, onError) =>
  watchAll(COL, [orderBy("createdAt", "desc")], onData, onError);

export const subscribeToRecentRegistrations = (max, onData, onError) =>
  watchAll(COL, [orderBy("createdAt", "desc"), limit(max)], onData, onError);

// `filter` is `{ field: value }` equality, e.g. `{ status: "pending" }`.
export const countRegistrations = (filter = {}) =>
  countAll(COL, ...Object.entries(filter).map(([field, value]) => where(field, "==", value)));

export const listAllRegistrations = () => fetchAll(COL);

export const subscribeToClimbRegistrationsNewestFirst = (climbId, onData, onError) =>
  watchAll(COL, [where("climbId", "==", climbId), orderBy("createdAt", "desc")], onData, onError);

// Every no-show on record — a small set, used for "earlier no-shows" warnings.
export const listNoShowRegistrations = () => fetchAll(COL, where("noShow", "==", true));

export const subscribeToUserRegistrationsNewestFirst = (uid, onData, onError) =>
  watchAll(COL, [where("userId", "==", uid), orderBy("createdAt", "desc")], onData, onError);
