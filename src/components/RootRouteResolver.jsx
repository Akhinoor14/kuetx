// RootRouteResolver.jsx
//
// Root-route (`/`) specific sibling to RequireStudentMode.jsx. Same
// server-verified checks (useIsFaculty / useIsProvider), same
// isGenuineFaculty = isFaculty && !isFounderBypass condition (copied
// verbatim from RequireStudentMode.jsx — do not diverge), but a different
// resolution: instead of rendering a "wrong shell" block screen with a
// manual link, this component silently <Navigate replace /> to the
// correct dashboard the instant the server-verified check resolves.
//
// Why root gets its own component instead of reusing RequireStudentMode:
// every other student route (/profile, /courses, etc.) is something the
// user reached on purpose — via a link, a bottom-nav tap, or typing that
// specific path — so if a genuine role mismatch is ever caught there, a
// block screen with a "go to the right place" button is the correct,
// honest UX. Root is different: it's the bare domain / bookmark entry
// point that EVERY signed-in account, regardless of role, lands on. For
// that entry point, "silently land the account in the right shell" is the
// intended behavior, not an edge case — so redirect, don't ask for a click.
//
// Two-stage resolution, matching the doc comment already in App.jsx's
// root <Route>:
//   1. Optimistic paint — App.jsx's own ternary (based on the
//      client-cached getAccountRole()) already fires a <Navigate> for the
//      teacher/provider cases before this component even mounts, so the
//      common case is already instant. This component is only reached at
//      all when that client flag said "student" (or hasn't resolved).
//   2. Correction — once BOTH useIsFaculty() and useIsProvider() have
//      resolved (server-verified), if either disagrees with "student",
//      Navigate to the correct dashboard. No block screen, no click.
//
// Deliberately mirrors RequireStudentMode's isResolved-guard rationale:
// signed-out / not-yet-resolved visitors never actually see this (Layout
// itself doesn't mount until App.jsx's queueBuilt gate passes — see
// App.jsx), so the loading state below is just the same "don't flash a
// wrong state before the check settles" courtesy, not a real gate.
//
// IMPORTANT: this does NOT replace RequireStudentMode. /profile, /courses,
// and the rest of the student-route list keep using RequireStudentMode
// exactly as before — only App.jsx's root <Route path="/"> switches to
// this component.

import { Navigate } from 'react-router-dom';
import { useIsFaculty } from '../hooks/useIsFaculty';
import { useIsProvider } from '../hooks/useIsProvider';

export default function RootRouteResolver({ children }) {
  const { isFaculty, isFounderBypass, isResolved: isFacultyResolved } = useIsFaculty();
  const { isProvider, isResolved: isProviderResolved } = useIsProvider();

  if (!isFacultyResolved || !isProviderResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking access…
      </div>
    );
  }

  // Copied verbatim from RequireStudentMode.jsx — same Founder-bypass
  // semantics must apply here too, so a Founder browsing the student
  // shell (useViewMode.js) is never redirected away from it.
  const isGenuineFaculty = isFaculty && !isFounderBypass;

  if (isGenuineFaculty) {
    return <Navigate to="/faculty" replace />;
  }

  // isProvider here means "account exists, any status" — same standard
  // RequireStudentMode uses (see that file's doc comment), not
  // isVerifiedProvider specifically.
  if (isProvider) {
    return <Navigate to="/provider" replace />;
  }

  return children;
}
