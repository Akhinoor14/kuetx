/**
 * useFirebaseAuth.js — React hook for Firebase auth state
 * Use this in App.jsx to get current user and sync status
 */

import { useState, useEffect } from 'react';
import { onAuthChange } from '../lib/firebaseAuth';
import { startFirebaseSync, stopFirebaseSync, pushAllToFirestore, getLastPullCount } from '../lib/firebaseSync';
import { getProfile, isProfileComplete, isProfileStaleForUid } from '../store/store';

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
      setAuthReady(true);

      if (firebaseUser) {
        // Start real-time sync for this user
        await startFirebaseSync(firebaseUser.uid, {
          onSyncStatus: (status) => setSyncStatus(status),
        });

        // BUGFIX (stale/foreign localStorage auto-populating a new
        // account): `getLastPullCount() === 0` is true both for the
        // intended case (an anonymous session that just linked/signed in
        // to a real account for the first time on this device — "used
        // anonymously on phone → Google login on PC") AND for a
        // brand-new account that has never had ANY server data yet,
        // full stop. Firestore is empty either way, so this couldn't
        // tell the two apart — every fresh Register (or Login into an
        // account with no synced data yet) silently uploaded whatever
        // kuetx_* keys happened to already be sitting in this browser's
        // storage (a previous account's leftovers on a shared/reused
        // device, an abandoned earlier attempt, etc.) as if the new user
        // had entered it themselves.
        //
        // Fix: only auto-push if the local data actually looks like it
        // belongs to THIS account — a complete profile that isn't
        // flagged as stale for this uid (isProfileStaleForUid already
        // treats an untagged-but-complete profile as ambiguous rather
        // than auto-trusting it). A genuinely fresh account with nothing
        // real typed in yet (the common case) no longer pushes anything;
        // ProfileSetupModal's own mandatory 'profile' onboarding step is
        // what populates their real data instead.
        if (!firebaseUser.isAnonymous && getLastPullCount() === 0) {
          const localProfile = getProfile();
          const looksOwnedByThisAccount =
            isProfileComplete(localProfile) &&
            !isProfileStaleForUid(localProfile, firebaseUser.uid);
          if (looksOwnedByThisAccount) {
            console.log('[KUETx] New device first login — pushing local data to Firestore');
            await pushAllToFirestore(firebaseUser.uid);
          }
        }
      } else {
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

  // Called after upgrading anonymous → real account
  // Pushes all local data up so nothing is lost
  const onAccountUpgraded = async (newUser) => {
    setUser(newUser);
    await pushAllToFirestore(newUser.uid);
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