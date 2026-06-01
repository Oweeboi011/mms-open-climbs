/**
 * Vitest global setup - runs before every test file.
 */
import "@testing-library/jest-dom";
import { vi, beforeEach, afterEach } from "vitest";

// Stub VITE_ env vars so firebase/config does not throw before mocks apply
Object.assign(import.meta.env, {
  VITE_FIREBASE_API_KEY:             "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN:         "test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID:          "test-project",
  VITE_FIREBASE_STORAGE_BUCKET:      "test-project.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID:              "1:000000000000:web:abc123",
});

// ---------------------------------------------------------------------------
// Firestore snapshot factories — imported by tests to shape mock return values
// ---------------------------------------------------------------------------
export function makeSnapshot(id, data) {
  return {
    id,
    exists: () => data !== null && data !== undefined,
    data:   () => data ?? {},
  };
}

export function makeQuerySnapshot(docs = []) {
  const snaps = docs.map(({ id, data }) => makeSnapshot(id, data));
  return {
    empty:   snaps.length === 0,
    size:    snaps.length,
    docs:    snaps,
    forEach: (fn) => snaps.forEach(fn),
  };
}

// ---------------------------------------------------------------------------
// Firebase module mocks
// ---------------------------------------------------------------------------
vi.mock("@/firebase/config", () => ({
  auth:           { currentUser: null },
  db:             {},
  functions:      {},
  storage:        {},
  googleProvider: {},
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged:             vi.fn(() => vi.fn()),
  signInWithEmailAndPassword:     vi.fn(() => Promise.resolve({ user: { uid: "u1" } })),
  createUserWithEmailAndPassword: vi.fn(() => Promise.resolve({ user: { uid: "u1", displayName: "", email: "" } })),
  signInWithPopup:                vi.fn(() => Promise.resolve({ user: { uid: "u1", displayName: "Test", email: "t@t.com", photoURL: null } })),
  getRedirectResult:              vi.fn(() => Promise.resolve(null)),
  signOut:                        vi.fn(() => Promise.resolve()),
  updateProfile:                  vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail:         vi.fn(() => Promise.resolve()),
  GoogleAuthProvider:             vi.fn().mockImplementation(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore:       vi.fn(),
  collection:         vi.fn((_db, path) => ({ path })),
  doc:                vi.fn((_db, ...args) => ({ path: args.join("/") })),
  getDoc:             vi.fn(() => Promise.resolve(makeSnapshot("doc-1", {}))),
  getDocs:            vi.fn(() => Promise.resolve(makeQuerySnapshot([]))),
  addDoc:             vi.fn(() => Promise.resolve({ id: "new-doc-id" })),
  setDoc:             vi.fn(() => Promise.resolve()),
  updateDoc:          vi.fn(() => Promise.resolve()),
  deleteDoc:          vi.fn(() => Promise.resolve()),
  query:              vi.fn((...args) => args),
  where:              vi.fn(),
  orderBy:            vi.fn(),
  limit:              vi.fn(),
  limitToLast:        vi.fn(),
  startAfter:         vi.fn(),
  onSnapshot:         vi.fn((_q, cb) => {
    cb(makeQuerySnapshot([]));
    return vi.fn();
  }),
  serverTimestamp:    vi.fn(() => ({ _type: "serverTimestamp" })),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  Timestamp: {
    fromDate: (d) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
    now:      () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
  },
  FieldValue: { increment: vi.fn((n) => ({ _type: "increment", n })) },
}));

vi.mock("firebase/storage", () => ({
  ref:            vi.fn(),
  uploadBytes:    vi.fn(() => Promise.resolve({ ref: {} })),
  getDownloadURL: vi.fn(() => Promise.resolve("https://example.com/file.jpg")),
  getStorage:     vi.fn(),
}));

vi.mock("firebase/functions", () => ({
  getFunctions:  vi.fn(),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));

// ---------------------------------------------------------------------------
// DOM stubs
// ---------------------------------------------------------------------------
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
Object.defineProperty(window, "confirm",  { value: vi.fn(() => false), writable: true });

// ---------------------------------------------------------------------------
// Scoped console suppression — filters known noise, real errors still surface
// ---------------------------------------------------------------------------
const SUPPRESS_PATTERNS = [
  /Warning: ReactDOM.render is no longer supported/,
  /Warning: An update to .* inside a test was not wrapped in act/,
  /Warning: Each child in a list should have a unique/,
  /Could not establish connection/,
  /FirebaseError/,
];

const _err  = console.error.bind(console);
const _warn = console.warn.bind(console);

beforeEach(() => {
  console.error = (...a) => { if (!SUPPRESS_PATTERNS.some(p => String(a[0]).match(p))) _err(...a); };
  console.warn  = (...a) => { if (!SUPPRESS_PATTERNS.some(p => String(a[0]).match(p))) _warn(...a); };
});

afterEach(() => {
  console.error = _err;
  console.warn  = _warn;
  vi.clearAllMocks();
});
