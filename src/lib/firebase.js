import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Exported so adminAuth.js can spin up a *second*, independent Firebase app
// instance (same project) for the admin login flow without touching the
// main app/auth object used by the normal student session.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Persistent local cache so group real-time listeners (routine/assignments/
// notices/resources) survive reloads and behave sanely offline, and so
// multiple tabs of the app don't fight over the cache.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// BUGFIX (silent Firestore lockup — no crash UI, just a stuck/empty app):
// persistentLocalCache is supposed to use IndexedDB, but the Firestore SDK
// has an internal localStorage-based fallback for its pending-mutation
// queue (keys named 'firestore_mutations_firestore/[DEFAULT]/<project>/
// <uid>') that kicks in when IndexedDB is unavailable or broken in that
// browser (private/incognito mode, a full-disk device, a browser storage
// policy, or a corrupted IndexedDB from a previous session). That queue is
// never trimmed, so on an affected browser it grows across sessions until
// it exceeds localStorage's much smaller quota (~5-10MB vs IndexedDB's
// hundreds of MB) — at which point EVERY future write attempt throws
// QuotaExceededError. That failure happens inside Firestore's internal
// async queue, not React's render/commit cycle, so ErrorBoundary (which
// only catches render-phase errors) never sees it — the SDK just logs
// "INTERNAL ASSERTION FAILED: Unexpected state" and pull/sync silently
// times out. From the outside this looks like the app being stuck loading
// forever with no error shown at all, which is worse than a crash: there's
// nothing here for the person to even retry.
//
// Fix: listen for this specific failure at the window level (it surfaces
// as an unhandled promise rejection, which IS observable there even
// though React never sees it), clear only the offending localStorage
// key(s) — not all of localStorage, which would also wipe unrelated app
// preferences/state — and reload once so Firestore can rebuild a fresh,
// empty mutation queue from scratch. Guarded the same way as the chunk-
// reload fix in ErrorBoundary.jsx: a sessionStorage flag caps this to one
// attempt, so if clearing somehow doesn't resolve it (e.g. IndexedDB is
// permanently unavailable in this browser and the queue immediately
// starts refilling), this falls through to just leaving the console error
// visible instead of reloading forever.
const FIRESTORE_QUOTA_RELOAD_FLAG = 'firestore_quota_reload_attempted';

function isFirestoreQuotaError(reasonOrMessage) {
  const text = String(reasonOrMessage?.message || reasonOrMessage || '');
  return (
    (text.includes('QuotaExceededError') || text.includes('exceeded the quota')) &&
    text.includes('firestore')
  );
}

function clearFirestoreLocalStorageQueue() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firestore_mutations_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return keysToRemove.length > 0;
  } catch (e) {
    // localStorage unavailable entirely — nothing we can clear
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isFirestoreQuotaError(event.reason)) return;

    let alreadyAttempted = false;
    try {
      alreadyAttempted = sessionStorage.getItem(FIRESTORE_QUOTA_RELOAD_FLAG) === '1';
    } catch (e) {
      alreadyAttempted = true;
    }
    if (alreadyAttempted) return;

    const cleared = clearFirestoreLocalStorageQueue();
    if (!cleared) return; // nothing to clear — reloading wouldn't help, leave the error visible

    try {
      sessionStorage.setItem(FIRESTORE_QUOTA_RELOAD_FLAG, '1');
    } catch (e) {
      // ignore — reload still happens, just without the loop guard
    }
    window.location.reload();
  });
}

export const storage = getStorage(app);

// Used for callable Cloud Functions (push notifications, etc.) — region
// left as default (us-central1) since functions were deployed there
// already (see functions/index.js).
export const functions = getFunctions(app);

// Analytics — lazy load so it doesn't block app startup
export const getFirebaseAnalytics = async () => {
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) return getAnalytics(app);
  } catch {}
  return null;
};

export default app;