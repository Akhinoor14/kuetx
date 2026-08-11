// useIsStaff.js
//
// Server-verified staff status for the current signed-in user.
// Founder -> admins/{uid} doc (adminAuth.js, unchanged single source of truth).
// Everyone else -> live roles under staff/{uid}/roles (staffSync.js).
// Never derived from any self-reported profile flag — see Sidebar.jsx comment.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { checkIsAdmin, subscribeIsAdmin } from '../lib/adminAuth';
import { subscribeMyRoles } from '../lib/staffSync';
import { ROLE_LABELS } from '../lib/staffRoles';

// Purely a same-tab, same-session paint optimization — NOT a source of
// truth and NEVER used to gate access to anything. The very first thing
// every render still does is re-verify against admins/{uid} and
// staff/{uid}/roles; this only decides what the sidebar shows for the
// few hundred ms before that real check resolves. Without it, the
// Class Rep/Founder row visibly disappears and reappears on every page
// load/reload even for someone who was just looking at it a second ago,
// because isRealAdmin/adminLabel always restart from false/null while
// onAuthStateChanged + the Firestore round-trip are in flight.
const CACHE_KEY = 'kuetx:lastKnownStaffStatus';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { isRealAdmin: false, adminLabel: null };
    const parsed = JSON.parse(raw);
    return { isRealAdmin: !!parsed.isRealAdmin, adminLabel: parsed.adminLabel || null };
  } catch {
    return { isRealAdmin: false, adminLabel: null };
  }
}

function writeCache(isRealAdmin, adminLabel) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ isRealAdmin, adminLabel }));
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — fine, just no optimistic paint
  }
}

// Whether a cached answer exists yet at all, distinct from what it says —
// seeds isResolved so a repeat navigation within the same session skips
// straight past the loading flash; a first-ever check this session still
// correctly waits for the real result. Same pattern as useIsFaculty.js /
// useIsProvider.js.
function hasCache() {
  try {
    return sessionStorage.getItem(CACHE_KEY) !== null;
  } catch {
    return false;
  }
}

export function useIsStaff() {
  const initial = readCache();
  const [isRealAdmin, setIsRealAdmin] = useState(initial.isRealAdmin);
  const [adminLabel, setAdminLabel] = useState(initial.adminLabel);
  // PERF FIX (repeated "Checking access…" flash on every navigation): see
  // useIsFaculty.js's matching comment for the full reasoning — seeding
  // this from hasCache() (not always false) removes the artificial
  // re-check flash on every single mount for someone whose status was
  // already verified earlier this same session. The live Firestore
  // subscriptions below still run every time and still correct this if
  // it's ever wrong.
  const [isResolved, setIsResolved] = useState(() => hasCache());

  useEffect(() => {
    let unsubRoles = () => {};
    let unsubAdmin = () => {};
    // Tracks the two independent checks separately so whichever resolves
    // first can be applied immediately, and so a late-arriving founder
    // check can't clobber an already-applied role result with a stale
    // "not admin" write. Both are now live onSnapshot subscriptions
    // (cache-first, near-instant), so neither one artificially lags
    // behind the other the way a one-shot getDoc used to.
    let founderResolved = false;
    let isFounder = false;

    const applyRoles = (roles) => {
      if (founderResolved && isFounder) return; // Founder always wins.
      if (!roles.length) {
        setIsRealAdmin(false);
        setAdminLabel(null);
        writeCache(false, null);
      } else {
        const primary = roles[0];
        const label = ROLE_LABELS[primary.role] || 'Staff';
        setIsRealAdmin(true);
        setAdminLabel(label);
        writeCache(true, label);
      }
      setIsResolved(true);
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubRoles();
      unsubRoles = () => {};
      unsubAdmin();
      unsubAdmin = () => {};
      founderResolved = false;
      isFounder = false;

      if (!user) {
        setIsRealAdmin(false);
        setAdminLabel(null);
        writeCache(false, null);
        setIsResolved(true);
        return;
      }

      // Fire both checks at the same time — they're independent reads.
      unsubAdmin = subscribeIsAdmin(user.uid, (result) => {
        founderResolved = true;
        isFounder = result;
        if (isFounder) {
          setIsRealAdmin(true);
          setAdminLabel('Founder');
          writeCache(true, 'Founder');
          setIsResolved(true);
        }
        // If not founder, whatever subscribeMyRoles already delivered (or
        // will deliver) stands as-is — no need to re-apply here.
      });

      unsubRoles = subscribeMyRoles(applyRoles);
    });

    return () => {
      unsubAuth();
      unsubRoles();
      unsubAdmin();
    };
  }, []);

  return { isRealAdmin, adminLabel, isResolved };
}