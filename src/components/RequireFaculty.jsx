import { Link } from 'react-router-dom';
import { useIsFaculty } from '../hooks/useIsFaculty';

/**
 * Blocks access to /faculty/* routes unless the current user is either:
 *   - a real, verified faculty account (faculty/{uid}.verifiedAt != null), or
 *   - the Founder, via the pure UI bypass in useIsFaculty (Deviation 9 —
 *     admins/{uid} existing is enough, no faculty/{uid} doc or campus
 *     email required, no second account created).
 *
 * Deliberately does NOT accept an unverified faculty/{uid} doc as
 * sufficient — Deviation 2 makes verification a hard gate, not a soft
 * badge, since there's no curated whitelist behind the suffix-match
 * signup check (Deviation 1). Mirrors RequireCR.jsx's loading/denied
 * shape exactly; copy is English per Deviation 3 (faculty-side UI has no
 * Bangla except the pre-role-select screen).
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
