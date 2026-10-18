# Domain Glossary

## Fee

A charge collected from a registrant for a climb (e.g. Guest Fee, Transportation Fee, Registration Fee).

- Canonical term is **Fee**, not "Expense." Both referred to the same concept: a fee line item, first shown as an estimate on the climb, then locked into a specific selection when a member registers.
- Resolved: renamed throughout — `climbs.expenses` → `climbs.fees` (field + Firestore migration), admin UI "Estimated Expenses" → "Fees", `getExpenseSummary`/`expenseSummary.js` → `getFeeSummary`/`feeSummary.js`, `climbCompleteness.js` "Expenses" check → "Fees".

## Guest Fee

A fixed domain concept, not just a conventionally-named ordinary Fee. Its defining behavior: charged only when the registrant's `memberType` is `joiner` (non-member/guest), never charged to `member`. This is membership-conditional selection, distinct from an ordinary optional Fee where the *registrant* chooses whether to include it.

- Resolved: identified by an explicit `isGuestFee: true` boolean on the fee object, not by regex-matching the label — see `src/utils/registrationFees.js`, `src/utils/feeSummary.js`, `src/pages/register/registrationSubmit.js` and the "Guest Fee" checkbox in `src/pages/admin/climbForm/FeesEditor.jsx`. Production climb docs were migrated once (the one-off migration script has since been removed).

## Transportation Fee

An ordinary optional Fee — no special/fixed-concept treatment. Selection is a plain registrant choice (`optionalFeeSelections`), unlike Guest Fee's membership-conditional selection. Confirmed: only Guest Fee gets fixed-concept status; other optional fees (Transportation Fee, Food & Meals, future ones) stay generic.

## Climb Officer roles — Team Leader / Assistant Team Leader

Invariant: a climb has **exactly one** Team Leader (or Senior Team Leader as its synonym) and **exactly one** Assistant Team Leader. Not enforced by validation anywhere (`src/pages/admin/climbForm/OfficersEditor.jsx` allows duplicate roles) — it's a convention, not a constraint. `ClimbCard.jsx`'s first-match-wins behavior is therefore correct by assumption, not coincidence.

## Climb Card lead-officer display — empty state

When a climb has no officer matching Team Leader or Assistant Team Leader, the card shows a "No Officers Yet" placeholder rather than falling back to an arbitrary officer (e.g. a Scribe) mislabeled as a leader. The old generic `/lead|poc/i` + `officers[0]` fallback is removed — a climb officer's role label should never be misrepresented as Team Leader/Assistant Team Leader.

## Open items (raised, not yet resolved)

- The "one TL, one ATL" invariant is not enforced anywhere in the climb form — an admin can currently save two officers both labeled "Team Leader." Worth a form-level validation, or accepted as low-risk since it's a small admin-only team?

## Resolved (fixed after being raised)

- `climbCompleteness.js` used to have separate "missing" checks for exact-match "Team Leader" and "Senior Team Leader" as if they were two different required roles, contradicting the synonym relationship established above. Merged into a single "Team Leader" check that matches either form.
