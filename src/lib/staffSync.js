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
import { getIdentityStamp, getGroupId } from './groupUtils';
import { retryableOnSnapshot } from './safeSnapshot';

// ---------------------------------------------------------------------
// My own roles (drives which Staff Panel sections render)
// ---------------------------------------------------------------------

// BUGFIX (excessive live listeners): subscribeMyRoles() is called from 4
// separate places (useIsStaff.js, QuestionBank.jsx, StaffDashboard.jsx,
// useClassRosterState.js) — useIsStaff.js alone means this effectively
// runs on every page via Sidebar/BottomNav. Each call used to open its
// own fresh onSnapshot() on the exact same staff/{uid}/roles collection,
// so up to 4 identical live Firestore connections could be open
// simultaneously for one signed-in user. This small ref-counted registry
// (same pattern as groupSync.js's _subscribeSingleton) means only ONE
// real listener is ever open per uid, shared across every caller.
const _myRolesRegistry = new Map(); // uid -> { unsubscribe, refCount, listeners:Set, lastValue }

export function subscribeMyRoles(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback([]); return () => {}; }

  let entry = _myRolesRegistry.get(uid);
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null };
    _myRolesRegistry.set(uid, entry);
    const attach = (retriesLeft) => {
      entry.unsubscribe = onSnapshot(
        collection(db, 'staff', uid, 'roles'),
        (snap) => {
          entry.lastValue = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          entry.listeners.forEach((cb) => cb(entry.lastValue));
        },
        (err) => {
          // permission-denied right after sign-in is almost always the
          // startup race — this listener runs via useIsStaff on
          // essentially every page, so it's the first thing hit on any
          // fresh load. Retry a few times with backoff before giving up
          // (same pattern as groupSync.js's _subscribeSingleton).
          if (err?.code === 'permission-denied' && retriesLeft > 0) {
            setTimeout(() => attach(retriesLeft - 1), 1200);
            return;
          }
          console.error('[staffSync] roles listener error:', err);
          entry.listeners.forEach((cb) => cb([]));
        },
      );
    };
    attach(3);
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue);

  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.unsubscribe?.();
      _myRolesRegistry.delete(uid);
    }
  };
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
  // BUGFIX (Campus Lead chip silently missing): previously this let a
  // 'group'-scoped role (campus_lead) or 'dept'-scoped role
  // (senior_campus_lead) through with an empty groupId/dept — e.g. a
  // caller that skipped picking a class before submitting. That wrote a
  // role doc id like `campus_lead_` (empty suffix) with
  // scope.groupId === '', which no downstream reader could recover a
  // real groupId from — StaffDashboard.jsx's tab/chip logic silently
  // dropped the role instead of erroring, so the person kept a
  // functionally broken grant with no obvious sign anything was wrong.
  // Failing fast here means a bad assignment surfaces immediately to
  // whoever is granting the role, instead of shipping a corrupt doc
  // that only shows up later as a missing UI element.
  if (role === 'campus_lead' && !scope?.groupId) {
    throw new Error('assignRole: campus_lead requires scope.groupId (a class/batch must be selected).');
  }
  if (role === 'senior_campus_lead' && !scope?.dept) {
    throw new Error('assignRole: senior_campus_lead requires scope.dept.');
  }

  // NOTE: there is deliberately no "is this person verified" gate here.
  // CL/SCL are the FIRST appointments in a class — there's no CR to have
  // verified them yet (CL/SCL are themselves the ones who approve CR
  // applications), so requiring group-membership verification here would
  // make a brand-new class impossible to staff. The caller (AdminDashboard/
  // StaffDashboard) is expected to resolve the target's groupId/dept from
  // their own signup profile via getStaffDisplayInfo() — every student has
  // dept/batch/roll from signup — and pass a complete `scope`. A Founder
  // or SCL choosing to make this assignment IS the verification.

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

  // Being given ANY staff role/position — not just CL/SCL — is itself a
  // form of verification: a Founder/SCL/Head of Ops choosing to appoint
  // this uid to a real post is a stronger signal than the usual
  // roll-number self-report. So if the target happens to be a student
  // (i.e. they have their own dept/batch/roll from signup, whether or
  // not they've ever joined that class's group), mark them verified in
  // their own class group as a courtesy side-effect — best-effort, never
  // blocks the role assignment above if it fails or if they're not a
  // student at all (e.g. a non-student Head of Ops has nothing to verify
  // here, which is fine).
  ensureOwnClassVerifiedOnRoleAssign(targetUid).catch((e) => {
    console.warn('[staffSync] ensureOwnClassVerifiedOnRoleAssign failed (non-fatal):', e);
  });

  return id;
}

