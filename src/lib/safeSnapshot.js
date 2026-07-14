// safeSnapshot.js
//
// Root-cause context: every subscribeX() helper across the codebase
// (groupSync.js, staffSync.js, manualVerifyRequests.js, qbUploadRequests.js,
// deleteRequests.js, rollOwnership.js, ...) calls Firestore's onSnapshot()
// with only a success callback, no error callback. Firestore's JS SDK does
// NOT call the success callback on error — it just never fires again. If a
// composite index is still building (common right after a fresh deploy),
// or the user is offline, or Firestore rules reject a specific query
// shape, the listener errors out ONCE into the void and the UI's `state
// === null` "Loading…" branch is stuck forever with no visible feedback.
// This isn't a network fluke, it repros 100% while the index is building.
//
// Fixing all ~25 subscribe*() call sites to accept + wire an onError
// param is the "real" fix, but happens gradually, one file at a time.
// wrapSnapshot() is the stop-gap available to every one of them right
// now with a one-line change: wrap the Firestore query with this instead
// of calling onSnapshot() directly, OR wrap an existing subscribeX() call
// from the outside (see withTimeout() below) when the lib function itself
// hasn't been touched yet.

import { onSnapshot } from 'firebase/firestore';

/**
 * Drop-in replacement for onSnapshot(query, successCb) that also handles
 * the error case instead of silently going quiet.
 *
 * @param {import('firebase/firestore').Query} q
 * @param {(data: any) => void} onData
 * @param {(err: Error) => void} [onError] - defaults to console.error only
 * @param {any} fallbackValue - value passed to onData when the listener errors
 *   (default: [] — matches the "no data yet" shape every caller already expects)
 */
export function safeOnSnapshot(q, onData, onError, fallbackValue = []) {
  return onSnapshot(
    q,
    (snap) => onData(snap),
    (err) => {
      console.error('[safeOnSnapshot] listener failed:', err?.code, err?.message);
      onData(fallbackValue);
      onError?.(err);
    }
  );
}

/**
 * Wraps an EXISTING subscribeX(callback) call (one that doesn't accept an
 * onError param yet) so the caller's loading state can't hang forever.
 * If `callback` hasn't fired within `timeoutMs`, force-resolves it to
 * `fallbackValue` and calls `onTimeout`.
 *
 * Usage (no change needed in the subscribeX function itself):
 *   useEffect(() => withTimeout(
 *     (cb) => subscribeAllCLApplications(cb),
 *     setClApplications,
 *     { onTimeout: () => setClAppsError('Still loading — check your connection or try again.') }
 *   ), []);
 *
 * @param {(cb: (data:any)=>void) => (()=>void)} subscribeFn - takes a callback, returns an unsubscribe fn
 * @param {(data:any)=>void} setState - React state setter to call with real or fallback data
 * @param {{timeoutMs?: number, fallbackValue?: any, onTimeout?: ()=>void}} [opts]
 */
export function withTimeout(subscribeFn, setState, opts = {}) {
  const { timeoutMs = 12000, fallbackValue = [], onTimeout } = opts;
  let settled = false;

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    console.warn('[withTimeout] listener did not respond within', timeoutMs, 'ms — resolving empty');
    setState(fallbackValue);
    onTimeout?.();
  }, timeoutMs);

  const unsub = subscribeFn((data) => {
    settled = true;
    clearTimeout(timer);
    setState(data);
  });

  return () => {
    clearTimeout(timer);
    unsub?.();
  };
}
