# MMS Open Climbs — Web Solution Plan

**Scope**: the web application (React SPA + Firebase backend) as it stands today, its recent evolution, and the forward-looking plan for hardening, cost, and growth.

Last reviewed: 2026-07-25. Companion document: [mms-open-climb-mobile.md](mms-open-climb-mobile.md).

---

## 1. Solution Overview

MMS Open Climbs is a single-page web application serving the Metropolitan Mountaineering Society's event management needs: climb scheduling, member registration, digital waivers, GCash payment proof submission, and admin verification workflows.

| Layer | Technology |
| --- | --- |
| Frontend | React 18.3, Vite 5, React Router 6 |
| Hosting | Firebase Hosting (CDN, SPA rewrite) |
| Database | Cloud Firestore, named database `openclimbs` |
| Auth | Firebase Auth (Email/Password + Google OAuth) |
| Storage | Firebase Storage (payment proofs, trail photos, GCash QR) |
| Backend logic | Cloud Functions v2, Node 22 |
| Transactional email | Brevo API v3 |
| Frontend tests | Vitest + Testing Library (jsdom) |
| Functions tests | Jest |
| CI/CD | GitHub Actions (8 workflows) |

The app is fully client-agnostic at the data layer — Firestore security rules, Cloud Functions callables, and Storage rules are keyed on `request.auth`, not on any web-specific assumption. This matters directly for the mobile plan: the same backend can be reused as-is.

---

## 2. Recent Delivery History

Grouped by theme, most recent first:

- **Admin dashboard and event display polish** — `ManagePayments` renamed the "Submitted" payment-status label to "Awaiting Review" and added a live **Unpaid** count alongside Verified/Awaiting Review/Rejected in both the global summary and per-climb headers. The admin Dashboard's per-climb rows are now expand/collapse-able, backed by a shared `Icon.jsx` icon set, a `DetailCell.jsx` labeled-value component, and completeness/expense-summary utilities. `ClimbCard` also got a lead-role display priority fix (plain "Team Leader" now correctly preferred over "Senior Team Leader"), and the `Event` page back button now always returns to the schedule instead of relying on browser history.
- **Thank-you emails for completed climbs** — `sendReminderNotifications` (scheduled function) now also sends a one-time "Thank You" email per climb once `climb.endDate` has passed, gated by a `thankYouSentAt` field so it fires exactly once per climb.
- **Failure logging system** — a new `failedRequests` Firestore collection captures client-side errors for admin review (open `create`, admin-only `read`), giving the team a lightweight production error trail without a third-party APM tool.
- **Add-Joiner linking** — admins can now link walk-in "Add Joiner" registration entries to an existing member account, closing a data-integrity gap where walk-in registrants were previously unlinked orphan records.
- **Welcome modal / onboarding** — a first-login guided tour with distinct member and admin step sequences, iterated twice for clarity and styling.
- **Release Notes feature** (multi-commit arc) — admin-authored "what's new" posts, one-time popup for members after login, full history page, member email blast on publish, and an AI-assisted draft generator (`generateReleaseNoteDraft`, `getReleaseNoteCommitOptions`) that proposes release note copy from recent commit history via a `GITHUB_TOKEN` secret. Shipped with a Firestore composite index fix and dedicated test coverage.
- **Notification bell** — in-app notification center backed by a `notifications` collection, with rules restricting members to toggling only the `read` flag on their own notifications (writes otherwise happen server-side via the Admin SDK).
- **Admin account correction** — admins can edit or delete problematic member accounts (`updateUserProfile`, `deleteUserAccount` callables) instead of requiring manual Firestore/Auth console intervention.
- **CI/CD pipeline stand-up** — `quality` → `promote` → `deploy` pipeline: quality gate runs `npm run qa` (build + strict coverage) for both frontend and functions; a promote job auto-merges `develop` → `main` via `gh pr merge` (working around the lack of paid auto-merge on a private repo); deploy job injects Firebase env secrets, authenticates via a GitHub-managed service account, and deploys rules/indexes/functions/hosting in one shot.
- **Analytics and onboarding polish earlier in the arc** — page-view tracking, admin page-view exclusion and purge tooling, Google Maps + weather integration on event pages, trail-photo carousel/lightbox.