/**
 * Best-effort side-effect of assignRole(): if targetUid is a registered
 * student (has dept/batch/roll from signup), ensure their groups/
 * {groupId}/members/{uid} doc exists and is verified:true. Being handed
 * any staff role is treated as sufficient verification — mirrors the
 * existing "CL-vacant bootstrap merge" precedent in approveCLApplication,
 * generalized to every role instead of just campus_lead. Never throws —
 * callers fire-and-forget this so a lookup failure never blocks the
 * actual role assignment, which is the part that matters.
 */
async function ensureOwnClassVerifiedOnRoleAssign(targetUid) {
  const profile = await getDoc(doc(db, 'students', targetUid));
  if (!profile.exists()) return;
  const value = profile.data() || {};
  const groupId = getGroupId(value);
  if (!groupId) return;
  const memberRef = doc(db, 'groups', groupId, 'members', targetUid);
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    if (existing.data()?.verified === true) return; // already verified, nothing to do
    await setDoc(memberRef, { verified: true }, { merge: true });
    return;
  }
  await setDoc(memberRef, {
    name: value.name || '',
    roll: value.studentId || '',
    uid: targetUid,
    verified: true,
    role: 'member',
    isAnonymous: false,
    joinedAt: serverTimestamp(),
    legacyCRClaim: false,
  });
}

/**
 * Repairs a legacy role doc whose scope is missing groupId/dept (see
 * removeRole's guard above for how these got created). Deletes the old
 * malformed doc and re-writes it under the correct roleDocId with a
 * complete scope, going through the same assignRole() path (and its
 * validation) as a normal assignment — so the mirror docs (clStatus/
 * sclStatus) and role history also get written correctly this time.
 */
export async function repairRoleScope(targetUid, role, oldScope, fixedScope) {
  const oldId = roleDocId(role, oldScope);
  // oldId may already be malformed (e.g. "campus_lead_") but deleteDoc on
  // a non-existent/odd-segment-count-safe path is fine here since oldId
  // always has the fixed 4-segment staff/{uid}/roles/{id} shape — only
  // the *mirror* paths (groups/{groupId}/meta/clStatus) break on empty
  // scope fields, not this one.
  await deleteDoc(doc(db, 'staff', targetUid, 'roles', oldId));
  return assignRole(targetUid, role, fixedScope);
}

export async function removeRole(targetUid, role, scope) {
  const actorUid = auth.currentUser?.uid;

  // BUGFIX (Uncaught FirebaseError: Invalid document reference — "groups/
  // meta/clStatus" has 3 segments): legacy role docs written before the
  // assignRole() guard above existed can have scope.groupId / scope.dept
  // missing or empty (e.g. an old campus_lead grant with scope = { type:
  // 'group', groupId: '' }). doc(db, 'groups', scope.groupId, 'meta',
  // 'clStatus') then collapses from 4 path segments to 3 when groupId is
  // falsy, and Firestore throws synchronously instead of rejecting the
  // promise — which is why this used to surface as an uncaught error in
  // the console with no user-facing feedback. Guarding each mirror-write
  // (and the main role-doc delete, which also goes through roleDocId())
  // means a corrupt legacy doc can still be revoked from the Founder UI
  // instead of crashing the click handler.
  const mainId = roleDocId(role, scope);
  if (mainId && !mainId.endsWith('_')) {
    await deleteDoc(doc(db, 'staff', targetUid, 'roles', mainId));
  } else {
    console.warn('[staffSync] removeRole: skipping malformed role doc id for corrupt scope', { targetUid, role, scope });
  }

  if (role === 'senior_campus_lead' && scope?.type === 'dept') {
    if (scope.dept) {
      await deleteDoc(doc(db, 'depts', scope.dept, 'meta', 'sclStatus')).catch(() => {});
    } else {
      console.warn('[staffSync] removeRole: skipping sclStatus mirror delete — scope.dept missing (corrupt legacy doc)', { targetUid, scope });
    }
  }
  if (role === 'campus_lead' && scope?.type === 'group') {
    if (scope.groupId) {
      await deleteDoc(doc(db, 'groups', scope.groupId, 'meta', 'clStatus')).catch(() => {});
    } else {
      console.warn('[staffSync] removeRole: skipping clStatus mirror delete — scope.groupId missing (corrupt legacy doc)', { targetUid, scope });
    }
  }
  logRoleHistoryEntry(targetUid, role, scope, 'revoked', actorUid);
}

/** One-shot: everyone currently holding a given role (e.g. all Senior Campus Leads, for Head of Ops's view). */
export async function listStaffByRole(role) {
  const snap = await getDocs(query(collectionGroup(db, 'roles'), where('role', '==', role)));
  return snap.docs.map((d) => ({ id: d.id, uid: d.ref.parent.parent.id, ...d.data() }));
}

