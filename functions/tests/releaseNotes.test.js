"use strict";

/**
 * Tests for the release-notes callables in functions/src/index.js:
 * sendReleaseNoteEmail, getReleaseNoteCommitOptions, generateReleaseNoteDraft.
 * These were previously untested (see docs/adr/0002-code-quality-gates.md
 * follow-up on functions coverage).
 *
 * Uses a small in-memory Firestore fake (path-routed maps) supporting the
 * collection().orderBy().limit().get() and collection().get() shapes these
 * handlers use, since index.test.js's flat mockDb only supports doc().get().
 */

const releaseNotesStore = {};
const usersStore = {};
const updates = [];

function resetStores() {
  for (const k of Object.keys(releaseNotesStore)) delete releaseNotesStore[k];
  for (const k of Object.keys(usersStore)) delete usersStore[k];
  updates.length = 0;
}

function storeFor(col) {
  if (col === "releaseNotes") return releaseNotesStore;
  if (col === "users") return usersStore;
  throw new Error(`Unmocked collection: ${col}`);
}

function docRef(path) {
  const [col, id] = path.split("/");
  const store = storeFor(col);
  return {
    get: async () => ({
      exists: store[id] !== undefined,
      data: () => store[id],
    }),
    update: async (patch) => {
      updates.push({ path, patch });
      store[id] = { ...(store[id] || {}), ...patch };
    },
  };
}

function collectionRef(name) {
  const store = storeFor(name);
  return {
    get: async () => ({
      docs: Object.entries(store).map(([id, data]) => ({
        id,
        data: () => data,
      })),
    }),
    orderBy: () => ({
      limit: (n) => ({
        get: async () => {
          const docs = Object.entries(store)
            .sort(([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, n)
            .map(([id, data]) => ({ id, data: () => data }));
          return { docs };
        },
      }),
    }),
  };
}

const mockDb = {
  doc: jest.fn((path) => docRef(path)),
  collection: jest.fn((name) => collectionRef(name)),
};

jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/auth", () => ({ getAuth: () => ({}) }));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockDb,
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
    increment: jest.fn((n) => ({ n })),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (_opts, fn) => fn,
  onDocumentUpdated: (_opts, fn) => fn,
  onDocumentUpdatedWithAuthContext: (_opts, fn) => fn,
  onDocumentDeleted: (_opts, fn) => fn,
}));
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts, fn) => fn,
}));
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (...args) => (args.length === 2 ? args[1] : args[0]),
  onRequest: (...args) => (args.length === 2 ? args[1] : args[0]),
  HttpsError: class HttpsError extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));
jest.mock("@google-cloud/bigquery", () => ({
  BigQuery: jest.fn().mockImplementation(() => ({ query: jest.fn() })),
}));

const index = require("../src/index");
const { FieldValue } = require("firebase-admin/firestore");

beforeEach(() => {
  resetStores();
  mockDb.doc.mockImplementation((path) => docRef(path));
  mockDb.collection.mockImplementation((name) => collectionRef(name));
  FieldValue.serverTimestamp.mockImplementation(() => "SERVER_TS");
  process.env.BREVO_API_KEY = "k";
  process.env.BREVO_FROM_EMAIL = "noreply@mms.ph";
  process.env.GITHUB_TOKEN = "gh-token";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  });
});

