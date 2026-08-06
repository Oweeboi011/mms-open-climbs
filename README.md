# MMS Open Climbs

Event management portal for the Metropolitan Mountaineering Society (MMS). Members browse the annual climb schedule, view mountain profiles, register for events, sign digital waivers, submit GCash payments, and track their registrations. Administrators manage climbs, review registrations, verify payments, track transportation headcounts, and manage user accounts.

---

## System Overview

```mermaid
graph TB
    subgraph Browser["User Browser"]
        SPA["React SPA\n(Vite + React 18)"]
    end

    subgraph Firebase["Firebase Platform"]
        FH["Firebase Hosting\n(CDN)"]
        FA["Firebase Auth\n(Email + Google)"]
        FS["Cloud Firestore\n(openclimbs DB)"]
        ST["Firebase Storage\n(photos, proofs)"]
        CF["Cloud Functions v2\n(Node 22)"]
    end

    subgraph External["External"]
        BV["Brevo\n(Email)"]
    end

    SPA -->|served from| FH
    SPA --> FA
    SPA --> FS
    SPA --> ST
    SPA --> CF
    FS -->|document triggers| CF
    CF --> BV
```

| Layer               | Technology                        |
| ------------------- | --------------------------------- |
| Frontend            | React 18, Vite, React Router v6   |
| Hosting             | Firebase Hosting                  |
| Database            | Cloud Firestore (`openclimbs` DB) |
| Authentication      | Firebase Auth (Email + Google)    |
| Storage             | Firebase Storage                  |
| Backend Functions   | Cloud Functions v2 (Node 22)      |
| Transactional Email | Brevo SMTP API                    |
| Testing (Frontend)  | Vitest, Testing Library           |
| Testing (Functions) | Jest                              |

---

## Features

### Member features

- Browse the climb schedule as a card grid with elevation, difficulty, and trip distance at a glance
- View full mountain profiles: summit elevation, difficulty, jump-off point, elevation gain, distances, features, itinerary, water source notes, and external links (AllTrails, Google Maps)
- Trail photo carousel on event and registration pages — click any photo to open a full-screen lightbox with keyboard navigation
- Register for a climb with personal details, emergency contact, experience level, and medical disclosure
- Select optional fees (e.g., transport) and review the full fee breakdown before submitting
- Sign the digital liability waiver by typing your full name
- Pay via GCash — tap the QR code for a full-screen modal, scan, pay, and upload your receipt screenshot
- Track all your registrations with status (pending / confirmed / waitlisted / cancelled)
- Print your waiver for any confirmed registration
- See a one-time "what's new" popup after login for the latest release note, and browse the full history at any time on the Release Notes page
- In-app notification bell for status updates and announcements
- Guided welcome tour on first login walking through key member features
- Automatic thank-you email once a climb you joined has concluded

### Admin features

- Dashboard — overview of all climbs with type, slots, confirmed and pending counts
- Climbs management — create, edit, open and close registration, set GCash details and upload the QR code, manage trail photos
- Climb detail — per-climb registrations list with status and payment controls
- All registrations — cross-climb view with search, status and payment filters, and CSV export
- Payment management — verify or reject GCash proof per registration; transport headcount per climb
- User management — create accounts, correct or delete accounts, assign admin roles, link walk-in "Add Joiner" entries to an existing member
- Analytics — page view traffic dashboard
- Failure logging — review client-side error reports (`failedRequests`) for troubleshooting
- Release notes — publish "what's new" updates and optionally email every member about a published note, with AI-assisted draft generation from recent commits

---

## End-to-End Registration Flow

```mermaid
sequenceDiagram
    autonumber
    actor M as Member
    participant SPA as React App
    participant ST as Firebase Storage
    participant FS as Firestore
    participant CF as Cloud Functions
    participant EM as Brevo Email
    actor AD as Admin

    M->>SPA: Browse schedule, select climb
    M->>SPA: Sign in (Email or Google)
    M->>SPA: Fill registration form, select fees, sign waiver
    M->>SPA: Scan GCash QR, pay, upload receipt
    SPA->>ST: Upload GCash proof image
    ST-->>SPA: proofUrl
    SPA->>FS: Create registration {status: pending, paymentStatus: submitted}
    FS-->>M: My Registrations — pending

    FS->>CF: onRegistrationCreated trigger
    CF->>FS: Increment registrationCount on climb
    CF->>EM: Confirmation email to member + officer notification
    EM-->>M: Registration Received email with waiver link

    AD->>FS: Review GCash proof in Admin > Payments
    AD->>FS: Set paymentStatus = verified

    AD->>FS: Review registration in Admin > Climbs
    AD->>FS: Update status = confirmed / waitlisted / cancelled

    FS->>CF: onRegistrationUpdated trigger
    CF->>EM: Status update email to member
    EM-->>M: Status email
```

---

## Repository Structure

