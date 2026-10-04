import { createContext, useContext, useEffect, useState } from "react";
import {
  consumeRedirectSignIn,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  watchAuthState,
} from "@/services/auth";
import { callFunction } from "@/services/callables";
import { serverTimestamp } from "@/services/firestore";
import { createUserProfile, getUserProfile } from "@/services/users";

export const AuthContext = createContext(null);

// Storage rules gate members' payment proofs and medical certificates on the
// `admin` custom claim (see syncAdminClaim in functions/src/index.js). A token
// minted before a promotion does not carry it, and Firebase only refreshes
// hourly on its own — so an admin promoted mid-session would be denied their
// own files until then. Force the refresh once when the claim is behind the
// profile. Failure is non-fatal: the token refreshes on its own eventually.
//
// An admin whose claim was never issued (promoted before syncAdminClaim
// existed) asks the server to issue it from their users/ role first, so no
// admin depends on a manual backfill to see members' files.
async function syncAdminToken(user, profile) {
  try {
    const { claims } = await user.getIdTokenResult();
    if ((profile?.role === "admin") !== (claims.admin === true)) {
      if (profile?.role === "admin") {
        await callFunction("ensureAdminClaim");
      }
      await user.getIdToken(true);
    }
  } catch {
    // Offline or a transient auth error — nothing worth surfacing.
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(uid) {
    const profile = await getUserProfile(uid);
    if (!profile) return null;
    const { id: _id, ...data } = profile;
    return data;
  }

  async function signup(email, password, displayName) {
    const cred = await signUpWithEmail(email, password, displayName);
    await createUserProfile(cred.user.uid, {
      displayName,
      email,
      role: "member",
      createdAt: serverTimestamp(),
      addedBy: "self",
    });
    // Non-blocking: a failed send just leaves the banner's Resend to retry.
    sendVerificationEmail(cred.user).catch(() => {});
    return cred;
  }

  function login(email, password) {
    return signInWithEmail(email, password);
  }

  async function loginWithGoogle() {
    try {
      // Try popup first (works in most cases)
      const cred = await signInWithGoogle();
      const existing = await fetchProfile(cred.user.uid);
      if (!existing) {
        await createUserProfile(cred.user.uid, {
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
      const cred = await consumeRedirectSignIn();
      if (!cred?.user) return;
      // Only write if we can — silently skip if rules block it
      try {
        const existing = await fetchProfile(cred.user.uid);
        if (!existing) {
          await createUserProfile(cred.user.uid, {
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
    return signOutUser();
  }

  function resendVerification() {
    return sendVerificationEmail();
  }

  function resetPassword(email) {
    return sendPasswordReset(email);
  }

  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    // Settle the Google redirect before subscribing. Fired-and-forgotten, it
    // races onAuthStateChanged, which can emit null first and bounce a user
    // who just came back from the Google consent screen.
    (async () => {
      await handleRedirectResult();
      if (cancelled) return;
      unsub = watchAuthState(async (user) => {
        setCurrentUser(user);
        if (user) {
          const profile = await fetchProfile(user.uid);
          setUserProfile(profile);
          await syncAdminToken(user, profile);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
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
        resendVerification,
      }}
    >
      {/* Rendered unconditionally: the public schedule and event pages must
          not wait on a users/ read. The route guards own the loading gate. */}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
