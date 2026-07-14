# #4 fix — Save Role right at account creation, not after

## What was asked
The doc's expected flow: `Sign Up → Choose Role → Create Account → Save
Role Permanently → Email Verification → Login → Dashboard` — specifically,
role gets saved to the server at the moment the account is created, not
sometime after.

## What was actually happening before this fix
Functionally the end state was already correct (role chosen before
Dashboard, saved once, never re-asked) — but the *save* itself happened
one step later than the diagram implies: `RoleSelectScreen` only wrote
the choice locally + attempted a server write that silently no-op'd
(no real uid existed yet at that point for a brand-new anonymous
visitor). The actual server write only ever completed afterward, inside
`App.jsx`'s `handleAuthSuccess`, once `onSuccess` fired back from
`AuthModal` — i.e. *after* account creation had already fully finished
and control had already returned to the parent.

## Fix
Role is now saved to `users/{uid}.role` **inside `AuthModal.jsx` itself**,
immediately after the account is created — before `onSuccess?.()` is even
called. This is the literal "Create Account → Save Role Permanently" step
from the diagram, now happening in exactly that order, in exactly that
place, rather than as a follow-up side effect one layer up.

Covered for every account-creation path in `AuthModal.jsx`:
- **Email/password register** (`handleEmail`, `tab === 'register'` or
  `isUpgrade`) — role is read from `isFaculty` (already determined by
  which `variant` this AuthModal was rendered with, itself set by the
  Role Select choice) and persisted right after
  `registerWithEmail`/`upgradeWithEmail` resolves, before
  `createFacultyAccountDoc` even runs for the faculty case.
- **Google Sign-In** (`handleGoogle`) — Google is student-only per
  Deviation 3 (faculty never uses Google), so `'student'` is persisted
  unconditionally right after sign-in succeeds. Safe for both new and
  returning accounts: Firestore rules reject overwriting an
  already-set `role`, so for a returning user this is a harmless no-op.
- **Both `credential-already-in-use` fallback paths** (Google upgrade →
  existing account, email upgrade → existing account) — same treatment,
  since these can land on a fresh device/tab where the local
  `accountRole` flag doesn't exist yet even though the account itself
  is not new.

`App.jsx`'s `handleAuthSuccess` still calls `persistAccountRoleToServer`
too — this is now a harmless, redundant backup rather than the primary
write path, kept in case some other future entry point creates an
account without going through `AuthModal.jsx` directly.

## Why this matters beyond just "matching the diagram"
Before this fix, there was a real (small) race window: if a person closed
the tab or lost connectivity in the moment between `AuthModal`'s
`onSuccess?.()` firing and `App.jsx`'s `handleAuthSuccess` completing its
own async `persistAccountRoleToServer` call, the account would exist with
no server-side role record yet — recoverable (buildQueue's fallback logic
still handles it correctly on next load), but not ideal. Saving the role
at the actual moment of account creation, inside the same function that
creates the account, closes that gap.

## Files touched
- `src/components/AuthModal.jsx` — role now persisted at the point of
  account creation in `handleEmail` (both register and upgrade cases) and
  `handleGoogle` (both the main path and its credential-already-in-use
  fallback).
