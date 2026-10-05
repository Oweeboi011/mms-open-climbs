# Troubleshooting

Symptom → likely cause → fix. Deploys only happen from CI
([DEPLOYMENT.md](DEPLOYMENT.md)); if a fix says "redeploy", push to `develop`.
Function logs: `firebase functions:log --only <functionName>`.

## Local development

| Symptom | Cause | Fix |
|---|---|---|
| Dev server writes to production data | `VITE_USE_FIREBASE_EMULATOR` isn't `true` | Set it in `.env`, start `firebase emulators:start --only auth,firestore,functions`, restart `npm run dev` |
| "No Firebase App" / blank page locally | `.env` missing `VITE_FIREBASE_*` | `cp .env.example .env` and fill it; `VITE_*` are read at build/start time |
| `npm run test:integration` / `test:e2e`: "Could not spawn java" | No JDK 21 on `PATH` | Install JDK 21 (CI installs it for you) |
| e2e: "Executable doesn't exist" | Playwright browser not installed | `npx playwright install chromium` |
| Emulator "port already in use" | An old emulator is still running | Stop it (PowerShell: `Get-NetTCPConnection -LocalPort 8080 \| % { Stop-Process -Id $_.OwningProcess -Force }`) |
| CI `npm ci` fails after you changed deps | Lockfile written by npm 11 | Regenerate with `npx npm@10 install` |
| knip / jscpd crash on a locked-down Windows machine | Native binaries blocked by App Control | Use the pinned versions in `package.json`; don't upgrade them |
| Commit rejected by the hook | ESLint or secretlint found something | Fix it — see [CODE-QUALITY.md](CODE-QUALITY.md) for each rule |

## Sign-in and access

| Symptom | Cause | Fix |
|---|---|---|
| `auth/unauthorized-domain` | Domain not in Auth's authorized list | Firebase console › Authentication › Settings › Authorized domains |
| Google popup blocked / fails in Messenger | Popup blocker, or an in-app browser | The app says so; open in a real browser or use email sign-in |
| Signed in but redirected away from members pages | No `users/{uid}` document yet | Sign out and back in; sign-up creates it |
| `/admin` redirects to home | `users/{uid}.role` isn't `admin` | An admin promotes you from the Users page, or `node scripts/set-admin.mjs <uid> "<Name>" <email>` (uses your `firebase login`) |
| Admin can't open member receipts or documents | Token lacks the `admin` claim Storage rules check | Reload the app (it calls `ensureAdminClaim` and refreshes); sign out/in if it persists |
| Requests fail with App Check errors | Missing/wrong `VITE_APPCHECK_SITE_KEY`, or a local build against enforced production | Use the emulators locally; check the GitHub secret for CI builds |

## Data

| Symptom | Cause | Fix |
|---|---|---|
| "Missing or insufficient permissions" | The rules deny that write — usually a field a member may not touch, or a non-admin admin action | Read the matching rule in `firebase/firestore.rules`; reproduce in `tests/integration/rules.test.mjs` |
| Query error asking for an index | Composite index not deployed | Add it to `firebase/firestore.indexes.json`; CI deploys indexes |
| Release notes page empty | No `published` note, or the `status`+`publishedAt` index missing | Publish one; check the index |
| `registrationCount` / `docsCompleteCount` wrong | A trigger failed | Check the trigger's logs and Admin › Insights › failed requests; fix the count in the console |
| Bell badge never clears | The `read` update included another field | Only `read` may change on a notification |
| A `failedRequests` write silently missing | New `type` value not allowed by the rules | Add it to the rules' list |

## Email

| Symptom | Cause | Fix |
|---|---|---|
| Nothing sent, logs say "Brevo credentials not configured" | The function doesn't declare the Brevo secrets | Add `secrets: ["BREVO_API_KEY", "BREVO_FROM_EMAIL"]` to its options ([API.md](API.md#email)) |
| Brevo rejects the send | `BREVO_FROM_EMAIL` isn't a verified sender | Verify it in Brevo |
| Links in emails go to the wrong site | `APP_URL` secret wrong | `firebase functions:secrets:set APP_URL`, then redeploy via CI |
| Shared event links show a bare URL, not a card | Hosting deployed without the staged app shell | Redeploy through CI, never `--only hosting` from a laptop |

## Payments and content

| Symptom | Cause | Fix |
|---|---|---|
| GCash QR missing in the payment modal | No QR uploaded for the climb | Admin › Climbs › Edit (or Payments) › upload; check `gcashQrUrl` |
| Payment verdict reverted by itself | A non-admin wrote it; the trigger clamps it | Verify as an admin ([SECURITY.md](SECURITY.md)) |
| Trail photos not showing | Empty `trailImages`, or a non-direct image URL | Upload via the climb form, or use a direct, public image link |
