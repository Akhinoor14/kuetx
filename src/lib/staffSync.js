// staffSync.js
//
// Handles the official KUETx team hierarchy (Manifesto v1.0):
//   Founder (admins/{uid}, unchanged, see adminAuth.js)
//     -> Head of Ops + 9 other Core Team leads (assigned by Founder)
//     -> Senior Campus Lead (one per dept, assigned by Founder/Head of Ops)
//     -> Campus Lead (one per dept+batch, appointed by that dept's SCL —
//        or Founder/Head of Ops directly if SCL is vacant)
//
// Removal authority is intentionally NOT symmetric with appointment
// authority (Manifesto §6, Code of Conduct): Head of Ops removes Campus
// Leads/Contributors; Founder removes Senior Campus Leads/Core Team leads.
// This is a deliberate accountability separation, not an oversight.

import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getIdentityStamp } from './groupUtils';

// ---------------------------------------------------------------------
// My own roles (drives which Staff Panel sections render)
// ---------------------------------------------------------------------

export function subscribeMyRoles(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback([]); return () => {}; }
  return onSnapshot(
    collection(db, 'staff', uid, 'roles'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('[staffSync] roles listener error:', err); callback([]); },
  );
}

export function hasRole(roles, role, scopeMatch) {
  return roles.some((r) => {
    if (r.role !== role) return false;
    if (!scopeMatch) return true;
    if (scopeMatch.type === 'global') return r.scope?.type === 'global';
    if (scopeMatch.type === 'dept') return r.scope?.type === 'dept' && r.scope.dept === scopeMatch.dept;
    if (scopeMatch.type === 'group') return r.scope?.type === 'group' && r.scope.groupId === scopeMatch.groupId;
    return false;
  });
}

// ---------------------------------------------------------------------
// Assigning / removing roles (Founder + Head of Ops + SCL, per the chain)
// ---------------------------------------------------------------------

/**
 * Deterministic doc id so Firestore *rules* can exists()-check an exact,
 * known path (rules can't run "any doc matching a filter" queries — only
 * exact-path get()/exists()). Global roles: one doc per person. Dept/group
 * -scoped roles: one doc per (person, scope) pair.
 */
function roleDocId(role, scope) {
  if (scope?.type === 'dept') return `${role}_${scope.dept}`;
  if (scope?.type === 'group') return `${role}_${scope.groupId}`;
  return role; // global
}

/**
 * Durable audit trail for staff role changes — assignments AND revokes.
 * Unlike the `staff/{uid}/roles/{roleId}` doc (which is deleted outright
 * on revoke, leaving no trace), each entry here is append-only under
 * `staffRoleHistory`, so the Staff & Roles detail popup can show a real
 * timeline (who was assigned what, when, by whom, and when/by whom it
 * was later revoked) instead of only ever reflecting the current state.
 * Fire-and-forget by design: a history-write failure should never block
 * or roll back the actual role assign/revoke it's describing.
 */
