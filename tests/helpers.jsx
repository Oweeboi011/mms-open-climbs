/**
 * Shared test utilities — render helpers and auth context factories.
 *
 * Auth objects are generated fresh per call (factory pattern) so that
 * vi.fn() mock instances do not accumulate call history across tests.
 */
import { render } from "@testing-library/react";
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import { onSnapshot, getDocs, getDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";
import { AuthContext } from "@/contexts/AuthContext";
import { GuideProvider } from "@/contexts/GuideContext";

// ---------------------------------------------------------------------------
// Auth context factories — call these inside tests, not at module level,
// to guarantee isolated vi.fn() instances per test.
// ---------------------------------------------------------------------------
export function makeGuestAuth(overrides = {}) {
  return {
    currentUser: null,
    userProfile: null,
    isAdmin: false,
    loading: false,
    login: vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    resetPassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

export function makeMemberAuth(overrides = {}) {
  return {
    currentUser: {
      uid: "user-1",
      email: "climber@example.com",
      displayName: "Juan Cruz",
    },
    userProfile: {
      displayName: "Juan Cruz",
      email: "climber@example.com",
      role: "member",
    },
    isAdmin: false,
    loading: false,
    login: vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    resetPassword: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

export function makeAdminAuth(overrides = {}) {
  return {
    currentUser: {
      uid: "admin-1",
      email: "admin@mms.ph",
      displayName: "Admin User",
    },
    userProfile: {
      displayName: "Admin User",
      email: "admin@mms.ph",
      role: "admin",
    },
    isAdmin: true,
    loading: false,
    login: vi.fn(() => Promise.resolve()),
    loginWithGoogle: vi.fn(() => Promise.resolve()),
    signup: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
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
      <GuideProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </GuideProvider>
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
      <GuideProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </MemoryRouter>
      </GuideProvider>
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Firestore read routing
// ---------------------------------------------------------------------------
/**
 * onSnapshot stub for pages that subscribe to more than one thing. `items` is
 * served to the page's main collection subscription (registrations); anything
 * else it opens is routed to the stub the test already set up:
 *   - a single doc ref  ("climbs/climb-1") → the current getDoc mock
 *   - the climbs list   ("climbs")         → the current getDocs mock
 *   - any other collection                  → `others[name]`, default empty
 * so tests describe their data once no matter whether a page reads a
 * collection once or keeps it live.
 */
export function mockLiveSnapshot(items, others = { feedback: [] }) {
  onSnapshot.mockImplementation((target, ...rest) => {
    const cb = rest.find((arg) => typeof arg === "function");
    const path = (Array.isArray(target) ? target[0]?.path : target?.path) ?? "";
    const [collectionName, docId] = path.split("/");
    if (!docId && collectionName in others) {
      cb?.(makeQuerySnapshot(others[collectionName] || []));
    } else if (collectionName === "feedback") {
      cb?.(makeQuerySnapshot([]));
    } else if (docId) {
      getDoc(target).then((snap) => cb?.(snap));
    } else if (collectionName === "climbs") {
      getDocs(target).then((snap) => cb?.(snap));
    } else {
      cb?.(makeQuerySnapshot(items));
    }
    return vi.fn();
  });
}

// ---------------------------------------------------------------------------
// Common data fixtures
// ---------------------------------------------------------------------------
export const climbFixture = {
  id: "climb-1",
  title: "Mt. Pulag",
  month: "aug",
  dateLabel: "Aug 1-3",
  location: "Benguet",
  elevation: 2926,
  difficulty: "Moderate",
  roundTripDistance: "12km",
  type: "major",
  color: "c-green",
  maxParticipants: 30,
  registrationCount: 10,
  status: "open",
  itinerary: ["Day 1: Arrival"],
  isWide: false,
  // Kept comfortably in the future so the default fixture represents a live,
  // upcoming climb — tests for past-climb behaviour set their own dates.
  startDate: { toDate: () => new Date("2099-08-01") },
};

export const registrationFixture = {
  id: "reg-1",
  climbId: "climb-1",
  climbTitle: "Mt. Pulag",
  userId: "user-1",
  name: "Juan Cruz",
  email: "climber@example.com",
  mobile: "09171234567",
  status: "pending",
  paymentStatus: "pending",
  createdAt: { toDate: () => new Date("2026-07-01") },
};
