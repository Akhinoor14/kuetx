/**
 * useFirebaseAuth.js — React hook for Firebase auth state
 * Use this in App.jsx to get current user and sync status
 */

import { useState, useEffect } from 'react';
import { onAuthChange, loginAnonymously } from '../lib/firebaseAuth';
import { startFirebaseSync, stopFirebaseSync, pushAllToFirestore, getLastPullCount } from '../lib/firebaseSync';

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

        // If this is a real (non-anonymous) account and Firestore had NO data,
        // it means this is their first login on this device — push local data up.
        // This handles: "used anonymously on phone → Google login on PC"
        if (!firebaseUser.isAnonymous && getLastPullCount() === 0) {
          console.log('[KUETx] New device first login — pushing local data to Firestore');
          await pushAllToFirestore(firebaseUser.uid);
        }
      } else {
        // Not logged in → login anonymously so data is always tied to a uid
        setSyncStatus('idle');
        try {
          await loginAnonymously();
          // onAuthChange will fire again with the anonymous user
        } catch (err) {
          console.warn('[KUETx] Anonymous login failed:', err.message);
        }
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