import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useIsStaff } from '../hooks/useIsStaff';
import { perfStart, perfEnd } from '../lib/perfLog';

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
 *
 * PERF LOGGING: wraps the isResolved wait in perfStart/perfEnd so the
 * console shows exactly how long "Checking access…" is on screen for
 * /team, /admin-hub, and anything else wrapped in RequireStaff. Filter
 * devtools console for "kuetx:perf" to see it.
 */
export default function RequireStaff({ children }) {
  const { isRealAdmin: isStaff, isResolved } = useIsStaff();
  const startedRef = useRef(false);
  const endedRef = useRef(false);

  if (!startedRef.current) {
    startedRef.current = true;
    perfStart('RequireStaff:check');
  }
  useEffect(() => {
    if (isResolved && !endedRef.current) {
      endedRef.current = true;
      perfEnd('RequireStaff:check', isStaff ? 'staff' : 'not staff');
    }
  }, [isResolved, isStaff]);

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
        <div style={{ marginBottom: 12 }}><Lock size={32} color="var(--muted)" /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          This page is only for the KUETx team and staff
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          You can not view this page because you do not have a KUETx staff role, even if you have the link.
        </div>
        <Link to="/" className="btn btn-primary btn-sm">Go home</Link>
      </div>
    );
  }

  return children;
}
