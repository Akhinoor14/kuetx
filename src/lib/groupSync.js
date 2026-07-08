// groupSync.js
//
// Everything related to the "class community" feature lives here:
//   - group membership (join / verify / promote-CR / revoke)
//   - shared routine + assignment entries (one Firestore doc PER ENTRY,
//     never one big array-in-a-doc — see note below)
//   - shared resource pool (notes/links/files)
//   - group-level (CR) notices
//   - soft-delete + audit log for every mutation
//
// IMPORTANT DATA-MODEL NOTE
// -------------------------
// Personal data in this app (firebaseSync.js) stores whole arrays in one
// doc because only ONE person ever writes to it. Group data has MANY
// writers, so an array-in-one-doc would let two people editing at the
// same moment silently overwrite each other's entries (last write wins,
// per document). To avoid that, every routine/assignment entry is its
// own Firestore document inside a subcollection. Two people adding two
// different entries at the same time never collide.
//
// All listener functions below are singletons with a ref-count, so
// mounting the same group data in multiple pages (Schedule, Assignments,
// ClassManagement, Classmates teaser) never creates duplicate listeners.

import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, writeBatch, increment, limit as fsLimit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getIdentityStamp } from './groupUtils';
import { emailMatchesGroup } from './kuetEmailVerify';

// ---------------------------------------------------------------------
// Singleton listener registry
// ---------------------------------------------------------------------
// key -> { unsubscribe, refCount, listeners:Set<callback>, lastValue }
const _registry = new Map();

function _subscribeSingleton(key, buildQueryFn, mapDocsFn, callback) {
  let entry = _registry.get(key);
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null };
    _registry.set(key, entry);
    const attach = (retriesLeft) => {
      entry.unsubscribe = onSnapshot(buildQueryFn(), (snap) => {
        entry.lastValue = mapDocsFn(snap);
        entry.listeners.forEach((cb) => cb(entry.lastValue));
      }, (err) => {
        console.error(`[groupSync] listener error for ${key}:`, err);
        // permission-denied here almost always means our own membership
        // doc write (joinGroup) hadn't landed yet when this query's rules
        // were evaluated — a startup race, not a real access problem.
        // Retry a couple of times with backoff instead of leaving callers
        // stuck on `null` (= infinite "Loading…") forever.
        if (err?.code === 'permission-denied' && retriesLeft > 0) {
          setTimeout(() => attach(retriesLeft - 1), 1200);
          return;
        }
        // Out of retries (or a non-permission error): stop showing an
        // infinite loading state — deliver an empty array so the UI can
        // render its normal "no one yet" / empty state instead of hanging.
        if (entry.lastValue === null) {
          entry.lastValue = [];
          entry.listeners.forEach((cb) => cb(entry.lastValue));
        }
      });
    };
    attach(3);
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue); // deliver cached value immediately

  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.unsubscribe?.();
      _registry.delete(key);
    }
  };
}

const _snapToArray = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ---------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------

/** Self-join a group. Never downgrades an already-verified member. */
export async function joinGroup(groupId, profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  const ref_ = doc(db, 'groups', groupId, 'members', uid);
  const existing = await getDoc(ref_);
  if (existing.exists()) {
    // just refresh display fields, never touch verified/role
    await updateDoc(ref_, { name: profile?.name || '', roll: profile?.studentId || '' });
  } else {
    await setDoc(ref_, {
      name: profile?.name || '',
      roll: profile?.studentId || '',
      // Tier 1: a confirmed @stud.kuet.ac.bd email whose embedded roll
      // matches this exact batch+dept auto-verifies instantly — no CL
      // approval needed. Everyone else starts at Tier 2 (manual, false).
      verified: await emailMatchesGroup(profile),
      role: 'member',
      joinedAt: serverTimestamp(),
      legacyCRClaim: !!profile?.isCR,
    });
  }
  // Lightweight denormalized summary doc at groups/{groupId} itself, so
  // the Admin Dashboard can list all groups without needing a separate
  // index collection. Contains no sensitive data — just labels + a
  // "last activity" timestamp.
  await setDoc(doc(db, 'groups', groupId), {
    batch: profile?.batch ? String(profile.batch).trim().toUpperCase() : '',
    dept: profile?.dept ? String(profile.dept).trim().toUpperCase() : '',
    lastActivityAt: serverTimestamp(),
  }, { merge: true });
}

