/**
 * useFirebaseAuth.js — React hook for Firebase auth state
 * Use this in App.jsx to get current user and sync status
 */

import { useState, useEffect } from 'react';
import { onAuthChange, handleGoogleRedirectResult, loginWithGoogle } from '../lib/firebaseAuth';
import { startFirebaseSync, stopFirebaseSync, pushAllToFirestore } from '../lib/firebaseSync';
import { syncLocalDataOnAuth, isSafeToTrustLocalData, isBrandNewAccount } from '../lib/accountLifecycle';
import { getProfile } from '../store/store';

export default function useFirebaseAuth() {
  const [user, setUser] = useState(null);           // Firebase user object
  const [authReady, setAuthReady] = useState(false); // auth state loaded
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|error|pending

  useEffect(() => {
    // Google Sign-In is redirect-based now (see firebaseAuth.js's
    // loginWithGoogle/upgradeWithGoogle) — the page navigates away to
    // Google and back, so there's no popup callback to rely on. This must
    // run once during app startup to pick up the result of a redirect
    // that just completed; if it's missing, users complete sign-in on
    // Google's side but the app never notices they're signed in.
    // Resolves to null (no-op) if the app just loaded normally with no
    // redirect in progress. The onAuthChange listener below still fires
    // independently for the resulting auth state either way — this only
    // needs to catch the auth/credential-already-in-use edge case, which
    // getRedirectResult() is the one place that can surface.
    //
    // BUGFIX (real root cause of "stuck after Google sign-in", found by
    // tracing a live console log across the redirect boundary): this
    // component mounts under <React.StrictMode> (main.jsx), which
    // deliberately mounts -> unmounts -> remounts every component once on
    // initial load specifically to surface effects that aren't idempotent.
    // This effect is exactly that kind of effect: getRedirectResult(auth)
    // is NOT safe to call twice for the same completed redirect — Firebase
    // consumes/clears the pending-redirect state on the FIRST call, so a
    // second concurrent call (StrictMode's remount, firing this effect
    // again a moment later) resolves with result.user === null even
    // though the first call already had (or was about to have) the real
    // user. Depending on microtask timing, either call can "win," which is
    // why this reproduced as "sometimes silently stuck, no error thrown."
    // The captured log confirms it: Google issued a real auth code
    // (`code=4/0AXEQ...`) on the redirect back, but the app's own
    // authReady/uid logs after that navigation still showed `uid= null`
    // — getRedirectResult() was called, but not exactly once.
    //
    // Fix: a module-level guard ensures getRedirectResult(auth) is only
    // ever actually invoked once per real page load, no matter how many
    // times React (re)runs this effect. Module scope (not component state)
    // is required here specifically because this must survive the
    // mount/unmount/remount cycle StrictMode performs before the
    // component's own state exists.
    if (window.__kuetxRedirectResultChecked) return;
    window.__kuetxRedirectResultChecked = true;

    handleGoogleRedirectResult().catch((err) => {
      if (err?.code === 'auth/credential-already-in-use') {
        // This Google account already belongs to a real, non-anonymous
        // account from before — it can't be linked to a brand-new
        // anonymous uid. Fall back to a plain sign-in (another redirect)
        // so a returning user isn't stuck just because they were holding
        // a fresh anonymous session on this device.
        console.warn('[KUETx Auth] Google account already in use — retrying as plain sign-in.');
        loginWithGoogle().catch((err2) => {
          console.error('[KUETx Auth] Fallback Google sign-in failed:', err2);
        });
        return;
      }
      console.error('[KUETx Auth] Google redirect sign-in failed:', err);
    });

    let prevUid = null;

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      const newUid = firebaseUser?.uid || null;

      // Stop old sync session whenever user switches (logout, account change)
      if (prevUid && prevUid !== newUid) {
        stopFirebaseSync();
      }
      prevUid = newUid;

      setUser(firebaseUser);

      if (firebaseUser) {
        // PERF FIX (zero-latency reload): this used to `await
        // syncLocalDataOnAuth()` THEN `await startFirebaseSync()` — two
        // fully sequential network round-trips — before setAuthReady(true)
        // ever fired. App.jsx's entire queue/routing system is gated on
        // authReady, so every single load (including a plain refresh of an
        // already-logged-in, already-cached account) sat through both
        // round-trips before showing anything real. That's the "20 second
        // freeze on every load" symptom.
        //
        // The two brand-new-account-vs-shared-device correctness concerns
        // that originally justified awaiting these are handled differently
        // now, WITHOUT paying for them on every load:
        //
        // 1. "Half-cleared local storage leaking into the UI for a
        //    brand-new account" — only possible when isBrandNewAccount(user)
        //    is true, which is by definition a NEW uid this device has never
        //    seen. For that one case (and only that case) we still await
        //    the clear before flipping authReady, since there's no local
        //    cache worth showing early anyway — an empty/fresh account has
        //    nothing to lose by waiting the extra beat. Every returning
        //    account (the overwhelmingly common case, and the one this
        //    perf fix is actually for) skips the await entirely.
        //
        // 2. "buildQueue() sees a stale/incomplete local profile because
        //    the Firestore->local profile pull hasn't landed yet" — the
        //    local IndexedDB/localStorage cache already has the last-known
        //    profile for a returning account (that's the whole point of
        //    persisting it). buildQueue() reading that cache immediately is
        //    the correct fast-path; startFirebaseSync()'s pull below still
        //    runs, and if it turns up a genuinely different profile shape,
        //    the store-updated event it fires (see store.js) flows through
        //    the app's existing reactive reads exactly like any other
        //    background change — nothing needs to poll or re-check.
        //
        // syncLocalDataOnAuth's own returning-account push (see
        // accountLifecycle.js) was already fire-and-forget before this
        // change; startFirebaseSync's pull/hydrate is made fire-and-forget
        // here for the same reason and by the same reasoning.
        //
        // SECURITY CHECK (same-account gate — this is the part that must
        // never be skipped): the "show local cache instantly" fast-path
        // below is ONLY safe if the cache on THIS device actually belongs
        // to the uid that's signing in right now. Before doing anything
        // else, explicitly compare the locally-stored profile's owner tag
        // against firebaseUser.uid.
        //
        // Why not just reuse isProfileStaleForUid() as-is: that helper
        // (store.js) deliberately returns false — "not stale, trust it" —
        // for any COMPLETE profile, even one tagged for a different uid,
        // because its one job is guarding ProfileSetupModal's prefill, not
        // gating what gets shown post-login. That's the wrong answer here:
        // if Person A's finished profile is sitting in local cache and
        // Person B (a different, real account) signs in on the same
        // device, a complete-but-wrong-owner profile is exactly the case
        // that must NOT be fast-pathed — it's someone else's real,
        // finished data, not harmless leftover junk.
        //
        // So this check is deliberately stricter and separate:
        //   - no owner tag recorded at all -> unknown provenance, don't
        //     trust it as this uid's data; go through the safe (awaited)
        //     path, same as a brand-new account.
        //   - owner tag present but for a DIFFERENT uid -> definitely not
        //     this account; also go through the safe path.
        //   - owner tag matches this uid -> genuinely this account's own
        //     cached data, safe to show instantly.
        const localProfile = getProfile();
        const cachedOwnerUid = localProfile?.__ownerUid || null;
        const cacheBelongsToThisUser = cachedOwnerUid === firebaseUser.uid;

        const isNew = isBrandNewAccount(firebaseUser);
        const needsSafePath = isNew || !cacheBelongsToThisUser;

        if (needsSafePath) {
          // Either a brand-new uid this device has never seen, OR the
          // local cache doesn't provably belong to the account that's
          // signing in (untagged, or tagged for someone else). Either way:
          // never show it. syncLocalDataOnAuth() below handles both —
          // brand-new accounts get a full wipe, and (via
          // isSafeToTrustLocalData's own ownership check) an untrusted
          // cache is simply never pushed to Firestore either. Awaiting
          // here means nothing renders off a cache we can't vouch for.
          await syncLocalDataOnAuth(firebaseUser);
          await startFirebaseSync(firebaseUser.uid, {
            onSyncStatus: (status) => setSyncStatus(status),
          });
        } else {
          // Returning account: don't block first paint on any network
          // round-trip. Local cache (IndexedDB, hydrated by ensureDBReady()
          // in main.jsx) is trusted immediately; sync work continues in the
          // background and merges in via the normal store-updated event
          // path whenever it lands.
          syncLocalDataOnAuth(firebaseUser).catch((err) => {
            console.warn('[KUETx Auth] Background syncLocalDataOnAuth failed:', err);
          });
          startFirebaseSync(firebaseUser.uid, {
            onSyncStatus: (status) => setSyncStatus(status),
          }).catch((err) => {
            console.warn('[KUETx Auth] Background startFirebaseSync failed:', err);
          });
        }

        setAuthReady(true);
      } else {
        setAuthReady(true);
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

  // Called after upgrading anonymous → real account. Currently unreachable
  // in practice — see App.jsx's showUpgradeModal (never set to true) and
  // the window.__kuetxShowAuth global auth modal (that global is never
  // defined anywhere, so setShowAuthModal(true) never fires from it
  // either) — the anonymous-session flow this was built for is fully
  // dead code elsewhere in the app now. Kept guarded anyway, routed
  // through the same shared isSafeToTrustLocalData() check as everywhere
  // else, as defense in depth: if either dead call site is ever wired
  // back up, this won't silently reintroduce the "push whatever's in
  // local storage, no ownership check" bug this session was about.
  const onAccountUpgraded = async (newUser) => {
    setUser(newUser);
    if (!newUser.isAnonymous && isSafeToTrustLocalData(newUser.uid)) {
      await pushAllToFirestore(newUser.uid);
    }
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