# Contributing

The one place for local setup, the git workflow and what a reviewer checks.
Production deployment is in [DEPLOYMENT.md](DEPLOYMENT.md); the gates every
change passes are in [CODE-QUALITY.md](CODE-QUALITY.md).

## Setup

| Tool | Version | Why |
|---|---|---|
| Node.js | 22 (CI) / 20.12+ | app, functions, scripts |
| npm | **10** | npm 11 rewrites the lockfile in ways CI's `npm ci` rejects |
| Java | 21 | only for the emulators (`test:integration`, `test:e2e`, local emulator dev) |

```bash
npm install                      # also installs the pre-commit hook
npm --prefix functions install
cp .env.example .env             # fill in VITE_FIREBASE_*
cp functions/.env.example functions/.env
```

Run against the emulators (recommended) or the real project:

```bash
# Terminal 1 — emulators (UI at http://localhost:4000)
firebase emulators:start --only auth,firestore,functions
# Terminal 2 — set VITE_USE_FIREBASE_EMULATOR=true in .env first
npm run dev                      # http://localhost:5173
```

Without `VITE_USE_FIREBASE_EMULATOR=true`, `npm run dev` talks to the **real**
Firebase project.

Admin helpers (read the key from `.env`):

```bash
node scripts/set-admin.mjs <uid> "<Name>" <email>   # make a user admin (uses your firebase login)
node scripts/seed-climbs.mjs                   # sample climbs
node functions/scripts/purge-admin-pageviews.mjs   # needs GOOGLE_APPLICATION_CREDENTIALS
```

## Workflow

```mermaid
gitGraph
    commit id: "develop"
    branch feature/x
    commit id: "change + tests"
    checkout develop
    merge feature/x id: "PR into develop"
    checkout main
    merge develop id: "CI promotes + deploys when every gate is green"
```

- Branch from `develop`: `feature/`, `fix/`, `docs/`, `chore/`, `test/`.
- Conventional-commit PR titles (checked by CI); they drive the release notes.
- **Never deploy from a laptop.** A push to `develop` is the deploy: CI runs
  the gates, merges to `main` and deploys. Local `firebase deploy --only
  hosting|functions` has broken event links and env config before.
- Never push to `main` or force-push shared branches.

## Before you push

The pre-commit hook lints and secret-scans staged files automatically. Then:

```bash
npm run qa                 # what CI's quality job runs
npm run test:integration   # if you touched firebase/*.rules
npm run test:e2e           # if you changed a visitor/member journey
```

## Review checklist

Machines check everything in [CODE-QUALITY.md](CODE-QUALITY.md). A reviewer
checks what they can't:

- **Single responsibility.** Does each new module have one reason to change?
  A component renders; a hook owns state and effects; a service talks to
  Firebase; a util is a pure function.
- **Dependencies point inward.** UI depends on services and utils, never the
  reverse; nothing outside `src/services` knows Firestore exists.
- **Reuse before writing.** Is there already a component, hook, service or
  util for this (`TextField`, `AuthLayout`, `Modal`, `useClimbRoster`,
  `uploadRegistrationFile`, …)?
- **Names say what, not how.** `subscribeToClimbRegistrations`, not `getData2`.
- **Tests would fail if the code were wrong**, not just run the lines.
- **Ratchets moved the right way**: `LEGACY` entries lowered or deleted when a
  file was split, thresholds never raised to go green.
- **Docs**: guide updated if behaviour changed; ADR if a design decision did.

## Coding conventions

Functional components and hooks only; JavaScript, not TypeScript; `@/`
imports; design tokens from `src/styles/globals.css` instead of new inline
styles; no CSS frameworks. PascalCase components, camelCase functions,
ALL_CAPS constants. Comment only where intent isn't obvious.

## Decisions

Architectural decisions go in [`docs/adr/`](../adr/README.md) as
`NNNN-title.md`, added in the same PR as the change. Authoring rules:
[`.github/instructions/adr.instructions.md`](../../.github/instructions/adr.instructions.md).

## Reporting issues

Use the GitHub issue templates: steps to reproduce, expected vs actual,
browser (frontend) or `firebase functions:log` output (backend).
