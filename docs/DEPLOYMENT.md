# Deployment

## Prerequisites

- Firebase CLI: `npm install -g firebase-tools`
- Node.js 20+
- A Firebase project with Firestore, Authentication, and Cloud Functions enabled
- A Vercel account (or alternative static host)
- A Brevo account for transactional email

---

## 1. Firebase Project Setup

```
firebase login
firebase use --add   # select your project
```

Enable these Firebase services in the console:

- Authentication (Email/Password + Google providers)
- Cloud Firestore
- Cloud Functions

---

## 2. Firestore Database

Create a Firestore database named `openclimbs` (not the default `(default)`).

Deploy security rules and indexes:

```
firebase deploy --only firestore
```

---

## 3. Cloud Functions

### Install dependencies

```
cd functions
npm install
```

### Configure secrets

```
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set BREVO_FROM_EMAIL
firebase functions:secrets:set APP_URL
```

Set `APP_URL` to your production frontend URL, e.g. `https://mms-open-climbs.vercel.app`.

### Deploy functions

```
firebase deploy --only functions
```

---

## 4. Frontend (Vercel)

### Build

```
npm run build
```

### Environment variables

Set these in Vercel (Project Settings > Environment Variables):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_APP_URL=https://mms-open-climbs.vercel.app
```

### Deploy to Vercel

Connect the GitHub repo to Vercel. The `vercel.json` in the root configures SPA rewrites:

```
vercel --prod
```

Or push to the main branch if auto-deploy is enabled.

---

## 5. Set First Admin

After deploying, create your account via the signup page, then promote it to admin:

```
node scripts/set-admin.mjs <email-or-uid>
```

This requires Application Default Credentials or a service account key.

---

## Deploy Order Summary

```mermaid
flowchart TD
    A["1. firebase deploy --only firestore\nrules + indexes"] --> B["2. firebase deploy --only functions\nrequires secrets to be set first"]
    B --> C["3. vercel --prod\nor push to main branch"]
    C --> D["4. node scripts/set-admin.mjs email\nfirst-time admin setup only"]
```

---

## Local Development

```mermaid
flowchart LR
    E["Terminal 1\nfirebase emulators:start\n--only auth,firestore,functions"]
    V["Terminal 2\nnpm run dev\nlocalhost:5173"]
    EU["Emulator UI\nlocalhost:4000"]

    E --> EU
    E --> V
```

```bash
# Terminal 1 — Firebase emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2 — Vite dev server
npm run dev
```

Point your `.env` `VITE_FIREBASE_*` values at the emulator when testing locally. See Firebase emulator docs for emulator connection config.
