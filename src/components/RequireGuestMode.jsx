// RequireGuestMode.jsx
//
// documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 4, item 3: "A signed-in user manually
// navigating to /guest/..." — plan's own recommendation was "redirect
// them to the real equivalent page instead, since they don't need a
// demo." This is that redirect, mirroring the existing
// RequireStudentMode.jsx / RequireFaculty.jsx wrapper-guard pattern
// already used elsewhere in App.jsx's route list, rather than inventing
// a new mechanism.
//
// Takes `authState` as a prop (same shape App.jsx's useFirebaseAuth()
// returns, already threaded into Layout as `authState` — see App.jsx's
// <Layout authState={authState} .../>) instead of re-deriving auth state
// internally, since the four /guest/* routes render inside Layout where
// authState is already in scope.
//
// Deliberately simple: any signed-in user (authState.user truthy) is
// bounced to /dashboard, the real app's own landing page, regardless of
// their role (student/faculty/provider/staff) — /dashboard's own
// existing role-based redirect logic (RootRouteResolver et al.) already
// handles sending each role to its correct home from there, so this
// component doesn't need to duplicate that per-role routing itself.
//
// Signed-out visitors (authState.user is null) and the not-yet-resolved
// moment before Firebase Auth settles (authState.authReady false) both
// pass straight through to the real guest page — this only ever blocks
// a confirmed, already-authenticated session, never flashes a redirect
// for a visitor who was never going to be blocked.

import { Navigate } from 'react-router-dom';

export default function RequireGuestMode({ authState, children }) {
  if (authState?.authReady && authState?.user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
