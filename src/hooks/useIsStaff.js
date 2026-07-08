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

  useEffect(() => {
    let unsubRoles = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubRoles();
      unsubRoles = () => {};

      if (!user) {
        setIsRealAdmin(false);
        setAdminLabel(null);
        writeCache(false, null);
        return;
      }

      checkIsAdmin(user.uid).then((isFounder) => {
        if (isFounder) {
          setIsRealAdmin(true);
          setAdminLabel('Founder');
          writeCache(true, 'Founder');
          return; // Founder outranks/subsumes any other role label.
        }

        unsubRoles = subscribeMyRoles((roles) => {
          if (!roles.length) {
            setIsRealAdmin(false);
            setAdminLabel(null);
            writeCache(false, null);
            return;
          }
          const primary = roles[0];
          const label = ROLE_LABELS[primary.role] || 'Staff';
          setIsRealAdmin(true);
          setAdminLabel(label);
          writeCache(true, label);
        });
      });
    });

    return () => {
      unsubAuth();
      unsubRoles();
    };
  }, []);

  return { isRealAdmin, adminLabel };
}