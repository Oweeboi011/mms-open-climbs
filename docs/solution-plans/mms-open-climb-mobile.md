# MMS Open Climbs — Mobile Solution Plan (Android & iOS)

**Scope**: this is a forward-looking plan. No native or hybrid mobile client exists in the repository today — this document lays out what would need to be built, the platform options, and the trade-offs, using the existing web app and Firebase backend as the foundation.

Last reviewed: 2026-07-23. Companion document: [mms-open-climb-web.md](mms-open-climb-web.md).

---

## 1. Current State: What Already Exists vs. What's Missing

**Reusable as-is** (backend is 100% client-agnostic):

- Firebase Auth (Email/Password + Google OAuth) — same auth flow works from any Firebase SDK (JS, Android/Kotlin, iOS/Swift, or React Native).
- Firestore schema and security rules (`climbs`, `registrations`, `users`, `pageViews`, `failedRequests`, `notifications`, `releaseNotes`) — all rules are keyed on `request.auth`, with no web-specific assumptions.
- Cloud Functions (9 total: `onRegistrationCreated`, `onRegistrationUpdated`, `sendReminderNotifications`, `createUser`, `updateUserProfile`, `deleteUserAccount`, `sendReleaseNoteEmail`, `getReleaseNoteCommitOptions`, `generateReleaseNoteDraft`) — callable/triggered functions work identically regardless of client platform.
- Storage buckets and rules (`payment-proofs/`, `climbs/`, `trail-images/`, `gcash-qr/`) — same upload/read model applies to a mobile client.
- Responsive design tokens in `src/styles/globals.css` (11 breakpoints from 360px up) — useful as a reference for what screen sizes and information density the existing UX already targets, informing mobile screen design even though the CSS itself isn't reusable in a native app.

**Missing entirely** — must be built from scratch:

- Any mobile client codebase (no React Native, Flutter, Capacitor, or native project in the repo).
- Push notification infrastructure — the current `notifications` collection and notification bell are in-app/web-only; there is no FCM (Android) or APNs (iOS) wiring anywhere.
- PWA baseline (`manifest.json`, service worker, install prompts, `apple-mobile-web-app-*` meta tags) — doesn't exist even as a stepping stone toward a "wrapped web app" approach.
- Native camera/file-picker integration for payment-proof and trail-photo uploads (currently a plain `<input type="file">`).
- Offline support / local caching — no explicit Firestore offline persistence configuration found; would need deliberate design for a mobile-first offline experience (trailheads often have no signal).
- App-store tooling: code signing, versioning, store listings, review-process compliance for both Google Play and Apple App Store.
- CI/CD for mobile builds — none of the 8 existing GitHub Actions workflows target a mobile artifact.

---

## 2. Platform Options

| Option | Description | Effort | Fit |
| --- | --- | --- | --- |
| **A. PWA (Progressive Web App)** | Add `manifest.json`, service worker, offline caching, and installability to the existing React app; ship the same codebase as an installable "app" on both platforms. | Low | Best fit for MMS's scale: reuses 100% of existing UI code, fastest to ship, no app-store review cycle for updates. Weaker on: push notifications on iOS (only supported since iOS 16.4+ and with real constraints), deep native camera/GPS integration. |
| **B. React Native** | New codebase, but shares React knowledge, patterns, and (partially) business logic with the existing team; uses the same Firebase JS/React Native Firebase SDKs. | Medium-High | Good fit if native push notifications, offline-first UX, or app-store presence become priorities. Steepest relative to PWA, but far cheaper than two fully native codebases. |
| **C. Native (Kotlin + Swift, two codebases)** | Fully separate Android and iOS native apps. | Highest | Best performance/platform integration, but doubles ongoing maintenance for a small volunteer-run project — hard to justify unless MMS has dedicated native mobile contributors. |
| **D. Flutter** | Single Dart codebase compiled to both platforms. | Medium-High | Comparable effort to React Native but doesn't leverage the team's existing React/JS expertise — a net new language/framework for the current contributors. |

### Recommendation

