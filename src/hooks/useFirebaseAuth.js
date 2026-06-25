/**
 * useFirebaseAuth.js — React hook for Firebase auth state
 * Use this in App.jsx to get current user and sync status
 */

import { useState, useEffect } from 'react';
import { onAuthChange, loginAnonymously } from '../lib/firebaseAuth';
import { startFirebaseSync, stopFirebaseSync, pushAllToFirestore } from '../lib/firebaseSync';
import { store } from '../store/store';

export default function useFirebaseAuth() {
  const [user, setUser] = useState(null);          // Firebase user object
  const [authReady, setAuthReady] = useState(false); // auth state loaded
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|error|pending

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        // Start real-time sync for this user
        await startFirebaseSync(firebaseUser.uid, {
          onSyncStatus: (status) => setSyncStatus(status),
        });
      } else {
        // Not logged in → login anonymously so data is always tied to a uid
        stopFirebaseSync();
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
