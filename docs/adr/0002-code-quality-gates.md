# ADR 0002: Code quality gates — what a machine enforces vs. what a reviewer judges

**Status**: Implemented
**Date**: 2026-08-06
**Supersedes / extends**: nothing; complements [ADR 0001](0001-admin-payments-pages-refactor.md), which surfaced the duplication and file-size problems this ADR puts guardrails around.

## Context

ADR 0001 found copy-pasted fee logic across three admin pages and two files over
1,300 lines. It fixed those instances by hand. Nothing stopped them recurring.

At the same time the repo had **no linter at all** — despite the CI job being
named "Build, Lint & Test" and `docs/wiki/CONTRIBUTING.md` describing coding
standards (naming, no inline styles, hooks-only) that existed purely as prose.
The only automated quality signal was the coverage threshold in
`vite.config.js`.

The question this ADR answers is not "should we lint" but: **for each kind of
quality decision, is it deterministic enough to gate on, and if so with what?**
Adopting a rule as a warning nobody reads is worse than not adopting it, because
it creates the appearance of enforcement.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Classify every quality rule into **Gate** (deterministic, fails the build), **Advisory** (reported, never blocks), or **Reviewed** (PR checklist). Record the tier explicitly. | The failure mode of "add all the tools" is a wall of warnings that trains everyone to ignore CI. Naming the tier forces the honest question: is this really machine-checkable? |
| 2 | Enforce layering with **`eslint-plugin-boundaries`** (per-file, in-editor) **and** `dependency-cruiser` (whole-graph). | They catch different things. Boundaries gives instant feedback on the bad import; dependency-cruiser catches cycles of arbitrary length, orphans, and broken `@/` alias resolution that no per-file rule can see. |
| 3 | Reject **ArchUnitTS** and **API Extractor**. | Both require TypeScript. `.claude/CLAUDE.md` commits this codebase to plain JavaScript, and that constraint is not up for renegotiation to satisfy a tool. |
| 4 | Reject **madge**; keep only `dependency-cruiser` for cycle detection. | Strict superset. Two tools reporting the same cycles is two configs to maintain. |
| 5 | Defer **Stryker Mutator**. | Mutation testing answers "do the tests assert anything?" — a real question. But at ~64% line coverage the mutation score would largely re-measure the coverage gap. It becomes informative once coverage is high, not before. |
| 6 | Set size/complexity ceilings at **today's worst offender**, and treat them as ratchets that must be lowered when a file is split. | A ceiling of 500 lines would have failed on day one against five files, and the pragmatic response would have been to disable the rule. A ceiling of 2100 is not an endorsement of 2100-line files — it is a guarantee the next one can't be 2101. Ratchets convert an unwinnable one-shot cleanup into monotonic progress. |
| 7 | Fold the gates into the **existing `npm run qa`** rather than a parallel CI job. | `qa` is already the documented pre-deploy gate and the only thing `firebase-ci-cd.yml` runs before promoting `develop` → `main`. A separate job would let a merge deploy code that failed the gates. |
| 8 | Make `npm audit` a **gate at high+** on production dependencies, clearing the two blocking advisories with targeted `overrides` rather than `npm audit fix --force`. Keep Semgrep advisory. | The critical (`websocket-driver`) and high (`form-data`) were both patch-level fixes on transitive deps — no reason to leave them open. Scoped overrides fix exactly those two paths without forcing majors elsewhere. The two remaining moderates need major upgrades (React Router v7, protobufjs 8) and get their own PRs. Semgrep stays advisory because unpinned community rulesets are noisy on first adoption and CodeQL already blocks. |
| 9 | Downgrade the **`eslint-plugin-react-hooks` v6 purity rules** to warnings under a `--max-warnings 19` cap; keep `rules-of-hooks` an error. | All 19 hits (`set-state-in-effect`, `purity`, `immutability`, `globals`, `static-components`, `exhaustive-deps`) need behavioural refactors that are out of scope for a tooling PR and carry real regression risk. The cap means the count can only go down. |
| 10 | Configure `react/no-unescaped-entities` to forbid only `>` and `}`. | The default also flags apostrophes in ordinary English copy — 33 hits, all harmless. Escaping them all would degrade readable JSX to satisfy a rule that exists to catch stray braces. |
| 11 | Delete the dead code the new rules surfaced (29 unused identifiers) rather than suppress it. | The whole point of turning the rule on. Removed: a dead `PayBadge` + `PAYMENT_STYLE` block in `ManagePayments.jsx`, three unused `Timestamp` helpers in `Analytics.jsx`, two orphaned status-class maps in `AllRegistrations.jsx`, and assorted unused imports. |
| 12 | Raise the **coverage floors to today's actuals** (frontend 45/45/35/34 → 63/62/56/52; functions 30/30/25/20 → 67/67/56/64) instead of leaving them where they were set. | The floors had drifted ~18 points below reality, which means they had stopped protecting anything — a PR could have deleted a third of the test suite and still gone green. Same ratchet logic as the size ceilings. |
| 13 | Keep naming conventions and "right abstraction" as **Reviewed**, and say so in the docs. | ESLint's `naming-convention` rule is TypeScript-only, and cohesion is not decidable. Writing "Reviewed" next to them is more useful than a gate that pretends to cover them. |

