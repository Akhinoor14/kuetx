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
//
// PERFORMANCE FIX: subscription setup moved into a shared module-level
// singleton (createAuthGatedSingleton), same reasoning as useIsFaculty.js
// — this hook mounts fresh on every navigation (RequireStudentMode/
// RequireProvider sit inside individual <Route> elements), so a
// per-instance onAuthStateChanged + onSnapshot pair was being torn down
// and rebuilt on every single page change. Now there's one shared
// listener for the whole page session; each hook instance just
// subscribes to its broadcast state.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeProviderProfile } from '../lib/providerSync';
import { createAuthGatedSingleton } from './createAuthGatedSingleton';

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

// Whether a cached answer exists yet at all, distinct from what it says —
// seeds isResolved so a repeat navigation within the same session skips
// straight past the loading flash; a first-ever check this session still
// correctly waits for the real result.
function hasCache() {
  try {
    return sessionStorage.getItem(CACHE_KEY) !== null;
  } catch {
    return false;
  }
}

const initial = readCache();
const providerSingleton = createAuthGatedSingleton((onState) => {
  let unsubProfile = () => {};

  const applyProfile = (profile) => {
    const active = !!profile;
    writeCache(active, profile?.status || null);
    onState({ isProvider: active, providerProfile: profile, isResolved: true });
  };

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    unsubProfile();
    unsubProfile = () => {};

    if (!user) {
      writeCache(false, null);
      onState({ isProvider: false, providerProfile: null, isResolved: true });
      return;
    }

    // BUGFIX (stale isResolved across account switch): isResolved must
    // flip back to false the instant a DIFFERENT uid shows up here,
    // synchronously, before subscribeProviderProfile's async result
    // lands — otherwise a gated consumer (Sidebar.jsx, Navbar.jsx,
    // RootRouteResolver.jsx, etc.) could read a stale isResolved=true
    // left over from the PREVIOUS account together with a stale
    // isProvider value for that brief window.
    onState({ isProvider: false, providerProfile: null, isResolved: false });
    unsubProfile = subscribeProviderProfile(user.uid, applyProfile);
  });

  return () => {
    unsubAuth();
    unsubProfile();
  };
}, {
  isProvider: initial.isProvider,
  providerProfile: null,
  isResolved: hasCache(),
});

export function useIsProvider() {
  const [state, setState] = useState(providerSingleton.getState);

  useEffect(() => providerSingleton.subscribe(setState), []);

  const status = state.providerProfile?.status || null;
  const isVerifiedProvider = status === 'verified';
  const isPendingProvider = status === 'pending';
  const isRejectedProvider = status === 'rejected';
  const isDeactivatedProvider = status === 'deactivated';

  return {
    isProvider: state.isProvider,
    providerProfile: state.providerProfile,
    isResolved: state.isResolved,
    status,
    isVerifiedProvider,
    isPendingProvider,
    isRejectedProvider,
    isDeactivatedProvider,
  };
}