/** Admin-only: list every group summary doc (batch/dept/lastActivityAt). */
export async function listAllGroups() {
  const snap = await getDocs(collection(db, 'groups'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Admin-only: member list for a specific group, one-shot (not realtime). */
export async function getGroupMembersOnce(groupId) {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeMembers(groupId, callback) {
  if (!groupId) return () => {};
  const key = `members:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'members'), orderBy('roll')),
    _snapToArray,
    callback,
  );
}

/** CL/admin: verify or unverify a member's self-typed identity claim. */
export async function verifyMember(groupId, memberUid) {
  await updateDoc(doc(db, 'groups', groupId, 'members', memberUid), { verified: true });
}
export async function revokeVerification(groupId, memberUid) {
  await updateDoc(doc(db, 'groups', groupId, 'members', memberUid), { verified: false });
}

/**
 * CR/ACR/CL/Admin: remove a member from the group entirely (deletes their
 * members/{uid} doc, as opposed to verifyMember/revokeVerification which
 * only flip a flag). Deliberately asymmetric like every other authority
 * check in this file — a CR/ACR can remove a plain member, but can NOT
 * remove another CR/ACR this way (that must go through clRevokeCR/CL
 * escalation instead) and can't remove themself. Firestore rules enforce
 * this same restriction server-side (see members/{memberUid} allow delete
 * in firestore.rules) — this client guard just avoids a wasted round trip,
 * never treat it as the actual security boundary.
 */
export async function removeMember(groupId, targetUid) {
  await deleteDoc(doc(db, 'groups', groupId, 'members', targetUid));
}

/**
 * Self-service: after Tier-1 KUET email verification succeeds, flip THIS
 * user's own membership doc (if one already exists) to verified: true.
 *
 * Why this is needed: joinGroup() only sets `verified` at doc-CREATION
 * time. If someone joins their class group (Classmates page) BEFORE
 * completing email verification, their member doc is created with
 * verified: false — and nothing ever revisits it afterward, since
 * joinGroup()'s "already exists" branch deliberately never touches
 * verified/role (that's what stops a CL demotion from being silently
 * undone by a routine re-join). Without this, a student who verifies
 * their KUET email AFTER joining stays stuck on "Pending" forever,
 * even though verifiedRolls/{roll} now correctly exists.
 * Call this right after the 'kuetx:kuet-email-verified' event fires.
 */
export async function syncOwnVerification(groupId, uid) {
  if (!groupId || !uid) return;
  const ref_ = doc(db, 'groups', groupId, 'members', uid);
  const snap = await getDoc(ref_);
  if (snap.exists() && snap.data().verified !== true) {
    await updateDoc(ref_, { verified: true });
  }
}

// ---------------------------------------------------------------------
// CR lifecycle
// ---------------------------------------------------------------------
// CR is NOT an official KUETx post — it's a per-class student feature.
// Each class (batch+dept group) has two "sections" in practice, so this
// system supports up to MAX_CR (2) simultaneous CR and MAX_ACR (2)
// simultaneous ACR per group. There is no hard-coded "Section A / Section
// B" label anywhere — CR/ACR are just independent slots, and which real
// class-section a given CR actually covers is something they sort out
// among themselves, not something this app tracks.
//
// Three distinct ways a slot changes hands, each with different authority:
//   1. Fresh student -> CR, when NOT replacing a specific person: always
//      goes through a request (requestCR) that only the group's Campus
//      Lead (or SCL/HeadOfOps/Admin fallback) can approve
//      (clApproveCRRequest). Never automatic, never CR-approved.
//   2. Existing CR -> hands their OWN slot to a specific successor
//      (handoffCR): no CL approval needed, by design (easy same-tier
//      handoff) — the departing CR chooses their own replacement, and
//      that replacement takes the exact slot vacated (not a new one).
//   3. Existing CR -> appoints someone into an ACR slot (assignACR): no
//      CL approval needed. CR and ACR are peer content-editing roles,
//      the difference is only that ACR carries no succession/appoint
//      power at all — an ACR can never appoint or hand off anything.
//
// The group's `meta/crStatus.count` is the CR-slot occupancy (0-2) that
// Firestore rules check for the "no CR yet -> any verified member may
// edit" fallback window (see isContentEditor). ACR occupancy isn't part
// of that rule (isGroupACR is checked directly), so it's only tracked
// client-side here for the "slots full" UI gate.

export const MAX_CR = 2;
export const MAX_ACR = 2;

/** Count current CR / ACR holders from a members snapshot's docs. */
function _countRoles(memberDocs) {
  let cr = 0, acr = 0;
  memberDocs.forEach((d) => {
    const role = d.data().role;
    if (role === 'cr') cr += 1;
    else if (role === 'acr') acr += 1;
  });
  return { cr, acr };
}

/**
 * Student self-service: ask this group's Campus Lead to become CR.
 * Always allowed to submit even when both CR slots are currently full —
 * the request just queues. Multiple pending requests can coexist; the
 * moment a CL approves one and a slot fills up, every other still-pending
 * request for this group is auto-rejected in the same batch (see
 * clApproveCRRequest) since the reason they were requesting (an open
 * slot) no longer exists once CL has made a choice.
 */
export async function requestCR(groupId, profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  await setDoc(doc(db, 'groups', groupId, 'crRequests', uid), {
    name: profile?.name || '', roll: profile?.studentId || '',
    status: 'pending', requestedAt: serverTimestamp(),
  });
}

export function subscribeCRRequests(groupId, callback) {
  if (!groupId) return () => {};
  const key = `crRequests:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'crRequests'), orderBy('requestedAt')),
    (snap) => _snapToArray(snap).filter((r) => r.status === 'pending'),
    callback,
  );
}

/**
 * Campus Lead action: approve a pending CR request into an open CR slot.
 * Throws if both CR slots are already occupied — CL must clRevokeCR (or
 * wait for a handoff/leave) to free a slot first, this never bumps an
 * existing CR out. On success, every OTHER still-pending request for this
 * group is auto-rejected in the same batch, since they were queued for
 * "the next open slot" and that slot is now gone.
 */
export async function clApproveCRRequest(groupId, targetUid) {
  const crStatusRef = doc(db, 'groups', groupId, 'meta', 'crStatus');
  const [crStatusSnap, membersSnap, requestsSnap] = await Promise.all([
    getDoc(crStatusRef),
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(query(collection(db, 'groups', groupId, 'crRequests'), where('status', '==', 'pending'))),
  ]);
  const { cr: crCount } = _countRoles(membersSnap.docs);
  if (crCount >= MAX_CR) {
    throw new Error(`Both CR slots for this class are already full (max ${MAX_CR}).`);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'cr', verified: true });
  batch.update(doc(db, 'groups', groupId, 'crRequests', targetUid), { status: 'approved' });
  // Auto-reject every other pending request for this group — the slot
  // they were queued for has just been taken.
  requestsSnap.docs.forEach((d) => {
    if (d.id !== targetUid) batch.update(d.ref, { status: 'rejected' });
  });
  const newCount = (crStatusSnap.exists() ? (crStatusSnap.data().count || 0) : 0) + 1;
  batch.set(crStatusRef, { count: newCount }, { merge: true });
  await batch.commit();
}

