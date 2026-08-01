# Google-Only Auth Migration — Summary

## Follow-up fix — institutional email privacy (see below for details)

After the initial migration, two problems were found and fixed:

1. **Founder couldn't see the Google login email during approval.**
   `manualVerifyRequests.js` stored `googleEmail` on the request doc, but
   neither `ManualVerifyFallback.jsx` nor the actual Approvals screen
   (`AdminDashboard.jsx`) ever displayed it — dead data. Fixed:
   `AdminDashboard.jsx`'s manual-verify Approval row now shows the Google
   login email as a sub-line (faculty requests only), so the Founder can
   cross-check it against the self-reported institutional email before
   approving.

2. **`institutionalEmail` was readable by every signed-in student.**
   `faculty/{uid}` has `allow read: if isSignedIn()` — any student can
   read the whole doc. Putting the new `institutionalEmail` field there
   (as the original Task 4 change did) made a faculty member's personal
   contact email as broadly readable as their public name/title/dept.
   Fixed by mirroring the codebase's own existing pattern for this exact
   problem — `providers/{uid}/contact/phone` already splits a
   privacy-sensitive field into its own sub-document with a tighter read
   rule. Did the same:
   - New `firestore.rules` match block: `faculty/{uid}/private/verification`
     — readable only by the owning faculty account or Admin/HeadOfOps,
     writable only by the owner, restricted to exactly the
     `institutionalEmail` key.
   - `faculty/{uid}`'s own create/update rules now explicitly reject
     `institutionalEmail` if anyone tries to write it onto the public doc.
   - `facultySync.js`: new `getFacultyInstitutionalEmail(uid)` /
     `setFacultyInstitutionalEmail(uid, email)` reading/writing the private
     sub-doc; `saveFacultyProfile()` no longer touches this field.
   - `FacultyProfileSetupModal.jsx`: loads from and saves to the private
     sub-doc via those two new functions (a second, parallel write
     alongside `saveFacultyProfile`'s public-doc write).

`officialEmail` (on the public `faculty/{uid}` doc, seeded from the
Google login email at account creation) is left public/unchanged — the
rules comment already documented that as intentional ("not secret, it's
an institutional address" — really, it's the login email, and that was a
pre-existing product decision this migration didn't touch).

---

## Files changed

1. **`src/lib/firebaseAuth.js`**
   - `loginWithGoogle()` / `upgradeWithGoogle()` switched from
     `signInWithPopup`/`linkWithPopup` to `signInWithRedirect`/`linkWithRedirect`.
   - Added `handleGoogleRedirectResult()`.

2. **`src/components/AuthModal.jsx`** — rewritten from 1268 lines to ~190.
   Google-only. Same external prop contract (`mode`, `isUpgrade`,
   `queueMode`, `onClose`, `onSuccess`) — no caller changes needed.

3. **`src/hooks/useFirebaseAuth.js`** — this, not `App.jsx`, is where
   `onAuthChange` actually lives in this codebase. Wired
   `handleGoogleRedirectResult()` in here at startup, with the
   `auth/credential-already-in-use` → fallback-to-plain-sign-in handling.

4. **`src/components/RoleSelectScreen.jsx`** — removed the faculty
   institutional-email gate (Google email is a personal Gmail now).

5. **`src/components/FacultyProfileSetupModal.jsx`** — institutional email
   is now an editable, required, validated field (`isFacultyEmailFormat`).

6. **`src/lib/facultySync.js`** — `saveFacultyProfile` persists a new,
   distinct `institutionalEmail` field (kept separate from `officialEmail`,
   which the existing verification bridge already depends on).

7. **`src/lib/manualVerifyRequests.js`** — `ensureManualVerifyRequest` now
   also accepts an optional `googleEmail` for context; `email` stays the
   institutional address (required downstream by `approveManualVerifyRequest`).

8. **`src/pages/Settings.jsx`** (not in the original prompt — found during
   the Task 5 sanity sweep) — its own standalone "Sign in with Google"
   button called `loginWithGoogle()` expecting a resolved user, which no
   longer happens with the redirect flow. Fixed to not assume a return
   value. Its "Change password" button was already correctly gated behind
   `providerData.some(p => p.providerId === 'password')`, so it simply
   never renders for a Google-only account — no dead "Forgot password?"
   surface reachable in the UI.

## Open decision — not made for you

`FacultyProfileSetupModal.jsx`'s `phone` field is still **optional**. The
original prompt suggested making it required (a number the Founder can
call to verify) but flagged this as a product decision rather than
something to silently flip. Left as-is; say the word if you want it
required and I'll add one line to `validate()`.

## Verified

- All 4 `<AuthModal>` call sites (`App.jsx` x3, `Profile.jsx` x2) still
  match the prop contract.
- No component still imports `studentUsernameAuth.js` / `providerPhoneAuth.js`
  (files themselves are left in place, unused, per the prompt).
- No live calls to `loginWithUsername`, `loginWithProviderPhone`,
  `registerWithEmail`; `loginWithEmail`/`resetPassword` remain only as
  dead-but-harmless exports, used defensively in Settings.jsx behind a
  gate that never fires for Google-only accounts.
- No `signInWithPopup(` / `linkWithPopup(` calls anywhere in `src/`.
- No "Forgot password" text anywhere in the UI.
- All 8 edited/rewritten files parse cleanly (checked with `@babel/parser`
  + JSX plugin — `npm install` wasn't available in this sandbox for a full
  Vite build, so this is a syntax check, not a full build/runtime check).
- `src/lib/adminAuth.js` confirmed independent (reads `admins/{uid}` off
  the existing session) — untouched, per the prompt's instruction.

## Not done (explicitly out of scope per the prompt)

- No migration/linking code for old username/phone/email-password accounts.
- No Firestore rules or Cloud Function changes.
- `studentUsernameAuth.js` / `providerPhoneAuth.js` left in the repo, unused.
