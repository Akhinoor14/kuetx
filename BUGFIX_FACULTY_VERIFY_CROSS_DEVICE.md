# Faculty verification: cross-device magic-link fix + full workflow / data-model audit

(Re-applied on top of the newer `kuetx.zip` upload — the earlier fix wasn't
present in this build, since it was a separate/newer export that included
its own independent fixes: popup-stacking timing, an IndexedDB race on
Profile page, and student-verify UX copy — none of which touched the
faculty flow.)

## The bug (unchanged from before)
Faculty magic-link completion only ran inside `FacultyVerifyHoldingScreen.jsx`,
which only mounts when the onboarding queue's step is `'faculty-verify'` —
gated on `accountRole` (localStorage) already being `'teacher'` on that
exact browser. Opening the emailed link in a new tab, different browser,
phone mail app, or after the original tab closed/refreshed meant that
condition was false, so the link-completion code never ran at all:
`verifiedFacultyEmails/{email}` never got written and
`faculty/{uid}.verifiedAt` stayed `null` forever — "verified holeo dhukte
parche na."

## Fix (same as before, reapplied)
- **`src/App.jsx`** — added a boot-level `useEffect`, independent of the
  onboarding queue, mirroring the existing student KUET-email-verify
  pattern. Handles `'needs-email'` (cross-device — shows a re-type-email
  modal), `'success'` (sets `accountRole = 'teacher'`, then calls
  `markFacultyVerifiedIfEmailConfirmed`), and `'error'` (toast).
- **`src/components/FacultyVerifyEmailConfirmModal.jsx`** (new) — English
  counterpart to `KuetVerifyEmailConfirmModal.jsx` for the cross-device
  re-entry case.
- **`src/components/FacultyVerifyHoldingScreen.jsx`** — removed the
  duplicate same-tab-only completion logic; now only sends/resends the
  link and live-subscribes to `faculty/{uid}.verifiedAt` so it auto-
  advances the moment verification completes from *any* tab/device.

## Full workflow audit (this pass)

**Auth core** (`firebaseAuth.js`) — register / login / forgot-password /
anonymous-upgrade all check out. `resetPassword` uses standard Firebase
`sendPasswordResetEmail`; the one documented limitation (pre-domain-check
fake-email accounts may not receive the reset mail, and Firebase won't
reveal that) is intentional, not a bug.

**Faculty gate consistency** — checked every place `faculty/{uid}` and
`verifiedFacultyEmails/{email}` are read or written app-wide:
- `facultySync.js`, `facultyEmailVerify.js`, `useIsFaculty.js`,
  `RequireFaculty.jsx`, `firestore.rules` (`isVerifiedFaculty`,
  `isVerifiedFacultyFor`), `AdminDashboard.jsx` — all consistently key off
  the same field name, `verifiedAt`, with no mismatches found.
- `facultyClassSync.js` additionally uses a `faculty/{uid}/classIndex`
  subcollection; `firestore.rules` has a matching `match /classIndex/{...}`
  block under `faculty/{uid}` — covered.
- `facultyMarksSync.js` uses `groups/{groupId}/facultyAssignments/{id}/
  sessions` and `.../studentRecords/{studentUid}`; both have matching,
  correctly-scoped rules blocks (including the create/update split needed
  because `setDoc(..., {merge:true})`'s first write is treated as
  `create`, not `update`, by Firestore rules — this was already handled
  correctly, not something I needed to fix).

No other gaps found in this pass.

## Store / "collections" check
Two separate things exist under the name "store" in this codebase — both
checked:

1. **Client-side `store.js` + `indexeddb-store.js`** — this is a flat
   key-value cache (localStorage + IndexedDB), not a multi-collection
   database. A single IndexedDB object store (`kuetx_data`) holds every
   key under one `kuetx_` prefix; `store.get/set/remove` keep an in-memory
   `Map` cache in sync with both localStorage (instant reads) and
   IndexedDB (bulk capacity) via `emitStoreUpdate()` events. Structurally
   sound — no collection-consistency issue possible here since there's
   only one "collection."
2. **Firestore collections** (the real multi-collection database) — see
   the faculty-gate consistency check above. All good.

No changes were needed to either storage layer.
