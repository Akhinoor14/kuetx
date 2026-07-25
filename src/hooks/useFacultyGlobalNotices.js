// useFacultyGlobalNotices.js
//
// Handoff item 1 (option a): a faculty page mounts this ONCE (not once per
// taught class) to get Admin/Founder → Faculty broadcasts
// (audience.type === 'faculty_all' | 'faculty_uids'). Wraps
// subscribeFacultyGlobalNotices (groupSync.js), which itself sits on top of
// subscribeGlobalNotices's `_subscribeSingleton` — so even if more than one
// faculty page mounts this hook during navigation, there's still only one
// underlying Firestore listener on the root `notices` collection.
//
// Deliberately NOT called from inside subscribeAllNotices's per-groupId
// loop (FacultyDashboard.jsx / FacultyClassDetail.jsx /
// FacultyNoticeBroadcast.jsx each call subscribeAllNotices once per class a
// faculty teaches) — doing that would mean a teacher with N classes gets N
// duplicate listeners and N duplicate emissions of the same Admin notice.

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { subscribeFacultyGlobalNotices } from '../lib/groupSync';

/**
 * @returns {Array} live list of Admin/Founder notices addressed to this
 *   faculty account (faculty_all or a faculty_uids list containing this
 *   uid), already mapped to the same { from, roleTag, isFounder, section,
 *   createdAt } shape the student-side global branch in noticeUtils.js
 *   produces, and with soft-deleted notices filtered out.
 */
export function useFacultyGlobalNotices() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    // Same pattern as useIsFaculty.js — auth.currentUser is not reactive
    // state, so reading it directly in a dep array only re-runs this
    // effect if the OWNING COMPONENT re-renders for some other reason at
    // the exact moment auth changes. In practice RequireFaculty already
    // blocks every faculty page from mounting until auth is resolved, so
    // that gap never bites today — but onAuthStateChanged is the correct,
    // robust way to react to sign-in/sign-out/account-switch regardless
    // of what gates this hook's mount point in the future.
    let unsubNotices = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubNotices();
      if (!user) { setNotices([]); unsubNotices = () => {}; return; }
      unsubNotices = subscribeFacultyGlobalNotices(user.uid, setNotices);
    });
    return () => { unsubAuth(); unsubNotices(); };
  }, []);

  return notices;
}
