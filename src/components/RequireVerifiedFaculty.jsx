import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useIsFaculty } from '../hooks/useIsFaculty';

/**
 * Narrower than RequireFaculty.jsx — blocks access unless the current
 * faculty account has the Blue Tick (faculty/{uid}.verifiedAt != null),
 * OR is the Founder bypass. Use this ONLY around the two things that
 * still require Founder-approved verification under the auto-approval
 * policy: posting a notice, and writing/editing student marks. Every
 * other faculty page/action should use the plain RequireFaculty instead
 * — an unverified (not-yet-approved) faculty account can still create
 * classes, log sessions, see rosters, etc.
 */
export default function RequireVerifiedFaculty({ children }) {
  const { isFaculty, isFounderBypass, facultyProfile, isResolved } = useIsFaculty();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking verification status…
      </div>
    );
  }

  const isVerified = isFounderBypass || (isFaculty && !!facultyProfile?.verifiedAt);

  if (!isVerified) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Blue Tick verification required
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          Posting notices and entering student marks needs Founder-approved
          verification first. Your request is already in the review queue —
          you&rsquo;ll get the Blue Tick once it&rsquo;s approved. Everything
          else (classes, sessions, schedule) is available right away.
        </div>
        <Link to="/faculty" className="btn btn-primary btn-sm">Back to dashboard</Link>
      </div>
    );
  }

  return children;
}