export async function clRejectCRRequest(groupId, targetUid) {
  await updateDoc(doc(db, 'groups', groupId, 'crRequests', targetUid), { status: 'rejected' });
}

/**
 * Campus Lead action: appoint a CR directly into an open slot (roster
 * view) without requiring a prior student-submitted request. Throws if
 * both CR slots are already full.
 */
export async function clAppointCR(groupId, targetUid) {
  const crStatusRef = doc(db, 'groups', groupId, 'meta', 'crStatus');
  const [crStatusSnap, membersSnap] = await Promise.all([
    getDoc(crStatusRef),
    getDocs(collection(db, 'groups', groupId, 'members')),
  ]);
  const { cr: crCount } = _countRoles(membersSnap.docs);
  if (crCount >= MAX_CR) {
    throw new Error(`Both CR slots for this class are already full (max ${MAX_CR}).`);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'cr', verified: true });
  const newCount = (crStatusSnap.exists() ? (crStatusSnap.data().count || 0) : 0) + 1;
  batch.set(crStatusRef, { count: newCount }, { merge: true });
  await batch.commit();
}

/** Campus Lead action: force-remove a misbehaving CR, freeing their slot. */
export async function clRevokeCR(groupId, targetUid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member' });
  batch.set(doc(db, 'groups', groupId, 'meta', 'crStatus'), { count: increment(-1) }, { merge: true });
  // Clean up any crRequests doc left over from when this person originally
  // became CR — Firestore rules forbid deleting crRequests docs (audit
  // trail), so we mark it 'revoked' instead. subscribeCRRequests already
  // filters to status === 'pending', so a leftover 'approved' doc was never
  // itself shown as pending — but this closes the loop cleanly so no doc
  // tied to this uid can ever be mistaken for an active/pending claim.
  const reqRef = doc(db, 'groups', groupId, 'crRequests', targetUid);
  const reqSnap = await getDoc(reqRef);
  if (reqSnap.exists()) {
    batch.update(reqRef, { status: 'revoked' });
  }
  await batch.commit();
}

