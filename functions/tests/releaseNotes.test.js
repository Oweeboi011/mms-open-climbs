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
const jobsStore = {};
const updates = [];

function resetStores() {
  for (const k of Object.keys(releaseNotesStore)) delete releaseNotesStore[k];
  for (const k of Object.keys(usersStore)) delete usersStore[k];
  for (const k of Object.keys(jobsStore)) delete jobsStore[k];
  updates.length = 0;
}

function storeFor(col) {
  if (col === "releaseNotes") return releaseNotesStore;
  if (col === "users") return usersStore;
  if (col === "releaseNoteEmailJobs") return jobsStore;
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
    add: async (data) => {
      const id = `job-${Object.keys(store).length + 1}`;
      store[id] = data;
      return { id };
    },
    doc: () => {
      const id = `job-${Object.keys(store).length + 1}`;
      return { id, path: `${name}/${id}` };
    },
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

// Runs the callback straight through; writes land in the stores.
async function runTransaction(fn) {
  const tx = {
    get: (ref) => docRef(ref.path).get(),
    set: (ref, data) => {
      const [col, id] = ref.path.split("/");
      storeFor(col)[id] = data;
    },
    update: (ref, patch) => docRef(ref.path).update(patch),
  };
  return fn(tx);
}

const mockDb = {
  doc: jest.fn((path) => ({ ...docRef(path), path })),
  collection: jest.fn((name) => collectionRef(name)),
  runTransaction: jest.fn(runTransaction),
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
  onDocumentWritten: (_opts, fn) => fn,
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
  mockDb.doc.mockImplementation((path) => ({ ...docRef(path), path }));
  mockDb.runTransaction.mockImplementation(runTransaction);
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
  const sender = () => {
    usersStore["admin-1"] = { role: "admin", canEmailMembers: true };
  };
  const call = (data, uid = "admin-1") => index.sendReleaseNoteEmail({ auth: uid ? { uid } : null, data });

  it("throws unauthenticated when caller has no auth", async () => {
    await expect(call({}, null)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws permission-denied for a non-admin caller", async () => {
    usersStore["u1"] = { role: "member", canEmailMembers: true };
    await expect(call({ releaseNoteId: "rn1" }, "u1")).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws permission-denied for an admin without canEmailMembers", async () => {
    usersStore["admin-1"] = { role: "admin" };
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B" };
    await expect(call({ releaseNoteId: "rn1" })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when releaseNoteId is missing", async () => {
    sender();
    await expect(call({})).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws not-found when the release note doesn't exist", async () => {
    sender();
    await expect(call({ releaseNoteId: "missing" })).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws failed-precondition when the note isn't published", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "draft", title: "Draft note" };
    await expect(call({ releaseNoteId: "rn1" })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("queues a job for every user with an email and marks the note", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "published", title: "New feature", body: "It works." };
    usersStore["m1"] = { email: "a@a.com" };
    usersStore["m2"] = {};

    const result = await call({ releaseNoteId: "rn1" });

    // admin-1 has no email, m2 has none: one recipient.
    expect(result).toEqual({ jobId: "job-1", total: 1 });
    expect(jobsStore["job-1"]).toMatchObject({ releaseNoteId: "rn1", status: "queued", total: 1, sent: 0, createdBy: "admin-1" });
    expect(releaseNotesStore["rn1"].emailJob).toMatchObject({ id: "job-1", status: "queued" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses while a send for the same note is still running", async () => {
    sender();
    releaseNotesStore["rn1"] = {
      status: "published",
      title: "T",
      body: "B",
      emailJob: { id: "j0", status: "sending" },
    };
    jobsStore["j0"] = { status: "sending", queuedAt: Date.now() - 20 * 60 * 1000, heartbeatAt: Date.now() };
    await expect(call({ releaseNoteId: "rn1" })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("keeps the lock while an earlier job waits in the queue", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "j0", status: "queued" } };
    jobsStore["j0"] = { status: "queued", queuedAt: Date.now() - 20 * 60 * 1000 };
    await expect(call({ releaseNoteId: "rn1" })).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("ignores a lock left by a job that died long ago", async () => {
    sender();
    releaseNotesStore["rn1"] = {
      status: "published",
      title: "T",
      body: "B",
      emailJob: { id: "j0", status: "sending" },
    };
    jobsStore["j0"] = { status: "sending", queuedAt: Date.now() - 60 * 60 * 1000, heartbeatAt: Date.now() - 30 * 60 * 1000 };
    await expect(call({ releaseNoteId: "rn1" })).resolves.toMatchObject({ jobId: "job-2" });
  });

  it("resumes after the last member a stalled job reached", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "j0", status: "sending" } };
    jobsStore["j0"] = { status: "sending", lastCursor: { at: 0, id: "m2" }, heartbeatAt: Date.now() - 30 * 60 * 1000 };
    const { jobId } = await call({ releaseNoteId: "rn1" });
    expect(jobsStore["j0"].status).toBe("failed");
    expect(jobsStore[jobId].afterCursor).toEqual({ at: 0, id: "m2" });
  });

  it("keeps the resume point when a resume job itself fails early", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "j1", status: "failed" } };
    jobsStore["j1"] = { status: "failed", afterCursor: { at: 0, id: "m2" } };
    const { jobId } = await call({ releaseNoteId: "rn1" });
    expect(jobsStore[jobId].afterCursor).toEqual({ at: 0, id: "m2" });
  });

  it("can send again after a failed job", async () => {
    sender();
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "j0", status: "failed" } };
    jobsStore["j0"] = { status: "failed" };
    await expect(call({ releaseNoteId: "rn1" })).resolves.toMatchObject({ jobId: "job-2" });
  });
});

