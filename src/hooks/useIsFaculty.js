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
import { checkIsAdmin } from '../lib/adminAuth';
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
  // Same role as useIsStaff.js's isResolved — RequireFaculty needs this to
  // avoid flashing "denied" before the real check settles.
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let unsubProfile = () => {};
    // Same independent-parallel-checks rationale as useIsStaff.js: don't
    // force every real faculty account to pay the founder-doc round-trip
    // latency before its own verifiedAt check can resolve.
    let founderResolved = false;
    let isFounder = false;

    const applyProfile = (profile) => {
      if (founderResolved && isFounder) return; // Founder bypass always wins.
      const verified = !!profile?.verifiedAt;
      setIsFaculty(verified);
      setIsFounderBypass(false);
      setFacultyProfile(profile);
      writeCache(verified, false);
      setIsResolved(true);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile();
      unsubProfile = () => {};
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

      checkIsAdmin(user.uid).then((result) => {
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
    };
  }, []);

  return {
    isFaculty, isFounderBypass, facultyProfile, isResolved,
  };
}
