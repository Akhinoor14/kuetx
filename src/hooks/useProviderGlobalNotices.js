// useProviderGlobalNotices.js
//
// Phase 5 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): direct clone of
// useFacultyGlobalNotices.js for the provider shell. A provider page
// (ProviderNotifications.jsx) mounts this ONCE to get Admin/Founder →
// Provider broadcasts (audience.type === 'provider_all' | 'provider_uids').
// Wraps subscribeProviderGlobalNotices (groupSync.js), which itself sits
// on top of subscribeGlobalNotices's `_subscribeSingleton` — so even if
// more than one provider page mounts this hook during navigation,
// there's still only one underlying Firestore listener on the root
// `notices` collection.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeProviderGlobalNotices } from '../lib/groupSync';

/**
 * @returns {Array|null} live list of Admin/Founder notices addressed to
 *   this provider account (provider_all or a provider_uids list
 *   containing this uid), already mapped to the same { from, roleTag,
 *   isFounder, section, createdAt } shape the student/faculty-side
 *   global branches produce, with soft-deleted notices filtered out.
 *   null until the first snapshot resolves (or until signed out), so
 *   callers can distinguish "still loading" from "loaded, genuinely
 *   empty".
 */
export function useProviderGlobalNotices() {
  const [notices, setNotices] = useState(null);

  useEffect(() => {
    // Same pattern as useFacultyGlobalNotices.js — auth.currentUser is
    // not reactive state, so onAuthStateChanged is the correct way to
    // react to sign-in/sign-out/account-switch regardless of what gates
    // this hook's mount point.
    let unsubNotices = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubNotices();
      if (!user) { setNotices([]); unsubNotices = () => {}; return; }
      unsubNotices = subscribeProviderGlobalNotices(user.uid, setNotices);
    });
    return () => { unsubAuth(); unsubNotices(); };
  }, []);

  return notices;
}
