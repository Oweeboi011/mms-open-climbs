# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

MMS Open Climbs is an event management portal for the Metropolitan Mountaineering Society. Members browse climb schedules, register for events, sign digital waivers, and submit GCash payment proofs. Admins verify payments, manage climbs, and track registrations.

## Commands

```bash
# Development
npm run dev                   # Vite dev server at localhost:5173
npm run build                 # Production build to dist/
npm run preview               # Preview production build locally

# Testing
npm test                      # Run frontend tests once (Vitest)
npm run test:watch            # Frontend tests in watch mode
npm run test:coverage         # Coverage report (HTML + LCOV)
npm run test:ui               # Vitest dashboard
npm run test:all              # Frontend + Cloud Functions tests
npm run test:strict           # Enforces coverage thresholds (pre-deploy)

# QA / pre-deploy
npm run qa                    # build + test:strict

# Cloud Functions
npm --prefix functions test           # Jest tests for functions
npm --prefix functions run serve      # Functions emulator
```

### Local emulator setup

```bash
# Terminal 1
firebase emulators:start --only auth,firestore,functions
# Emulator UI: http://localhost:4000

# Terminal 2 — set VITE_USE_FIREBASE_EMULATOR=true in .env first
npm run dev
# App: http://localhost:5173
```

`src/firebase/config.js` only connects to local emulators when `VITE_USE_FIREBASE_EMULATOR=true` is set in `.env` (in addition to running in dev mode) — without it, `npm run dev` talks to the real Firebase project.

### Run a single test file

```bash
npx vitest run tests/SomeComponent.test.jsx
```

### Admin setup

```bash
node scripts/set-admin.mjs your@email.com   # Promote a user to admin role
node scripts/seed-climbs.mjs               # Load sample climb data
node scripts/purge-admin-pageviews.mjs     # Maintenance: clean admin page views
```

## Architecture

**Stack**: React 18 + Vite SPA → Firebase Hosting → Cloud Firestore (`openclimbs` database) + Firebase Auth + Firebase Storage + Cloud Functions v2 (Node 20/22) + Brevo SMTP for email.

### Key files

- `src/App.jsx` — router with route guards (`ProtectedRoute`, `AdminRoute`)
- `src/firebase/config.js` — Firebase SDK init; exports `db`, `auth`, `storage`. Note: connects to the named database `"openclimbs"`, not the default.
- `src/contexts/AuthContext.jsx` — manages Firebase Auth lifecycle, creates `users/` Firestore doc on signup, handles Google OAuth redirect fallback
- `src/contexts/GuideContext.jsx` — guide/officer state
- `functions/src/index.js` — all Cloud Functions: document triggers send transactional email via Brevo on registration create/update; callable functions for admin ops

### Routes

- **Public**: `/`, `/event/:climbId`, `/login`, `/signup`, `/forgot-password`
- **Authenticated** (requires `currentUser`): `/register/:climbId`, `/my-registrations`, `/waiver/:registrationId`
- **Admin only** (requires `role: admin` on Firestore `users/` doc): `/admin/*`

### Data flow

1. Components subscribe to Firestore via `onSnapshot` (real-time). Always return the unsubscribe function from `useEffect`.
2. Payment proof images upload to Storage at `proofs/{registrationId}/{filename}`.
3. Firestore document creates/updates trigger Cloud Functions which call Brevo API to email members, climb officers, and admin CCs.

### Firestore collections

`climbs`, `registrations`, `users`, `pageViews`. See `docs/DATA.md` for full schema.

### Email flow

Cloud Functions use Brevo API v3. Brevo credentials are Firebase secrets (not `.env`). The pattern is: member confirmation email + officer notification + CC all admins.

## Testing

Frontend tests use **Vitest + Testing Library** with a jsdom environment. All Firebase SDK modules are globally mocked in `tests/setup.js` — tests never make real Firestore calls.

- Wrap components with `renderWithProviders()` from `tests/helpers.jsx` to get `AuthContext` + `GuideContext`.
- Use `climbFixture` and other fixtures from helpers for test data.
- Coverage thresholds are enforced in `vite.config.js`: ~45% lines/statements, ~35% functions, ~34% branches.

Cloud Functions tests use **Jest** with `--experimental-vm-modules`. Config: `functions/jest.config.cjs`.

## Environment variables

Frontend vars are `VITE_*` prefixed (in `.env`):
- `VITE_FIREBASE_*` — Firebase SDK config
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_APP_BASE_URL`

Functions env (in `functions/.env`):
- `BREVO_API_KEY`, `FROM_EMAIL`, `APP_URL`

Copy `.env.example` and `functions/.env.example` to get started.

## Vite / build notes

- Firebase SDK modules are split into separate chunks to minimize initial bundle size (see `vite.config.js` `manualChunks`).
- `publicDir` is set to `images/` — static images are served from there.
- Use the `@` path alias for imports from `src/` (e.g., `import Foo from "@/components/Foo"`).

## Coding conventions

- Functional components with hooks only — no class components, no TypeScript migration.
- No inline styles; use design tokens from `src/styles/globals.css`. Do not introduce Tailwind, CSS-in-JS, or other CSS frameworks.
- Naming: PascalCase components, camelCase variables/functions, ALL_CAPS constants, kebab-case CSS custom properties.
- Only comment where intent is non-obvious; no JSDoc added to code you didn't write.

## Docs

Detailed references live in `docs/`:
- `ARCHITECTURE.md` — system design and component diagrams
- `DATA.md` — Firestore schema
- `API.md` — Cloud Functions API signatures
- `TESTING.md` — test patterns and coverage guide
- `DEPLOYMENT.md` — production deployment checklist
- `SECURITY.md` — Firestore rules and security model
- `CONTRIBUTING.md` — git workflow, coding standards, PR process
- `TROUBLESHOOTING.md` — common issues and fixes