/**
 * CR-initiated succession — no CL approval needed by design (easy
 * handoff). The successor MUST already be a verified member of this
 * exact group, and may already hold an ACR slot (an ACR being promoted
 * to CR by the outgoing CR is allowed). This replaces the CURRENT CR
 * (currentUid) specifically with the successor — it does NOT touch the
 * other CR slot or any ACR slots besides the successor's own (if they
 * held one, it's freed since they're moving into the CR slot instead).
 * Net crStatus.count stays the same (one CR replaced by another in the
 * same slot), and the CL is passively notified, not asked.
 */
export async function handoffCR(groupId, currentUid, successorUid, currentProfile) {
  const successorSnap = await getDoc(doc(db, 'groups', groupId, 'members', successorUid));
  if (!successorSnap.exists() || !successorSnap.data().verified) {
    throw new Error('The new CR must already be a verified member of this class.');
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', currentUid), { role: 'member' });
  batch.update(doc(db, 'groups', groupId, 'members', successorUid), { role: 'cr' });
  await batch.commit();
  // Passive notification to the Campus Lead — not an approval gate.
  await addDoc(collection(db, 'groups', groupId, 'notices'), {
    title: 'CR changed', body: `${currentProfile?.name || 'The CR'} handed CR duties to a new student.`,
    postedBy: { uid: currentUid, name: 'System', roll: '' }, createdAt: serverTimestamp(), system: true,
  });
}

/**
 * CR action: appoint an Assistant CR into an open ACR slot — equal
 * content-editing access, but no succession/appoint power at all. No CL
 * approval needed. Throws if both ACR slots are already full.
 */
export async function assignACR(groupId, targetUid) {
  const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const { acr: acrCount } = _countRoles(membersSnap.docs);
  if (acrCount >= MAX_ACR) {
    throw new Error(`Both ACR slots for this class are already full (max ${MAX_ACR}).`);
  }
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), { role: 'acr' });
}
export async function revokeACR(groupId, targetUid) {
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member' });
}

/**
 * CR "leave without naming a successor" — the CL-approval leave-request
 * flow. Reuses the same crRequests collection/rule as a fresh student's
 * CR claim (type field distinguishes them), since the CL-side surface
 * (subscribeCRRequests, approve/reject) and authority model are otherwise
 * identical: an existing CR asking to step down still needs CL sign-off,
 * exactly like a new student asking to step up.
 */
export async function requestLeaveCR(groupId, profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  await setDoc(doc(db, 'groups', groupId, 'crRequests', `leave_${uid}`), {
    type: 'leave',
    uid,
    name: profile?.name || '', roll: profile?.studentId || '',
    status: 'pending', requestedAt: serverTimestamp(),
  });
}

