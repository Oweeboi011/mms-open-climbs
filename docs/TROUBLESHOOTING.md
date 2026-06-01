# Troubleshooting

## Frontend

### "Module not found" or alias errors

Ensure `@` alias is configured in `vite.config.js` and you ran `npm install`.

---

### Blank page after deploy to Firebase Hosting

Check that `firebase.json` has the SPA rewrite rule:

```json
"rewrites": [{ "source": "**", "destination": "/index.html" }]
```

---

### Firebase config missing / "No Firebase App" error

Ensure all `VITE_FIREBASE_*` environment variables are set in your `.env` file at the project root. These are baked into the bundle by Vite at build time. After changing `.env`, re-run `npm run build` before deploying.

---

### Google sign-in popup blocked

The app falls back to `signInWithRedirect` automatically when the popup is blocked. This is handled in `AuthContext.jsx`. Ensure your Firebase project's Authorized Domains list includes your deployment domain.

---

## Cloud Functions

### Functions deploy fails with "secret not found"

Run the following before deploying:

```
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set BREVO_FROM_EMAIL
firebase functions:secrets:set APP_URL
```

---

### Emails not sending

1. Verify `BREVO_API_KEY` and `BREVO_FROM_EMAIL` are set correctly as secrets.
2. Check that `BREVO_FROM_EMAIL` is a verified sender in your Brevo account.
3. Check Cloud Function logs: `firebase functions:log`

---

### "permission-denied" when calling createUser

The caller must have `role: admin` in Firestore `users/{uid}`. Use the admin setup script:

```
node scripts/set-admin.mjs <email-or-uid>
```

---

## Firestore

### Registrations not updating registrationCount

The count is maintained by the `onRegistrationCreated` and `onRegistrationUpdated` Cloud Function triggers. If the count is wrong:

1. Check that functions are deployed: `firebase deploy --only functions`
2. Check function logs for errors: `firebase functions:log`

---

### "Missing or insufficient permissions" in browser

The Firestore security rules may not be deployed. Run:

```
firebase deploy --only firestore:rules
```

Also ensure the user is signed in and the Firestore database name is `openclimbs` (set in `src/firebase/config.js`).

---

## Admin Access

### Cannot access /admin

Your user account's `role` field in Firestore must be `admin`. Run:

```
node scripts/set-admin.mjs your@email.com
```

This script requires Firebase Admin SDK credentials (ADC or service account key).
