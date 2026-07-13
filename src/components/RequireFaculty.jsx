import { Link } from 'react-router-dom';
import { useIsFaculty } from '../hooks/useIsFaculty';

/**
 * Blocks access to /faculty/* routes unless the current user is at least
 * a faculty ACCOUNT (faculty/{uid} exists) or the Founder bypass.
 *
 * MANUAL VERIFICATION POLICY (revised): the Blue Tick (verifiedAt) used
 * to be a hard, route-level gate — an unverified account couldn't see
 * ANY /faculty/* page at all. That's now relaxed: an unverified faculty
 * account can browse everything (dashboard, classes, schedule, notices,
 * contact, tools) exactly like a verified one — reading a roster, seeing
 * what a class looks like, finding the Contact page to actually get
 * verified, none of that can hurt anyone. What's still blocked is the
 * specific handful of WRITE actions a fake/unverified account could use
 * to damage real students' data: creating a class assignment, adding or
 * editing a schedule slot, entering marks, and broadcasting a notice.
 * Each of those pages gates its own action button on `isVerified` (via
 * useIsFaculty) AND — the real boundary, never trust the UI alone —
 * Firestore rules already independently require isVerifiedFaculty() for
 * every one of those writes (facultyAssignments create/update, marks
 * studentRecords create/update, notices create, meetings write). So even
 * if this route-level gate were bypassed entirely, none of those four
 * writes can actually land unverified.
 */
export default function RequireFaculty({ children }) {
  const { isFaculty, isFounderBypass, isResolved } = useIsFaculty();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking faculty access…
      </div>
    );
  }

  const hasAccess = isFounderBypass || isFaculty;

  if (!hasAccess) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Faculty access required
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          This page is only available to faculty accounts. If you're a teacher, sign in with your official KUET email first.
        </div>
        <Link to="/" className="btn btn-primary btn-sm">Back to home</Link>
      </div>
    );
  }

  return children;
}