async function logRoleHistoryEntry(uid, role, scope, event, actorUid) {
  try {
    await addDoc(collection(db, 'staffRoleHistory'), {
      uid, role, scope: scope || null, event, actorUid: actorUid || null, at: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[staffSync] logRoleHistoryEntry failed:', e);
  }
}

/** Live timeline of role history entries for one person, newest first — feeds the Staff & Roles detail popup. */
export function subscribeStaffRoleHistory(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  return onSnapshot(
    query(collection(db, 'staffRoleHistory'), where('uid', '==', uid), orderBy('at', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.error('[staffSync] role history listener error:', err); callback([]); },
  );
}

/**
 * Assign a role to a target user. Firestore rules are the real
 * enforcement of who's allowed to call this for which role/scope.
 */
export async function assignRole(targetUid, role, scope, reportsTo = null) {
  const uid = auth.currentUser?.uid;
  const id = roleDocId(role, scope);
  await setDoc(doc(db, 'staff', targetUid, 'roles', id), {
    role, scope, reportsTo, assignedBy: uid, assignedAt: serverTimestamp(),
  });
  // Denormalized "is this dept/group covered" markers so rules can check
  // vacancy without a collectionGroup query.
  if (role === 'senior_campus_lead' && scope?.type === 'dept') {
    await setDoc(doc(db, 'depts', scope.dept, 'meta', 'sclStatus'), { uid: targetUid, assignedAt: serverTimestamp() });
  }
  if (role === 'campus_lead' && scope?.type === 'group') {
    await setDoc(doc(db, 'groups', scope.groupId, 'meta', 'clStatus'), { uid: targetUid, assignedAt: serverTimestamp() });
  }
  logRoleHistoryEntry(targetUid, role, scope, 'assigned', uid);
  return id;
}

export async function removeRole(targetUid, role, scope) {
  const actorUid = auth.currentUser?.uid;
  await deleteDoc(doc(db, 'staff', targetUid, 'roles', roleDocId(role, scope)));
  if (role === 'senior_campus_lead' && scope?.type === 'dept') {
    await deleteDoc(doc(db, 'depts', scope.dept, 'meta', 'sclStatus')).catch(() => {});
  }
  if (role === 'campus_lead' && scope?.type === 'group') {
    await deleteDoc(doc(db, 'groups', scope.groupId, 'meta', 'clStatus')).catch(() => {});
  }
  logRoleHistoryEntry(targetUid, role, scope, 'revoked', actorUid);
}

/** One-shot: everyone currently holding a given role (e.g. all Senior Campus Leads, for Head of Ops's view). */
export async function listStaffByRole(role) {
  const snap = await getDocs(query(collectionGroup(db, 'roles'), where('role', '==', role)));
  return snap.docs.map((d) => ({ id: d.id, uid: d.ref.parent.parent.id, ...d.data() }));
}

// Resolves a uid to display info (name/roll/dept/batch/groupId/verified/
// role) by checking that person's membership doc in ANY class group
// (groups/*/members/{uid}) — global staff roles (staff/{uid}/roles/
// {roleId}) store none of this, since role assignment is deliberately
// decoupled from class membership (e.g. a Head of Ops may not even be a
// student). Queries on a `uid` field (written by joinGroup on every
// create/update) rather than documentId() — documentId() in a
// collectionGroup query requires the full document path, which we have
// no way to build from a bare uid without already knowing which group
// they're in; that mismatch was silently failing 100% of lookups (see
// the "odd number of segments" Firestore error) and is why the Staff &
// Roles list only ever showed raw uids instead of names. If the uid
// isn't a member of any group (or the lookup fails), falls back to
// empty fields so the UI can show just the uid instead of breaking.
export async function getStaffDisplayInfo(uid) {
  if (!uid) return { name: '', roll: '', dept: '', groupId: '', verified: false, memberRole: '' };
  try {
    const snap = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)));
    if (!snap.empty) {
      const memberDoc = snap.docs[0];
      const data = memberDoc.data();
      const groupId = memberDoc.ref.parent.parent?.id || '';
      // groupId is BATCH_DEPT (see groupUtils.js's getGroupId) — split it
      // back out so the Staff detail popup can show dept/batch without a
      // second lookup.
      const [batch, dept] = groupId.split('_');
      return {
        name: data.name || '',
        roll: data.roll || '',
        dept: dept || '',
        batch: batch || '',
        groupId,
        verified: !!data.verified,
        memberRole: data.role || 'member',
      };
    }
  } catch (e) {
    console.warn('[staffSync] getStaffDisplayInfo lookup failed:', e);
  }
  return { name: '', roll: '', dept: '', groupId: '', verified: false, memberRole: '' };
}

// Batched version for a list of uids (Staff & Roles view resolves many
// holders at once) — runs the lookups in parallel and returns a
// uid -> {name, roll} map, so callers don't need N sequential renders.
export async function getStaffDisplayInfoBatch(uids) {
  const uniqueUids = [...new Set((uids || []).filter(Boolean))];
  const entries = await Promise.all(uniqueUids.map(async (uid) => [uid, await getStaffDisplayInfo(uid)]));
  return Object.fromEntries(entries);
}

/** One-shot: Campus Lead holders for a single department, scoped through groups. */
export async function listCampusLeadsForDept(dept) {
  const groupsSnap = await getDocs(query(collection(db, 'groups'), where('dept', '==', String(dept || '').trim().toUpperCase())));
  const rows = await Promise.all(groupsSnap.docs.map(async (groupDoc) => {
    const clStatusSnap = await getDoc(doc(db, 'groups', groupDoc.id, 'meta', 'clStatus'));
    if (!clStatusSnap.exists()) return null;
    const clUid = clStatusSnap.data().uid || null;
    const memberSnap = clUid ? await getDoc(doc(db, 'groups', groupDoc.id, 'members', clUid)) : null;
    return {
      groupId: groupDoc.id,
      uid: clUid,
      name: memberSnap?.exists() ? memberSnap.data().name || '' : '',
      roll: memberSnap?.exists() ? memberSnap.data().roll || '' : '',
      ...clStatusSnap.data(),
    };
  }));
  return rows.filter(Boolean);
}

