# Deployment

## Table of Contents

- [Overview](#overview)
- [Infrastructure Diagram](#infrastructure-diagram)
- [Prerequisites](#prerequisites)
- [Deployment Order](#deployment-order)
- [Step 1 — Firebase Project Setup](#step-1--firebase-project-setup)
- [Step 2 — Firestore Database and Rules](#step-2--firestore-database-and-rules)
- [Step 3 — Firebase Storage Rules](#step-3--firebase-storage-rules)
- [Step 4 — Cloud Functions](#step-4--cloud-functions)
- [Step 5 — Frontend Build and Hosting](#step-5--frontend-build-and-hosting)
- [Step 6 — First Admin Setup](#step-6--first-admin-setup)
- [Deploy Everything at Once](#deploy-everything-at-once)
- [Local Development](#local-development)
- [Environment Reference](#environment-reference)
- [CI/CD Considerations](#cicd-considerations)

---

## Overview

MMS Open Climbs is deployed entirely on Firebase. There is no custom server to provision or manage. The deployment pipeline covers:

- **Firebase Hosting** — serves the React SPA from Firebase's global CDN
- **Cloud Firestore** — stores climbs, registrations, and users data
- **Firebase Storage** — stores trail photos and GCash payment proof images
- **Cloud Functions v2** — runs automated triggers and the `createUser` callable
- **Brevo** — handles all transactional email delivery

---

## Infrastructure Diagram

```mermaid
graph TB
    subgraph Developer["Developer Machine"]
        DEV["npm run build\nfirebase deploy"]
    end

    subgraph Firebase["Firebase Platform"]
        FH["Firebase Hosting\nCDN — global edge"]
        FS["Cloud Firestore\nopenclimbs database"]
        ST["Firebase Storage"]
        CF["Cloud Functions v2\nNode 20 — asia-east1"]
        FA["Firebase Auth"]
        SEC["Firebase Secrets Manager\nBREVO_API_KEY\nBREVO_FROM_EMAIL\nAPP_URL"]
    end

    subgraph External["External Services"]
        BV["Brevo SMTP API\nTransactional email"]
    end

    subgraph Users["End Users"]
        MB["Member Browser"]
        AB["Admin Browser"]
    end

    DEV -->|firebase deploy --only hosting| FH
    DEV -->|firebase deploy --only functions| CF
    DEV -->|firebase deploy --only firestore| FS

    MB -->|HTTPS| FH
    AB -->|HTTPS| FH
    FH --> FA
    FH --> FS
    FH --> ST
    FH --> CF
    CF --> SEC
    CF --> BV
```

---

## Prerequisites

Before starting, ensure you have:

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Bundled with Node 20 |
| Firebase CLI | Latest | `npm install -g firebase-tools` |
| Firebase project | — | With Firestore, Auth, Functions, and Storage enabled |
| Brevo account | — | For transactional email — verified sender required |

---

## Deployment Order

Follow this order strictly. Steps have dependencies: Functions require secrets; Hosting requires a successful build.

```mermaid
flowchart TD
    A["1. Firebase project login and setup\nfirebase login\nfirebase use --add"]
    B["2. Create Firestore openclimbs database\nFirebase Console"]
    C["3. Deploy Firestore rules and indexes\nfirebase deploy --only firestore"]
    D["4. Deploy Storage rules\nfirebase deploy --only storage"]
    E["5. Set Cloud Function secrets\nfirebase functions:secrets:set ..."]
    F["6. Install Function dependencies\ncd functions && npm install"]
    G["7. Deploy Cloud Functions\nfirebase deploy --only functions"]
    H["8. Configure frontend .env\ncopy .env.example to .env"]
    I["9. Build frontend\nnpm run build"]
    J["10. Deploy Hosting\nfirebase deploy --only hosting"]
    K["11. Set first admin\nnode scripts/set-admin.mjs email"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K
```

---

## Step 1 — Firebase Project Setup

```bash
# Authenticate with Firebase
firebase login

# Link this directory to your Firebase project
firebase use --add
```

Enable the following services in the Firebase Console:

- **Authentication** — Email/Password and Google providers
- **Cloud Firestore**
- **Cloud Functions**
- **Firebase Storage**

---

## Step 2 — Firestore Database and Rules

Create a Firestore database named **`openclimbs`** — not the default `(default)` database. This is required because the application code and Cloud Functions target this named database explicitly.

Deploy security rules and composite indexes:

```bash
firebase deploy --only firestore
```

This deploys both `firestore.rules` and `firestore.indexes.json`.

### Firestore rules summary

```mermaid
flowchart LR
    subgraph Rules["Firestore Security Rules"]
        R1["climbs\npublic read\nadmin write"]
        R2["registrations\nowner read + create\nadmin read + write all\ncreation gated on climb.status = open"]
        R3["users\nany signed-in read\nowner or admin update\nadmin delete"]
        R4["pageViews\npublic create\nadmin read/update/delete"]
    end
```

---

## Step 3 — Firebase Storage Rules

```bash
firebase deploy --only storage
```

This deploys `storage.rules`. Ensure your Storage rules allow authenticated uploads for payment proofs and trail photos.

---

## Step 4 — Cloud Functions

### Install dependencies

```bash
cd functions
npm install
cd ..
```

### Configure secrets

Set these secrets before deploying. Firebase will prompt for the values interactively.

```bash
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set BREVO_FROM_EMAIL
firebase functions:secrets:set APP_URL
```

| Secret | Value |
| --- | --- |
| `BREVO_API_KEY` | Your Brevo account API key |
| `BREVO_FROM_EMAIL` | A verified sender email address in your Brevo account |
| `APP_URL` | Your production URL, e.g. `https://<project-id>.web.app` |

### Deploy functions

```bash
firebase deploy --only functions
```

---

## Step 5 — Frontend Build and Hosting

### Configure environment variables

Copy the example environment file and fill in your Firebase project values:

```bash
cp .env.example .env
```

`.env` contents:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

These values are baked into the browser bundle at build time by Vite. Do not commit `.env` to source control.

### Build the frontend

```bash
npm run build
```

Output is written to the `dist/` folder. The `firebase.json` `hosting.public` setting points to `dist`.

### Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

The SPA catch-all rewrite in `firebase.json` ensures all routes resolve to `index.html` for React Router:

```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

---

## Step 6 — First Admin Setup

After deploying, create your user account via the sign-up page, then promote it to admin:

```bash
node scripts/set-admin.mjs your@email.com
```

This script uses the Firebase Admin SDK and requires Application Default Credentials (ADC) or a service account key configured in your environment.

---

## Deploy Everything at Once

To deploy Firestore rules, Functions, and Hosting in one command (after secrets are set and the frontend is built):

```bash
npm run build && firebase deploy
```

---

## Local Development

### Architecture

```mermaid
flowchart LR
    subgraph Local["Local Machine"]
        V["Vite Dev Server\nlocalhost:5173\nnpm run dev"]
        E["Firebase Emulator Suite\nlocalhost:4000 (UI)\nAuth, Firestore, Functions"]
    end

    subgraph Browser["Browser"]
        B["Developer Browser\npoints to localhost:5173"]
    end

    B --> V
    V --> E
```

### Start the emulators

```bash
firebase emulators:start --only auth,firestore,functions
```

The Emulator UI is available at `http://localhost:4000`.

### Start the Vite dev server

In a second terminal:

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

### Emulator connection

When connecting the frontend to local emulators, set `VITE_USE_EMULATORS=true` in your `.env` (if the app is wired to respect this flag), or configure `connectFirestoreEmulator`, `connectAuthEmulator`, and `connectFunctionsEmulator` in `src/firebase/config.js` during local development.

### Local Functions environment

Create `functions/.env` (based on `functions/.env.example`) for local secret values:

```
BREVO_API_KEY=your-brevo-key
BREVO_FROM_EMAIL=your-sender@email.com
APP_URL=http://localhost:5173
```

---

## Environment Reference

### Files

| File | Purpose | Committed? |
| --- | --- | --- |
| `.env` | Frontend Vite env vars | No (git-ignored) |
| `.env.example` | Template for `.env` | Yes |
| `functions/.env` | Functions env vars for emulator | No (git-ignored) |
| `functions/.env.example` | Template for `functions/.env` | Yes |

### Production secrets

Managed via Firebase Secrets Manager. Set with `firebase functions:secrets:set`. Never stored in files or source code.

---

## CI/CD Considerations

For automated deployments (GitHub Actions, etc.), the recommended approach is:

1. Store Firebase service account credentials as a CI secret (`FIREBASE_SERVICE_ACCOUNT`).
2. Store all `VITE_*` values as CI secrets and inject them during the build step.
3. Run `npm run qa` (build + strict tests) as a gate before deploying.
4. Deploy using `firebase deploy --only hosting,functions` with `--token` or Workload Identity Federation.

```mermaid
flowchart TD
    PR["Pull Request merged to main"]
    T["Run npm run qa\nbuild + strict test coverage"]
    D["firebase deploy\nhosting + functions"]
    N["Notify on failure"]

    PR --> T
    T -- "Pass" --> D
    T -- "Fail" --> N
```
