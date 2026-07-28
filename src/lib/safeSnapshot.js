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
 * Drop-in replacement for onSnapshot(query, successCb, errorCb) that
 * retries a few times with backoff specifically on permission-denied —
 * the near-universal "startup race" where a listener attaches a beat
 * before the Firestore stream has picked up a just-resolved auth token
 * (see onAuthStateChanged firing in useFirebaseAuth.js vs. the
 * underlying gRPC/Listen channel's token refresh). Same race already
 * documented and handled ad hoc in groupSync.js's _subscribeSingleton;
 * this is the same fix factored out for callers that aren't behind that
 * registry (bookingAlerts.js, providerSync.js, manualVerifyRequests.js,
 * staffSync.js's CL application listeners, etc).
 *
 * Non-permission-denied errors are NOT retried — those are real errors
 * (offline, bad query shape, missing index) and retrying them just
 * delays the same failure.
 *
 * @param {import('firebase/firestore').Query | import('firebase/firestore').DocumentReference} ref
 * @param {(snap: any) => void} onData
 * @param {(err: Error) => void} onFinalError - called once retries are exhausted (or on a non-permission error immediately)
 * @param {{retries?: number, delayMs?: number}} [opts]
 * @returns {() => void} unsubscribe
 */
export function retryableOnSnapshot(ref, onData, onFinalError, opts = {}) {
  const { retries = 3, delayMs = 1200 } = opts;
  let unsub = null;
  let cancelled = false;

  const attach = (retriesLeft) => {
    unsub = onSnapshot(ref, onData, (err) => {
      if (err?.code === 'permission-denied' && retriesLeft > 0 && !cancelled) {
        setTimeout(() => attach(retriesLeft - 1), delayMs);
        return;
      }
      onFinalError(err);
    });
  };
  attach(retries);

  return () => {
    cancelled = true;
    unsub?.();
  };
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
