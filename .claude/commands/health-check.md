Run a quick health check of the project's current state and surface anything that looks off.

Check the following in parallel and report findings:

1. **Git state** — uncommitted changes, untracked files, divergence of `develop` from `origin/develop` (a push to `develop` deploys)
2. **CI** — `gh run list --limit 8`: latest Firebase CI/CD, Supply chain & patterns, CodeQL, Create-Release and CSP watch results
3. **Open PRs and issues** — `gh pr list`, `gh issue list` (csp-watch files CSP violations as an issue)
4. **Dependencies** — `npm run audit:deps` (production deps, moderate+, frontend and functions)
5. **Static gates** — `npm run quality` (lint, layering, CSS collisions, duplication, dead code, secrets)
6. **Env** — `.env` exists, `VITE_USE_FIREBASE_EMULATOR` is what the user expects (not `true` means `npm run dev` hits production data)

Present results as a brief status board: green (ok), yellow (worth checking), red (action needed). One line per item.
