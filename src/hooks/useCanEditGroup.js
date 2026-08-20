import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { subscribeMembers, subscribeCRStatus } from '../lib/groupSync';

/**
 * Mirrors firestore.rules' isContentEditor(groupId) and isRoutineEditor
 * (groupId). Rules enforce this for real — this hook only decides
 * whether the UI shows edit controls.
 *
 * NOTE (Aug 2026, CR_PERMISSION_AND_ROLL_UPGRADE_PLAN.md §4 Phase B):
 * the two gates diverged — routineEntries/assignmentEntries/
 * teacherProfiles now let ANY verified member write regardless of
 * whether the group currently has a CR (isRoutineEditor), while
 * meta/plannerSettings (course-teacher assignment)/meta/classSetup
 * stayed on the older, narrower CR/ACR/CL/Admin + no-CR-fallback gate
 * (isContentEditor). Pass `scope: 'routine'` (default) for Schedule/
 * Assignments-style UI, or `scope: 'content'` for anything gating
 * plannerSettings/classSetup writes (e.g. "assign a teacher to this
 * course" in Courses.jsx/TermQS.jsx/Attendance.jsx) — using the wrong
 * scope would show/hide edit controls for the wrong set of people
 * relative to what the actual Firestore rule allows.
 */
export function useCanEditGroup(groupId, { scope = 'routine' } = {}) {
  const [myRole, setMyRole] = useState(null);   // 'member'|'cr'|'acr'|null
  const [verified, setVerified] = useState(false);
  const [hasCR, setHasCR] = useState(true);      // fail-safe default: assume locked until we know
  const [isCL, setIsCL] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    const uid = auth.currentUser?.uid;

    const unsubMembers = subscribeMembers(groupId, (members) => {
      const me = members.find((m) => m.id === uid);
      setMyRole(me?.role || null);
      setVerified(!!me?.verified);
    });
    const unsubCR = subscribeCRStatus(groupId, (status) => setHasCR(!!status?.hasCR));
    const unsubCL = uid
      ? onSnapshot(doc(db, 'staff', uid, 'roles', `campus_lead_${groupId}`), (snap) => setIsCL(snap.exists()), (err) => {
          console.error('[useCanEditGroup] campus_lead role listener error:', err);
          setIsCL(false);
        })
      : () => {};
    if (uid) getDoc(doc(db, 'admins', uid)).then((snap) => setIsAdmin(snap.exists())).catch(() => {});

    return () => { unsubMembers(); unsubCR(); unsubCL(); };
  }, [groupId]);

  // isRoutineEditor mirror: CR/ACR no longer special-cased separately
  // from "any verified member" — a CR just IS a verified member, so
  // dropping the hasCR-dependent branch entirely gives the same result
  // as the rules' `isAdmin() || isCLFor() || isVerifiedMember()`.
  const canEditRoutine = isAdmin || isCL || verified;
  // isContentEditor mirror: unchanged from before — CR/ACR always can;
  // anyone verified only while the group currently has no CR.
  const canEditContent = isAdmin || isCL || myRole === 'cr' || myRole === 'acr' || (!hasCR && verified);

  const canEdit = scope === 'content' ? canEditContent : canEditRoutine;
  return { canEdit, myRole, verified, hasCR, isCL, isAdmin };
}
