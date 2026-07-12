# Faculty Module — Progress

## Phase 1 — Foundations: DONE

Files created (paths relative to repo root):

| File | Status | Notes |
|---|---|---|
| `src/lib/facultyEmailVerify.js` | ✅ created | Suffix-match (`*.kuet.ac.bd`, hard-excludes `@stud.kuet.ac.bd`) + magic-link mechanism, reused 1:1 from `kuetEmailVerify.js` pattern via a separate secondary Firebase app (`kuetFacultyVerify`). Writes `verifiedFacultyEmails/{email}`. Includes `TESTING_BYPASS_EMAILS = ['guluvai479@gmail.com']` (Deviation 1b) — skips suffix check only, magic-link ownership proof still required. |
| `src/lib/facultySync.js` | ✅ created | `faculty/{uid}` CRUD: `createFacultyShell`, `getFacultyProfile`, `subscribeFacultyProfile`, `saveFacultyProfile`, `syncFacultyVerificationStatus`. Follows `groupUtils.js` identity-stamp spirit (no group scoping needed since faculty accounts aren't group-scoped). |
| `src/hooks/useIsFaculty.js` | ✅ created | Direct structural copy of `useIsStaff.js` — parallel founder-check + `subscribeFacultyProfile` check, `sessionStorage` optimistic-paint cache (`kuetx:lastKnownFacultyStatus`), `isResolved` flag for guard use. |
| `src/components/RequireFaculty.jsx` | ✅ created | Direct structural copy of `RequireCR.jsx`'s loading/denied shape. English copy (Deviation 3). |

## Known gaps / things NOT done yet (do not assume these are handled)

- `faculty/{uid}` is never actually **created** yet — `createFacultyShell()` exists but nothing calls it. That wiring happens in **Phase 2 (Auth Branch)**: after `AuthModal.jsx` `variant="faculty"` successfully creates the email+password account, App.jsx's onboarding flow must call `createFacultyShell(uid, email)` before advancing the queue.
- The magic-link holding screen (auto-advance on `verifiedAt` becoming non-null) is NOT built yet — also Phase 2. `syncFacultyVerificationStatus()` exists in `facultySync.js` but nothing calls it after `completeFacultyVerificationLink()` resolves.
- Firestore rules (§10 of spec) NOT written yet — these files assume rules will eventually restrict `verifiedAt` writes to the secondary-app path only. Until rules are deployed, a malicious client COULD call `updateDoc` directly on `faculty/{uid}.verifiedAt` — this is a real gap, not just a formality, and should be closed before this ships past local testing.
- `role-select` step in `App.jsx buildQueue()` NOT wired yet.
- `nav-faculty.js` NOT created yet (Phase 3).

## Next step

**Phase 2 — Auth Branch**: role-select step (bilingual), `AuthModal.jsx` `variant="faculty"` prop, wiring `createFacultyShell`/`syncFacultyVerificationStatus` into `App.jsx`'s `buildQueue()`, and the verification holding screen.
