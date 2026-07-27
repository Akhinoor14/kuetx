/**
 * useFirebaseAuth.js — React hook for Firebase auth state
 * Use this in App.jsx to get current user and sync status
 */

import { useState, useEffect } from 'react';
import { onAuthChange } from '../lib/firebaseAuth';
import { startFirebaseSync, stopFirebaseSync, pushAllToFirestore } from '../lib/firebaseSync';
import { syncLocalDataOnAuth, isSafeToTrustLocalData } from '../lib/accountLifecycle';

export default function useFirebaseAuth() {
  const [user, setUser] = useState(null);           // Firebase user object
  const [authReady, setAuthReady] = useState(false); // auth state loaded
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|error|pending

  useEffect(() => {
    let prevUid = null;

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      const newUid = firebaseUser?.uid || null;

      // Stop old sync session whenever user switches (logout, account change)
      if (prevUid && prevUid !== newUid) {
        stopFirebaseSync();
      }
      prevUid = newUid;

      setUser(firebaseUser);

      if (firebaseUser) {
        // BUGFIX (race condition): setAuthReady(true) used to fire here,
        // immediately after setUser() and before syncLocalDataOnAuth()
        // below. That's exactly the bug it looks like it isn't — React
        // treats setAuthReady(true) as a signal to re-render, and
        // App.jsx's own authReady-gated useEffect (the one that calls
        // buildQueue()) would fire right then, reading store.get(...) /
        // getProfile() while a brand-new account's local-storage clear
        // was still in progress a few lines below. Half-cleared reads —
        // some keys already gone, others not yet reached — could leak
        // through to the UI for one render, or worse, get picked back up
        // by whatever reads them.
        //
        // Fix: hold off setAuthReady(true) until AFTER
        // syncLocalDataOnAuth() (the clear-or-push decision) has fully
        // settled. Nothing that gates on authReady can now observe the
        // in-between state — by the time anything downstream sees
        // authReady flip to true, local storage is already in its final,
        // correct shape for this account.
        await syncLocalDataOnAuth(firebaseUser);
        setAuthReady(true);

        // Start real-time sync for this user
        await startFirebaseSync(firebaseUser.uid, {
          onSyncStatus: (status) => {
            console.log('[KUETx DIAG] syncStatus ->', status, 'at t=', performance.now());
            setSyncStatus(status);
          },
        });
      } else {
        setAuthReady(true);
        // Not logged in — do NOT auto sign-in anonymously anymore.
        // The 'auth' step in App.jsx's queue is now mandatory (no skip),
        // so every real session ends up going through Login/Register
        // instead of silently getting an anonymous uid first.
        setSyncStatus('idle');
      }
    });

    // Listen for sync status events
    const handleSyncEvent = (e) => setSyncStatus(e.detail?.status || 'idle');
    window.addEventListener('kuetx:firebase-sync', handleSyncEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('kuetx:firebase-sync', handleSyncEvent);
      stopFirebaseSync();
    };
  }, []);

  // Called after upgrading anonymous → real account. Currently unreachable
  // in practice — see App.jsx's showUpgradeModal (never set to true) and
  // the window.__kuetxShowAuth global auth modal (that global is never
  // defined anywhere, so setShowAuthModal(true) never fires from it
  // either) — the anonymous-session flow this was built for is fully
  // dead code elsewhere in the app now. Kept guarded anyway, routed
  // through the same shared isSafeToTrustLocalData() check as everywhere
  // else, as defense in depth: if either dead call site is ever wired
  // back up, this won't silently reintroduce the "push whatever's in
  // local storage, no ownership check" bug this session was about.
  const onAccountUpgraded = async (newUser) => {
    setUser(newUser);
    if (!newUser.isAnonymous && isSafeToTrustLocalData(newUser.uid)) {
      await pushAllToFirestore(newUser.uid);
    }
    await startFirebaseSync(newUser.uid, {
      onSyncStatus: (status) => setSyncStatus(status),
    });
  };

  return {
    user,
    authReady,
    syncStatus,
    isAnonymous: user?.isAnonymous ?? true,
    uid: user?.uid || null,
    displayName: user?.displayName || user?.email || null,
    onAccountUpgraded,
  };
}