```mermaid
graph LR
    subgraph src["src/"]
        S1["App.jsx — main application router"]
        S2["main.jsx — React entry point"]
        S3["components/ — shared UI (Header, Footer, ClimbCard, ...)"]
        S4["contexts/ — AuthContext, GuideContext"]
        S5["data/ — static schedule data"]
        S6["firebase/ — Firebase SDK init and config"]
        S7["hooks/ — usePageTracking"]
        S8["pages/ — route-level page components"]
        S9["pages/admin/ — admin-only page components"]
        S10["styles/ — global CSS and design tokens"]
    end

    subgraph tests["tests/ and test/"]
        T1["tests/ — Vitest + Testing Library suites"]
        T2["test/ — shared render helpers and setup"]
    end

    subgraph functions["functions/"]
        F1["src/index.js — triggers, scheduled function, callables"]
        F2["tests/ — Jest suite for Cloud Functions"]
    end

    subgraph scripts["scripts/"]
        SC1["set-admin.mjs — promote a user to admin role"]
        SC2["seed-climbs.mjs — seed local emulator with sample climbs"]
        SC3["purge-admin-pageviews.mjs — remove admin-generated pageView docs"]
    end

    subgraph docs["docs/wiki/"]
        D1["ARCHITECTURE.md — system design and diagrams"]
        D2["API.md — Cloud Functions API reference"]
        D3["DEPLOYMENT.md — production setup and deploy guide"]
        D4["SECURITY.md — security model and OWASP assessment"]
        D5["CONTRIBUTING.md — workflow and coding standards"]
        D6["TESTING.md — test setup and coverage guide"]
        D7["DATA.md — Firestore schema reference"]
        D8["TROUBLESHOOTING.md — common issues and fixes"]
        D9["USER_MANUAL.md — end-user and admin guide"]
        D10["RELEASE_NOTES_FEATURE.md — release notes audit, roadmap, governance"]
        D11["CODE-QUALITY.md — quality gates, layering rules, ratchets"]
    end

    subgraph plans["docs/solution-plans/"]
        P1["mms-open-climb-web.md — web solution plan"]
        P2["mms-open-climb-mobile.md — mobile (Android/iOS) solution plan"]
    end

    infra["infra/ — reserved for future infrastructure as code"]
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`

### Setup

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Configure environment
cp .env.example .env
cp functions/.env.example functions/.env
# Fill in VITE_FIREBASE_* in .env
# Fill in BREVO_* and APP_URL in functions/.env

# 3. Start Firebase emulators (Terminal 1)
firebase emulators:start --only auth,firestore,functions

# 4. Start Vite dev server (Terminal 2)
npm run dev
```

- App: `http://localhost:5173`
- Emulator UI: `http://localhost:4000`

### Set first admin

```bash
node scripts/set-admin.mjs your@email.com
```

---

## Scripts Reference

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run frontend tests (Vitest) |
| `npm run test:watch` | Frontend tests in watch mode |
| `npm run test:coverage` | Frontend tests with coverage report |
| `npm run test:all` | Run frontend + function tests |
| `npm run test:strict` | Full strict coverage gate |
| `npm run lint` | ESLint: correctness, layering, banned imports, size ceilings |
| `npm run arch` | dependency-cruiser: cycles, layering, reachability |
| `npm run dupes` | jscpd duplication threshold |
| `npm run audit:deps` | npm audit, production dependencies, high+ |
| `npm run quality` | lint + arch + dupes |
| `npm run qa` | Quality gates + build + strict coverage (pre-deploy gate) |

---

## Documentation

| Document | Description |
| --- | --- |
| [ARCHITECTURE.md](docs/wiki/ARCHITECTURE.md) | System design, component diagrams, data model |
| [API.md](docs/wiki/API.md) | Cloud Functions API reference |
| [DEPLOYMENT.md](docs/wiki/DEPLOYMENT.md) | Production setup and deploy steps |
| [SECURITY.md](docs/wiki/SECURITY.md) | Security model, rules, and OWASP assessment |
| [DATA.md](docs/wiki/DATA.md) | Firestore schema and data reference |
| [TESTING.md](docs/wiki/TESTING.md) | Test setup, patterns, and coverage guide |
| [CONTRIBUTING.md](docs/wiki/CONTRIBUTING.md) | Contribution workflow and coding standards |
| [CODE-QUALITY.md](docs/wiki/CODE-QUALITY.md) | Quality gates, layering rules, and enforcement tiers |
| [docs/adr/](docs/adr/README.md) | Architecture Decision Records |
| [TROUBLESHOOTING.md](docs/wiki/TROUBLESHOOTING.md) | Common issues and fixes |
| [USER_MANUAL.md](docs/wiki/USER_MANUAL.md) | End-user and administrator usage guide |
| [RELEASE_NOTES_FEATURE.md](docs/wiki/RELEASE_NOTES_FEATURE.md) | Release notes feature audit, roadmap, and governance plan |
| [mms-open-climb-web.md](docs/solution-plans/mms-open-climb-web.md) | Web solution plan — challenges, recommendations, cost, environment, security |
| [mms-open-climb-mobile.md](docs/solution-plans/mms-open-climb-mobile.md) | Mobile (Android/iOS) solution plan — challenges, recommendations, cost, environment, security |
