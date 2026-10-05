import { orderBy, setDoc, updateDoc } from "firebase/firestore";
import { countAll, docRef, fetchAll, fetchDoc, watchAll } from "@/services/firestore";

export const getUserProfile = (uid) => fetchDoc("users", uid);

export const createUserProfile = (uid, data) => setDoc(docRef("users", uid), data);

export const updateUserProfile = (uid, patch) => updateDoc(docRef("users", uid), patch);

export const listUsers = () => fetchAll("users");

export const listUsersByName = () => fetchAll("users", orderBy("displayName"));

export const subscribeToUsers = (onData, onError) => watchAll("users", [], onData, onError);

export const countUsers = () => countAll("users");
