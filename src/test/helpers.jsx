/**
 * Shared test utilities — render helpers and auth context factories.
 *
 * Auth objects are generated fresh per call (factory pattern) so that
 * vi.fn() mock instances do not accumulate call history across tests.
 */
import { render } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import { AuthContext } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Auth context factories — call these inside tests, not at module level,
// to guarantee isolated vi.fn() instances per test.
// ---------------------------------------------------------------------------
export function makeGuestAuth(overrides = {}) {
  return {
    currentUser:    null,
    userProfile:    null,
    isAdmin:        false,
    loading:        false,
    login:          vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup:         vi.fn(() => Promise.resolve()),
    logout:         vi.fn(() => Promise.resolve()),
    resetPassword:  vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

export function makeMemberAuth(overrides = {}) {
  return {
    currentUser:  { uid: "user-1", email: "climber@example.com", displayName: "Juan Cruz" },
    userProfile:  { displayName: "Juan Cruz", email: "climber@example.com", role: "member" },
    isAdmin:      false,
    loading:      false,
    login:        vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup:       vi.fn(() => Promise.resolve()),
    logout:       vi.fn(() => Promise.resolve()),
    resetPassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

export function makeAdminAuth(overrides = {}) {
  return {
    currentUser:  { uid: "admin-1", email: "admin@mms.ph", displayName: "Admin User" },
    userProfile:  { displayName: "Admin User", email: "admin@mms.ph", role: "admin" },
    isAdmin:      true,
    loading:      false,
    login:        vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup:       vi.fn(() => Promise.resolve()),
    logout:       vi.fn(() => Promise.resolve()),
    resetPassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

/**
 * Render a component wrapped in BrowserRouter and an AuthContext value.
 */
export function renderWithProviders(ui, authValue, options = {}) {
  const ctx = authValue ?? makeGuestAuth();
  return render(
    <AuthContext.Provider value={ctx}>
      <BrowserRouter>{ui}</BrowserRouter>
    </AuthContext.Provider>,
    options,
  );
}

/**
 * Render a component at a specific route path so useParams works.
 * @example renderAtRoute(<Event />, "/event/:climbId", "/event/abc123")
 */
export function renderAtRoute(ui, path, initialEntry, authValue) {
  const ctx = authValue ?? makeGuestAuth();
  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Common data fixtures
// ---------------------------------------------------------------------------
export const climbFixture = {
  id:                  "climb-1",
  title:               "Mt. Pulag",
  month:               "aug",
  dateLabel:           "Aug 1-3",
  location:            "Benguet",
  elevation:           2926,
  difficulty:          "Moderate",
  roundTripDistance:   "12km",
  type:                "major",
  color:               "c-green",
  maxParticipants:     30,
  registrationCount:   10,
  status:              "open",
  itinerary:           ["Day 1: Arrival"],
  isWide:              false,
  startDate:           { toDate: () => new Date("2026-08-01") },
};

export const registrationFixture = {
  id:            "reg-1",
  climbId:       "climb-1",
  climbTitle:    "Mt. Pulag",
  userId:        "user-1",
  name:          "Juan Cruz",
  email:         "climber@example.com",
  mobile:        "09171234567",
  status:        "pending",
  paymentStatus: "pending",
  createdAt:     { toDate: () => new Date("2026-07-01") },
};
