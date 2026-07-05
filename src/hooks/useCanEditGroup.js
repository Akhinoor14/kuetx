import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { subscribeMembers, subscribeCRStatus } from '../lib/groupSync';

/**
 * Mirrors firestore.rules' isContentEditor(groupId): CR/ACR/Campus Lead/
 * Admin can always edit; anyone verified can edit only while the group
 * currently has no CR. Rules enforce this for real — this hook only
 * decides whether the UI shows edit controls.
 */
export function useCanEditGroup(groupId) {
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
      ? onSnapshot(doc(db, 'staff', uid, 'roles', `campus_lead_${groupId}`), (snap) => setIsCL(snap.exists()))
      : () => {};
    if (uid) getDoc(doc(db, 'admins', uid)).then((snap) => setIsAdmin(snap.exists())).catch(() => {});

    return () => { unsubMembers(); unsubCR(); unsubCL(); };
  }, [groupId]);

  const canEdit = isAdmin || isCL || myRole === 'cr' || myRole === 'acr' || (!hasCR && verified);
  return { canEdit, myRole, verified, hasCR, isCL, isAdmin };
}
