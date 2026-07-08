import { Link } from 'react-router-dom';
import { useIsStaff } from '../hooks/useIsStaff';

/**
 * Blocks access to staff-only pages/tools unless the current user's REAL,
 * server-verified status is Founder (admins/{uid}) or holds at least one
 * role under staff/{uid}/roles — mirrors RequireCR.jsx's pattern exactly.
 *
 * Without this, /team and /admin-hub were reachable by anyone who typed
 * or was given the URL directly, even with zero role — the pages
 * themselves already refused to show any data or actions to a non-staff
 * user (server-verified checks inside StaffDashboard/AdminEntryPoint),
 * but the route itself had no guard. This closes that gap at the routing
 * level too, same as RequireCR does for CR-only tools.
 *
 * useIsStaff() is itself always backed by a live Firestore check
 * (admins/{uid} or staff/{uid}/roles) — never a self-reported flag —
 * so there's nothing to spoof client-side to get past this.
 */
export default function RequireStaff({ children }) {
  const { isRealAdmin: isStaff, isResolved } = useIsStaff();

  if (!isResolved) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        Checking access…
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          এই পেজটা শুধু KUETx টিম/স্টাফদের জন্য
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          তোমার কোনো KUETx staff role নেই বলে এই পেজ দেখা যাবে না — লিংক থাকলেও না।
        </div>
        <Link to="/" className="btn btn-primary btn-sm">হোমে ফিরে যাও</Link>
      </div>
    );
  }

  return children;
}
