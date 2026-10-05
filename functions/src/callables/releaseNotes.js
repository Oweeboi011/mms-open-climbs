"use strict";

const logger = require("firebase-functions/logger");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { tplReleaseNote } = require("../email/templates");
const { logFailedRequest } = require("../shared/registrationOps");
const { requireAdmin } = require("../callables/users");
const { db } = require("../shared/admin");

// ── Emailing every member about a published release note ─────────────────────
// Sending is a job: the callable queues releaseNoteEmailJobs/{id} and returns
// at once; triggers/releaseNoteEmailJobs.js sends in batches and writes
// progress the admin form watches. Only admins who another admin has granted
// `canEmailMembers` may queue one (the rules stop self-granting).

async function requireEmailSender(uid) {
  const caller = await requireAdmin(uid);
  if (caller?.canEmailMembers !== true) {
    throw new HttpsError(
      "permission-denied",
      "Emailing every member needs the \"Can email members\" permission, granted by another admin.",
    );
  }
}

async function loadPublishedNote(releaseNoteId) {
  if (!releaseNoteId) {
    throw new HttpsError("invalid-argument", "releaseNoteId is required.");
  }
  const snap = await db.doc(`releaseNotes/${releaseNoteId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Release note not found.");
  const note = snap.data();
  if (note.status !== "published") {
    throw new HttpsError("failed-precondition", "Only published release notes can be emailed.");
  }
  return note;
}

// Send order and resume cursor: signup time, then uid. Members who sign up
// while a send is stalled sort last, so a resumed job still reaches them.
const cursorOf = (u) => ({ at: u.createdAt?.toMillis?.() ?? 0, id: u.id });
function isAfter(u, cursor) {
  if (!cursor) return true;
  const k = cursorOf(u);
  return k.at > cursor.at || (k.at === cursor.at && k.id > cursor.id);
}
const byCursor = (a, b) => {
  const x = cursorOf(a);
  const y = cursorOf(b);
  return x.at - y.at || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
};

async function emailRecipients() {
  const usersSnap = await db.collection("users").get();
  return usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u) => u.email)
    .sort(byCursor);
}

function renderReleaseNoteEmail(note) {
  const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
  return {
    subject: `MMS Open Climbs Update: ${note.title}`,
    html: tplReleaseNote({ title: note.title, body: note.body, appUrl }),
  };
}

// The job document is the lock. A queued job may wait behind others (the
// trigger runs one at a time); a sending job writes heartbeatAt every batch.
// Past these limits it died without cleaning up, and no longer blocks.
const QUEUED_LIMIT_MS = 60 * 60 * 1000;
const SILENT_LIMIT_MS = 15 * 60 * 1000;

function isLocked(job, now = Date.now()) {
  const since = job?.queuedAt || job?.createdAt?.toMillis?.() || 0;
  if (job?.status === "queued") return now - since < QUEUED_LIMIT_MS;
  if (job?.status === "sending") return now - (job.heartbeatAt || since) < SILENT_LIMIT_MS;
  return false;
}

// What members would receive, and how many of them — shown before sending.
exports.previewReleaseNoteEmail = onCall(async (request) => {
  await requireEmailSender(request.auth?.uid);
  const note = await loadPublishedNote(request.data?.releaseNoteId);
  const recipients = await emailRecipients();
  return { ...renderReleaseNoteEmail(note), recipients: recipients.length };
});

exports.sendReleaseNoteEmail = onCall(async (request) => {
  try {
    await requireEmailSender(request.auth?.uid);
    const { releaseNoteId } = request.data || {};
    await loadPublishedNote(releaseNoteId);
    const recipients = await emailRecipients();
    const noteRef = db.doc(`releaseNotes/${releaseNoteId}`);
    const jobRef = db.collection("releaseNoteEmailJobs").doc();
    // One transaction, so two simultaneous clicks can't both queue a send.
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(noteRef)).data()?.emailJob?.id;
      const currentJob = current ? (await tx.get(db.doc(`releaseNoteEmailJobs/${current}`))).data() : null;
      if (isLocked(currentJob)) {
        throw new HttpsError("failed-precondition", "This note is already being sent.");
      }
      // A job that stalled mid-send (e.g. hit the 9-minute limit): close it and
      // carry on after the last member it reached, so nobody gets it twice.
      const unfinished = currentJob && !["done", "superseded"].includes(currentJob.status);
      const resume = unfinished ? currentJob.lastCursor || currentJob.afterCursor || null : null;
      if (["queued", "sending"].includes(currentJob?.status)) {
        tx.update(db.doc(`releaseNoteEmailJobs/${current}`), { status: "failed", error: "Stalled; resumed by a new job." });
      }
      tx.set(jobRef, {
        ...(resume ? { afterCursor: resume } : {}),
        releaseNoteId,
        status: "queued",
        total: recipients.length,
        sent: 0,
        failed: 0,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        queuedAt: Date.now(),
      });
      tx.update(noteRef, { emailJob: { id: jobRef.id, status: "queued" } });
    });
    const job = jobRef;
    logger.info("[sendReleaseNoteEmail] Queued", { releaseNoteId, jobId: job.id, total: recipients.length });
    return { jobId: job.id, total: recipients.length };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    await logFailedRequest({ type: "email", source: "sendReleaseNoteEmail", message: err.message });
    throw new HttpsError("internal", err.message);
  }
});

Object.assign(module.exports, { emailRecipients, renderReleaseNoteEmail, cursorOf, isAfter });

// ── Release note draft generation from GitHub commit history ──────────────────
const GITHUB_REPO_OWNER = "Oweeboi011";
const GITHUB_REPO_NAME = "mms-open-climbs";
const GITHUB_DEFAULT_BRANCH = "main";

const RELEASE_NOTE_TYPE_LABELS = {
  feat: "New Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Improvements",
};
const RELEASE_NOTE_NOISE_TYPES = new Set([
  "docs",
  "style",
  "test",
  "chore",
  "ci",
  "build",
  "revert",
]);

async function githubApi(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new HttpsError(
      "failed-precondition",
      "GITHUB_TOKEN secret is not configured.",
    );
  }
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "mms-open-climbs-functions",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpsError(
      "internal",
      `GitHub API error ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  return res.json();
}

function shapeCommit(raw) {
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    subject: raw.commit.message.split("\n")[0],
    date: raw.commit.author?.date || raw.commit.committer?.date || null,
    author: raw.commit.author?.name || "",
  };
}

