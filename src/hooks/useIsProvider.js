// useIsProvider.js
//
// Server-verified provider status for the current signed-in user,
// mirroring useIsFaculty.js's shape (same sessionStorage optimistic-paint
// pattern, same "never derived from a self-reported flag" principle).
//
// Deliberate difference from useIsFaculty: there is no Founder-bypass
// branch here and no "isFaculty means account exists, not verified"
// split. Per SERVICES_PROVIDER_PLAN.md §4, provider verification is a
// HARD GATE — isProvider below reflects the ACCOUNT existing (any
// status), while isVerifiedProvider reflects status === 'verified'
// specifically. RequireProvider (Phase 1) renders the pending/rejected
// screen for the former-but-not-latter case, rather than letting any
// dashboard content through unverified — see providerSync.js's doc
// comment for why this is intentionally stricter than the Faculty
// Module's browse-but-don't-write policy.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeProviderProfile } from '../lib/providerSync';

// Same rationale as useIsFaculty.js's CACHE_KEY — a same-tab paint
// optimization only, never a source of truth. Every render still
// re-verifies against providers/{uid}; this only avoids a flash of
// "not a provider" for a few hundred ms while that resolves.
const CACHE_KEY = 'kuetx:lastKnownProviderStatus';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { isProvider: false, status: null };
    const parsed = JSON.parse(raw);
    return { isProvider: !!parsed.isProvider, status: parsed.status || null };
  } catch {
    return { isProvider: false, status: null };
  }
}

function writeCache(isProvider, status) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ isProvider, status }));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — fine, just no optimistic paint
  }
}

export function useIsProvider() {
  const initial = readCache();
  const [isProvider, setIsProvider] = useState(initial.isProvider);
  const [providerProfile, setProviderProfile] = useState(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let unsubProfile = () => {};

    const applyProfile = (profile) => {
      const active = !!profile;
      setIsProvider(active);
      setProviderProfile(profile);
      writeCache(active, profile?.status || null);
      setIsResolved(true);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile();
      unsubProfile = () => {};

      if (!user) {
        setIsProvider(false);
        setProviderProfile(null);
        writeCache(false, null);
        setIsResolved(true);
        return;
      }

      // BUGFIX (stale isResolved across account switch): isResolved used
      // to only ever get set to true inside applyProfile (async, after
      // the real Firestore check completes) — it was never reset to
      // false the moment a DIFFERENT uid showed up here. So a consumer
      // gating on isResolved (Sidebar.jsx, Navbar.jsx,
      // RootRouteResolver.jsx, etc.) could read a stale isResolved=true
      // (left over from the PREVIOUS account) together with a stale
      // isProvider value for the brief window between this callback
      // firing and applyProfile's async result landing — exactly the
      // window where the wrong shell's nav/banners could flash. Reset
      // isResolved synchronously here, before subscribeProviderProfile
      // is even called, so every gated consumer correctly shows its
      // loading/neutral state for that window instead of a stale value.
      setIsResolved(false);
      unsubProfile = subscribeProviderProfile(user.uid, applyProfile);
    });

    return () => {
      unsubAuth();
      unsubProfile();
    };
  }, []);

  const status = providerProfile?.status || null;
  const isVerifiedProvider = status === 'verified';
  const isPendingProvider = status === 'pending';
  const isRejectedProvider = status === 'rejected';
  const isDeactivatedProvider = status === 'deactivated';

  return {
    isProvider,
    providerProfile,
    isResolved,
    status,
    isVerifiedProvider,
    isPendingProvider,
    isRejectedProvider,
    isDeactivatedProvider,
  };
}
