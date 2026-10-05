"use strict";

const logger = require("firebase-functions/logger");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { sendEmail } = require("../email/sendEmail");
const { tplReleaseNote } = require("../email/templates");
const { logFailedRequest } = require("../shared/registrationOps");
const { requireAdmin } = require("../callables/users");
const { db } = require("../shared/admin");

// ── Callable: admin emails all members about a published release note ────────
exports.sendReleaseNoteEmail = onCall(
  { secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"] },
  async (request) => {
    try {
      await requireAdmin(request.auth?.uid);

      const { releaseNoteId } = request.data;
      if (!releaseNoteId) {
        throw new HttpsError("invalid-argument", "releaseNoteId is required.");
      }

      const noteRef = db.doc(`releaseNotes/${releaseNoteId}`);
      const noteSnap = await noteRef.get();
      if (!noteSnap.exists) {
        throw new HttpsError("not-found", "Release note not found.");
      }
      const note = noteSnap.data();
      if (note.status !== "published") {
        throw new HttpsError(
          "failed-precondition",
          "Only published release notes can be emailed.",
        );
      }

      const usersSnap = await db.collection("users").get();
      const recipients = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.email);

      const appUrl = process.env.APP_URL || "https://mms-open-climbs.web.app";
      const html = tplReleaseNote({
        title: note.title,
        body: note.body,
        appUrl,
      });

      let sent = 0;
      for (const u of recipients) {
        try {
          await sendEmail({
            to: u.email,
            toName: u.displayName || u.email,
            subject: `MMS Open Climbs Update: ${note.title}`,
            html,
          });
          sent++;
        } catch (emailErr) {
          logger.error("[sendReleaseNoteEmail] Failed for recipient", {
            email: u.email,
            err: emailErr.message,
          });
          await logFailedRequest({
            type: "email",
            source: "sendReleaseNoteEmail",
            message: emailErr.message,
            userId: u.id,
          });
        }
      }

      await noteRef.update({
        emailSentAt: FieldValue.serverTimestamp(),
        emailSentCount: sent,
      });

      logger.info("[sendReleaseNoteEmail] Sent", {
        releaseNoteId,
        sent,
        recipients: recipients.length,
      });
      return { sent, total: recipients.length };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message);
    }
  },
);

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
