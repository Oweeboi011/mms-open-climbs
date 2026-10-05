# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

MMS Open Climbs is an event management portal for the Metropolitan Mountaineering Society. Members browse climb schedules, register for events, sign digital waivers, and submit GCash payment proofs. Admins verify payments, manage climbs, and track registrations.

## Commands

```bash
npm run dev                   # Vite dev server at localhost:5173
npm run build                 # Production build to dist/

npm test                      # unit + component + accessibility (Vitest)
npm run test:watch            # Vitest watch mode
npx vitest run tests/unit/payments.test.js   # one file
npm --prefix functions test   # Cloud Functions (Jest)
npm run test:integration      # security rules on emulators (needs Java 21)
npm run test:e2e              # Playwright smoke on emulators (needs Java 21)

npm run qa                    # every gate CI runs: lint, arch, dupes, deadcode, secrets,
                              # build, bundle budget, tests with coverage thresholds
```

A husky pre-commit hook runs ESLint and secretlint on staged files.

### Local emulators

```bash
firebase emulators:start --only auth,firestore,functions   # UI: localhost:4000
# set VITE_USE_FIREBASE_EMULATOR=true in .env, then:
npm run dev
```

Without that flag `npm run dev` talks to the **real** Firebase project.

### Admin helpers

```bash
node scripts/set-admin.mjs <uid> "<Name>" <email>    # uses your firebase login
node scripts/seed-climbs.mjs                          # sample climbs
node functions/scripts/purge-admin-pageviews.mjs      # admin SDK scripts live in functions/scripts
```

## Architecture

**Stack**: React 18 + Vite SPA → Firebase Hosting → Cloud Firestore (named database `openclimbs`, not the default) + Auth + Storage + Cloud Functions v2 (Node 22) + Brevo for email.

### Layers — enforced by ESLint (ADR 0004)

- `src/services/` is the **only** code that imports `firebase/*` or `src/firebase/config`. Services return plain `{ id, ...data }` objects, never snapshots. Add or reuse a service function instead of calling the SDK.
- `src/utils/` is pure domain logic: no I/O, no React.
- Pages compose; big pages split into `src/pages/<feature>/` (sections + a page hook for state + a pure `…Model.js`). Examples: `pages/event/`, `pages/register/`, `pages/admin/climbForm/`.
- Reuse before writing: `TextField`, `AuthLayout`, `Modal`, `useClimbRoster`, `useLiveClimbData`, `uploadRegistrationFile`, `callFunction(name, payload)`.
- Web storage only via `services/browserStorage` (survives Safari private mode).
- Strict limits for new code (complexity 20, 200-line functions, 600-line files); legacy files are pinned in `LEGACY` in `eslint.config.js` — only ever lower those numbers.

### Key files

- `src/App.jsx` — routes and guards (`ProtectedRoute`, `AdminRoute`)
- `src/firebase/config.js` — SDK init, App Check, emulator wiring
- `src/contexts/AuthContext.jsx` — auth lifecycle (through `services/auth` and `services/users`)
- `functions/src/index.js` — re-exports only; handlers in `triggers/`, `scheduled/`, `callables/`, shared code in `email/`, `shared/`
- `firebase/` — `firestore.rules`, `storage.rules`, indexes, CORS, storage lifecycle

### Routes

- **Public**: `/`, `/event/:climbId`, `/login`, `/signup`, `/forgot-password`
- **Authenticated**: `/register/:climbId`, `/my-registrations`, `/waiver/:registrationId`, `/release-notes`, `/privacy`, `/feedback/:climbId`
- **Admin** (`role: admin` on `users/{uid}`): `/admin/*`

### Data

- Live data via `subscribeTo…` service functions; return the unsubscribe from `useEffect`.
- Payment proofs and documents upload to `{prefix}/{climbId}/{userId|regId}/{timestamp}_{name}`; each payment is appended to the registration's `payments` array (see `src/utils/payments.js`).
- Collections: `climbs`, `climbPrivate`, `climbInternal`, `climbExpenses`, `registrations`, `feedback`, `users`, `pageViews`, `failedRequests`, `notifications`, `auditLog`, `releaseNotes` — schema in `docs/guides/DATA.md`.
- Firestore writes trigger Cloud Functions that email members, officers and admin CCs via Brevo.

## Testing

`tests/{unit,component,accessibility,integration,e2e,performance}`; Cloud Functions tests in `functions/tests`. Firebase is mocked globally in `tests/setup.js`; render with `renderWithProviders()` / `renderAtRoute()` from `tests/helpers.jsx`. Route `httpsCallable` mocks by name. Coverage thresholds are ratchets in `vite.config.js` and `functions/jest.config.cjs`. Details: `docs/guides/TESTING.md`.

## Environment

- `.env`: `VITE_FIREBASE_*`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_APPCHECK_SITE_KEY`, `VITE_APP_URL`, `VITE_USE_FIREBASE_EMULATOR`.
- Functions secrets (Firebase, not `.env` in production): `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `APP_URL`; optional `BILLING_EXPORT_TABLE`.
- Scripts read `VITE_FIREBASE_API_KEY` from `.env` — never hard-code keys (secretlint blocks them).

## Deploying

Push to `develop`; CI runs the gates, merges to `main` and deploys. Never deploy from a laptop.

## Coding conventions

- Functional components with hooks; JavaScript, not TypeScript.
- Design tokens from `src/styles/globals.css`; no new inline styles; no CSS frameworks.
- PascalCase components, camelCase functions, ALL_CAPS constants; `@/` imports.
- Comment only where intent is non-obvious.

## Docs

- `docs/guides/` — what it is: ARCHITECTURE, DATA, API, SECURITY, CONTRIBUTING, TESTING, CODE-QUALITY, DEPLOYMENT, TROUBLESHOOTING, USER_MANUAL
- `docs/solution-plans/` — how we deliver it
- `docs/adr/` — why (0003 quality harness, 0004 services layer)
- `CONTEXT.md` — domain glossary
