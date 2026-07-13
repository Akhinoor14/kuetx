import { Link } from 'react-router-dom';
import { useIsFaculty } from '../hooks/useIsFaculty';

/**
 * Blocks access to /faculty/* routes unless the current user is either:
 *   - a VERIFIED faculty account (faculty/{uid}.verifiedAt != null — the
 *     "Blue Tick", granted only by an Admin in AdminDashboard's Faculty →
 *     Pending tab), or
 *   - the Founder, via the pure UI bypass in useIsFaculty (admins/{uid}
 *     existing is enough, no faculty/{uid} doc or campus email required).
 *
 * MANUAL VERIFICATION POLICY: an unverified faculty account (email/
 * password created, magic link maybe even clicked) can still reach the
 * profile-setup screen to fill in name/title/dept (that check happens
 * upstream in the onboarding queue, before this gate), but every real
 * /faculty/* destination — dashboard, classes, schedule, notices, marks
 * — requires the Blue Tick. There is no longer a narrower
 * "RequireVerifiedFaculty" for just marks/notices; this is the one gate.
 */
export default function RequireFaculty({ children }) {
  const { isFaculty, isFounderBypass, facultyProfile, isResolved } = useIsFaculty();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking faculty access…
      </div>
    );
  }

  const isVerified = isFounderBypass || (isFaculty && !!facultyProfile?.verifiedAt);

  if (!isVerified) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Blue Tick verification required
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          {isFaculty
            ? "Your account is created, but a Founder/Admin still needs to verify it before you can use the Teacher features. This is usually quick — check back soon."
            : "This page is only available to verified faculty accounts. If you're a teacher, sign in with your official KUET email first."}
        </div>
        <Link to="/" className="btn btn-primary btn-sm">Back to home</Link>
      </div>
    );
  }

  return children;
}