/** Is there currently a Senior Campus Lead for this department? */
export async function checkSCLVacant(dept) {
  const snap = await getDoc(doc(db, 'depts', dept, 'meta', 'sclStatus'));
  return !snap.exists();
}

/** Is there currently a Campus Lead for this exact dept+batch group? */
export async function checkCLVacant(groupId) {
  const snap = await getDoc(doc(db, 'groups', groupId, 'meta', 'clStatus'));
  return !snap.exists();
}

export function subscribeCLStatus(groupId, callback) {
  if (!groupId) return () => {};
  return onSnapshot(doc(db, 'groups', groupId, 'meta', 'clStatus'), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ---------------------------------------------------------------------
// Campus Lead applications
// ---------------------------------------------------------------------
// Routes to the Senior Campus Lead of that department — or straight to
// Head of Ops/Founder if the SCL post is vacant (so one missing SCL never
// freezes an entire department, per the manifesto's universal-fallback rule).

export async function applyForCampusLead(groupId, profile, { bundledCRClaim = false } = {}) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await addDoc(collection(db, 'clApplications'), {
    ...stamp,
    dept: String(profile?.dept || '').trim().toUpperCase(),
    batch: String(profile?.batch || '').trim().toUpperCase(),
    groupId,
    bundledCRClaim,
    status: 'pending',
    appliedAt: serverTimestamp(),
  });
}

export function subscribeCLApplications(dept, callback) {
  return onSnapshot(
    query(collection(db, 'clApplications'), where('dept', '==', dept), where('status', '==', 'pending')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/**
 * Head of Ops / Admin view — every pending CL application system-wide.
 * This is the "escalate up until someone exists" endpoint: if a
 * department's Senior Campus Lead post is vacant, its applications never
 * disappear — they're simply also visible here, one level up.
 */
export function subscribeAllCLApplications(callback) {
  return onSnapshot(
    query(collection(db, 'clApplications'), where('status', '==', 'pending'), orderBy('appliedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/** SCL (or Head of Ops/Founder override) approves — appoints CL, and CR too if bundled. */
export async function approveCLApplication(applicationId) {
  const appSnap = await getDoc(doc(db, 'clApplications', applicationId));
  if (!appSnap.exists()) return;
  const app = appSnap.data();
  const reviewerUid = auth.currentUser?.uid;

  await assignRole(app.uid, 'campus_lead', { type: 'group', groupId: app.groupId }, reviewerUid);
  await updateDoc(doc(db, 'clApplications', applicationId), {
    status: 'approved', reviewedBy: reviewerUid, reviewedAt: serverTimestamp(),
  });

  if (app.bundledCRClaim) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'groups', app.groupId, 'members', app.uid), {
      name: app.name, roll: app.roll, verified: true, role: 'cr', joinedAt: serverTimestamp(),
    }, { merge: true });
    batch.set(doc(db, 'groups', app.groupId, 'meta', 'crStatus'), { count: increment(1) }, { merge: true });
    // Clean up any stale CR request docs left over from previous CR tenure or
    // leave requests. This gives a clean slate: if the user was previously CR
    // (and left, and founder re-appointed them via bundled CL+CR), the old
    // crRequests/{uid} and crRequests/leave_{uid} docs would otherwise linger
    // and block future requestCR() calls. Firestore rules forbid DELETE on
    // crRequests (audit trail), so mark them 'revoked' instead.
    const freshReqRef = doc(db, 'groups', app.groupId, 'crRequests', app.uid);
    const leaveReqRef = doc(db, 'groups', app.groupId, 'crRequests', `leave_${app.uid}`);
    const freshSnap = await getDocFromServer(freshReqRef);
    if (freshSnap.exists()) {
      batch.update(freshReqRef, { status: 'revoked' });
    }
    const leaveSnap = await getDocFromServer(leaveReqRef);
    if (leaveSnap.exists()) {
      batch.update(leaveReqRef, { status: 'revoked' });
    }
    await batch.commit();
  }
}

export async function rejectCLApplication(applicationId) {
  await updateDoc(doc(db, 'clApplications', applicationId), {
    status: 'rejected', reviewedBy: auth.currentUser?.uid, reviewedAt: serverTimestamp(),
  });
}