export function subscribeLeaveRequests(groupId, callback) {
  if (!groupId) return () => {};
  const key = `leaveRequests:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'crRequests'), orderBy('requestedAt')),
    (snap) => _snapToArray(snap).filter((r) => r.status === 'pending' && r.type === 'leave'),
    callback,
  );
}

/** Campus Lead action: approve a CR's own request to step down — frees their slot. */
export async function clApproveLeaveCR(groupId, requestDocId, targetUid) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member' });
  batch.set(doc(db, 'groups', groupId, 'meta', 'crStatus'), { count: increment(-1) }, { merge: true });
  batch.update(doc(db, 'groups', groupId, 'crRequests', requestDocId), { status: 'approved' });
  await batch.commit();
}

export async function clRejectLeaveCR(groupId, requestDocId) {
  await updateDoc(doc(db, 'groups', groupId, 'crRequests', requestDocId), { status: 'rejected' });
}

/** Read-only helper for UI — is there currently an active CR in this group? */
/**
 * Real, server-verified CR/ACR status for the CURRENT user — this reads
 * their own members/{uid}.role field, which only ever becomes 'cr'/'acr'
 * through clApproveCRRequest / clAppointCR / assignACR (Campus Lead or
 * Admin action). This is deliberately separate from profile.isCR, which
 * is just a self-ticked checkbox in Profile Setup with no verification
 * behind it — profile.isCR must never be used to gate access to CR-only
 * pages/tools.
 */
export function subscribeMyRole(groupId, uid, callback) {
  if (!groupId || !uid) { callback('member'); return () => {}; }
  const ref = doc(db, 'groups', groupId, 'members', uid);
  return onSnapshot(ref, (snap) => {
    const role = snap.exists() ? (snap.data().role || 'member') : 'member';
    // TEMP DIAGNOSTIC — remove once the CR-revoke visibility bug is confirmed
    // fixed. Logs every live role update this listener receives, so a revoke
    // can be watched end-to-end (server write -> this callback -> UI).
    console.log('[groupSync] subscribeMyRole update', { groupId, uid, role, at: new Date().toISOString() });
    callback(role);
  }, (err) => {
    console.error('[groupSync] subscribeMyRole error:', err);
    callback('member');
  });
}

export function subscribeCRStatus(groupId, callback) {
  if (!groupId) return () => {};
  const key = `crStatus:${groupId}`;
  let entry = _registry.get(key);
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null };
    _registry.set(key, entry);
    entry.unsubscribe = onSnapshot(doc(db, 'groups', groupId, 'meta', 'crStatus'), (snap) => {
      const count = snap.exists() ? (snap.data().count || 0) : 0;
      entry.lastValue = { hasCR: count > 0, count, slotsFull: count >= MAX_CR };
      entry.listeners.forEach((cb) => cb(entry.lastValue));
    }, (err) => console.error('[groupSync] crStatus listener error:', err));
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue);
  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) { entry.unsubscribe?.(); _registry.delete(key); }
  };
}

// ---------------------------------------------------------------------
// Generic entry CRUD (used by both routineEntries and assignmentEntries)
// ---------------------------------------------------------------------

async function _writeAuditLog(groupId, action, collectionName, entryId, stamp) {
  try {
    await addDoc(collection(db, 'groups', groupId, 'auditLog'), {
      action, collection: collectionName, entryId, by: stamp, at: serverTimestamp(),
    });
  } catch (e) {
    // audit logging must never block the actual write from succeeding
    console.warn('[groupSync] audit log write failed:', e);
  }
}

function subscribeEntries(groupId, collectionName, callback) {
  if (!groupId) return () => {};
  const key = `${collectionName}:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, collectionName), orderBy('updatedAt', 'desc')),
    (snap) => _snapToArray(snap).filter((e) => !e.deleted),
    callback,
  );
}

