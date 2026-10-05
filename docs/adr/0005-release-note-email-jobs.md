# ADR 0005: All-member email as a resumable job, behind an owner-granted permission

**Status**: Accepted (implemented)
**Date**: 2026-10-05

## Context

`sendReleaseNoteEmail` emailed every user one by one inside a single HTTPS
callable. Three problems grew with membership:

- A callable has a bounded run time; a long sequential loop eventually times
  out mid-send, and the admin sees a spinner, then an error, with an unknown
  number of emails already out.
- Brevo rate-limits; a failed send was logged and skipped, never retried.
- Any admin — or anyone holding one admin's session — could email the whole
  membership with one click and no preview.

## Decision

```mermaid
sequenceDiagram
    participant A as Admin form
    participant P as previewReleaseNoteEmail
    participant S as sendReleaseNoteEmail
    participant J as releaseNoteEmailJobs/{id}
    participant T as onReleaseNoteEmailJobCreated
    A->>P: preview
    P-->>A: subject, html, recipient count
    A->>S: confirm
    S->>J: create {status: queued}
    S-->>A: jobId
    J-->>T: onCreate
    loop batches of 10, one retry each
        T->>J: sent / failed
        J-->>A: live progress
    end
    T->>J: status done
```

- **Send is a job.** The callable validates and queues a document in a
  transaction; a Firestore trigger (9-minute budget, one instance) claims it —
  still queued, still the note's current job, note still published — then
  sends in batches with a retry, writing progress and a heartbeat after each.
  A second send is refused while one is live. A job that stalls (timeout) is
  closed by the next send, which resumes after the last member it reached
  (recipients go in uid order), so nobody is emailed twice.
- **Preview first.** The admin sees the rendered email and the recipient
  count before confirming.
- **Owner-granted permission.** Sending needs `users/{uid}.canEmailMembers` on
  top of the admin role. No client can write that flag: any admin can create
  admins, so an in-app grant (even "another admin only") could be self-served
  with a second account. The project owner grants it with
  `functions/scripts/grant-email-members.mjs`, which needs Google Cloud access.

## Alternatives rejected

- **Cloud Tasks queue** — more infrastructure (queue, IAM, task handler) for a
  club that sends a handful of these a year; a Firestore job document gives
  the same decoupling and doubles as the progress feed.
- **A separate "release manager" role** — a new role touches every rule and
  guard; one capability flag on admins covers the actual risk.
- **Approval workflow (draft → review → published)** — heavier than the risk
  warrants; preview + the owner-held grant address accidental and single-account
  misuse.
- **"Another admin grants it" in the app** — tried first; a single admin can
  mint a second admin account and approve themselves.

## Consequences

- New collection `releaseNoteEmailJobs` (admin read, Functions write) and
  fields `users.canEmailMembers`, `releaseNotes.emailJob`.
- Existing admins can't send until the owner runs the grant script — a
  deliberate one-time step after deploy.
- One job covers a few thousand recipients; beyond that the trigger would need
  to continue across invocations.
