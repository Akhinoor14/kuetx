# Faculty Module — Bug Fixes (My Classes + My Schedule)

## Root cause of "My Schedule looks empty" — REAL BUG, HIGH SEVERITY

`firestore.rules` had NO rules block at all for `faculty/{uid}/classIndex/{assignmentId}`
— the subcollection both FacultyClasses.jsx and FacultySchedule.jsx read from.
Firestore does not inherit a parent doc's rules into its subcollections, so this
silently fell through to default-deny for both reads AND the write that
`createFacultyAssignment()` does to populate it.

`subscribeMyClassIndex()`'s onSnapshot error handler swallowed the resulting
`permission-denied` error and called back with `[]` — indistinguishable from
"you genuinely have no classes yet." This is why both pages looked empty even
right after creating a class.

**Fixed:**
- `firestore.rules` — added the missing `match /classIndex/{assignmentId}` block
  inside `match /faculty/{uid}`, scoped to the owning account only.
- `src/lib/facultyClassSync.js` — `subscribeMyClassIndex` now logs the real
  error to console instead of silently eating it, so a future rules regression
  is debuggable instead of looking like empty state again.

**You must deploy the updated firestore.rules for this fix to take effect** —
this isn't a client-only fix, the rules file itself has to be redeployed
(`firebase deploy --only firestore:rules` or via Firebase Console).

## Root cause of "everything is selectable" in Add Class

`src/pages/faculty/FacultyClasses.jsx` — Batch, Term, and Course were three
fully independent dropdowns with zero cross-validation. A teacher could select
e.g. batch `2k25` (started June 2026) together with term `Y4T2`, a combination
that can't be real yet, with no feedback at all.

**Fixed:** added a SOFT plausibility check (`getBatchTermPlausibility`) that
compares the batch's `BATCH_START_DATES` elapsed time against the selected
term and shows an amber warning banner if the gap looks implausible (more than
~1 term early or ~2 terms late). Deliberately NOT a hard block — a teacher
legitimately might backfill a finished term's class or pre-create one slightly
ahead of schedule, so this warns rather than prevents.

## Secondary latent bug found while investigating (not the reported symptom, but real)

`src/pages/faculty/FacultySchedule.jsx` — `DAYS` only covers 5 teaching days
(Sun-Thu). The `selectedDay` initializer read `new Date().getDay()` (0-6)
directly into `DAYS[todayIndex]`, which is `undefined` on a real Friday (5) or
Saturday (6), silently falling back via `|| 'Sunday'`. Not the cause of
today's symptom (today is Sunday), but would misbehave every Fri/Sat.

**Fixed:** same fallback, but now explicit (`DAYS[todayIndex] || DAYS[0]`)
with a comment explaining why, so it's not mistaken for dead code later.

## Files in this bundle (drop into matching repo paths)

```
firestore.rules                          — MUST be redeployed, not just committed
src/lib/facultyClassSync.js
src/pages/faculty/FacultyClasses.jsx
src/pages/faculty/FacultySchedule.jsx
```

## Suggested test after deploying

1. Deploy the new `firestore.rules`.
2. As a verified faculty account, create a class via "+ Add Class".
3. Confirm it now appears immediately in "My Classes".
4. Confirm it now appears in the correct day/slot cell in "My Schedule".
5. Open browser console while testing — if classIndex ever fails to load
   again, you'll now see an explicit error instead of silent empty state.
