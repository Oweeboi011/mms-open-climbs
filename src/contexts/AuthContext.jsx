import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/firebase/config";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  }

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, "users", cred.user.uid), {
      displayName,
      email,
      role: "member",
      createdAt: serverTimestamp(),
      addedBy: "self",
    });
    return cred;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    try {
      // Try popup first (works in most cases)
      const cred = await signInWithPopup(auth, googleProvider);
      const existing = await fetchProfile(cred.user.uid);
      if (!existing) {
        await setDoc(doc(db, "users", cred.user.uid), {
          displayName: cred.user.displayName,
          email: cred.user.email,
          photoURL: cred.user.photoURL ?? null,
          role: "member",
          createdAt: serverTimestamp(),
          addedBy: "self",
        });
      }
      return cred;
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") return; // user dismissed — not an error
      if (err.code === "auth/popup-blocked") {
        const e = new Error(
          "Popup was blocked. Please allow popups for this site, or use email sign-in.",
        );
        e.code = "auth/popup-blocked";
        throw e;
      }
      throw err;
    }
  }

  async function handleRedirectResult() {
    try {
      const cred = await getRedirectResult(auth);
      if (!cred?.user) return;
      // Only write if we can — silently skip if rules block it
      try {
        const existing = await fetchProfile(cred.user.uid);
        if (!existing) {
          await setDoc(doc(db, "users", cred.user.uid), {
            displayName: cred.user.displayName,
            email: cred.user.email,
            photoURL: cred.user.photoURL ?? null,
            role: "member",
            createdAt: serverTimestamp(),
            addedBy: "self",
          });
        }
      } catch {
        // Rules not yet published — profile will be created on next sign-in
      }
    } catch (err) {
      if (err.code !== "auth/null-user")
        console.error("Redirect result:", err.code);
    }
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    // Handle redirect result on page load
    handleRedirectResult();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await fetchProfile(user.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = userProfile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        loading,
        signup,
        login,
        loginWithGoogle,
        logout,
        resetPassword,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
