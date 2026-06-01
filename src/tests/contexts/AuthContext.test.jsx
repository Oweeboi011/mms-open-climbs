/**
 * Tests for AuthContext / AuthProvider.
 *
 * Scenarios:
 *  - Provides null currentUser when unauthenticated
 *  - Provides currentUser once onAuthStateChanged fires
 *  - isAdmin is true when userProfile.role === "admin"
 *  - isAdmin is false for member role
 *  - signup() calls createUserWithEmailAndPassword, updateProfile, setDoc
 *  - login() delegates to signInWithEmailAndPassword
 *  - logout() calls signOut
 *  - resetPassword() calls sendPasswordResetEmail
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { getDoc, setDoc } from "firebase/firestore";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { makeSnapshot } from "@/test/setup";

// A minimal consumer component that exposes context values via data-testid
function Consumer() {
  const { currentUser, isAdmin, userProfile } = useAuth();
  return (
    <div>
      <span data-testid="uid">{currentUser?.uid ?? "none"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="role">{userProfile?.role ?? "none"}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe("AuthContext — initial state (unauthenticated)", () => {
  it("provides uid=none when no user is signed in", async () => {
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(null);
      return vi.fn();
    });
    getDoc.mockResolvedValue(makeSnapshot("u", null));

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("uid").textContent).toBe("none"),
    );
  });
});

describe("AuthContext — authenticated member", () => {
  it("provides the user uid and member role", async () => {
    const user = { uid: "u1", displayName: "Juan", email: "j@j.com" };
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(user);
      return vi.fn();
    });
    getDoc.mockResolvedValue(
      makeSnapshot("u1", {
        role: "member",
        displayName: "Juan",
        email: "j@j.com",
      }),
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("uid").textContent).toBe("u1"),
    );
    expect(screen.getByTestId("admin").textContent).toBe("false");
    expect(screen.getByTestId("role").textContent).toBe("member");
  });
});

describe("AuthContext — admin user", () => {
  it("sets isAdmin=true when role is admin", async () => {
    const user = { uid: "a1", displayName: "Admin", email: "a@a.com" };
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(user);
      return vi.fn();
    });
    getDoc.mockResolvedValue(
      makeSnapshot("a1", {
        role: "admin",
        displayName: "Admin",
        email: "a@a.com",
      }),
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("admin").textContent).toBe("true"),
    );
  });
});

describe("AuthContext — signup()", () => {
  it("calls createUserWithEmailAndPassword, updateProfile, and setDoc", async () => {
    const user = { uid: "new-1", displayName: "", email: "n@n.com" };
    createUserWithEmailAndPassword.mockResolvedValue({ user });
    updateProfile.mockResolvedValue();
    setDoc.mockResolvedValue();
    getDoc.mockResolvedValue(makeSnapshot("new-1", null));
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(null);
      return vi.fn();
    });

    // Access signup via Consumer that calls it
    let signupFn;
    function SignupConsumer() {
      const { signup } = useAuth();
      signupFn = signup;
      return null;
    }
    render(
      <BrowserRouter>
        <AuthProvider>
          <SignupConsumer />
        </AuthProvider>
      </BrowserRouter>,
    );

    await signupFn("n@n.com", "pass1234", "New User");
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "n@n.com",
      "pass1234",
    );
    expect(updateProfile).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
  });
});

describe("AuthContext — login()", () => {
  it("delegates to signInWithEmailAndPassword", async () => {
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(null);
      return vi.fn();
    });
    let loginFn;
    function LoginConsumer() {
      const { login } = useAuth();
      loginFn = login;
      return null;
    }
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginConsumer />
        </AuthProvider>
      </BrowserRouter>,
    );
    await loginFn("e@e.com", "pw");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "e@e.com",
      "pw",
    );
  });
});

describe("AuthContext — logout()", () => {
  it("calls signOut", async () => {
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(null);
      return vi.fn();
    });
    let logoutFn;
    function LogoutConsumer() {
      const { logout } = useAuth();
      logoutFn = logout;
      return null;
    }
    render(
      <BrowserRouter>
        <AuthProvider>
          <LogoutConsumer />
        </AuthProvider>
      </BrowserRouter>,
    );
    await logoutFn();
    expect(signOut).toHaveBeenCalled();
  });
});

describe("AuthContext — resetPassword()", () => {
  it("calls sendPasswordResetEmail", async () => {
    onAuthStateChanged.mockImplementation((_, cb) => {
      cb(null);
      return vi.fn();
    });
    let resetFn;
    function ResetConsumer() {
      const { resetPassword } = useAuth();
      resetFn = resetPassword;
      return null;
    }
    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetConsumer />
        </AuthProvider>
      </BrowserRouter>,
    );
    await resetFn("user@example.com");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
    );
  });
});
