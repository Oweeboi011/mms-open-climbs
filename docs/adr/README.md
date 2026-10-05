# Architecture Decision Records

Significant architectural decisions are recorded here, one file per decision,
named `NNNN-title-with-hyphens.md` using the next available sequence number.

ADRs are append-only. To reverse or revise a decision, write a new ADR that
supersedes the old one and cross-link both — don't rewrite history.

See [CONTRIBUTING.md — Architecture Decision Records](../guides/CONTRIBUTING.md#decisions)
for the process and [`.github/instructions/adr.instructions.md`](../../.github/instructions/adr.instructions.md)
for the authoring rules.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-admin-payments-pages-refactor.md) | Admin payments-related pages — consolidation & consistency | Implemented | 2026-07-29 |
| [0002](0002-code-quality-gates.md) | Code quality gates — what a machine enforces vs. what a reviewer judges | Implemented; amended by 0003 | 2026-08-06 |
| [0003](0003-minimum-viable-quality-harness.md) | Minimum viable quality harness | Accepted | 2026-10-05 |
| [0004](0004-services-layer.md) | Firebase only through `src/services` | Accepted | 2026-10-05 |
