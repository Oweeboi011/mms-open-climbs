/**
 * Tests for ProtectedRoute and AdminRoute guards.
 *
 * Scenarios:
 *  - ProtectedRoute redirects unauthenticated user to /login
 *  - ProtectedRoute renders children for authenticated user
 *  - AdminRoute redirects non-admin to /
 *  - AdminRoute renders children for admin user
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthContext } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import { makeGuestAuth, makeMemberAuth, makeAdminAuth } from "@/test/helpers";

function renderRoutes(authValue, Component) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<Component />}>
            <Route path="/protected" element={<div>protected content</div>} />
          </Route>
          <Route path="/" element={<div>home page</div>} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when user is not authenticated", () => {
    renderRoutes(makeGuestAuth(), ProtectedRoute);
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders protected content when user is authenticated", () => {
    renderRoutes(makeMemberAuth(), ProtectedRoute);
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});

describe("AdminRoute", () => {
  it("redirects to / when user is not authenticated", () => {
    renderRoutes(makeGuestAuth(), AdminRoute);
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("redirects to / when user is a regular member", () => {
    renderRoutes(makeMemberAuth(), AdminRoute);
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("renders protected content when user is admin", () => {
    renderRoutes(makeAdminAuth(), AdminRoute);
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
