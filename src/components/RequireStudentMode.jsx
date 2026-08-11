// RequireStudentMode.jsx
//
// Companion to RequireFaculty.jsx, for the reverse direction. Student-side
// routes (/profile, /courses, /attendance, /marks, /services, etc. — see
// App.jsx's top-level <Route> list) previously had NO route-level wrapper
// at all, unlike /faculty/* (RequireFaculty) and /provider (RequireProvider).
//
// IMPORTANT — this is NOT a data-leak fix. It was independently verified
// (see MULTI_CATEGORY_SERVICES_PLAN.md's post-Phase-7 follow-up notes) that
// every sensitive Firestore read on these pages is already scoped by
// request.auth.uid == <owner field> or a server-verified role function, so
// a faculty account visiting e.g. /attendance directly could only ever see
// an empty/broken state built from ITS OWN (faculty-shaped, mostly absent)
// profile data — never another account's data. Firestore rules are, and
// remain, the actual security boundary; nothing here changes that.
//
// What THIS fixes is the confusing UX of that empty/broken state: a real
// faculty account (verified or not — same "browsing is harmless, only
// writes are gated" philosophy as RequireFaculty's own doc comment) landing
// on a student page they were never meant to use, given no explanation.
// Blocked here with the same clear "wrong shell" message RequireFaculty
// gives in the other direction, rather than a silent empty page.
//
// Deliberately does NOT block:
//   - Signed-out / not-yet-resolved visitors — Layout itself never even
//     mounts for them (see App.jsx's queue-gated render), so this
//     component's isResolved-guard below is just the same "don't flash a
//     wrong state before the check settles" courtesy RequireFaculty uses,
//     not a real gate for that case.
//   - Plain student accounts — the overwhelmingly common case, isFaculty
//     is false for them, they pass straight through.
//   - The Founder viewing in Faculty mode (isFounderBypass) — the Founder
//     legitimately has both shells at once (see useViewMode.js's own doc
//     comment on why only the Founder gets a visible student/teacher
//     switch); blocking them here would contradict that design.
//
// Only a genuine, non-Founder faculty account (isFaculty && !isFounderBypass)
// is blocked — mirroring RequireFaculty's isFounderBypass || isFaculty
// check, just inverted.
//
// PERF LOGGING: perfStart/perfEnd around the combined isFacultyResolved +
// isProviderResolved wait — filter devtools console for "kuetx:perf".

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useIsFaculty } from '../hooks/useIsFaculty';
import { useIsProvider } from '../hooks/useIsProvider';
import { perfStart, perfEnd } from '../lib/perfLog';

export default function RequireStudentMode({ children }) {
  const { isFaculty, isFounderBypass, isResolved: isFacultyResolved } = useIsFaculty();
  const { isProvider, isResolved: isProviderResolved } = useIsProvider();
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const bothResolved = isFacultyResolved && isProviderResolved;

  if (!startedRef.current) {
    startedRef.current = true;
    perfStart('RequireStudentMode:check');
  }
  useEffect(() => {
    if (bothResolved && !endedRef.current) {
      endedRef.current = true;
      const isGenuineFaculty = isFaculty && !isFounderBypass;
      perfEnd('RequireStudentMode:check', isGenuineFaculty ? 'blocked:faculty' : (isProvider ? 'blocked:provider' : 'allowed'));
    }
  }, [bothResolved, isFaculty, isFounderBypass, isProvider]);

  if (!bothResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking access…
      </div>
    );
  }

  const isGenuineFaculty = isFaculty && !isFounderBypass;

  if (isGenuineFaculty) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          This page is for student accounts
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          You're signed in as faculty. Head back to your Faculty Dashboard instead.
        </div>
        <Link to="/faculty" className="btn btn-primary btn-sm">Go to Faculty Dashboard</Link>
      </div>
    );
  }

  if (isProvider) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          This page is for student accounts
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          You're signed in as a service provider. Head back to your Provider Dashboard instead.
        </div>
        <Link to="/provider" className="btn btn-primary btn-sm">Go to Provider Dashboard</Link>
      </div>
    );
  }

  return children;
}
