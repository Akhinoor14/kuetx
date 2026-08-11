// useIsFaculty.js
//
// Server-verified faculty status for the current signed-in user, mirroring
// useIsStaff.js's shape exactly (same two-checks-in-parallel + sessionStorage
// optimistic-paint pattern), but the two branches here are:
//   - Founder -> admins/{uid} doc (checkIsAdmin, unchanged single source of
//     truth) -> pure UI bypass into the Teacher shell, no faculty/{uid} doc
//     or campus email required (Deviation 9).
//   - Everyone else -> faculty/{uid}.verifiedAt != null (facultySync.js).
//     This is a HARD GATE (Deviation 2) — an unverified faculty/{uid} doc
//     existing is NOT enough, verifiedAt must be non-null.
//
// Never derived from any self-reported flag — same principle as
// useIsStaff.js's profile.isCR note.
//
// PERFORMANCE FIX: the onAuthStateChanged + subscribeIsAdmin +
// subscribeFacultyProfile listeners used to live inside this hook's own
// useEffect and were torn down/re-created on every mount — which happens
// on EVERY navigation, since RequireStudentMode/RequireFaculty sit inside
// individual <Route> elements rather than wrapping the route tree once
// (see App.jsx). The subscription setup now lives in one shared
// module-level singleton (createAuthGatedSingleton) so the Firestore
// listeners are only ever created once per page session; every hook
// instance just subscribes to the singleton's broadcast state.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeIsAdmin } from '../lib/adminAuth';
import { subscribeFacultyProfile } from '../lib/facultySync';
import { createAuthGatedSingleton } from './createAuthGatedSingleton';

// Same rationale as useIsStaff.js's CACHE_KEY — a same-tab paint
// optimization only, never a source of truth. Every render still
// re-verifies against admins/{uid} and faculty/{uid}.verifiedAt; this only
// avoids a flash of "not faculty" for a few hundred ms while that resolves.
const CACHE_KEY = 'kuetx:lastKnownFacultyStatus';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { isFaculty: false, isFounderBypass: false };
    const parsed = JSON.parse(raw);
    return { isFaculty: !!parsed.isFaculty, isFounderBypass: !!parsed.isFounderBypass };
  } catch {
    return { isFaculty: false, isFounderBypass: false };
  }
}

// Whether a cached answer actually exists yet, distinct from what that
// answer says — used to seed isResolved so a repeat visit within the same
// session skips the loading flash entirely, while a first-ever check this
// session still correctly waits for the real result.
function hasCache() {
  try {
    return sessionStorage.getItem(CACHE_KEY) !== null;
  } catch {
    return false;
  }
}

function writeCache(isFaculty, isFounderBypass) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ isFaculty, isFounderBypass }));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — fine, just no optimistic paint
  }
}

const initial = readCache();
const facultySingleton = createAuthGatedSingleton((onState) => {
  let unsubProfile = () => {};
  let unsubAdmin = () => {};
  // Tracks the two independent checks separately so whichever resolves
  // first can be applied immediately, and so a late-arriving founder
  // check can't clobber an already-applied role result with a stale
  // "not admin" write.
  let founderResolved = false;
  let isFounder = false;

  const applyProfile = (profile) => {
    if (founderResolved && isFounder) return; // Founder always wins.
    const active = !!profile?.verifiedAt;
    writeCache(active, false);
    onState({ isFaculty: active, isFounderBypass: false, facultyProfile: profile, isResolved: true });
  };

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    unsubProfile();
    unsubProfile = () => {};
    unsubAdmin();
    unsubAdmin = () => {};
    founderResolved = false;
    isFounder = false;

    if (!user) {
      writeCache(false, false);
      onState({ isFaculty: false, isFounderBypass: false, facultyProfile: null, isResolved: true });
      return;
    }

    // BUGFIX (stale isResolved across account switch): isResolved must
    // flip back to false the instant a DIFFERENT uid appears here,
    // synchronously, before either subscribeIsAdmin's or
    // subscribeFacultyProfile's async result lands. Otherwise a gated
    // consumer (Sidebar.jsx, Navbar.jsx, RootRouteResolver.jsx) could
    // briefly read a stale isResolved=true left over from the PREVIOUS
    // account together with that account's stale values.
    onState({ isFaculty: false, isFounderBypass: false, facultyProfile: null, isResolved: false });

    unsubAdmin = subscribeIsAdmin(user.uid, (result) => {
      founderResolved = true;
      isFounder = result;
      if (isFounder) {
        writeCache(true, true);
        onState({ isFaculty: true, isFounderBypass: true, facultyProfile: null, isResolved: true });
      }
      // If not founder, whatever subscribeFacultyProfile already
      // delivered (or will deliver) stands as-is.
    });

    unsubProfile = subscribeFacultyProfile(user.uid, applyProfile);
  });

  return () => {
    unsubAuth();
    unsubProfile();
    unsubAdmin();
  };
}, {
  isFaculty: initial.isFaculty,
  isFounderBypass: initial.isFounderBypass,
  facultyProfile: null,
  // PERF FIX (repeated "Checking access…" flash on every navigation):
  // seeding this from hasCache() (not always false) removes the
  // artificial re-check flash on every single mount for someone whose
  // status was already verified earlier this same session. The live
  // Firestore subscriptions above still run once (not per-mount) and
  // still correct this if it's ever wrong.
  isResolved: hasCache(),
});

export function useIsFaculty() {
  const [state, setState] = useState(facultySingleton.getState);

  useEffect(() => facultySingleton.subscribe(setState), []);

  return state;
}
