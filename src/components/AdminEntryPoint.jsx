import { useEffect, useState, useRef } from 'react';
import { auth } from '../lib/firebase';
import { subscribeIsAdmin } from '../lib/adminAuth';
import AdminDashboard from '../pages/AdminDashboard';
import { perfStart, perfEnd } from '../lib/perfLog';

/**
 * Founder/admin access, scoped to whatever account is already signed in
 * via the main app session (Google sign-in). No separate email/password
 * login — the `admins/{uid}` Firestore doc is the single source of truth
 * for who's an owner, and we just check the current session's uid against it.
 *
 * PERF FIX: this used to call checkIsAdmin(uid), a one-shot getDoc() that
 * always waits on a real network round-trip — on every single mount of
 * the Founder tab, even though the exact same admins/{uid} doc is also
 * being watched via subscribeIsAdmin inside useIsStaff.js (used by
 * RequireStaff, which already wraps this whole page). subscribeIsAdmin
 * is a ref-counted, shared onSnapshot listener that serves its
 * already-cached value instantly and only hits the network in the
 * background to reconcile — see adminAuth.js's own doc comment. Switching
 * to it here means opening the Founder tab reuses the SAME live listener
 * RequireStaff already opened a moment earlier, instead of firing a
 * second, slower, independent check.
 */
export default function AdminEntryPoint() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const startedRef = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      perfStart('AdminEntryPoint:check');
    }
    let unsubAdmin = () => {};
    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubAdmin();
      if (!user) {
        setAuthorized(false);
        setChecking(false);
        if (!endedRef.current) { endedRef.current = true; perfEnd('AdminEntryPoint:check', 'no user'); }
        return;
      }
      unsubAdmin = subscribeIsAdmin(user.uid, (isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!endedRef.current) {
          endedRef.current = true;
          perfEnd('AdminEntryPoint:check', isAdmin ? 'authorized' : 'not admin');
        }
      });
    });
    return () => {
      unsubAuth();
      unsubAdmin();
    };
  }, []);

  if (checking) return null;
  if (authorized) return <AdminDashboard />;

  // Not an admin on this account — render nothing (no login box needed).
  return null;
}
