// useIsFaculty.js
//
// Server-verified faculty status for the current signed-in user — the
// Faculty Module's counterpart to useIsStaff.js. Two independent checks
// run in parallel, exactly like useIsStaff.js:
//   - Founder bypass: admins/{uid} exists (checkIsAdmin) → instantly treated
//     as "real faculty" for shell-unlock purposes, no faculty/{uid} doc or
//     campus email required at all (Deviation/§7/§9 item 9 of the merged
//     prompt — pure UI bypass, not a second account).
//   - Real faculty: faculty/{uid} exists AND verifiedAt is set (Deviation 2
//     hard gate — an unverified doc with verifiedAt: null does NOT count).
//
// Same sessionStorage optimistic-paint cache pattern as useIsStaff.js: it's
// only ever used to avoid a visible flash of "locked" for a split second on
// reload for someone who was already known-good a moment ago. It is never
// treated as a source of truth — every mount still re-verifies against
// Firestore before isResolved flips true.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import { subscribeFacultyDoc } from '../lib/facultySync';

const CACHE_KEY = 'kuetx:lastKnownFacultyStatus';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { isRealFaculty: false, isFounderBypass: false };
    const parsed = JSON.parse(raw);
    return {
      isRealFaculty: !!parsed.isRealFaculty,
      isFounderBypass: !!parsed.isFounderBypass,
    };
  } catch {
    return { isRealFaculty: false, isFounderBypass: false };
  }
}

function writeCache(isRealFaculty, isFounderBypass) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ isRealFaculty, isFounderBypass }));
  } catch {
    // sessionStorage unavailable (private browsing etc.) — fine, just no optimistic paint
  }
}

export function useIsFaculty() {
  const initial = readCache();
  const [isRealFaculty, setIsRealFaculty] = useState(initial.isRealFaculty);
  const [isFounderBypass, setIsFounderBypass] = useState(initial.isFounderBypass);
  const [facultyDoc, setFacultyDoc] = useState(null);
  // Same role as useIsStaff.js's isResolved — route guards (RequireFaculty)
  // must wait for this before rendering a "denied" state, to avoid flashing
  // it for a genuinely-verified faculty account whose live check just
  // hasn't come back yet.
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let unsubFaculty = () => {};
    let founderResolved = false;
    let isFounder = false;

    const applyFacultyDoc = (fdoc) => {
      if (founderResolved && isFounder) return; // Founder bypass always wins.
      setFacultyDoc(fdoc);
      const verified = !!fdoc?.verifiedAt;
      setIsRealFaculty(verified);
      setIsFounderBypass(false);
      writeCache(verified, false);
      setIsResolved(true);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubFaculty();
      unsubFaculty = () => {};
      founderResolved = false;
      isFounder = false;

      if (!user) {
        setIsRealFaculty(false);
        setIsFounderBypass(false);
        setFacultyDoc(null);
        writeCache(false, false);
        setIsResolved(true);
        return;
      }

      // Fire both checks in parallel — same rationale as useIsStaff.js:
      // don't force every faculty sign-in to pay the founder-doc round-trip
      // latency serially before their own verifiedAt can resolve.
      checkIsAdmin(user.uid).then((result) => {
        founderResolved = true;
        isFounder = result;
        if (isFounder) {
          setIsRealFaculty(true);
          setIsFounderBypass(true);
          writeCache(true, true);
          setIsResolved(true);
        }
        // If not founder, whatever subscribeFacultyDoc already delivered
        // (or will deliver) stands as-is.
      });

      unsubFaculty = subscribeFacultyDoc(user.uid, applyFacultyDoc);
    });

    return () => {
      unsubAuth();
      unsubFaculty();
    };
  }, []);

  return { isRealFaculty, isFounderBypass, facultyDoc, isResolved };
}
