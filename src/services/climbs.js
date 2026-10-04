import { addDoc, orderBy, setDoc, updateDoc, where } from "firebase/firestore";
import { colRef, docRef, fetchAll, fetchDoc, watchAll, watchDoc } from "@/services/firestore";

// climbs/{id} is public; climbPrivate/{id} (meeting links, officer contacts)
// is readable only by registrants and admins; climbExpenses/{id} is admin-only.

export const getClimb = (id) => fetchDoc("climbs", id);

// Registrants and admins only — a denied read resolves to null rather than
// failing the page that asked.
export const getClimbPrivate = (id) => fetchDoc("climbPrivate", id).catch(() => null);

export const subscribeToClimb = (id, onData, onError) => watchDoc("climbs", id, onData, onError);

export const subscribeToClimbPrivate = (id, onData, onError) =>
  watchDoc("climbPrivate", id, onData, onError);

export const subscribeToClimbExpenses = (id, onData, onError) =>
  watchDoc("climbExpenses", id, onData, onError);

export async function createClimb(data) {
  const ref = await addDoc(colRef("climbs"), data);
  return ref.id;
}

export const updateClimb = (id, patch) => updateDoc(docRef("climbs", id), patch);

export const saveClimbPrivate = (id, data) => setDoc(docRef("climbPrivate", id), data, { merge: true });

export const saveClimbInternal = (id, data) =>
  setDoc(docRef("climbInternal", id), data, { merge: true });

export const saveClimbExpenses = (id, data) =>
  setDoc(docRef("climbExpenses", id), data, { merge: true });

export const listClimbsLedBy = (uid) =>
  fetchAll("climbs", where("officerIds", "array-contains", uid));

// What the public schedule shows: everything except drafts.
export const subscribeToScheduledClimbs = (onData, onError) =>
  watchAll(
    "climbs",
    [where("status", "in", ["open", "closed", "completed", "cancelled"]), orderBy("startDate", "asc")],
    onData,
    onError,
  );

export const subscribeToAllClimbs = (onData, onError) =>
  watchAll("climbs", [orderBy("startDate", "asc")], onData, onError);

// Unordered, so climbs without a startDate are included too.
export const subscribeToEveryClimb = (onData, onError) => watchAll("climbs", [], onData, onError);

export const listAllClimbs = () => fetchAll("climbs");

export const listClimbsByStartDate = () => fetchAll("climbs", orderBy("startDate", "asc"));

export const subscribeToAllClimbPrivate = (onData, onError) =>
  watchAll("climbPrivate", [], onData, onError);

// Officer emails live in admin-only climbInternal/{id}.
export async function getClimbOfficerEmails(id) {
  const internal = await fetchDoc("climbInternal", id);
  return internal?.officerEmails || [];
}