describe("previewReleaseNoteEmail callable", () => {
  it("returns the rendered email and the recipient count", async () => {
    usersStore["admin-1"] = { role: "admin", canEmailMembers: true, email: "me@a.com" };
    usersStore["m1"] = { email: "a@a.com" };
    releaseNotesStore["rn1"] = { status: "published", title: "Maps", body: "Now with maps." };

    const result = await index.previewReleaseNoteEmail({ auth: { uid: "admin-1" }, data: { releaseNoteId: "rn1" } });

    expect(result.subject).toBe("MMS Open Climbs Update: Maps");
    expect(result.html).toContain("Now with maps.");
    expect(result.recipients).toBe(2);
  });
});

describe("release-note email job", () => {
  const { runReleaseNoteEmailJob } = require("../src/triggers/releaseNoteEmailJobs");
  const noSleep = { sleep: async () => {} };

  it("sends to everyone, records progress and stamps the note", async () => {
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["m1"] = { email: "a@a.com" };
    usersStore["m2"] = { email: "b@b.com" };

    await runReleaseNoteEmailJob("job-9", jobsStore["job-9"], noSleep);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(jobsStore["job-9"]).toMatchObject({ status: "done", sent: 2, failed: 0, total: 2 });
    expect(releaseNotesStore["rn1"]).toMatchObject({ emailSentCount: 2, emailJob: { id: "job-9", status: "done" } });
  });

  it("retries a failed send once and counts what still fails", async () => {
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["ok"] = { email: "ok@a.com" };
    usersStore["flaky"] = { email: "flaky@a.com" };
    usersStore["dead"] = { email: "dead@a.com" };
    const calls = {};
    global.fetch = jest.fn(async (_url, init) => {
      const to = JSON.parse(init.body).to[0].email;
      calls[to] = (calls[to] || 0) + 1;
      const fail = to === "dead@a.com" || (to === "flaky@a.com" && calls[to] === 1);
      return { ok: !fail, status: fail ? 500 : 201, json: async () => ({}), text: async () => "err" };
    });

    await runReleaseNoteEmailJob("job-9", jobsStore["job-9"], noSleep);

    expect(calls).toEqual({ "ok@a.com": 1, "flaky@a.com": 2, "dead@a.com": 2 });
    expect(jobsStore["job-9"]).toMatchObject({ status: "done", sent: 2, failed: 1 });
    expect(releaseNotesStore["rn1"].emailSentCount).toBe(2);
  });

  it("releases the note's lock when the job crashes", async () => {
    const { onReleaseNoteEmailJobCreated } = require("../src/triggers/releaseNoteEmailJobs");
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["m1"] = { email: "a@a.com" };
    mockDb.collection.mockImplementation((name) => {
      if (name === "users") throw new Error("Firestore unavailable");
      return collectionRef(name);
    });

    await onReleaseNoteEmailJobCreated({ params: { jobId: "job-9" }, data: { data: () => jobsStore["job-9"] } });

    expect(jobsStore["job-9"].status).toBe("failed");
    expect(releaseNotesStore["rn1"].emailJob).toEqual({ id: "job-9", status: "failed" });
  });

  it("does not send a job that a newer one replaced", async () => {
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-new", status: "sending" } };
    jobsStore["job-old"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["m1"] = { email: "a@a.com" };
    await runReleaseNoteEmailJob("job-old", jobsStore["job-old"], noSleep);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(jobsStore["job-old"].status).toBe("superseded");
    expect(releaseNotesStore["rn1"].emailJob).toEqual({ id: "job-new", status: "sending" });
  });

  it.each(["sending", "done"])("ignores a redelivered event while the job is %s", async (live) => {
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: live } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: live };
    usersStore["m1"] = { email: "a@a.com" };
    // The event carries the document as created, i.e. still "queued".
    await runReleaseNoteEmailJob("job-9", { releaseNoteId: "rn1", status: "queued" }, noSleep);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(jobsStore["job-9"].status).toBe(live);
    expect(releaseNotesStore["rn1"].emailJob.status).toBe(live);
  });

  it("treats a job with only createdAt as recently queued", async () => {
    usersStore["admin-1"] = { role: "admin", canEmailMembers: true };
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "j0", status: "queued" } };
    jobsStore["j0"] = { status: "queued", createdAt: { toMillis: () => Date.now() - 60_000 } };
    await expect(
      index.sendReleaseNoteEmail({ auth: { uid: "admin-1" }, data: { releaseNoteId: "rn1" } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("skips members a previous stalled job already reached", async () => {
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued", afterCursor: { at: 200, id: "m2" } };
    const at = (ms) => ({ toMillis: () => ms });
    usersStore["m1"] = { email: "m1@a.com", createdAt: at(100) };
    usersStore["m2"] = { email: "m2@a.com", createdAt: at(200) };
    usersStore["m3"] = { email: "m3@a.com", createdAt: at(300) };
    // Signed up during the stall; its uid sorts first but its signup is last.
    usersStore["a0"] = { email: "new@a.com", createdAt: at(999) };
    await runReleaseNoteEmailJob("job-9", jobsStore["job-9"], noSleep);
    const to = global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).to[0].email);
    expect(to).toEqual(["m3@a.com", "new@a.com"]);
    expect(jobsStore["job-9"]).toMatchObject({ status: "done", lastCursor: { at: 999, id: "a0" } });
  });

  it("does not send a note that was unpublished after queueing", async () => {
    releaseNotesStore["rn1"] = { status: "draft", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["m1"] = { email: "a@a.com" };
    await runReleaseNoteEmailJob("job-9", jobsStore["job-9"], noSleep);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(jobsStore["job-9"].status).toBe("failed");
  });

  it("keeps a finished job done when only the closing stamp fails", async () => {
    const { onReleaseNoteEmailJobCreated } = require("../src/triggers/releaseNoteEmailJobs");
    releaseNotesStore["rn1"] = { status: "published", title: "T", body: "B", emailJob: { id: "job-9", status: "queued" } };
    jobsStore["job-9"] = { releaseNoteId: "rn1", status: "queued" };
    usersStore["m1"] = { email: "a@a.com" };
    let transactions = 0;
    mockDb.runTransaction.mockImplementation((fn) => {
      transactions++;
      // claim succeeds; the final note stamp (2nd transaction) fails.
      if (transactions === 2) return Promise.reject(new Error("deadline exceeded"));
      return runTransaction(fn);
    });
    await onReleaseNoteEmailJobCreated({ params: { jobId: "job-9" }, data: { data: () => ({ releaseNoteId: "rn1", status: "queued" }) } });
    expect(jobsStore["job-9"].status).toBe("done");
  });

  it("fails the job when the note was deleted", async () => {
    jobsStore["job-9"] = { releaseNoteId: "gone" };
    await runReleaseNoteEmailJob("job-9", jobsStore["job-9"], noSleep);
    expect(jobsStore["job-9"].status).toBe("failed");
    expect(global.fetch).not.toHaveBeenCalled();
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
