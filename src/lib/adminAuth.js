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
 *
 * BUGFIX (excessive live listeners): called from both useIsStaff.js and
 * useIsFaculty.js — both mounted broadly via Sidebar/BottomNav — and each
 * used to open its own fresh onSnapshot() on the exact same admins/{uid}
 * doc, meaning 2 identical live Firestore connections per signed-in user
 * on every page. This ref-counted registry (same pattern as
 * subscribeMyRoles in staffSync.js) means only ONE real listener is ever
 * open per uid, shared across every caller.
 */
const _isAdminRegistry = new Map(); // uid -> { unsubscribe, refCount, listeners:Set, lastValue }

export function subscribeIsAdmin(uid, callback) {
  if (!uid) { callback(false); return () => {}; }

  let entry = _isAdminRegistry.get(uid);
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null };
    _isAdminRegistry.set(uid, entry);
    entry.unsubscribe = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => {
        entry.lastValue = snap.exists();
        entry.listeners.forEach((cb) => cb(entry.lastValue));
      },
      (err) => {
        console.error('[adminAuth] admin listener error:', err);
        entry.lastValue = false;
        entry.listeners.forEach((cb) => cb(false));
      },
    );
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue);

  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.unsubscribe?.();
      _isAdminRegistry.delete(uid);
    }
  };
}