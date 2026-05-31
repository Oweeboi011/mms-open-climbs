# MMS Open Climbs

Event management portal for MMS mountaineering club climbs. Members browse the climb schedule, register for events, sign digital waivers, and track their registrations. Admins manage climbs, review registrations, and handle user accounts.

## System Overview

```mermaid
graph TD
    SPA["React SPA\nVite + React 18\nVercel hosted"]
    Auth["Firebase Auth\nEmail/Password + Google"]
    Firestore["Cloud Firestore\nopenclimbs DB"]
    CF["Cloud Functions v2\nNode 20\nTriggers + Callables"]
    Brevo["Brevo SMTP API\nTransactional emails"]

    SPA --> Auth
    SPA --> Firestore
    SPA --> CF
    Firestore --> CF
    CF --> Brevo
```

## User Paths

### Member Registration Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Member
    participant FE as React SPA
    participant FA as Firebase Auth
    participant FS as Firestore
    participant CF as Cloud Functions
    participant EM as Brevo Email

    U->>FE: Browse climb schedule
    U->>FA: Sign in (email or Google)
    FA-->>FE: Auth token + user profile
    U->>FE: Open climb and click Register
    FE->>FE: Validate form + waiver signature
    FE->>FS: Create registration (status: pending)
    FS->>CF: Trigger onRegistrationCreated
    CF->>FS: Increment registrationCount on climb
    CF->>EM: Send confirmation email to member
    EM-->>U: Registration confirmation
```

### Admin Approval Flow

```mermaid
sequenceDiagram
    autonumber
    participant AD as Admin
    participant FE as React SPA
    participant FS as Firestore
    participant CF as Cloud Functions
    participant EM as Brevo Email
    participant U as Member

    AD->>FE: Open climb detail in admin panel
    AD->>FS: Update registration status
    FS->>CF: Trigger onRegistrationUpdated
    CF->>EM: Send status update email

    alt confirmed
        EM-->>U: Registration confirmed email
    else waitlisted
        EM-->>U: Waitlist notification email
    else cancelled
        CF->>FS: Decrement registrationCount
        EM-->>U: Cancellation email
    end
```

## Registration Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending : member submits form
    pending --> confirmed : admin confirms
    pending --> waitlisted : admin waitlists
    pending --> cancelled : admin rejects
    confirmed --> cancelled : admin cancels
    waitlisted --> confirmed : admin confirms
    waitlisted --> cancelled : admin cancels
    confirmed --> [*]
    cancelled --> [*]
```

## Local Development

### 1. Install dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your Firebase project values:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Start emulators and dev server

```bash
# Terminal 1 — Firebase emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2 — Vite dev server
npm run dev
```

- App: `http://localhost:5173`
- Emulator UI: `http://localhost:4000`

### 4. Set first admin

```bash
node scripts/set-admin.mjs your@email.com
```

## Repository Structure

```
src/
  components/     Shared UI components
  contexts/       React contexts (AuthContext)
  data/           Static schedule data
  firebase/       Firebase client config
  pages/          Route-level page components
  pages/admin/    Admin-only pages
  styles/         Global CSS and design tokens
functions/        Firebase Cloud Functions (Node 20)
infra/            (reserved for future IaC)
scripts/          Admin utility scripts
docs/             Architecture and operational docs
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