async function addEntry(groupId, collectionName, profile, data) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref_ = await addDoc(collection(db, 'groups', groupId, collectionName), {
    ...data,
    deleted: false,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  await _writeAuditLog(groupId, 'create', collectionName, ref_.id, stamp);
  return ref_.id;
}

async function updateEntry(groupId, collectionName, entryId, profile, data) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await updateDoc(doc(db, 'groups', groupId, collectionName, entryId), {
    ...data,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  await _writeAuditLog(groupId, 'edit', collectionName, entryId, stamp);
}

async function softDeleteEntry(groupId, collectionName, entryId, profile) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await updateDoc(doc(db, 'groups', groupId, collectionName, entryId), {
    deleted: true,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  await _writeAuditLog(groupId, 'delete', collectionName, entryId, stamp);
}

async function restoreEntry(groupId, collectionName, entryId, profile) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await updateDoc(doc(db, 'groups', groupId, collectionName, entryId), {
    deleted: false,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  await _writeAuditLog(groupId, 'restore', collectionName, entryId, stamp);
}

// Routine
export const subscribeRoutine = (groupId, cb) => subscribeEntries(groupId, 'routineEntries', cb);
export const addRoutineEntry = (groupId, profile, data) => addEntry(groupId, 'routineEntries', profile, data);
export const updateRoutineEntry = (groupId, entryId, profile, data) => updateEntry(groupId, 'routineEntries', entryId, profile, data);
export const deleteRoutineEntry = (groupId, entryId, profile) => softDeleteEntry(groupId, 'routineEntries', entryId, profile);
export const restoreRoutineEntry = (groupId, entryId, profile) => restoreEntry(groupId, 'routineEntries', entryId, profile);

// Assignments
export const subscribeAssignments = (groupId, cb) => subscribeEntries(groupId, 'assignmentEntries', cb);
export const addAssignmentEntry = (groupId, profile, data) => addEntry(groupId, 'assignmentEntries', profile, data);
export const updateAssignmentEntry = (groupId, entryId, profile, data) => updateEntry(groupId, 'assignmentEntries', entryId, profile, data);
export const deleteAssignmentEntry = (groupId, entryId, profile) => softDeleteEntry(groupId, 'assignmentEntries', entryId, profile);
export const restoreAssignmentEntry = (groupId, entryId, profile) => restoreEntry(groupId, 'assignmentEntries', entryId, profile);

// ---------------------------------------------------------------------
// Group (CR-level) notices
// ---------------------------------------------------------------------

export function subscribeGroupNotices(groupId, callback) {
  if (!groupId) return () => {};
  const key = `groupNotices:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'notices'), orderBy('createdAt', 'desc'), fsLimit(50)),
    _snapToArray,
    callback,
  );
}

export async function postGroupNotice(groupId, profile, { title, body }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await addDoc(collection(db, 'groups', groupId, 'notices'), {
    title, body, postedBy: stamp, createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------
// Global (admin) notices — flexible audience so batch-wide broadcasts
// don't require a schema migration later.
// audience: { type: 'all' } | { type: 'batch', batch } | { type: 'group', groupId }
// ---------------------------------------------------------------------

export function subscribeGlobalNotices(callback) {
  const key = 'globalNotices';
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'notices'), orderBy('createdAt', 'desc'), fsLimit(50)),
    _snapToArray,
    callback,
  );
}

/** Client-side filter: does this notice apply to this profile/groupId? */
export function noticeAppliesTo(notice, profile, groupId) {
  const a = notice?.audience;
  if (!a) return false;
  if (a.type === 'all') return true;
  if (a.type === 'batch') return !!profile?.batch && a.batch === profile.batch.trim().toUpperCase();
  if (a.type === 'group') return !!groupId && a.groupId === groupId;
  return false;
}

// NOTE: There is deliberately no group-scoped "Resources" feature here.
// KUETx already has a dedicated, R2-backed Question Bank system
// (QuestionBank.jsx, UploadQuestionModal.jsx, useQuestionBankData.js) that
// covers exactly what the manifesto's "Content Lead reviews question
// banks/notes" responsibility refers to. Wiring Content Lead moderation
// into *that* existing system (rather than inventing a second, parallel
// Firebase-Storage-based one) is a follow-up task that needs its own look
// at how uploads currently work there.

// ---------------------------------------------------------------------
// Audit log (read-only view for CR/admin)
// ---------------------------------------------------------------------

export function subscribeAuditLog(groupId, callback) {
  if (!groupId) return () => {};
  const key = `auditLog:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'auditLog'), orderBy('at', 'desc'), fsLimit(100)),
    _snapToArray,
    callback,
  );
}