**Net effect**: the app has moved from a functional MVP to a system with real operational tooling — audit trail (failure logging), user-lifecycle correction tools, structured release communication, and a proper CI/CD gate. The remaining gaps are mostly hardening (see §5) rather than missing features.

---

## 3. Environment

| Environment | Purpose | Notes |
| --- | --- | --- |
| Local (emulator) | Development | `firebase emulators:start --only auth,firestore,functions` + Vite dev server with `VITE_USE_FIREBASE_EMULATOR=true`. No Storage emulator wired into the default dev flow. |
| CI (GitHub Actions) | Quality gate | Runs `npm run qa` for frontend and `npm --prefix functions test` for functions on every push/PR to `develop`. |
| Production | Live | Single Firebase project (`mms-open-climbs`), Blaze plan (required for Cloud Functions v2, scheduled functions, and secrets). No separate staging Firebase project currently exists. |

**Gap**: there is no staging/pre-prod Firebase project distinct from production. `develop` merges auto-promote to `main` and deploy on green CI — meaning the quality gate (build + tests) is the only check standing between a merge and a live production deploy. This is a reasonable trade-off for a small volunteer-run org, but it means test coverage quality directly gates production risk (see §5).

---

## 4. Advantages of the Current Solution

- **Low operating cost for the current scale** — serverless end-to-end (Hosting, Firestore, Functions, Storage all pay-per-use); no idle server cost. See §6 for concrete figures.
- **Fast iteration** — Vite dev server, Firebase emulator suite, and a single-repo full-stack setup let one or two contributors ship features quickly, evidenced by the delivery cadence in §2.
- **Security rules do the heavy lifting** — access control lives declaratively in `firestore.rules`/`storage.rules` rather than being re-implemented in every API handler, reducing the chance of an endpoint forgetting an auth check.
- **Backend is mobile-ready without rework** — because the data/auth layer isn't web-coupled, the mobile plan doesn't require any backend migration.
- **Real audit/observability tooling now in place** — failure logging and the notification/release-notes system give admins visibility without needing a paid observability stack.

## 5. Disadvantages / Risks

- **No staging environment** — every merge to `develop` that passes CI is auto-promoted and deployed to production. A logic bug that passes tests (coverage thresholds are only ~45% lines) ships directly to members.
- **App Check not enabled** — Firestore/Storage/Functions currently accept any request with a valid Firebase Auth token; there's no verification that the request originates from the real app binary. This is the single largest open security gap (flagged in `docs/wiki/SECURITY.md`).
- **No rate limiting / Cloud Armor** — the anonymous-write `pageViews` and `failedRequests` collections are both open to unauthenticated `create`, which is by design for analytics/error capture, but also means they're an unmetered write surface without App Check or rate limiting in front of them.
- **No MFA for admin accounts** — a compromised admin credential has full read/write over `climbs`, `users`, and payment verification state.
- **Coverage thresholds are modest** (45% lines / 35% functions / 34% branches) — enough to catch regressions in exercised paths, not enough to catch regressions in the ~55-65% of code that isn't required to be covered.
- **Single point of ownership for Cloud Functions secrets** (`BREVO_API_KEY`, `GITHUB_TOKEN`) — no documented secret-rotation cadence.
- **Storage rules push admin-role enforcement to the UI layer** for `climbs/**` and `trail-images/**` (any authenticated user can write per the rules; the admin check is a client-side gate) — a malicious authenticated member could technically upload directly to those paths via the Storage API, bypassing the UI.

## 6. Cost & Pricing

