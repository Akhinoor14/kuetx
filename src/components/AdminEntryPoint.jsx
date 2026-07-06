import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import AdminDashboard from '../pages/AdminDashboard';

/**
 * Founder/admin access, scoped to whatever account is already signed in
 * via the main app session (Google sign-in). No separate email/password
 * login — the `admins/{uid}` Firestore doc is the single source of truth
 * for who's an owner, and we just check the current session's uid against it.
 */
export default function AdminEntryPoint() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAuthorized(false);
        setChecking(false);
        return;
      }
      const ok = await checkIsAdmin(user.uid);
      setAuthorized(ok);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) return null;
  if (authorized) return <AdminDashboard />;

  // Not an admin on this account — render nothing (no login box needed).
  return null;
}