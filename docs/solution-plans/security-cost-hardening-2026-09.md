# Security and cost hardening — September 2026

What changed, and the order it has to go live in. The code is one commit on
`develop`; the steps marked **(console)** are one-time infrastructure settings
that live outside the repo.

## Deploy order

The new storage rules read the `admin` custom claim, and the new Firestore
rules read the registrant roster from `climbInternal`. Neither depends on a
backfill to stay usable:

- An admin whose token lacks the claim gets it on their next app load:
  AuthContext calls the `ensureAdminClaim` callable, which issues it from
  their `users/` role.
- `isRegisteredFor` still accepts the legacy `climbs/{id}.registeredUserIds`
  list until a climb's roster has moved.

The scripts below still finish the job — they issue claims to admins who
haven't opened the app, and remove the public roster and officer emails from
existing climb docs. They need Application Default Credentials
(`gcloud auth application-default login`), are dry runs unless given
`--apply`, and are safe to re-run. Run them after the deploy.

1. **Admin claims**
   ```bash
   node scripts/backfill-admin-claims.mjs          # review the list
   node scripts/backfill-admin-claims.mjs --apply
   ```
   Admins pick the claim up on their next token refresh (AuthContext forces
   one when the claim is behind the profile); signing out and in is instant.
2. **Roster and officer emails → climbInternal**
   ```bash
   node scripts/backfill-climb-denorm.mjs
   node scripts/backfill-climb-denorm.mjs --apply
   ```
   Until this runs, existing climbs still expose the legacy roster and
   officer emails, and a member who cancels keeps briefing access through
   the legacy list.
3. **Smoke test** as a member on a real climb: register unpaid, submit a
   payment, submit a second payment, open the climb's briefing, upload a
   document. As an admin: open a member's receipt, replace a GCash QR.

## One-time infrastructure (console / CLI)

| What | How | Why |
| --- | --- | --- |
| Firestore TTL | `gcloud firestore fields ttls update expireAt --collection-group=pageViews --enable-ttl --database=openclimbs --project=mms-open-climbs`, and the same for `--collection-group=failedRequests` | New page views and error logs carry `expireAt` (90 days). Without the policy the field does nothing. Rows written before this change have no `expireAt` and are never deleted by TTL — purge them once if the collection is large |
| Storage lifecycle | `gcloud storage buckets update gs://<bucket> --lifecycle-file=storage-lifecycle.json` | Deletes member uploads (receipts, medical certificates, permits, waivers) 2 years after upload. **This is a data-retention decision — confirm 730 days suits the club before applying.** |
| Function image cleanup | `npx firebase-tools functions:artifacts:setpolicy --project mms-open-climbs` | Every functions deploy leaves a container image in Artifact Registry; without a cleanup policy they accumulate and are billed |
| App Check | Firebase Console → App Check → register the web app with reCAPTCHA v3; add the site key as the `VITE_APPCHECK_SITE_KEY` GitHub secret and redeploy; watch the metrics for a few days, then **Enforce** for Firestore and Storage | The only real limit on scripted writes to the open `pageViews`/`failedRequests` collections |
| Budget alert | Google Cloud Console → Billing → Budgets & alerts → a monthly budget with alerts at 50/90/100% | Nothing else notices a runaway bill |

## What was fixed

### Security

| Finding | Fix |
| --- | --- |
| Any signed-in user could read every member's receipts and medical documents | `storage.rules`: private upload folders are owner-or-admin (`token.admin`) for read; members may only add new files to their own folder, never overwrite or delete |
| Registrant uids were public on `climbs/{id}.registeredUserIds` | Roster moved to admin-only `climbInternal/{id}`; the rules and triggers read and write it there |
| Any signed-in user could replace the GCash QR, climb images and templates | Admin-only writes, content-type checked |
| Members could forge `verified` payment entries or edit accepted amounts | Rules allow a member to append exactly one `submitted` entry and leave earlier entries unchanged; `amountPaid` can grow by at most that entry. The client appends with `arrayUnion` |
| Members could create registrations with any status or payment state | Create rule pins status, payment state, verification fields, `memberType` values and the waiver name |
| Confirmation emails could be sent to any address | The registration's `email` must equal the account's own (`request.auth.token.email`) |
| HTML injection into officer/admin emails | Every email template escapes its arguments (`escaped()` in `functions/src/index.js`) |
| Uploads accepted any file type | Images/PDF for receipts; images/PDF/Word for documents |
| No security headers on Firebase Hosting | HSTS, `X-Frame-Options`, `frame-ancestors`, nosniff, Referrer-Policy and Permissions-Policy in `firebase.json` |
| Duplicate registrations | `onRegistrationCreated` deletes a second live registration for the same user and climb before any email |
| Officer emails public | Moved to `climbInternal/{id}.officerEmails` |
| Feedback unbounded, open to non-participants | Must be on the roster; fields and lengths pinned |
| Deleted accounts left personal data behind | `deleteUserAccount` strips health/contact fields from their registrations, deletes their notifications and their uploaded files |
| `createUser` accepted any role string | Only `member` or `admin` |
| Stray emulator files committed | Removed and ignored |

### Cost

| Finding | Fix |
| --- | --- |
| Dashboard re-read every registration and climb on each registration write | `loadAll()` runs once per visit |
| Analytics read up to 6,000 docs per open | Queries bounded to the 30-day window the charts show; caps lowered |
| `pageViews`/`failedRequests` grow forever | `expireAt` + TTL (see above) |
| Full-size photo uploads | Images over 400 KB are downscaled to 2000px JPEG in the browser (`src/utils/compressImage.js`) |
| No instance cap on functions | `setGlobalOptions({ maxInstances: 5 })` |
| Hashed build assets re-downloaded | `Cache-Control: immutable` on `/assets/**` |

## Deliberately not changed

- **`isAdmin()` in Firestore rules still reads `users/{uid}`** instead of the
  claim. The read is what makes a demotion take effect immediately; a claim
  stays valid in an issued ID token for up to an hour.
- **Unreviewed payments still count toward a member's balance.** That is the
  documented intent in `src/utils/payments.js` (members shouldn't be chased
  for money they've already sent). With forged verdicts now blocked, the
  remaining risk is an honest-looking but false claim, which admins still
  review.
- **Guest-fee self-declaration** (`memberType`): there is no membership list
  to check it against. The rules only restrict it to `member`/`joiner`.
- **ClimbsManage / ManagePayments live listeners** over all registrations stay
  — both pages exist to show live balances, and a listener only bills changed
  documents after its first load.
- **Officer phone numbers** stay on the public climb doc (see DATA.md).
- **react-router 6 → 7 and the `uuid` advisory under `firebase-admin`** —
  the remaining moderate `npm audit` items need breaking upgrades.
- **A full script/style Content-Security-Policy** — needs browser testing
  against Maps, Google sign-in, Storage and fonts before it can be enforced.

## Testing

- `npm run test:rules` — 53 emulator checks of `firestore.rules` and
  `storage.rules` (needs Java). Not part of `npm test`.
- `npm run qa` — build plus frontend and functions tests with coverage.
