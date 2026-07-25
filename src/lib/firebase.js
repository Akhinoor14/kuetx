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