describe("sendReleaseNoteEmail callable", () => {
  it("throws unauthenticated when caller has no auth", async () => {
    await expect(
      index.sendReleaseNoteEmail({ auth: null, data: {} }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied for a non-admin caller", async () => {
    usersStore["u1"] = { role: "member" };
    await expect(
      index.sendReleaseNoteEmail({
        auth: { uid: "u1" },
        data: { releaseNoteId: "rn1" },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when releaseNoteId is missing", async () => {
    usersStore["admin-1"] = { role: "admin" };
    await expect(
      index.sendReleaseNoteEmail({ auth: { uid: "admin-1" }, data: {} }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws not-found when the release note doesn't exist", async () => {
    usersStore["admin-1"] = { role: "admin" };
    await expect(
      index.sendReleaseNoteEmail({
        auth: { uid: "admin-1" },
        data: { releaseNoteId: "missing" },
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws failed-precondition when the note isn't published", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = { status: "draft", title: "Draft note" };
    await expect(
      index.sendReleaseNoteEmail({
        auth: { uid: "admin-1" },
        data: { releaseNoteId: "rn1" },
      }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("emails every user with an email and records the sent count", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = {
      status: "published",
      title: "New feature",
      body: "It works.",
    };
    usersStore["m1"] = { email: "a@a.com", displayName: "A" };
    usersStore["m2"] = { email: "b@b.com" };
    usersStore["m3"] = {}; // no email — should be skipped

    const result = await index.sendReleaseNoteEmail({
      auth: { uid: "admin-1" },
      data: { releaseNoteId: "rn1" },
    });

    expect(result).toEqual({ sent: 2, total: 2 });
    expect(updates).toEqual([
      {
        path: "releaseNotes/rn1",
        patch: { emailSentAt: "SERVER_TS", emailSentCount: 2 },
      },
    ]);
  });

  it("keeps going and reports a partial count when one recipient's email fails", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = {
      status: "published",
      title: "New feature",
      body: "It works.",
    };
    usersStore["m1"] = { email: "a@a.com" };
    usersStore["m2"] = { email: "b@b.com" };

    let calls = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const result = await index.sendReleaseNoteEmail({
      auth: { uid: "admin-1" },
      data: { releaseNoteId: "rn1" },
    });

    expect(result).toEqual({ sent: 1, total: 2 });
  });

  it("wraps an unexpected error as internal", async () => {
    usersStore["admin-1"] = { role: "admin" };
    mockDb.doc.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    await expect(
      index.sendReleaseNoteEmail({
        auth: { uid: "admin-1" },
        data: { releaseNoteId: "rn1" },
      }),
    ).rejects.toMatchObject({ code: "internal" });
  });
});

describe("getReleaseNoteCommitOptions callable", () => {
  it("throws permission-denied for a non-admin caller", async () => {
    usersStore["u1"] = { role: "member" };
    await expect(
      index.getReleaseNoteCommitOptions({ auth: { uid: "u1" }, data: {} }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns the last checkpoint and shaped commits from GitHub", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = { createdAt: 2, sourceCommit: "abc123" };
    releaseNotesStore["rn0"] = { createdAt: 1, sourceCommit: "old000" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            sha: "deadbeefcafe",
            commit: {
              message: "feat: add thing\n\nbody",
              author: { name: "Dev", date: "2026-01-01" },
            },
          },
        ]),
    });

    const result = await index.getReleaseNoteCommitOptions({
      auth: { uid: "admin-1" },
      data: {},
    });

    expect(result.since).toBe("abc123");
    expect(result.commits).toEqual([
      {
        sha: "deadbeefcafe",
        shortSha: "deadbee",
        subject: "feat: add thing",
        date: "2026-01-01",
        author: "Dev",
      },
    ]);
  });

  it("wraps a GitHub API error as internal", async () => {
    usersStore["admin-1"] = { role: "admin" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("rate limited"),
    });
    await expect(
      index.getReleaseNoteCommitOptions({ auth: { uid: "admin-1" }, data: {} }),
    ).rejects.toMatchObject({ code: "internal" });
  });

  it("fails precondition when GITHUB_TOKEN is not configured", async () => {
    delete process.env.GITHUB_TOKEN;
    usersStore["admin-1"] = { role: "admin" };
    await expect(
      index.getReleaseNoteCommitOptions({ auth: { uid: "admin-1" }, data: {} }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("generateReleaseNoteDraft callable", () => {
  it("throws invalid-argument when until is missing", async () => {
    usersStore["admin-1"] = { role: "admin" };
    await expect(
      index.generateReleaseNoteDraft({ auth: { uid: "admin-1" }, data: {} }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("returns an empty draft when since equals until", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = { createdAt: 1, sourceCommit: "same-sha" };

    const result = await index.generateReleaseNoteDraft({
      auth: { uid: "admin-1" },
      data: { until: "same-sha" },
    });

    expect(result.commitCount).toBe(0);
    expect(result.body).toBe("");
    expect(result.sourceCommit).toBe("same-sha");
  });

  it("fetches the full commit list when there is no prior checkpoint", async () => {
    usersStore["admin-1"] = { role: "admin" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            sha: "111aaaa",
            commit: {
              message: "fix(payments): correct rounding",
              author: { name: "Dev", date: "2026-02-01" },
            },
          },
          {
            sha: "222bbbb",
            commit: {
              message: "chore: bump deps",
              committer: { date: "2026-02-02" },
            },
          },
          {
            sha: "333cccc",
            commit: { message: "improve coverage reporting" },
          },
        ]),
    });

    const result = await index.generateReleaseNoteDraft({
      auth: { uid: "admin-1" },
      data: { until: "333cccc" },
    });

    expect(result.commitCount).toBe(3);
    // "chore:" is noise (dropped) and the coverage-mention commit is dropped
    // regardless of type — only the fix: commit survives into the body.
    expect(result.droppedCount).toBe(2);
    expect(result.body).toContain("Fixes");
    expect(result.body).toContain("Correct rounding");
    expect(result.title).toMatch(/^What's New — /);
  });

  it("compares since...until when a prior checkpoint exists", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = { createdAt: 1, sourceCommit: "old-sha" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          commits: [
            {
              sha: "444dddd",
              commit: { message: "plain commit with no conventional prefix" },
            },
          ],
        }),
    });

    const result = await index.generateReleaseNoteDraft({
      auth: { uid: "admin-1" },
      data: { until: "new-sha" },
    });

    expect(result.commitCount).toBe(1);
    expect(result.body).toContain("Improvements");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/compare/old-sha...new-sha"),
      expect.anything(),
    );
  });
});