Start with **Option A (PWA)** as an immediate, low-cost step — it gets MMS to "installable app icon on the home screen" with the current codebase and no new language. If usage and appetite justify deeper investment (native push notifications, offline-first registration at trailheads with no signal, richer camera/GPS features), migrate to **Option B (React Native)** next, since it preserves the team's React expertise and can reuse most business logic (validation, data-fetching hooks) even though UI components must be rewritten against RN primitives. Native (C) and Flutter (D) are not recommended given the team's current size and skill set.

---

## 3. Environment

| Environment | PWA path (Option A) | React Native path (Option B) |
| --- | --- | --- |
| Local dev | Same Vite dev server; test installability via Chrome DevTools "Application" panel and Lighthouse PWA audit | Expo or React Native CLI + Android Studio/Xcode simulators; Firebase emulator suite reused unchanged for backend |
| CI | Extend existing GitHub Actions to run a Lighthouse PWA check on PRs | New workflow(s) for Android (Gradle build, `.aab`) and iOS (Xcode Cloud or `fastlane`) — real added CI complexity |
| Distribution | Same Firebase Hosting deploy; "install" is a browser prompt, no store review | Google Play Console (Android) + Apple Developer Program (iOS) — both require store accounts, review cycles, and versioned releases |

**iOS-specific note**: Apple's App Store review guidelines require that apps offering account creation/login also work as expected under App Review test conditions; a PWA sidesteps this entirely since there's no store submission. This is a meaningful reason to prefer the PWA path first.

---

## 4. Security

The mobile plan inherits the web app's security model largely unchanged, with these mobile-specific additions to plan for:

- **App Check for mobile clients** — if pursuing React Native or native, Firebase App Check has dedicated attestation providers (Play Integrity API for Android, DeviceCheck/App Attest for iOS) that are actually *stronger* than the web reCAPTCHA-based provider. This is a good argument for prioritizing App Check rollout (see web plan §8 recommendation #1) before or alongside mobile work, since the mobile attestation providers are more robust.
- **Secure local storage of auth tokens** — React Native/native apps must use platform secure storage (Android Keystore / iOS Keychain) rather than plain AsyncStorage for any cached credentials; this is a new concern that doesn't exist for the web app (which relies on Firebase Auth's own token handling).
- **Push notification payload security** — FCM/APNs payloads should carry only a notification ID, with the client fetching full content from Firestore (respecting existing security rules), rather than embedding sensitive data (e.g., payment status) directly in the push payload.
- **Certificate/domain restrictions** — the existing recommendation to restrict the Firebase Web API key to the production domain (web plan §8) doesn't directly apply to mobile SDKs, which use platform-specific API key restrictions (package name + SHA-1 fingerprint for Android, bundle ID for iOS) — these should be configured at the same time mobile clients are registered in the Firebase console.
- **Same Firestore/Storage rules apply unchanged** — no additional backend security work is needed purely to support a mobile client, since rules are transport-agnostic.

---

## 5. Advantages of Going Mobile

- **Reuses the entire backend** — zero migration cost for data, auth, or business logic regardless of which frontend option is chosen.
- **Push notifications** close a real gap — the current notification bell only surfaces in-app when a member has the site open; native push (via PWA web-push, or FCM/APNs) would reach members who aren't actively browsing, which matters for time-sensitive climb updates (registration status changes, weather-related schedule changes).
- **Offline-capable registration/waiver viewing** — useful for members checking their registration status or a printed waiver at a trailhead with poor connectivity, particularly relevant given this is an outdoor/mountaineering use case.
- **Home-screen presence** increases repeat engagement compared to a bookmarked website.

## 6. Disadvantages / Risks

