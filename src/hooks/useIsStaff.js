// useIsStaff.js
//
// Server-verified staff status for the current signed-in user.
// Founder -> admins/{uid} doc (adminAuth.js, unchanged single source of truth).
// Everyone else -> live roles under staff/{uid}/roles (staffSync.js).
// Never derived from any self-reported profile flag — see Sidebar.jsx comment.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
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

export function useIsStaff() {
  const initial = readCache();
  const [isRealAdmin, setIsRealAdmin] = useState(initial.isRealAdmin);
  const [adminLabel, setAdminLabel] = useState(initial.adminLabel);
  // Tracks whether the live Firestore check has actually completed at
  // least once this session — separate from isRealAdmin/adminLabel,
  // which may already hold an optimistic cached value. Route guards
  // (RequireStaff) need this to avoid flashing "denied" before the real
  // check resolves; Sidebar/BottomNav don't need it and can ignore it.
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    let unsubRoles = () => {};
    // Tracks the two independent checks separately so whichever resolves
    // first can be applied immediately, and so a late-arriving founder
    // check can't clobber an already-applied role result with a stale
    // "not admin" write. Previously checkIsAdmin was awaited BEFORE
    // subscribeMyRoles even started, forcing every non-founder user
    // (including CRs) to pay the founder-doc round-trip latency before
    // their own role could resolve — this is what made the sidebar and
    // Founder-hub cards feel slow to appear even for correctly-flagged
    // CRs. Running them in parallel removes that artificial serial hop.
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
      checkIsAdmin(user.uid).then((result) => {
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
    };
  }, []);

  return { isRealAdmin, adminLabel, isResolved };
}