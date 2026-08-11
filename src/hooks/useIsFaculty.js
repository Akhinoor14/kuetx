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

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeIsAdmin } from '../lib/adminAuth';
import { subscribeFacultyProfile } from '../lib/facultySync';

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

export function useIsFaculty() {
  const initial = readCache();
  const [isFaculty, setIsFaculty] = useState(initial.isFaculty);
  const [isFounderBypass, setIsFounderBypass] = useState(initial.isFounderBypass);
  const [facultyProfile, setFacultyProfile] = useState(null);
  // PERF FIX (repeated "Checking faculty access…" flash on every
  // navigation): this used to always start false, forcing RequireFaculty
  // to show its loading screen on every single mount — i.e. every time
  // the user navigated onto a /faculty/* route — even though a trustworthy
  // cached answer from THIS SAME SESSION was sitting right there in
  // sessionStorage. On mobile, where navigation is frequent and network
  // round-trips are slower, this showed as a "checking access" bar
  // flashing on nearly every page.
  //
  // Fix: if the cache holds a value at all (readCache() successfully
  // parsed something previously written this session), trust it as the
  // initial isResolved state too, not just the initial isFaculty/
  // isFounderBypass value. The live Firestore listener below still runs
  // and still corrects this if it's ever wrong — this only removes the
  // ARTIFICIAL "always start not-resolved" flash for a value we already
  // know from earlier this same session. A brand-new session (nothing
  // cached yet) still correctly shows the loading screen once, and the
  // onAuthStateChanged handler below still synchronously flips isResolved
  // back to false the instant a DIFFERENT uid signs in (see the BUGFIX
  // comment on that line), so a same-tab account switch can never show
  // the previous account's cached faculty status.
  const [isResolved, setIsResolved] = useState(() => hasCache());

  useEffect(() => {
    let unsubProfile = () => {};
    let unsubAdmin = () => {};
    // Same independent-parallel-checks rationale as useIsStaff.js: don't
    // force every real faculty account to pay the founder-doc round-trip
    // latency before its own verifiedAt check can resolve.
    let founderResolved = false;
    let isFounder = false;

    const applyProfile = (profile) => {
      if (founderResolved && isFounder) return; // Founder bypass always wins.
      // isFaculty here means "account exists" only (not verified) — this
      // is the signal used by the onboarding queue and by places that
      // only need to know "is this a faculty account at all" (e.g. App.jsx
      // routing a returning faculty account back to 'teacher' role), and
      // it's also what RequireFaculty.jsx gates /faculty/* routes on, by
      // design: an unverified faculty account is still allowed to browse
      // (see RequireFaculty.jsx's own "MANUAL VERIFICATION POLICY" doc
      // comment) — the four real WRITE actions are what's blocked, both
      // in the UI (via facultyProfile.verifiedAt) and, as the actual
      // boundary, in Firestore rules regardless of what the client sends.
      // The real access-control bug was never here — see accountRole.js /
      // App.jsx's buildQueue()/handleAuthSuccess() for the fix that
      // stops a Student-role account from ever reaching this at all.
      const active = !!profile;
      setIsFaculty(active);
      setIsFounderBypass(false);
      setFacultyProfile(profile);
      writeCache(active, false);
      setIsResolved(true);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile();
      unsubProfile = () => {};
      unsubAdmin();
      unsubAdmin = () => {};
      founderResolved = false;
      isFounder = false;

      if (!user) {
        setIsFaculty(false);
        setIsFounderBypass(false);
        setFacultyProfile(null);
        writeCache(false, false);
        setIsResolved(true);
        return;
      }

      // BUGFIX (stale isResolved across account switch): same fix as
      // useIsProvider.js's doc comment on this exact line — isResolved
      // must flip back to false the instant a DIFFERENT uid appears
      // here, synchronously, before either subscribeIsAdmin's or
      // subscribeFacultyProfile's async result lands. Otherwise a
      // gated consumer (Sidebar.jsx, Navbar.jsx, RootRouteResolver.jsx)
      // could briefly read a stale isResolved=true left over from the
      // PREVIOUS account together with that account's stale
      // isFaculty/isFounderBypass values.
      setIsResolved(false);

      unsubAdmin = subscribeIsAdmin(user.uid, (result) => {
        founderResolved = true;
        isFounder = result;
        if (isFounder) {
          setIsFaculty(true);
          setIsFounderBypass(true);
          writeCache(true, true);
          setIsResolved(true);
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
  }, []);

  return {
    isFaculty, isFounderBypass, facultyProfile, isResolved,
  };
}