## Enforcement map

| Decision type | Tier | Tool |
|---|---|---|
| Layering / dependency direction | Gate | `eslint-plugin-boundaries`, `dependency-cruiser` |
| No circular dependencies | Gate | `dependency-cruiser`, `import/no-cycle` |
| Forbidden imports / banned APIs | Gate | `no-restricted-imports`, `dependency-cruiser` |
| Module reach / orphans / resolvability | Gate | `dependency-cruiser` |
| Complexity, file size, function length | Gate (ratcheted) | ESLint `complexity`, `max-lines`, `max-lines-per-function` |
| Duplication | Gate (≤ 4%) | `jscpd` |
| Coverage floor | Gate | Vitest V8 thresholds, Jest thresholds |
| Dangerous patterns | Gate (subset) + Advisory | ESLint, Semgrep, CodeQL |
| Dependency vulnerabilities | Gate (high+) | `npm audit --omit=dev` |
| React purity / effects | Advisory (ratcheted) | `eslint-plugin-react-hooks` |
| Naming | Reviewed | PR checklist |
| Abstraction / cohesion | Reviewed | PR checklist |

## Layering

```
App/main → pages → components → contexts → hooks → utils → firebase (leaf)
                                                    data (leaf)
```

`src/utils` is the domain layer and may not import `pages`, `components`,
`contexts`, or `hooks`. It *may* import `src/firebase` — a deliberate carve-out
for `auditLog.js` and `logFailedRequest.js`, which are write-only telemetry
sinks. The invariant that matters (domain never depends on UI or state) is
intact and enforced.

## Outcome

- `eslint.config.js` — flat config; **0 errors**, 19 ratcheted warnings across 55 source files and 30 test files.
- `.dependency-cruiser.cjs` — 10 graph rules; clean across 57 modules / 187 dependencies, all `@/` aliases resolving.
- `.jscpd.json` — duplication at 3.5% against a 4% ceiling.
- Coverage floors raised to just under actuals in `vite.config.js` and `functions/jest.config.cjs`.
- `.github/workflows/code-quality.yml` — `gates` and `supply-chain` (blocking), `patterns` (advisory).
- `websocket-driver` 0.7.4 → 0.7.5 (critical) and `form-data` 2.5.5 → 2.5.6 (high) via scoped `overrides`; both audits now clean at high+.
- `coverage/` and `functions/coverage/` untracked — 139 generated files that were producing diff churn on every test run.
- `package.json` — `lint`, `lint:fix`, `arch`, `arch:graph`, `dupes`, `audit:deps`, `quality`; `qa` now runs `quality` first.
- `docs/wiki/CODE-QUALITY.md` — the working reference, including the ratchet table and the exit conditions for every advisory check.
- 29 dead identifiers removed across 8 files. 249 frontend tests still pass; production build unchanged.

## Follow-up / not yet done

- Lower the ceilings as the five oversized pages are split (`Event.jsx`, `ClimbForm.jsx`, `MyRegistrations.jsx`, `Register.jsx`, `Analytics.jsx`). Targets: 500 lines/file, 150 lines/function, complexity 20.
- Upgrade to React Router v7 and pick up `protobufjs` 8 when `firebase` bumps it, then lower `--audit-level` from `high` to `moderate`.
- Triage one Semgrep run, pin the ruleset, then make `patterns` blocking.
- Work the 19 react-hooks warnings down toward 0, lowering `--max-warnings` each time.
- Extend linting to `functions/` — currently excluded; it has its own dependency tree and CommonJS/ESM mix and deserves its own config.
- Reconsider Stryker once coverage is meaningfully above the current ~45% floor.