All costs are pay-as-you-go (Firebase Blaze plan required for Cloud Functions v2 + scheduled functions + secrets).

| Cost driver | Current scale characteristics | Notes |
| --- | --- | --- |
| Cloud Functions invocations | 9 functions total: 2 Firestore triggers, 1 scheduled job, 6 callables | Low function count; cost scales with registration volume and admin actions, not raw traffic. |
| Firestore reads/writes | 7 composite indexes across registrations, climbs, notifications, releaseNotes | `pageViews` collection is the main uncontrolled write-growth risk — every page view is a write with no batching/throttling. A purge script exists (`purge-admin-pageviews.mjs`) but only removes admin-generated noise, not general growth. |
| Storage | Payment proofs capped at 10MB/file; climb/trail photos and GCash QR uncapped by rule | Storage cost is proportional to registrant count and photo volume, not traffic — cheap at MMS's likely membership scale (dozens to low hundreds of active members). |
| Hosting | Static SPA served from CDN | Effectively negligible cost at this traffic tier. |
| Brevo email | Transactional (registration confirm/update, thank-you, release-note blasts, reminders) | No plan tier is documented in-repo; email volume scales with registration count × ~2-3 emails per registration lifecycle, plus one release-note blast per publish. Worth confirming Brevo's free-tier daily send cap (typically 300/day) isn't a ceiling once release-note blasts + reminders overlap on a single day. |

**Recommendation**: instrument a monthly cost review against Firebase Billing console (no budget alert currently found in-repo) and set a budget alert at a conservative threshold — this is a five-minute Console change with outsized risk reduction, since an unbounded write path (`pageViews`) exists.

## 7. Challenges

- Balancing further feature velocity against the coverage/staging gaps above — every new feature currently ships straight to prod on merge.
- The AI-assisted release-note draft generator depends on a `GITHUB_TOKEN` secret and commit-history access; if the repo's visibility or token scope changes, this feature silently degrades and needs a documented fallback (manual note authoring, which already exists as the base path).
- Keeping `docs/wiki/*` synchronized with the codebase as feature velocity increases — this document set has needed a manual catch-up pass more than once (this update included).

## 8. Recommendations & Enhancements

Priority-ordered, cheapest/highest-impact first:

1. **Enable Firebase App Check** — highest-impact, lowest-effort security fix available; directly closes the "no client-origin verification" gap.
2. **Add a Firestore budget alert** in Google Cloud Billing for the project — near-zero effort, protects against the unbounded `pageViews`/`failedRequests` write surface turning into a surprise bill.
3. **Stand up a second Firebase project as a staging environment**, and gate `main` deploys behind a manual approval step or a staging soak period, rather than deploying immediately after `develop`'s quality gate passes.
4. **Enforce MFA for admin accounts** (Firebase Auth supports this) — admins hold the most sensitive permissions in the system (payment verification, user deletion).
5. **Move `climbs/**` and `trail-images/**` Storage write authorization from UI-only to Storage rules** (check `users/{uid}.role == 'admin'` via a rules function, consistent with how Firestore already does it) — closes the direct-API-bypass gap.
6. **Raise coverage thresholds incrementally** (e.g., 45% → 55% lines) as new features land, rather than in one large jump, to keep the CI gate meaningful without blocking velocity.
7. **Document a secret-rotation cadence** for `BREVO_API_KEY` and `GITHUB_TOKEN` in `docs/wiki/SECURITY.md`.

---

## 9. Summary

The web application is functionally mature and inexpensive to run at MMS's current scale, with a real CI/CD pipeline and growing operational tooling (failure logging, notifications, release notes). The open items are almost entirely hardening work — App Check, staging, MFA, storage-rule tightening — rather than missing capability. None of these require architectural change; all are additive to the existing Firebase-native design, which is the right foundation to keep building on for both the web app and the planned mobile client (see companion mobile plan).
