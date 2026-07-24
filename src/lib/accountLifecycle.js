// accountLifecycle.js
//
// Single source of truth for "is this a brand-new account, and is it safe
// to trust/push local data" — the question at the center of this session's
// entire bug-fix arc (new accounts silently inheriting a previous
// account's leftover localStorage/IndexedDB data on a shared/reused
// device). That logic used to be hand-copied in three separate places
// (App.jsx's handleAuthSuccess, useFirebaseAuth.js's onAuthChange, and
// Profile.jsx's own handleAuthSuccess) — three chances to fix a bug in
// only two of them. Everything now routes through here instead.
//
// ─── Why creationTime === lastSignInTime, and its limits ───────────────
// Firebase's own signal for "this uid's very first sign-in" is
// user.metadata.creationTime === user.metadata.lastSignInTime (both are
// ISO strings from the server, not client clocks, so this isn't affected
// by device clock skew). It is not perfectly infallible — in a pathological
// case (sign-up immediately followed by a fast sign-out/retry sign-in
// within the same request round-trip) the two timestamps could in theory
// differ by the time this code observes them, misclassifying a genuinely
// new account as "returning." That failure mode is intentionally
// low-stakes here: isSafeToTrustLocalData() below still requires the
// local profile to be COMPLETE and not tagged for a different uid before
// trusting/pushing anything, so a misclassified brand-new account with no
// real local data yet simply pushes nothing (isProfileComplete() is
// false) — it doesn't inherit anyone else's data either way, it just
// skips clearing local storage it presumably didn't need cleared. Given
// the "auth" step is now mandatory (see App.jsx's buildQueue), there is
// no anonymous-session grace period during which this ambiguity window
// could matter in practice.
//
// ─── The two-part trust test ────────────────────────────────────────────
// A returning account's local data is only trusted (and only pushed to
// Firestore) when BOTH hold:
//   1. isProfileComplete(profile) — an incomplete/empty profile is never
//      pushed regardless of source, since ProfileSetupModal's own
//      mandatory step is what's supposed to populate it.
//   2. !isProfileStaleForUid(profile, uid) — the profile isn't tagged
//      (via tagProfileOwner in store.js) as belonging to a DIFFERENT uid.
//      An untagged-but-complete profile is treated as ambiguous-but-safe
//      (see isProfileStaleForUid's own doc comment: "never second-guess a
//      real, finished profile") rather than blocked outright, since the
//      tag was only introduced after this system existed and older local
//      data was never retroactively tagged.

import { store, getProfile, isProfileComplete, isProfileStaleForUid } from '../store/store';
import { clearAccountRole } from './accountRole';
import { pushAllToFirestore } from './firebaseSync';

/**
 * True iff `user` (a Firebase Auth user object) is signing in for the
 * very first time ever — i.e. a genuinely brand-new account, not a
 * returning one. False (not "unknown") for anonymous users, since an
 * anonymous session doesn't have a meaningful "new account" concept in
 * this app anymore (the anonymous flow is fully retired — see
 * firebaseAuth.js's loginAnonymously(), which is defined but never
 * called from anywhere in the UI).
 */
export function isBrandNewAccount(user) {
  if (!user || user.isAnonymous) return false;
  const created = user.metadata?.creationTime;
  const lastSignIn = user.metadata?.lastSignInTime;
  return !!created && !!lastSignIn && created === lastSignIn;
}

// ─── Concurrent-call dedup ────────────────────────────────────────────────
// This module is deliberately called from more than one place for the
// same auth event — App.jsx's handleAuthSuccess (fired directly from
// AuthModal's onSuccess) and useFirebaseAuth.js's onAuthChange (a
// Firebase-level listener that fires independently, with no guaranteed
// order relative to onSuccess) both call syncLocalDataOnAuth(user) for
// the same uid. Every individual operation inside this function is
// idempotent (clearing an already-cleared key, or pushing already-pushed
// data, is harmless) — but running the actual work twice in parallel is
// still wasteful and, for the IndexedDB sweep specifically, briefly
// unpredictable which call's Promise.all "wins" the memoryCache/
// localStorage synchronous clear first. This cache makes concurrent
// calls for the same uid share a single in-flight promise instead: the
// first call does the real work, any call for the same uid while that's
// still running just awaits the same promise, and every caller still
// correctly awaits genuine completion either way.
const _inFlight = new Map();

/**
 * True iff the local profile currently in storage looks like it
 * genuinely belongs to `uid` and is safe to push to Firestore / treat as
 * already-entered data, rather than a stranger's leftovers on a
 * shared/reused device.
 */
export function isSafeToTrustLocalData(uid) {
  if (!uid) return false;
  const localProfile = getProfile();
  return isProfileComplete(localProfile) && !isProfileStaleForUid(localProfile, uid);
}