// Most recent release note that recorded the commit it was generated up to —
// this is the checkpoint the next draft should start from.
async function findLastSourceCommit() {
  const snap = await db
    .collection("releaseNotes")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();
  for (const doc of snap.docs) {
    const sourceCommit = doc.data().sourceCommit;
    if (sourceCommit) return sourceCommit;
  }
  return null;
}

function groupCommitsIntoChangelog(commits) {
  const groups = {
    "New Features": [],
    Fixes: [],
    Performance: [],
    Improvements: [],
  };
  let dropped = 0;

  for (const { subject } of commits) {
    if (/coverage/i.test(subject)) {
      dropped++;
      continue;
    }
    const match = subject.match(/^(\w+)(\([^)]*\))?:\s*(.+)$/);
    if (match) {
      const [, type, , rest] = match;
      if (RELEASE_NOTE_NOISE_TYPES.has(type)) {
        dropped++;
        continue;
      }
      const label = RELEASE_NOTE_TYPE_LABELS[type];
      if (label) {
        groups[label].push(rest.charAt(0).toUpperCase() + rest.slice(1));
        continue;
      }
    }
    groups["Improvements"].push(
      subject.charAt(0).toUpperCase() + subject.slice(1),
    );
  }

  const sections = Object.entries(groups).filter(([, items]) => items.length > 0);
  const body = sections
    .map(([label, items]) => `${label}\n${items.map((i) => `- ${i}`).join("\n")}`)
    .join("\n\n");
  return { body, dropped };
}

// ── Callable: list recent commits + last checkpoint for the admin's picker ────
exports.getReleaseNoteCommitOptions = onCall(
  { secrets: ["GITHUB_TOKEN"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const since = await findLastSourceCommit();
      const raw = await githubApi(
        `/commits?sha=${GITHUB_DEFAULT_BRANCH}&per_page=30`,
      );
      const commits = raw.map(shapeCommit);

      return { since, commits };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

// ── Callable: build a title/body draft from commits since the last checkpoint ─
exports.generateReleaseNoteDraft = onCall(
  { secrets: ["GITHUB_TOKEN"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const { until } = request.data;
      if (!until) {
        throw new HttpsError("invalid-argument", "until (a commit sha) is required.");
      }

      const since = await findLastSourceCommit();

      let rawCommits;
      if (since) {
        if (since === until) {
          rawCommits = [];
        } else {
          const compare = await githubApi(`/compare/${since}...${until}`);
          rawCommits = compare.commits || [];
        }
      } else {
        const list = await githubApi(`/commits?sha=${until}&per_page=50`);
        rawCommits = list;
      }

      const commits = rawCommits.map(shapeCommit);
      const { body, dropped } = groupCommitsIntoChangelog(commits);

      const untilCommit = commits[commits.length - 1] || null;
      const dateSource = untilCommit?.date ? new Date(untilCommit.date) : new Date();
      const title = `What's New — ${dateSource.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`;

      return {
        title,
        body,
        sourceCommit: until,
        commitCount: commits.length,
        droppedCount: dropped,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);
