# KUETx — Auto-Approval Update

Build-tested (real `vite build`, succeeded with no errors — only
pre-existing chunk-size warnings unrelated to this change).

## New flow

**Students:** Sign up → immediately active in their department/batch
group (this already worked at the rules level — only the nagging UI
that implied otherwise is removed). CR/ACR see a "New student joined"
entry in the group's normal notices feed (server-side Cloud Function,
`onMemberJoin` in functions/index.js) — informational, non-blocking.

**Faculty:** Sign up → immediately active, can create classes, log
sessions, see rosters, everything except posting notices and entering
student marks. A Cloud Function (`onFacultySignup`) automatically files
a request into the Founder's existing Approvals tab. Founder approves →
faculty account gets the Blue Tick → notices + marks unlock.

## Files in this zip (copy over the matching paths in your project)

- `firestore.rules` — new `isFaculty()` (any faculty account) vs.
  `isVerifiedFaculty()` (Blue Tick only, now gates ONLY notices-create
  and student-marks write). `faculty/{uid}.verifiedAt` can now only be
  set by Admin (Founder), not the old email-link bridge.
- `functions/index.js` — added `onMemberJoin` (notifies CR) and
  `onFacultySignup` (auto-files Founder approval request). Old
  `requestOtp`/`verifyOtp` functions left in place but unreachable
  (client no longer calls them) — safe to delete later if you want.
- `src/App.jsx` — removed the faculty-verify holding-screen queue step,
  removed `VerifyReminderPopup` and the magic-link confirm modals from
  render, added the new `RequireVerifiedFaculty` wrapper around
  `/faculty/notices`.
- `src/components/RoleSelectScreen.jsx`, `AuthModal.jsx` — unchanged
  behavior for faculty doc creation (Cloud Function handles the
  approval-request filing now, not the client).
- `src/components/RequireFaculty.jsx` — doc comment updated only,
  logic unchanged (already just checks faculty-doc-exists via the hook).
- `src/components/RequireVerifiedFaculty.jsx` — **new file.** Wrap this
  around anything that must stay Blue-Tick-gated.
- `src/hooks/useIsFaculty.js` — `isFaculty` now true as soon as
  `faculty/{uid}` exists, not gated on `verifiedAt`.
- `src/lib/facultySync.js` — unchanged (kept as reference/copy).
- `src/lib/manualVerifyRequests.js` — unchanged; the existing
  `approveManualVerifyRequest` is reused as-is by the new
  auto-filed faculty requests.
- `src/lib/founderCategories.js` — relabeled the approvals subtab to
  "Faculty Blue Tick / Manual Verification".
- `src/pages/AdminDashboard.jsx` — unchanged; the existing manual-verify
  list already renders faculty vs student correctly.
- `src/pages/Profile.jsx` — removed the KUET-verify nag banner
  (`ProfileVerifyBanner`). Left `EmailVerifyBanner` alone — that one is
  Firebase Auth password-recovery email verification, a different,
  legitimate concern, not KUET institutional verify.

## Everything is now complete

`FacultyClassDetail.jsx`'s `MarksTab` is now gated inline — same
Blue Tick check as `RequireVerifiedFaculty`, but scoped to just the
marks section, so Syllabus/Schedule/Sessions/Attendance tabs on the
same page stay open to any faculty account. This matches what
`firestore.rules` already enforces server-side; now the UI shows a
clear message too instead of the write silently failing.

## Files safe to delete (now unused/unreachable)

These still exist in your project untouched — dead code, not
referenced by anything after this update. Delete at your convenience:

- `src/components/EmailVerifyBanner.jsx` → **KEEP**, still used
  (Firebase Auth email verification, unrelated to KUET verify)
- `src/components/ProfileVerifyBanner.jsx` — no longer imported
- `src/components/KuetVerifyEmailConfirmModal.jsx` — no longer rendered
- `src/components/FacultyVerifyEmailConfirmModal.jsx` — no longer rendered
- `src/components/FacultyVerifyHoldingScreen.jsx` — no longer rendered
- `src/components/KuetEmailVerifyWidget.jsx` — only used by the above
- `src/components/KuetEmailVerifyBox.jsx` — check usage before deleting
- `src/components/OtpInput.jsx` — only used by the above
- `src/lib/kuetEmailVerify.js` — only referenced by dead code paths in
  App.jsx (the link-detection effects are inert now, left in place —
  see comment added at the removed-modals spot in App.jsx)
- `src/lib/facultyEmailVerify.js` — same, inert
- `src/lib/otpVerify.js` — no longer called from any UI
- `functions/index.js`'s `requestOtp`/`verifyOtp` exports — unreachable,
  can delete once you're sure nothing external calls them directly

**Do NOT delete:**
- `src/components/ClaimCRCard.jsx` — different feature (a student
  volunteering to become CR), untouched, still active
- `src/components/RequireCR.jsx` — different feature (gates CR-only
  tools like Class Management), untouched, still active
- `src/lib/manualVerifyRequests.js` — actively reused by the new
  auto-approval flow
