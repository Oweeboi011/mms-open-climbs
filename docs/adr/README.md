# Architecture Decision Records

Why the system is shaped the way it is. One decision per file.

## Rules

1. Name it `NNNN-title-with-hyphens.md` with the next number, and add it to
   the index below in the same PR as the change.
2. Shape: **Status**, **Date**, then Context → Decision → Alternatives
   rejected → Consequences. Keep it to what a future maintainer needs.
3. Append-only. To change a decision, write a new ADR that supersedes the
   old one; in the old one, touch only the Status line and the link.
4. Start as `Proposed`; move to `Accepted` when merged.
5. Tie the rationale to this repo — name files, numbers, constraints.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-admin-payments-pages-refactor.md) | Admin payments-related pages — consolidation & consistency | Implemented | 2026-07-29 |
| [0002](0002-code-quality-gates.md) | Code quality gates — what a machine enforces vs. what a reviewer judges | Superseded by 0003 | 2026-08-06 |
| [0003](0003-minimum-viable-quality-harness.md) | Minimum viable quality harness | Accepted | 2026-10-05 |
| [0004](0004-services-layer.md) | Firebase only through `src/services` | Accepted | 2026-10-05 |
| [0005](0005-release-note-email-jobs.md) | All-member email as a resumable job, behind an owner-granted permission | Accepted | 2026-10-05 |
