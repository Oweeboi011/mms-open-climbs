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

---

## GCash QR Code

### QR modal does not open

The QR image is always tappable. If no QR has been uploaded for the climb, the modal opens but shows an informational message rather than an image. Upload the QR via **Admin > Manage Payments** or the climb's edit form (**Admin > Climbs > Edit**).

### QR image is blurry in the modal

The modal renders the image at up to 280 px wide at full resolution. If it looks blurry, re-upload a higher-resolution QR image via **Admin > Manage Payments**.

---

## Trail Photos

### Photos not appearing on the event or registration page

1. Ensure at least one image URL has been added to the **Trail Photos** section in **Admin > Climbs > Edit**.
2. If uploaded via Firebase Storage, confirm the upload completed (thumbnail should appear in the admin form). If it failed, check the browser console for Storage permission errors.
3. If added via URL, confirm the URL is a direct image link (ending in `.jpg`, `.png`, etc.) and is publicly accessible. Google Photos share links are not direct image URLs and will not render.

### Carousel arrows not appearing

Arrows only show when there are multiple photos. With a single photo, no navigation controls are displayed.

### Lightbox does not open

Click directly on the main carousel image (cursor changes to a zoom icon). The thumbnail strip navigates the carousel but does not open the lightbox. Keyboard shortcuts (arrow keys to navigate, Escape to close) work once the lightbox is open.
