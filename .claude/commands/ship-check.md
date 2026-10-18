Pre-ship readiness check for the current branch. Run before pushing to `develop` (which deploys) or opening a PR.

Check all of the following from the repo root and report a punch list:

1. `npm run qa` — every CI quality gate: lint, layering, CSS collisions, duplication, dead code, secrets, build, bundle budget, both test suites with coverage ratchets
2. `npm run test:integration` — if `firebase/*.rules` changed (needs Java 21)
3. `npm run test:e2e` — if a visitor/member/admin journey changed (needs Java 21)
4. `npm run audit:deps` — no moderate+ advisories in production dependencies
5. Lockfiles — if dependencies changed, `package-lock.json` was written by npm 10 (`npx npm@10 install`), or CI's `npm ci` fails
6. Git status — no uncommitted changes that belong in this change; commits follow conventional-commit format
7. Ratchets — `LEGACY` (eslint.config.js), `tools/inline-styles-legacy.json`, coverage floors and bundle budgets only moved the right way
8. Docs — changed behaviour in `src/` or `functions/src/` is reflected in `docs/guides/` (and an ADR if a design decision changed)

For any failing check, show the exact error and the one-line fix. For passing checks, just show a checkmark and the key metric (e.g., "✓ 760 tests, 79.9% lines").