// Resolves a uid to display info (name/roll/dept/batch/groupId/role) for
// the Staff & Roles UI.
//
// BUGFIX (CL/SCL couldn't be assigned to anyone -> "unverified" dead end):
// this used to require a groups/{groupId}/members/{uid}.verified doc
// before a name/groupId could be resolved for someone. But CL/SCL are
// the FIRST appointments made in a class — nobody has verified them as a
// CR yet (CL/SCL are the ones who approve CR applications in the first
// place), so that check could never be satisfied for a brand-new class.
// Every student already has dept/batch/roll on their own profile from
// signup (students/{uid}) — that's enough to derive their groupId via
// getGroupId(), same formula groupSync.js uses everywhere else. A
// Founder/SCL choosing to assign someone a role IS the verification;
// there's no separate gate to check. `groups/*/members` is still tried
// first since it's slightly more likely to be fresh for someone already
// active in a class, but the profile is now the reliable source of
// truth, not a fallback of last resort.
export async function getStaffDisplayInfo(uid) {
  if (!uid) return { name: '', roll: '', dept: '', groupId: '', memberRole: '' };
  try {
    const snap = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)));
    if (!snap.empty) {
      const memberDoc = snap.docs[0];
      const data = memberDoc.data();
      const groupId = memberDoc.ref.parent.parent?.id || '';
      const [batch, dept] = groupId.split('_');
      return {
        name: data.name || '',
        roll: data.roll || '',
        dept: dept || '',
        batch: batch || '',
        groupId,
        memberRole: data.role || 'member',
      };
    }
  } catch (e) {
    console.warn('[staffSync] getStaffDisplayInfo lookup failed:', e);
  }
  // Fallback: no group-membership doc found (or the query itself failed) —
  // try the person's own synced profile instead of giving up on a name.
  //
  // Phase 6: profile lives at the FLAT collection students/{uid} — uid
  // alone locates the doc directly, no collectionGroup query needed (see
  // firebaseSync.js's header comment on pushProfile/pullProfile for why
  // the old nested students/{dept}/{batch}/{uid} layout was replaced —
  // it made every collectionGroup('students') query 403 because the
  // real collection name was the batch, e.g. "2K23", never "students").
  try {
    const snap = await getDoc(doc(db, 'students', uid));
    if (snap.exists()) {
      const value = snap.data() || {};
      return {
        name: value.name || '',
        roll: value.studentId || '',
        dept: value.dept || '',
        batch: value.batch || '',
        groupId: getGroupId(value) || '',
        memberRole: '',
      };
    }
  } catch (e) {
    console.warn('[staffSync] getStaffDisplayInfo profile fallback failed:', e);
  }
  // Legacy fallback: accounts that synced a profile before this migration
  // and haven't re-saved it since (so no students/{dept}/{batch}/{uid} doc
  // exists for them yet) may still have the old flat doc sitting here —
  // see the matching note kept in firestore.rules' users/{uid}/data/{key}
  // block for why this path is intentionally still readable.
  try {
    const profileSnap = await getDoc(doc(db, 'users', uid, 'data', 'profile'));
    if (profileSnap.exists()) {
      const value = profileSnap.data()?.value || {};
      return {
        name: value.name || '',
        roll: value.studentId || '',
        dept: value.dept || '',
        batch: value.batch || '',
        groupId: getGroupId(value) || '',
        memberRole: '',
      };
    }
  } catch (e) {
    console.warn('[staffSync] getStaffDisplayInfo legacy profile fallback failed:', e);
  }
  return { name: '', roll: '', dept: '', groupId: '', memberRole: '' };
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
  return retryableOnSnapshot(doc(db, 'groups', groupId, 'meta', 'clStatus'), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.error('[staffSync] subscribeCLStatus error:', err);
    callback(null);
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
  return retryableOnSnapshot(
    query(collection(db, 'clApplications'), where('dept', '==', dept), where('status', '==', 'pending')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[staffSync] subscribeCLApplications error:', err);
      callback([]);
    },
  );
}

/**
 * Head of Ops / Admin view — every pending CL application system-wide.
 * This is the "escalate up until someone exists" endpoint: if a
 * department's Senior Campus Lead post is vacant, its applications never
 * disappear — they're simply also visible here, one level up.
 */
export function subscribeAllCLApplications(callback) {
  return retryableOnSnapshot(
    query(collection(db, 'clApplications'), where('status', '==', 'pending'), orderBy('appliedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[staffSync] subscribeAllCLApplications error:', err);
      callback([]);
    },
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