- **Splits engineering attention** across a second platform surface, on a project currently run with a small contributor base — this is the central trade-off to weigh against the advantages above.
- **App-store review cycles** (Option B/C/D) introduce release latency that doesn't exist today (web deploys are immediate post-merge).
- **New a security surface**: local secure storage, platform-specific API key restrictions, and push payload design are all net-new concerns not present in the web-only architecture.
- **iOS push notification support for a pure PWA is limited** — real but constrained (iOS 16.4+, requires the PWA be added to the home screen first) — this materially affects the push-notification advantage above if Option A is chosen and not later supplemented.
- **No existing mobile CI/CD** — Option B/C/D each require standing up an entirely new release pipeline (store credentials, signing keys, versioning) which is genuinely new operational overhead beyond what today's GitHub Actions setup provides.

## 7. Cost & Pricing

| Item | PWA (Option A) | React Native (Option B) | Native (Option C) |
| --- | --- | --- | --- |
| Development cost | Lowest — extends existing codebase | Medium — new codebase, reuses React skills | Highest — two codebases, two skill sets |
| Google Play Developer account | N/A | $25 one-time | $25 one-time |
| Apple Developer Program | N/A | $99/year | $99/year |
| Backend (Firebase) incremental cost | None — same Firestore/Functions/Storage usage patterns, same Blaze billing as the web plan (§6 of the companion doc) | Same backend cost model; costs scale with additional mobile-driven read/write/function-invocation volume, which is usage-driven, not platform-driven | Same as React Native |
| Push notification service | Web Push (free, via browser vendors) | FCM (free) + APNs (free, requires Apple Developer Program membership above) | Same as React Native |
| Ongoing store maintenance | None | Annual Apple renewal + periodic OS-compatibility updates | Same, times two codebases |

**Bottom line**: the PWA path has effectively zero incremental infrastructure cost beyond the existing Firebase Blaze usage. The React Native path adds a modest, mostly one-time/annual store-account cost (~$125 combined) on top of ongoing development time; the backend cost model doesn't change under any option since Firebase bills by usage, not by client platform.

## 8. Challenges

- Deciding push-notification strategy up front, since it materially affects the platform choice (PWA's iOS push limitations vs. RN/native's full FCM/APNs access).
- Designing an offline-first data model for registration/waiver viewing without introducing sync conflicts, given Firestore's offline persistence needs deliberate configuration and testing (not verified as configured anywhere in the current web app).
- Maintaining feature parity between web and mobile as both evolve, without duplicating business logic — worth extracting shared validation/data-shaping logic (e.g., registration fee calculation, waiver text) into a form that both a web app and a future React Native app could import, if Option B is chosen.
- Store review compliance (Option B/C/D only) — Apple in particular scrutinizes apps with account creation and payment-adjacent flows (GCash proof upload is not a payment processor integration, but reviewers may still ask questions about it).

## 9. Recommendations & Enhancements

1. **Ship the PWA path first** (manifest, service worker, install prompt, offline shell for read-mostly pages like My Registrations and the climb schedule) — lowest cost, fastest to validate real member demand for an "app-like" experience before investing further.
2. **Roll out Firebase App Check with Play Integrity/App Attest providers** as part of any React Native/native effort — treat this as blocking for a store-distributed app more than for the PWA.
3. **Design push notifications around IDs, not payload content** from day one, regardless of platform chosen, so the security posture doesn't need rework later.
4. **Defer native (Option C) and Flutter (Option D)** unless a specific mobile-only capability (deep camera/GPS integration, offline-first performance) proves necessary after the PWA/React Native stages — the maintenance cost isn't justified by current evidence of need.
5. **Reuse the existing Firestore schema and Cloud Functions unchanged** — no backend redesign is needed to support mobile; this keeps the mobile effort scoped purely to client work.

---

## 10. Summary

There is no mobile app today, but the backend is already mobile-ready: Firebase Auth, Firestore rules, Cloud Functions, and Storage all work identically from a mobile client with zero migration. The lowest-risk path to a mobile presence is a PWA built on the existing React codebase; a React Native rewrite is the natural next step if push notifications, offline-first UX, or app-store presence become priorities MMS is willing to invest in. Native platform-specific apps are not recommended given the project's current contributor base. Security work for mobile (App Check with native attestation providers, secure token storage, push payload design) is additive to, not a replacement for, the hardening already recommended for the web app.
