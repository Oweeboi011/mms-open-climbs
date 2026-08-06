# ADR 0001: Admin payments-related pages — consolidation & consistency

**Status**: Implemented
**Date**: 2026-07-29
**Context**: A grilling session (`/grill-with-docs`) auditing `src/pages/admin/*` after several turns of incrementally adding transportation toggles, outstanding-balance math, and fee breakdown review to `ClimbDetail.jsx` and `ManagePayments.jsx`.

## Audit findings

1. `toggleTransportation` was copy-pasted verbatim into `ClimbDetail.jsx`, `ManagePayments.jsx`, and `AllRegistrations.jsx`.
2. `getExpectedTotal` / `getOutstanding` were duplicated between `ClimbDetail.jsx` and `ManagePayments.jsx`.
3. `AllRegistrations.jsx` had the transportation toggle but not the Outstanding column or Fee Breakdown view that the other two pages had — an inconsistent admin experience depending on which page you used to look up a registrant.
4. `ClimbDetail.jsx` (2,006 lines) and `ManagePayments.jsx` (1,324 lines) had grown into monolithic files mixing table rendering, modals, CSV export, and fee math.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Add Outstanding column + Fee Breakdown view to `AllRegistrations.jsx` for parity | It's the cross-climb registrant view; admins shouldn't need to open a climb-specific page just to see what someone owes. |
| 2 | Extract `getExpectedTotal`/`getOutstanding` into `src/utils/registrationFees.js` as pure functions; keep `toggleTransportation` per-page (each has its own `updateDoc`/`logAuditEvent` wiring) but have it delegate array mutation to a shared pure helper | Matches the existing convention (`feeSummary.js`, `climbCompleteness.js` already live in `src/utils`). Avoids coupling a hook to each page's Firestore/audit conventions. |
| 3 | Split `ClimbDetail.jsx` and `ManagePayments.jsx` now, as part of this same work, rather than deferring | Already touching both files for the fee-logic extraction; bundling the split avoids a second disruptive pass later. |
| 4 | Extract only the big reusable chunks (registrant row, fee breakdown table, modals) — not a full per-section decomposition | Meaningful size reduction without the risk/cost of a much larger diff. |
| 5 | Leave `AppInsights.jsx`'s Tier 3 Cloud Functions Health tile as-is | It already degrades gracefully with a clear "not configured" message; no code benefit to removing it before the IAM role is granted. |

## Glossary (terms introduced/clarified this session)

- **Outstanding (balance)**: `expected fee total − already-declared/paid amount`, floored at 0. A rejected payment doesn't count toward "already paid."
- **Expected fee total**: sum of a registration's selected `feeBreakdown` items (or the climb's current non-optional fees, if the registration predates fee tracking).
- **Fee Breakdown (admin view)**: itemized read-only table of a registrant's selected fees + total, shown for admin review during payment verification.
- **Transportation toggle**: admin-editable checkbox reflecting/mutating the `feeBreakdown` entry matching `/transport/i`, falling back to synthesizing that entry from the climb's fee schedule if the registrant's snapshot doesn't have one yet.

## Outcome

- `src/utils/registrationFees.js` — pure `getExpectedTotal`/`getOutstanding`/`toggleTransportationEntry`, with dedicated unit tests.
- `src/components/FeeBreakdownTable.jsx` — shared read-only fee table, now used by all three pages.
- `ClimbDetail.jsx`: 2,006 → 721 lines, via extracting `src/components/admin/RegistrantRow.jsx` and `src/components/admin/AddJoinerModal.jsx`, plus `src/components/admin/registrantShared.jsx` (StatusBadge, InfoCell, status/payment style maps).
- `ManagePayments.jsx`: 1,209 → 467 lines, via extracting `src/components/admin/ClimbPaymentCard.jsx` and `src/components/admin/paymentShared.jsx` (StatBox).
- `AllRegistrations.jsx` gained the Outstanding column and Fee Breakdown view, and its transportation toggle now delegates to the shared `toggleTransportationEntry` helper.
- 198 frontend tests passing (up from 187 at the start of this session), including 9 new tests for `registrationFees.js` and 2 new tests for `AllRegistrations.jsx` parity.

## Follow-up / not yet done

- ~~Cloud Functions deploy~~ — confirmed live: `getEmailStats`, `getStorageUsage`, `getFunctionHealth`, `onClimbUpdated`, etc. all show ACTIVE in `gcloud functions list`.
- ~~Tier 3 IAM grant~~ — `roles/monitoring.viewer` granted to `819276060182-compute@developer.gserviceaccount.com` (2026-07-29) via `gcloud projects add-iam-policy-binding`.
- ~~`auditLog` Firestore rules deploy~~ — deployed 2026-07-29 via `firebase deploy --only firestore:rules` (compiled and released successfully).
