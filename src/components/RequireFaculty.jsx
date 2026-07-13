import { Link } from 'react-router-dom';
import { useIsFaculty } from '../hooks/useIsFaculty';

/**
 * Blocks access to /faculty/* routes unless the current user is either:
 *   - a real faculty account (faculty/{uid} doc exists — auto-approval
 *     policy, verifiedAt/"Blue Tick" is NOT required just to use the
 *     Teacher shell), or
 *   - the Founder, via the pure UI bypass in useIsFaculty (admins/{uid}
 *     existing is enough, no faculty/{uid} doc or campus email required).
 *
 * For the two actions that DO still require the Blue Tick — posting a
 * notice and writing student marks — use RequireVerifiedFaculty.jsx
 * instead, not this one.
 */
export default function RequireFaculty({ children }) {
  const { isFaculty, isResolved } = useIsFaculty();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking faculty access…
      </div>
    );
  }

  if (!isFaculty) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Faculty access required
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          This page is only available to verified faculty accounts. If you&rsquo;re a teacher,
          sign in with your official KUET email and complete verification first.
        </div>
        <Link to="/" className="btn btn-primary btn-sm">Back to home</Link>
      </div>
    );
  }

  return children;
}
