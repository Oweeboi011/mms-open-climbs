import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/firebase/config";

export const watchAuthState = (onChange) => onAuthStateChanged(auth, onChange);

export const currentUserId = () => auth.currentUser?.uid ?? null;

export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export async function signUpWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred;
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const consumeRedirectSignIn = () => getRedirectResult(auth);

export const signOutUser = () => signOut(auth);

export const sendVerificationEmail = (user = auth.currentUser) =>
  user ? sendEmailVerification(user) : Promise.resolve();

export const sendPasswordReset = (email) => sendPasswordResetEmail(auth, email);
