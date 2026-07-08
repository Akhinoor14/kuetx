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

export function useIsStaff() {
  const [isRealAdmin, setIsRealAdmin] = useState(false);
  const [adminLabel, setAdminLabel] = useState(null);

  useEffect(() => {
    let unsubRoles = () => {};

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubRoles();
      unsubRoles = () => {};

      if (!user) {
        setIsRealAdmin(false);
        setAdminLabel(null);
        return;
      }

      checkIsAdmin(user.uid).then((isFounder) => {
        if (isFounder) {
          setIsRealAdmin(true);
          setAdminLabel('Founder');
          return; // Founder outranks/subsumes any other role label.
        }

        unsubRoles = subscribeMyRoles((roles) => {
          if (!roles.length) {
            setIsRealAdmin(false);
            setAdminLabel(null);
            return;
          }
          const primary = roles[0];
          setIsRealAdmin(true);
          setAdminLabel(ROLE_LABELS[primary.role] || 'Staff');
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
