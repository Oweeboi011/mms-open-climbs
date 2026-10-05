# Quality harness — delivery

What was delivered (2026-10) and how to keep it working. The *why* is in
[ADR 0003](../adr/0003-minimum-viable-quality-harness.md) and
[ADR 0004](../adr/0004-services-layer.md); the day-to-day reference is
[CODE-QUALITY.md](../guides/CODE-QUALITY.md).

## What it should do

Stop secrets, banned patterns, dead code, cycles, layering violations,
complexity growth, duplication and vulnerable packages from reaching
`main` — with one local command (`npm run qa`) and a seconds-long pre-commit
hook, not a fifty-step process.

## Delivered

| Commit | Change |
|---|---|
| `c161d2d` | Root cleanup: dead files gone, Firebase config grouped in `firebase/`, admin scripts beside their SDK, no hard-coded keys |
| `5aed1cb` | 0 high advisories; secretlint; Dependabot; CodeQL fixed; template workflows removed |
| `135e338` | functions/ linted; alias-aware boundaries; banned APIs; two-tier complexity ratchet; knip; one check per tool |
| `4afb880` | `src/services` as the only Firebase boundary (37 files migrated); shared upload helper and hooks |
| `4b57c7b` | Event / Register / ClimbForm (≈2k lines each → ≤ 266) and the functions monolith split |
| `e261b7a` | Tests organised by type; integration, Playwright e2e, bundle budget, axe a11y; pre-commit hook |
| `2b59b5c` | Deploy gated on integration + e2e; storage rules deployed |
| `510207d` | `AuthLayout`, `TextField` (labels linked to inputs) |

Measured at the end: frontend coverage floor 63 → 78% lines (actual 79.3%);
functions 87.2% lines; duplication 4% ceiling → 0.32% actual (ceiling now 1%);
frontend tests 712 → 744, plus 69 rules checks and 10 e2e runs (4 smoke
paths + a sign-up → register → My Climbs journey, desktop and phone); initial load
270.6 kB gzip (+2 kB from the services layer).

## Keeping it working

- When you split a `LEGACY` file, lower its numbers in the same commit.
- Raise coverage floors and lower budgets when reality improves; never the
  reverse to go green.
- Dependabot PRs land on `develop` weekly; the audit job is the backstop.
- Re-check the pinned tools (knip 5.55, jscpd 4) once contributors' machines
  no longer block native binaries.

## Not done / next

- Work down `LEGACY`: `ClimbPaymentCard`, `RegistrantRow`, `AllRegistrations`,
  `Analytics`, `ClimbDetail`, `MyRegistrations`, then the functions triggers.
- Replace remaining inline styles with design tokens (convention, not yet a gate).
- Grow `TextField` adoption across the other ~100 hand-written form groups.
- Consider Stryker once coverage is consistently above 80%.
