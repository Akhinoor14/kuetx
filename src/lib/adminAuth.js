// adminAuth.js
//
// Admin status is derived from the main app's already-signed-in session
// (Google sign-in via `auth` in firebase.js). The `admins/{uid}` Firestore
// doc is the single source of truth for who's an owner — this file just
// exposes a helper to check that doc against a given uid.

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

/** Checks the `admins/{uid}` doc — the single source of truth for who's an owner. */
export async function checkIsAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

/**
 * Live-subscribes to the `admins/{uid}` doc instead of one-shot getDoc.
 * getDoc always waits on a network round-trip even when the doc is
 * already cached locally; onSnapshot serves the cached result first
 * (near-instant, same as subscribeMyRoles in staffSync.js) and then
 * reconciles with the server in the background. This is what
 * useIsStaff.js should call so Founder resolves just as fast as
 * CR/staff roles instead of lagging behind them.
 */
export function subscribeIsAdmin(uid, callback) {
  if (!uid) { callback(false); return () => {}; }
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => callback(snap.exists()),
    (err) => { console.error('[adminAuth] admin listener error:', err); callback(false); },
  );
}