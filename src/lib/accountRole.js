// accountRole.js
//
// The one-time Role Select choice ("Student" vs "Faculty Member") from §5
// Step 1 of the merged Faculty Module prompt. Deliberately a tiny, separate
// file rather than folded into store.js's growing DEFAULT_PROFILE shape —
// this flag is NOT part of the student profile object at all (a faculty
// account never has a studentId/roll/batch), so keeping it as its own
// store key avoids ever accidentally merging it into student-profile reads
// like getProfile() does with DEFAULT_PROFILE.
//
// This is a LOCAL, self-reported UI routing hint only — it decides which
// auth branch/onboarding queue to show, nothing more. It is never used to
// grant access to anything (see useIsFaculty.js / RequireFaculty.jsx for
// the actual server-verified gate). Someone could clear this and pick
// differently; the worst case is just seeing the wrong onboarding branch
// once, not a security issue.

import { store } from '../store/store';

export function getAccountRole() {
  return store.get('accountRole') || null; // null | 'student' | 'teacher'
}

export function setAccountRole(role) {
  if (role !== 'student' && role !== 'teacher') {
    throw new Error(`Invalid accountRole: ${role}`);
  }
  store.set('accountRole', role);
}

/** Sign-out (or "choose again") should clear this so Role Select reappears
 * — not currently wired to the sign-out button; noted here for Phase 8/
 * final-pass follow-up if the logout flow needs it. */
export function clearAccountRole() {
  store.set('accountRole', null);
}