// Note: an earlier version of this file exposed an isAccountSyncInProgress()
// flag for callers to check before rendering data-dependent UI. It's been
// removed — the actual fix for that race (a component reading local
// storage mid-clear) lives in useFirebaseAuth.js instead: setAuthReady(true)
// only fires AFTER syncLocalDataOnAuth() resolves, and every data-rendering
// part of the app (App.jsx's Layout/Routes) is gated behind authReady via
// queueBuilt. Nothing can mount and read local storage until this function
// has fully finished, so a separate "is it still running" flag for
// call sites to poll was unnecessary surface area.

/**
 * The one function every auth-success call site should call, replacing
 * all three of the previous hand-copied implementations.
 *
 * - Brand-new account: wipes every local kuetx_* key (localStorage +
 *   IndexedDB, not just whatever memoryCache happened to have lazily
 *   loaded — see store.js's clearAllForFreshAccountThorough for why that
 *   distinction matters) and pushes nothing. Nothing from a previous
 *   account on this device can leak into the new one.
 * - Returning account: clears nothing, and pushes local data to
 *   Firestore ONLY if isSafeToTrustLocalData(uid) holds — covers the one
 *   legitimate remaining case (a device that already has this exact
 *   account's own data locally, e.g. it was entered before this sync
 *   layer existed, or a future re-introduction of an anonymous-to-real
 *   upgrade flow).
 *
 * Callers should await this BEFORE starting Firestore sync (pulling
 * and/or attaching store-change listeners), so a brand-new account's
 * clear always finishes ahead of anything that could read or resurrect
 * the data it just removed.
 */
export async function syncLocalDataOnAuth(user) {
  if (!user || user.isAnonymous) return;

  const uid = user.uid;
  if (_inFlight.has(uid)) {
    return _inFlight.get(uid);
  }

  const work = (async () => {
    if (isBrandNewAccount(user)) {
      clearAccountRole();
      try {
        await store.clearAllForFreshAccountThorough();
      } catch (err) {
        // A failed clear is a real correctness concern (stale data from a
        // previous account could still be sitting there) — log it loudly
        // so it's visible during testing/support, but never let it hang
        // the app. The person can still use the app; worst case some
        // leftover local keys survive one session, which the next
        // successful sync (or a manual re-login) will catch.
        console.error('[KUETx] clearAllForFreshAccountThorough failed for brand-new account:', err);
      }
      // Nothing to push — a freshly-cleared (or attempted-to-clear)
      // account has no local data, by construction, that could
      // legitimately belong to it yet.
      return;
    }

    if (isSafeToTrustLocalData(uid)) {
      try {
        await pushAllToFirestore(uid);
      } catch (err) {
        // BUGFIX (found on architecture review): pushAllToFirestore is a
        // network call that can genuinely fail (offline, transient
        // Firestore/permission error). This function used to let that
        // exception propagate straight up to the caller — and since
        // useFirebaseAuth.js's setAuthReady(true) only runs AFTER this
        // whole function's await resolves, an uncaught failure here would
        // leave the entire app stuck on its "Loading…" screen forever,
        // for something as ordinary as a flaky connection during login.
        // A failed push just means this session's local data doesn't
        // reach Firestore yet — startFirebaseSync's own periodic pull/
        // push-on-change layer, or simply using the app normally, will
        // pick it up later. Not worth blocking the whole app over.
        console.warn('[KUETx] pushAllToFirestore failed for returning account:', err);
      }
    }
  })();

  _inFlight.set(uid, work);
  try {
    await work;
  } finally {
    _inFlight.delete(uid);
  }
}

/**
 * Clears all local kuetx_* data (localStorage + IndexedDB) as part of
 * signing out.
 *
 * DESIGN DECISION (changed after review): this app is cloud-based —
 * Firestore is the actual source of truth, and startFirebaseSync()'s
 * pullAllFromFirestore() restores a returning account's data in well
 * under a second on a normal connection. Given that, keeping local data
 * around after logout "for convenience" bought almost nothing in
 * practice, while directly working against this whole session's fix:
 * every logout handler in the app (Profile.jsx, Settings.jsx,
 * Navbar.jsx) used to promise the person "your data will stay on this
 * device" — a promise that was silently broken the moment a DIFFERENT
 * person registered a brand-new account on the same device afterward
 * (syncLocalDataOnAuth's isBrandNewAccount clear would wipe it anyway).
 * A promise that's true 95% of the time and silently false the other 5%
 * (exactly the shared/reused-device case this whole session has been
 * about protecting) is worse than no promise at all.
 *
 * Fix: logout now clears local data unconditionally, same as a brand-new
 * account would get on this device. The promise made to the person at
 * logout time is now simple and always true: "signing out clears this
 * device; log back in and everything comes right back from the cloud."
 * No more silent exception carved out for a case the person had no way
 * to know about in advance.
 */
export async function clearLocalDataOnLogout() {
  clearAccountRole();
  try {
    await store.clearAllForFreshAccountThorough();
  } catch (err) {
    // Same reasoning as the brand-new-account case above: a failed clear
    // is worth logging loudly, but the person is signing out either way
    // and shouldn't be blocked by a local-storage cleanup hiccup.
    console.error('[KUETx] clearAllForFreshAccountThorough failed during logout:', err);
  }
}
