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
  collection, collectionGroup, doc, getDocFromServer, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot,
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
        // Out of retries on a permission error: deliver an empty array to
        // any callers waiting RIGHT NOW so the UI doesn't hang forever on
        // "Loading…" — but do NOT cache it as entry.lastValue. Caching it
        // would make every future mount of this same group (a fresh page
        // visit, a route re-entry) instantly replay a stale empty list
        // from the singleton registry without ever attempting a real
        // listener again, permanently hiding classmates that do exist
        // once the underlying race (or connectivity blip) has cleared.
        // Non-permission errors also fall through here, but those are
        // real (not a startup race), so it's still correct not to cache.
        if (entry.lastValue === null) {
          entry.listeners.forEach((cb) => cb([]));
        }
        // Keep retrying in the background at a slower cadence so the
        // listener recovers on its own once the real membership doc
        // write is visible server-side, instead of staying dead until a
        // full page reload clears the registry.
        if (err?.code === 'permission-denied') {
          setTimeout(() => attach(3), 5000);
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
  // Must read from the server, not the local cache. On a brand-new
  // device (right after the initial local->Firestore push) the cache has
  // no entry for this doc at all, so a cache-first getDoc() can report
  // exists():false for a member doc that has genuinely existed on the
  // server since an earlier device/session. That sends this into the
  // setDoc() "create" branch below, which resets role/verified/joinedAt/
  // legacyCRClaim to fresh-join defaults. Firestore's rules engine
  // evaluates this against server truth, so if the doc really does
  // already exist it correctly treats the setDoc as an UPDATE, not a
  // create — and the update rule has no branch permitting a member to
  // reset their own role/verified this way, so the write is rejected
  // with permission-denied on first load. Worse case: if the update rule
  // ever did allow it, this would silently demote/unverify an already-
  // verified member or CR/ACR back to a plain unverified 'member' purely
  // because their new device's cache was empty. getDocFromServer avoids
  // both outcomes by always checking real server state first.
  const existing = await getDocFromServer(ref_);
  if (existing.exists()) {
    // just refresh display fields, never touch verified/role. Also
    // backfills `isAnonymous` for pre-existing docs written before this
    // field existed, so an account that upgrades from anonymous to a
    // real Google/email login gets its member doc corrected the very
    // next time joinGroup() runs for them (App.jsx's auto-join effect
    // already re-runs this on every app open) — no manual fix needed.
    await updateDoc(ref_, {
      name: profile?.name || '',
      roll: profile?.studentId || '',
      isAnonymous: !!auth.currentUser?.isAnonymous,
      // Login email, shown to CL/SCL/admin ONLY as a display field so
      // they can judge if it looks fake (see emailFlags.js) — never used
      // for auth or matched against verifiedRolls. Anonymous accounts
      // have no email; leave it unset rather than writing an empty
      // string so the UI can distinguish "no account email" from "empty".
      ...(auth.currentUser?.email ? { accountEmail: auth.currentUser.email } : {}),
    });
  } else {
    await setDoc(ref_, {
      name: profile?.name || '',
      roll: profile?.studentId || '',
      // Tier 1: a confirmed @stud.kuet.ac.bd email whose embedded roll
      // matches this exact batch+dept auto-verifies instantly — no CL
      // approval needed. Everyone else starts at Tier 2 (manual, false).
      verified: await emailMatchesGroup(profile),
      role: 'member',
      // Recorded for display filtering (ClassmatesList hides anonymous
      // entries). The Firestore create rule already blocks anonymous
      // sessions from writing this doc at all now (isRealAccount()), so
      // in practice this will only ever be false for anything created
      // going forward — kept here mainly so the field always exists and
      // an old pre-existing doc gets backfilled to false the moment its
      // owner logs in for real (see the update branch above).
      isAnonymous: !!auth.currentUser?.isAnonymous,
      joinedAt: serverTimestamp(),
      legacyCRClaim: !!profile?.isCR,
      ...(auth.currentUser?.email ? { accountEmail: auth.currentUser.email } : {}),
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

/**
 * Confirms the CURRENT user's own members/{uid} doc is actually readable
 * (not just that joinGroup()'s write promise resolved — on a slow/offline-
 * queued connection that promise can resolve before the write is visible
 * server-side, so a listener started right after still hits a transient
 * permission-denied). Callers that gate mounting a members-list subscriber
 * on this (e.g. Classmates.jsx's `joined` flag) avoid ever hitting that
 * race in the first place, instead of relying on _subscribeSingleton's
 * retry-after-failure recovery. Gives up after a few short retries so a
 * genuinely stuck join never blocks the page forever.
 */
export async function waitForOwnMembership(groupId, retries = 5, delayMs = 400) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return false;
  for (let i = 0; i < retries; i++) {
    try {
      const snap = await getDocFromServer(doc(db, 'groups', groupId, 'members', uid));
      if (snap.exists()) return true;
    } catch (e) {
      // permission-denied while the write is still propagating — retry
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
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
  
  try {
    // Must read from the server, not the local cache: getDoc() is
    // cache-first and on a brand-new device (right after the initial bulk
    // local->Firestore push) the cache can be stale or briefly empty. A
    // stale/missing cache read here makes this silently no-op (or write
    // stale data back), leaving members/{uid}.verified stuck at false even
    // though the account really is verified — which then makes
    // waitForOwnVerification() poll for up to 10*400ms and either time out,
    // or (worse) appear to succeed against a doc that was never actually
    // updated, only to have the real write (e.g. crRequests/{uid}) get
    // rejected server-side by isVerifiedMember(groupId). Every other
    // verification-critical read in this file (waitForOwnMembership,
    // waitForOwnVerification, requestCR's dup-check) already uses
    // getDocFromServer for this same reason — keep this one consistent.
    const snap = await getDocFromServer(ref_);
    if (snap.exists() && snap.data().verified !== true) {
      await updateDoc(ref_, { verified: true });
    }
  } catch (syncErr) {
    // Member doc read failed or update failed — log for diagnostics
    console.warn('[Verification Sync] Failed to sync verification for', groupId, uid, ':', syncErr?.code, syncErr?.message);
    if (syncErr?.code === 'permission-denied') {
      console.warn('[Verification Sync] Permission denied — member doc may not exist yet or roll verification incomplete');
    }
  }
}

/**
 * Wait until this user's own member doc is readable and verified:true.
 * This is used after syncOwnVerification() before writes that Firestore
 * rules gate on isVerifiedMember(groupId), so we don't race the server's
 * view of the newly-updated member doc.
 * 
 * Increased retries for new-device scenarios where initial sync takes longer.
 */
export async function waitForOwnVerification(groupId, retries = 10, delayMs = 400) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return false;
  for (let i = 0; i < retries; i++) {
    try {
      const snap = await getDocFromServer(doc(db, 'groups', groupId, 'members', uid));
      if (snap.exists() && snap.data().verified === true) return true;
    } catch (e) {
      // permission-denied while the verification write is still propagating — retry
      if (i === retries - 1) {
        // Last attempt, log the error for debugging
        console.warn('[Verification Sync] Final verification check failed:', e?.code, e?.message);
      }
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.warn('[Verification Sync] Timed out waiting for verified:true after', retries * delayMs, 'ms');
  return false;
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
  
  const ref_ = doc(db, 'groups', groupId, 'crRequests', uid);
  const requestData = {
    uid,
    name: profile?.name || '',
    roll: profile?.studentId || '',
    status: 'pending',
    requestedAt: serverTimestamp(),
    // IMPORTANT: must be present (even if null), not omitted. The
    // Firestore rule checks `request.resource.data.type != 'leave'` —
    // if `type` is absent from the written map entirely, that
    // comparison evaluates to false (not true), which silently denies
    // the whole `create`. Setting it explicitly to null keeps the key
    // present so the != check actually passes.
    type: null,
  };
  
  let existing;
  try {
    existing = await getDocFromServer(ref_);
  } catch (e) {
    // If read fails (e.g. permission-denied while doc propagating), 
    // assume doc doesn't exist yet and try fresh request
    console.warn('[CR REQUEST] Failed to check existing crRequests doc, treating as fresh request:', e?.code, e?.message);
    existing = { exists: () => false };
  }

  const branch = existing.exists() ? 'update (resubmission)' : 'create (fresh)';
  const existingStatus = existing.exists() ? existing.data()?.status : null;
  console.group('[CR REQUEST WRITE]');
  console.log('groupId:', groupId);
  console.log('uid:', uid);
  console.log('branch:', branch);
  if (existingStatus != null) console.log('existingRequest.status:', existingStatus);
  console.log('requestData:', requestData);
  console.groupEnd();
  
  if (existing.exists()) {
    const status = existing.data()?.status;
    // If pending already, user must wait
    if (status === 'pending') {
      throw new Error('You already have a pending CR request. Wait for your Campus Lead to act on it first.');
    }
    // If rejected/revoked/approved, this is a RESUBMISSION — update back to pending
    // (matches Firestore rule's resubmission path: resource.status != 'pending' && 
    // request.status == 'pending')
    try {
      await updateDoc(ref_, requestData);
    } catch (err) {
      if (err?.code !== 'permission-denied') throw err;
      console.warn('[CR REQUEST] permission-denied while updating request, retrying after sync checks', {
        groupId,
        uid,
        branch,
        requestData,
        existingStatus,
        errorCode: err.code,
        errorMessage: err.message,
      });
      // A brand-new device can still be catching up with the member-doc
      // writes that make isVerifiedMember(groupId) true server-side.
      // Retry once after a fresh server read instead of surfacing a false
      // permanent failure when the rule conditions are already satisfied.
      await waitForOwnVerification(groupId);
      await waitForOwnMembership(groupId);
      await updateDoc(ref_, requestData);
    }
  } else {
    // Fresh request — doc doesn't exist yet
    try {
      await setDoc(ref_, requestData);
    } catch (err) {
      if (err?.code !== 'permission-denied') throw err;
      console.warn('[CR REQUEST] permission-denied while creating request, retrying after sync checks', {
        groupId,
        uid,
        branch,
        requestData,
        errorCode: err.code,
        errorMessage: err.message,
      });
      // Same first-login race as the resubmission path above.
      await waitForOwnVerification(groupId);
      await waitForOwnMembership(groupId);
      await setDoc(ref_, requestData);
    }
  }
}

export function subscribeCRRequests(groupId, callback) {
  if (!groupId) return () => {};
  const key = `crRequests:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'crRequests'), orderBy('requestedAt')),
    // Exclude type === 'leave' docs — those are step-down requests and
    // belong only in the CR Leave Requests tab (subscribeCRLeaveRequests
    // below). Without this filter, a leave_{uid} doc (which also has
    // status: 'pending') leaked into this "fresh CR" queue too, showing
    // the SAME person in both "CR Requests" and "CR Leave Requests" even
    // though they only ever filed one leave request, not a fresh claim.
    (snap) => _snapToArray(snap).filter((r) => r.status === 'pending' && r.type !== 'leave'),
    callback,
  );
}

/**
 * Live status of the CURRENT user's own fresh-claim crRequests/{uid} doc
 * in this group — null if none exists, otherwise the doc's status
 * ('pending' | 'approved' | 'rejected' | 'revoked'). Used to gate the
 * "Claim CR" button: without this, a member with an already-pending
 * request could click Claim CR again and get a confusing "already
 * pending" error instead of the button simply reflecting their real
 * state (e.g. "Request pending — waiting on your Campus Lead").
 */
export function subscribeOwnCRRequestStatus(groupId, uid, callback) {
  if (!groupId || !uid) return () => {};
  const ref_ = doc(db, 'groups', groupId, 'crRequests', uid);
  return onSnapshot(ref_, (snap) => {
    callback(snap.exists() ? snap.data().status : null);
  }, () => callback(null));
}

/**
 * Mirror of Firestore rule: allow crRequests/create
 * Returns { passed: bool, conditions: { check: bool, reason: string }[] }
 */
export async function diagnosticCheckCRRequestsCreate(groupId, profile) {
  return diagnosticCheckCRRequestsWrite(groupId, profile);
}

/**
 * Mirror of Firestore rule: allow crRequests/create or crRequests/update
 * Returns { passed: bool, conditions: { check: bool, reason: string }[] }
 */
export async function diagnosticCheckCRRequestsWrite(groupId, profile) {
  const uid = auth.currentUser?.uid;
  const conditions = [];
  const requestRef = doc(db, 'groups', groupId, 'crRequests', uid);
  const existingRequestSnap = await getDocFromServer(requestRef).catch(() => null);
  const existingStatus = existingRequestSnap?.exists() ? existingRequestSnap.data()?.status : null;
  const isUpdateBranch = existingRequestSnap?.exists() && existingStatus !== 'pending';
  
  // Rule condition 1: isSignedIn()
  const isSignedIn = uid != null;
  conditions.push({
    check: isSignedIn,
    reason: `isSignedIn: ${isSignedIn ? '✓ YES - logged in' : '✗ NO - not logged in!'}`,
  });
  
  // Rule condition 2a: isGroupMember(groupId)
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const memberSnap = await getDocFromServer(memberRef).catch(() => null);
  const isGroupMember = memberSnap?.exists() || false;
  conditions.push({
    check: isGroupMember,
    reason: `isGroupMember: ${isGroupMember ? '✓ YES - member doc exists' : '✗ NO - member doc missing!'}`,
  });
  
  // Rule condition 2b: isVerifiedMember(groupId) — the verified flag
  const isVerified = isGroupMember && memberSnap?.data()?.verified === true;
  const verifiedValue = memberSnap?.data()?.verified;
  const memberData = memberSnap?.data();
  
  let verifiedReason = '';
  if (!isGroupMember) {
    verifiedReason = '✗ NO - member doc missing (can\'t check verified)';
  } else if (verifiedValue === true) {
    verifiedReason = '✓ YES - verified == true';
  } else if (verifiedValue === false) {
    verifiedReason = '✗ NO - verified == false (should be true!)';
  } else if (verifiedValue === undefined || verifiedValue === null) {
    verifiedReason = `✗ NO - verified is ${verifiedValue || 'undefined'} (missing field!)`;
  } else {
    verifiedReason = `✗ NO - verified is ${typeof verifiedValue} ${JSON.stringify(verifiedValue)} (not boolean true!)`;
  }
  
  conditions.push({
    check: isVerified,
    reason: `isVerifiedMember: ${verifiedReason}`,
  });

  conditions.push({
    check: true,
    reason: existingRequestSnap?.exists()
      ? `existingRequest: ✓ YES - current status is ${String(existingStatus)}`
      : 'existingRequest: ✗ NO - no prior request doc found',
  });
  
  // Rule condition 3: request.auth.uid == requestUid (doc id matches uid)
  const uidMatches = true; // always true in our case
  conditions.push({
    check: uidMatches,
    reason: `uid==requestUid: ✓ YES - doc id matches requester`,
  });
  
  if (isUpdateBranch) {
    const updateAllowed = existingStatus !== 'pending';
    conditions.push({
      check: updateAllowed,
      reason: updateAllowed
        ? `update.status gate: ✓ YES - existing status is ${existingStatus}, so resubmission path is allowed`
        : `update.status gate: ✗ NO - existing status is pending, so requestCR should not be taking the update branch`,
    });
  } else {
    // Rule condition 4: request.resource.data.type != 'leave'
    const noLeaveType = true; // we never set type:'leave' in requestCR
    conditions.push({
      check: noLeaveType,
      reason: `type != 'leave': ✓ YES - no type field in fresh request`,
    });
  }
  
  const allPass = conditions.every(c => c.check);
  return { passed: allPass, conditions, memberData, existingStatus, isUpdateBranch };
}

export function logCRRequestDiagnostics(groupId, profile, diagnos) {
  const failedCondition = diagnos.conditions.find(c => !c.check);
  
  const failureReason = failedCondition 
    ? failedCondition.reason 
    : 'All rule conditions passed - write should succeed. If you still see permission-denied, check browser console network tab for exact error.';
  
  console.log('%c━━━ [CR REQUEST FAILED] ━━━', 'color: #ff3333; font-size: 14px; font-weight: bold; background: #ffe6e6; padding: 4px 8px;');
  console.log('%c→ Rule Violation: ' + failureReason, 'color: #ff3333; font-size: 13px; font-weight: bold;');
  console.log('');
  
  const branchLabel = diagnos.isUpdateBranch ? 'update (resubmission)' : 'create (fresh)';
  console.group('[Firestore crRequests/write Rule Analysis]');
  console.log('branch:', branchLabel);
  console.log('groupId:', groupId);
  console.log('uid:', auth.currentUser?.uid);
  if (diagnos.existingStatus != null) {
    console.log('existing request status:', diagnos.existingStatus);
  }
  console.log('');
  diagnos.conditions.forEach((c, i) => {
    console.log(`[${i + 1}] ${c.reason}`);
  });
  console.log('');
  
  if (diagnos.memberData) {
    console.log('Member doc state:');
    console.table(diagnos.memberData);
    console.log('');
  }
  
  console.log('%cResult: ' + (diagnos.passed ? 'PASS ✓ - should succeed' : 'FAIL ✗ - rule rejects'), diagnos.passed ? 'color: #00aa00; font-weight: bold' : 'color: #ff3333; font-weight: bold');
  console.groupEnd();
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
  const [membersSnap, requestsSnap] = await Promise.all([
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
  // Derive the new count from crCount (just computed from the actual
  // members' role fields above), not from crStatusSnap's own stored
  // count. crStatus.count is a denormalized cache that can drift from
  // the real membership data (a missed decrement, a race between two
  // concurrent CL actions, etc.) — basing the new value on crCount+1
  // self-corrects any existing drift on every approval instead of
  // reading a possibly-wrong number and writing an equally-wrong one
  // right back.
  batch.set(crStatusRef, { count: crCount + 1 }, { merge: true });
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
  const [membersSnap, requestsSnap] = await Promise.all([
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(query(collection(db, 'groups', groupId, 'crRequests'), where('status', '==', 'pending'))),
  ]);
  const { cr: crCount } = _countRoles(membersSnap.docs);
  if (crCount >= MAX_CR) {
    throw new Error(`Both CR slots for this class are already full (max ${MAX_CR}).`);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'cr', verified: true });
  // Same cleanup as clApproveCRRequest: a slot just filled outside the
  // queue, so any still-pending "fresh CR" request for this group was
  // queued for a slot that no longer exists. Leave requests (type ===
  // 'leave') are untouched — they're a different person stepping down,
  // unrelated to a slot opening up.
  requestsSnap.docs.forEach((d) => {
    if (d.data().type !== 'leave') batch.update(d.ref, { status: 'rejected' });
  });
  // See clApproveCRRequest for why this is crCount + 1 (self-healing
  // from the real members role count) rather than crStatusSnap's stored
  // count + 1 (perpetuates any existing drift).
  batch.set(crStatusRef, { count: crCount + 1 }, { merge: true });
  await batch.commit();
}

/** Campus Lead action: force-remove a misbehaving CR, freeing their slot. */
export async function clRevokeCR(groupId, targetUid) {
  const batch = writeBatch(db);
  // legacyCRClaim cleared alongside role — see note in clApproveLeaveCR;
  // same "Claims CR" badge bug applies to a CL-forced revoke too.
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member', legacyCRClaim: false });
  batch.set(doc(db, 'groups', groupId, 'meta', 'crStatus'), { count: increment(-1) }, { merge: true });
  // Clean up any crRequests doc left over from when this person originally
  // became CR — Firestore rules forbid deleting crRequests docs (audit
  // trail), so we mark it 'revoked' instead. subscribeCRRequests already
  // filters to status === 'pending', so a leftover 'approved' doc was never
  // itself shown as pending — but this closes the loop cleanly so no doc
  // tied to this uid can ever be mistaken for an active/pending claim.
  const reqRef = doc(db, 'groups', groupId, 'crRequests', targetUid);
  // getDocFromServer, not getDoc: a stale/cached "doesn't exist" read here
  // would skip marking a genuinely-existing request 'revoked', leaving it
  // in an ambiguous state (see the leave-request comment below for the
  // concrete corruption this class of bug causes).
  const reqSnap = await getDocFromServer(reqRef);
  if (reqSnap.exists()) {
    batch.update(reqRef, { status: 'revoked' });
  }
  // Also close out a pending "leave CR" request for this same person, if
  // one exists. Without this, a CL revoking a CR who had ALSO already
  // asked to step down leaves a stale pending leave_{uid} doc behind —
  // it would keep showing up in the leave-requests queue forever, and if
  // anyone later clicked Approve on it, clApproveLeaveCR would run
  // crStatus.count: increment(-1) a SECOND time for a slot that was
  // already freed here, silently corrupting the slot count. Must read
  // from the server (not cache): a stale cache miss on this exact check
  // is what would let that double-decrement slip through.
  const leaveReqRef = doc(db, 'groups', groupId, 'crRequests', `leave_${targetUid}`);
  const leaveReqSnap = await getDocFromServer(leaveReqRef);
  if (leaveReqSnap.exists() && leaveReqSnap.data().status === 'pending') {
    batch.update(leaveReqRef, { status: 'revoked' });
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
  // getDocFromServer, not getDoc: a stale local cache (e.g. the successor
  // was verified moments ago and this device hasn't caught up) can report
  // verified:false or exists():false for someone who genuinely already
  // qualifies, wrongly blocking a legitimate handoff.
  const successorSnap = await getDocFromServer(doc(db, 'groups', groupId, 'members', successorUid));
  if (!successorSnap.exists() || !successorSnap.data().verified) {
    throw new Error('The new CR must already be a verified member of this class.');
  }
  const batch = writeBatch(db);
  // legacyCRClaim cleared alongside role — see note in clApproveLeaveCR;
  // same "Claims CR" badge bug applies to a direct CR-to-CR handoff too.
  batch.update(doc(db, 'groups', groupId, 'members', currentUid), { role: 'member', legacyCRClaim: false });
  batch.update(doc(db, 'groups', groupId, 'members', successorUid), { role: 'cr' });
  // If the departing CR also had a pending "leave CR" request queued
  // (asked to step down, then handed off directly before CL acted on it),
  // close it out here. Otherwise it lingers as pending forever, and if a
  // CL later approves it, clApproveLeaveCR would decrement crStatus.count
  // for a slot that was never actually freed (the successor took it
  // immediately) — silently corrupting the slot count. Must read from the
  // server, not cache, or a stale "no pending request" read lets that
  // exact double-decrement through.
  const leaveReqRef = doc(db, 'groups', groupId, 'crRequests', `leave_${currentUid}`);
  const leaveReqSnap = await getDocFromServer(leaveReqRef);
  if (leaveReqSnap.exists() && leaveReqSnap.data().status === 'pending') {
    batch.update(leaveReqRef, { status: 'revoked' });
  }
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
// KNOWN GAP: MAX_ACR is enforced HERE ONLY (client-side). Unlike CR — which
// firestore.rules now independently checks via crCount(groupId) against the
// real meta/crStatus doc — there is no meta/acrStatus doc for ACR occupancy
// (see the "ACR occupancy isn't part of that rule" note above), so the rules
// engine has nothing to count against and cannot enforce this cap. A
// modified client (or a direct Firestore write) could still set more than
// MAX_ACR members to role:'acr' in one group. Left as client-side-only
// deliberately for now — closing it properly needs a real acrStatus doc
// (mirroring crStatus) plus rule changes, not a quick patch here. ACR has
// no succession/appoint power of its own, so the blast radius of this gap
// is content-editing capacity only, not a privilege escalation.
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
  // Clear legacyCRClaim too, not just role: this field is what
  // ClassmatesList's "Claims CR" badge actually checks (role !== 'cr' &&
  // legacyCRClaim), so leaving it untouched here left the badge stuck on
  // ex-CRs forever even after their role correctly flipped to 'member'.
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member', legacyCRClaim: false });
  batch.set(doc(db, 'groups', groupId, 'meta', 'crStatus'), { count: increment(-1) }, { merge: true });
  batch.update(doc(db, 'groups', groupId, 'crRequests', requestDocId), { status: 'approved' });
  await batch.commit();
}

export async function clRejectLeaveCR(groupId, requestDocId) {
  await updateDoc(doc(db, 'groups', groupId, 'crRequests', requestDocId), { status: 'rejected' });
}

/**
 * Campus Lead action: dismiss a stale "Claims CR" badge without appointing
 * that person CR. Needed because legacyCRClaim is a one-time snapshot of
 * profile.isCR taken when a member doc is first created (see joinGroup) —
 * it does NOT auto-track later leave/revoke/handoff actions unless they go
 * through clRevokeCR / handoffCR / clApproveLeaveCR specifically. Anyone
 * who left CR through some other path (or had legacyCRClaim set from an
 * old profile.isCR toggle unrelated to ever actually holding the role)
 * would otherwise show this badge forever with no way to clear it besides
 * temporarily making them CR just to revoke it again.
 */
export async function clDismissLegacyCRClaim(groupId, targetUid) {
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), { legacyCRClaim: false });
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
// Class Planner (shared across CR/ACR of a group — NOT personal
// bookkeeping). Manual "+1" logs live as one-doc-per-entry in
// plannerLogEntries (same reasoning as routineEntries/assignmentEntries:
// multiple CR/ACR could log at once, so an array-in-one-doc would
// collide). courseTeacherMap + per-course plan targets (plannedTotalClasses,
// perWeekTarget, teachers) live in the single meta/plannerSettings doc,
// same pattern as meta/crStatus.
// ---------------------------------------------------------------------

export const subscribePlannerLogs = (groupId, cb) => subscribeEntries(groupId, 'plannerLogEntries', cb);
export const addPlannerLogEntry = (groupId, profile, data) => addEntry(groupId, 'plannerLogEntries', profile, data);
export const updatePlannerLogEntry = (groupId, entryId, profile, data) => updateEntry(groupId, 'plannerLogEntries', entryId, profile, data);
export const deletePlannerLogEntry = (groupId, entryId, profile) => softDeleteEntry(groupId, 'plannerLogEntries', entryId, profile);
export const restorePlannerLogEntry = (groupId, entryId, profile) => restoreEntry(groupId, 'plannerLogEntries', entryId, profile);

export function subscribePlannerSettings(groupId, callback) {
  if (!groupId) return () => {};
  const key = `plannerSettings:${groupId}`;
  let entry = _registry.get(key);
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null };
    _registry.set(key, entry);
    entry.unsubscribe = onSnapshot(doc(db, 'groups', groupId, 'meta', 'plannerSettings'), (snap) => {
      entry.lastValue = snap.exists() ? snap.data() : {};
      entry.listeners.forEach((cb) => cb(entry.lastValue));
    }, (err) => console.error('[groupSync] plannerSettings listener error:', err));
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

export async function updatePlannerSettings(groupId, profile, data) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await setDoc(doc(db, 'groups', groupId, 'meta', 'plannerSettings'), {
    ...data,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

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
  // Avoid attaching a global notices listener for unsigned/anonymous
  // visitors — many deployments lock down `notices` reads to real
  // accounts, and mounting this listener immediately on every page
  // load floods the console with permission-denied errors for guests.
  // Callers should still call this freely; when no real user exists
  // we return a no-op unsubscribe.
  if (!auth.currentUser || auth.currentUser.isAnonymous) return () => {};
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