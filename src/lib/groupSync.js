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
  collection, collectionGroup, doc, getDoc, getDocFromServer, getDocs, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, writeBatch, increment, limit as fsLimit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getIdentityStamp, getGroupId } from './groupUtils';
import { checkIsAdmin } from './adminAuth';

/**
 * One-shot check: is the current user privileged to skip the CR/ACR
 * approval queue for THIS SPECIFIC groupId — i.e. is it their own class?
 * Mirrors firestore.rules' privileged self-join branch (members/
 * {memberUid} create + joinRequests/{requestUid} create) exactly:
 *   - Founder (isAdmin()): only when groupId is the class matching their
 *     OWN dept+batch (getGroupId(profile) — same as ownGroupId() in
 *     rules). A Founder has a personal class just like any other
 *     student; this was never meant to mean "skip approval anywhere."
 *   - Senior Campus Lead: only for their own dept's classes.
 *   - Campus Lead: only for their own specific class.
 * Deliberately excludes Head of Ops: that role has no class-specific
 * scope at all, so including it here would mean "skip approval in every
 * class," not "skip approval in my own class" — not what this feature
 * is for (Head of Ops can still act as a normal reviewer via the
 * CR-approval path, same as any staff role with read/approve rights).
 * Deliberately excludes CR/ACR: those roles only exist because they
 * already went through the normal approve flow once, so there's no
 * bootstrap gap to close for them the way there was for CL.
 */
async function _checkIsPrivilegedJoiner(uid, groupId, profile) {
  if (!uid) return false;
  const [isAdminUser, staffRolesSnap] = await Promise.all([
    checkIsAdmin(uid),
    getDocs(collection(db, 'staff', uid, 'roles')),
  ]);
  if (isAdminUser) return getGroupId(profile) === groupId;
  const dept = groupId.split('_')[1];
  return staffRolesSnap.docs.some((d) => {
    const roleId = d.id;
    return roleId === `senior_campus_lead_${dept}`
      || roleId === `campus_lead_${groupId}`;
  });
}

// ---------------------------------------------------------------------
// Singleton listener registry
// ---------------------------------------------------------------------
// key -> { unsubscribe, refCount, listeners:Set<callback>, lastValue, teardownTimer }
const _registry = new Map();

// PERF FIX (zero-latency navigation — Schedule/Attendance/ClassPlanner/CR
// routine all appearing slow on every visit): this singleton registry
// already did the hard part right (one shared onSnapshot per group+
// collection, cached lastValue delivered instantly to new subscribers —
// see the `if (entry.lastValue !== null) callback(...)` line below). The
// bug was TEARDOWN: the instant the last consumer unmounted (refCount hit
// 0 — which happens on EVERY navigation away from a page using this data,
// since the component unmounts), the listener was killed and the whole
// registry entry deleted immediately. Navigating back re-attached a
// brand-new onSnapshot from scratch with lastValue reset to null, paying
// the full Firestore round-trip again — on every single visit to Schedule,
// Attendance, ClassPlanner, or any CR routine page, even navigating back
// and forth within the same minute.
//
// Fix: don't tear down immediately. Keep the listener (and its cached
// lastValue) alive for a short grace period after the last consumer
// unmounts. If the person navigates back within that window (the common
// case — bottom-nav tapping between Today/Schedule/Attendance/Courses is
// often just a few seconds apart), the SAME live listener is reused:
// _subscribeSingleton finds the still-alive entry, delivers its cached
// lastValue instantly (synchronously, on the next line after
// entry.listeners.add), and the page paints with real data on the very
// first render — zero network wait. Only after the grace period passes
// with genuinely nobody subscribed does the listener actually get killed,
// which still correctly frees the Firestore connection for someone who's
// truly done with that group's data (e.g. logged out, switched groups).
const TEARDOWN_GRACE_MS = 60_000; // 1 minute — long enough for normal in-app navigation, short enough not to leak connections for someone who's actually left

// Shared helper for the doc-watching singletons below (crStatus,
// plannerSettings, classSetup) — same grace-period reuse fix as
// _subscribeSingleton above, factored out once instead of hand-copied at
// each of the three call sites (they'd previously each hand-rolled their
// own copy of the instant-teardown version of this same pattern).
function _subscribeDocSingleton(key, buildDocRefFn, mapSnapFn, callback, errLabel) {
  let entry = _registry.get(key);
  if (entry?.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null, teardownTimer: null };
    _registry.set(key, entry);
    entry.unsubscribe = onSnapshot(buildDocRefFn(), (snap) => {
      entry.lastValue = mapSnapFn(snap);
      entry.listeners.forEach((cb) => cb(entry.lastValue));
    }, (err) => console.error(`[groupSync] ${errLabel} listener error:`, err));
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue);
  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.teardownTimer = setTimeout(() => {
        if (entry.refCount <= 0) {
          entry.unsubscribe?.();
          _registry.delete(key);
        }
      }, TEARDOWN_GRACE_MS);
    }
  };
}

function _subscribeSingleton(key, buildQueryFn, mapDocsFn, callback) {
  let entry = _registry.get(key);
  if (entry?.teardownTimer) {
    // A teardown was scheduled from a previous unmount but hasn't fired
    // yet — a new subscriber showed up within the grace window, so cancel
    // it. The listener and its cached lastValue stay alive and get reused
    // below exactly like a normal already-active singleton.
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }
  if (!entry) {
    entry = { unsubscribe: null, refCount: 0, listeners: new Set(), lastValue: null, teardownTimer: null };
    _registry.set(key, entry);
    const attach = (retriesLeft, slowRetriesLeft) => {
      entry.unsubscribe = onSnapshot(buildQueryFn(), (snap) => {

        entry.lastValue = mapDocsFn(snap);
        entry.listeners.forEach((cb) => cb(entry.lastValue));
      }, (err) => {
        // permission-denied here almost always means our own membership
        // doc write (joinGroup) hadn't landed yet when this query's rules
        // were evaluated — a startup race, not a real access problem.
        // Retry a couple of times with backoff instead of leaving callers
        // stuck on `null` (= infinite "Loading…") forever.
        //
        // Only log once the fast-retry budget is exhausted, not on every
        // single attempt — a caller that isn't a member yet (pending join
        // request) hits permission-denied on all 3 fast + 5 slow retries,
        // which used to mean 8 separate console.error lines per mount for
        // one underlying condition. One line per attach cycle is enough
        // to diagnose without flooding the console.
        const isRetryablePermission = err?.code === 'permission-denied'
          && (retriesLeft > 0 || slowRetriesLeft > 0);
        if (!isRetryablePermission) {
          console.error(`[groupSync] listener error for ${key}:`, err);
        }
        if (err?.code === 'permission-denied' && retriesLeft > 0) {
          setTimeout(() => attach(retriesLeft - 1, slowRetriesLeft), 1200);
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
        // full page reload clears the registry. Capped at a handful of
        // slow retries — if permission is still denied after this many
        // attempts it's a real rules/membership problem, not a startup
        // race, and retrying forever every 5s just spams the console and
        // burns a live Firestore connection for nothing.
        if (err?.code === 'permission-denied' && slowRetriesLeft > 0) {
          setTimeout(() => attach(3, slowRetriesLeft - 1), 5000);
        }
      });
    };
    attach(3, 5);
  }
  entry.refCount += 1;
  entry.listeners.add(callback);
  if (entry.lastValue !== null) callback(entry.lastValue); // deliver cached value immediately

  return () => {
    entry.listeners.delete(callback);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      // GRACE PERIOD (see the fix comment above _subscribeSingleton): don't
      // kill the listener immediately just because nobody's subscribed
      // this instant — that's exactly the "every navigation pays full
      // Firestore round-trip again" bug. Schedule a delayed real teardown
      // instead; a new subscriber within TEARDOWN_GRACE_MS cancels it (see
      // the clearTimeout branch above) and reuses the still-live listener.
      entry.teardownTimer = setTimeout(() => {
        // Re-check refCount at fire time, not capture time — a subscriber
        // that arrived and left again during the grace window could have
        // bumped refCount back up and down without ever cancelling this
        // specific timer instance if timers overlapped; this guard is
        // belt-and-braces so we never tear down a genuinely-in-use entry.
        if (entry.refCount <= 0) {
          entry.unsubscribe?.();
          _registry.delete(key);
        }
      }, TEARDOWN_GRACE_MS);
    }
  };
}

const _snapToArray = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ---------------------------------------------------------------------
// Merge N _subscribeSingleton listeners into one combined callback.
//
// WHY THIS EXISTS (permission-denied on notices/groupNotices listeners):
// Firestore can only allow a *list* query (onSnapshot over a collection,
// as opposed to a get() on one known doc) when the security rule for
// that collection can be proven true for every possible result WITHOUT
// looking at each doc's own data — i.e. the rule's conditions have to be
// implied by the query's own where()/orderBy() clauses. A rule like
// `resource.data.audience.type == 'all' || (resource.data.audience.type
// == 'student_uids' && request.auth.uid in resource.data.audience.uids)`
// is a perfectly fine rule for reading ONE known doc, but a bare
// `query(collection('notices'), orderBy('createdAt'), limit(50))` has no
// where() clause tying it to that condition, so Firestore can't verify
// the whole result set would pass — it denies the ENTIRE query up
// front with permission-denied, not just the docs that would fail.
// Same root cause for groups/{groupId}/notices: the `targetType !=
// 'cr_only' || isGroupCR(...)` branch can't be proven for an unfiltered
// query either.
//
// The fix is NOT to loosen the rules (that would leak targeted/CR-only
// notices to readers who shouldn't see them) — it's to run one
// rule-provable, where()-scoped listener PER audience the current user
// actually qualifies for, and merge the results client-side. Each
// individual listener's query now has a where() clause matching exactly
// the rule branch it's allowed under, so Firestore can verify every
// result up front.
function _mergeSubscriptions(subscribeFns, callback) {
  const n = subscribeFns.length;
  const results = new Array(n).fill(null);
  const received = new Array(n).fill(false);
  const emit = () => {
    if (!received.every(Boolean)) return; // wait for every listener's first snapshot
    const merged = new Map();
    for (const arr of results) {
      for (const item of arr || []) merged.set(item.id, item);
    }
    callback(Array.from(merged.values()));
  };
  const unsubs = subscribeFns.map((fn, i) => fn((arr) => {
    results[i] = arr;
    received[i] = true;
    emit();
  }));
  return () => unsubs.forEach((u) => u());
}

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
      // Redundant with the doc id, but collectionGroup queries can't use
      // documentId() with just a bare uid — it needs a full document path,
      // which getStaffDisplayInfo (staffSync.js) has no way to construct
      // without already knowing the groupId. Storing uid as a normal
      // field makes it queryable with a plain where('uid', '==', ...)
      // instead. Backfills on every join/profile-refresh, so existing
      // docs written before this field existed self-heal over time.
      uid,
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
      uid,
      // No auto-verify tier — every member's `verified` flag is only ever
      // set by a human reviewer (approveJoinRequest, or the CL-vacant
      // bootstrap merge in approveCLApplication). This branch of
      // joinGroup() is unreachable in practice (see the function's own
      // comment above), but defaults to false rather than true for safety
      // if it's ever hit.
      verified: false,
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
 * Auto-run version of joinGroup, called from App.jsx on every profile
 * change. Since class membership now requires CR/ACR approval (see
 * "Join requests" section below), this NEVER creates a fresh
 * members/{uid} doc itself — that would defeat the whole approval gate.
 * It only:
 *   - refreshes an ALREADY-member's display fields, exactly like
 *     joinGroup's own update branch (delegates straight to joinGroup,
 *     which is a no-op create-wise once the doc exists — see the
 *     getDocFromServer existence check inside it), and
 *   - otherwise makes sure a joinRequests/{uid} doc exists so the
 *     person shows up in their CR/ACR's review queue, without spamming
 *     a fresh request on every single store-updated tick (only creates
 *     one if none exists yet at all; a pending/approved/rejected doc is
 *     left alone — resubmission after rejection is a deliberate user
 *     action via requestToJoinGroup, not automatic).
 */
export async function syncGroupMembership(groupId, profile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  const memberRef = doc(db, 'groups', groupId, 'members', uid);
  const existingMember = await getDocFromServer(memberRef);
  if (existingMember.exists()) {
    await joinGroup(groupId, profile);
    return;
  }
  const reqRef = doc(db, 'groups', groupId, 'joinRequests', uid);
  let existingReq;
  try {
    existingReq = await getDocFromServer(reqRef);
  } catch (e) {
    console.warn('[syncGroupMembership] Failed to check existing joinRequests doc:', e?.code, e?.message);
    return;
  }
  if (!existingReq.exists()) {
    try {
      await requestToJoinGroup(groupId, profile, '');
    } catch (e) {
      console.warn('[syncGroupMembership] auto requestToJoinGroup failed:', e?.code, e?.message);
    }
  }
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

/**
 * Self-service: write the CURRENT user's own mobile number onto their
 * members/{uid} doc for THIS group. Firestore rules already allow a
 * member to self-update any field except verified/role (see the
 * `request.auth.uid == memberUid` branch of the members update rule),
 * so this needs no rules change.
 *
 * A student's mobile is per-group (member doc), not a single global
 * profile field, because joinGroup() already writes a fresh member doc
 * per class group — mirroring that shape keeps one write path instead
 * of a second, parallel "global profile" one. In practice a student only
 * has one active groupId at a time (their own batch+dept), so this reads
 * like a single number in the UI even though it's stored per-group.
 */
export async function updateOwnMobile(groupId, mobile) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  const trimmed = String(mobile || '').trim();
  await updateDoc(doc(db, 'groups', groupId, 'members', uid), { mobile: trimmed });
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

// (Removed: syncOwnVerification(). It flipped members/{uid}.verified from
// false->true as a catch-up for the old Tier-1 KUET-email-OTP flow. Now
// dead: every members/{uid} create path sets verified:true immediately
// (approveJoinRequest, approveCLApplication's bootstrap merge), and
// verified is otherwise only ever set by a human CL/Faculty approval. Its
// last two call sites (App.jsx's boot effect, ClaimCRCard.jsx) and the
// matching Firestore rules "Tier-1 catch-up" branch were removed together.)

/**
 * One-shot (non-polling) check of this user's own verified flag for a
 * group — unlike waitForOwnVerification, this does not retry or wait; it
 * just reports current server state right now. Used where a caller only
 * needs "is this account already Blue-Tick verified" as a gate before
 * doing something else (e.g. deciding whether to also queue a manual-
 * verify safety-net request), not to synchronize with a write in flight.
 */
export async function getOwnMemberVerifiedOnce(groupId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return false;
  try {
    const snap = await getDocFromServer(doc(db, 'groups', groupId, 'members', uid));
    return snap.exists() && snap.data().verified === true;
  } catch {
    return false;
  }
}

/**
 * Wait until this user's own member doc is readable and verified:true —
 * used before writes that Firestore rules gate on isVerifiedMember(groupId)
 * (e.g. right after approveJoinRequest/updateOwnMobile), so we don't race
 * the server's view of a just-approved member doc.
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
// CR is NOT an official KUETx post -- it's a per-class student feature.
// Each groupId now represents exactly ONE real class-section: for the 4
// multi-section depts (CE/EEE/ME/CSE, 120 seats/batch) groupId is
// batch_dept_section (Section A and B are separate groups), and for every
// other dept (single-section regardless of seat count) groupId stays
// batch_dept as before. Because of that, MAX_CR (1) and MAX_ACR (1) apply
// PER GROUP -- one CR + one ACR per real section. A multi-section dept's
// batch therefore still ends up with 2 CR + 2 ACR overall, but each pair
// now comes from a distinct, correctly-scoped section group instead of
// being lumped into one 120-student pool.
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
// The group's `meta/crStatus.count` is the CR-slot occupancy (0-1) that
// Firestore rules check for the "no CR yet -> any verified member may
// edit" fallback window (see isContentEditor). ACR occupancy isn't part
// of that rule (isGroupACR is checked directly), so it's only tracked
// client-side here for the "slots full" UI gate.

export const MAX_CR = 1;
export const MAX_ACR = 1;

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
export async function requestCR(groupId, profile, mobile) {
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
    // Only meaningful for the bootstrap path (no CR/ACR exists yet, so
    // the requester was never a plain member first — see this file's
    // crRequests create bootstrap branch and clApproveCRRequest below).
    // In the normal path the requester is already a member with mobile
    // set via updateOwnMobile, so this is just redundant there and
    // harmless. Always present (even if empty string) for the same
    // "field must exist, not be omitted" reason as `type` above.
    mobile: String(mobile || '').trim(),
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
 *
 * BUGFIX (bootstrap CR claim silently failed): when this class has no CR
 * yet at all (see firestore.rules' crRequests create — the crCount==0
 * bootstrap branch), the requester was never a plain member first, so
 * members/{targetUid} doesn't exist. The old batch.update() here required
 * an existing doc and would throw "no document to update" for exactly
 * this case — the one case this bootstrap path exists to support.
 * set({...}, {merge:true}) creates the doc if missing (matching the
 * shape approveJoinRequest already uses) and behaves identically to the
 * old update() when the doc DOES already exist, so normal (non-bootstrap)
 * CR approvals are unaffected.
 */
export async function clApproveCRRequest(groupId, targetUid) {
  const crStatusRef = doc(db, 'groups', groupId, 'meta', 'crStatus');
  const [membersSnap, requestsSnap, requestSnap] = await Promise.all([
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(query(collection(db, 'groups', groupId, 'crRequests'), where('status', '==', 'pending'))),
    getDoc(doc(db, 'groups', groupId, 'crRequests', targetUid)),
  ]);
  const { cr: crCount } = _countRoles(membersSnap.docs);
  if (crCount >= MAX_CR) {
    throw new Error(`The CR slot for this class is already full (max ${MAX_CR}).`);
  }
  const req = requestSnap.exists() ? requestSnap.data() : {};
  const batch = writeBatch(db);
  batch.set(doc(db, 'groups', groupId, 'members', targetUid), {
    name: req.name || '',
    roll: req.roll || '',
    uid: targetUid,
    role: 'cr',
    verified: true,
    isAnonymous: false,
    joinedAt: serverTimestamp(),
    legacyCRClaim: false,
    // Bootstrap path only (see requestCR's comment on why `mobile` is
    // stored on the request doc): if the requester was already a member,
    // their mobile was already set via updateOwnMobile and this merge
    // just re-writes the same value; harmless either way. Falls back to
    // leaving the field untouched (via merge) if the request doc never
    // had one, rather than ever overwriting a real number with ''.
    ...(req.mobile ? { mobile: req.mobile } : {}),
  }, { merge: true });
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
 * the CR slot is already full.
 *
 * BUGFIX (person requested this): this used to write only { role: 'cr',
 * verified: true } with no mobile number at all — unlike the self-claim
 * path (ClaimCRCard.jsx -> requestCR -> clApproveCRRequest), which makes
 * a mobile number mandatory before the request can even be submitted.
 * That meant a CL/SCL/Founder directly appointing someone from the
 * roster could create a CR with NO mobile on file, silently breaking the
 * "every CR/ACR has a real contact number, visible to Faculty" guarantee
 * documented in termStartDateSync.js/FacultyAllCR.jsx and enforced
 * everywhere else. `mobile` is now required here too — same
 * enforcement point, both directions now agree.
 */
export async function clAppointCR(groupId, targetUid, mobile) {
  const trimmedMobile = String(mobile || '').trim();
  if (!trimmedMobile) {
    throw new Error('A mobile number is required to appoint a CR.');
  }
  const crStatusRef = doc(db, 'groups', groupId, 'meta', 'crStatus');
  const [membersSnap, requestsSnap] = await Promise.all([
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(query(collection(db, 'groups', groupId, 'crRequests'), where('status', '==', 'pending'))),
  ]);
  const { cr: crCount } = _countRoles(membersSnap.docs);
  if (crCount >= MAX_CR) {
    throw new Error(`The CR slot for this class is already full (max ${MAX_CR}).`);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'cr', verified: true, mobile: trimmedMobile });
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
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member', legacyCRClaim: false, mobile: '' });
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
// BUGFIX (person requested this): handoffCR used to write only
// { role: 'cr' } for the successor — no mobile at all, and it actively
// CLEARED the outgoing CR's own mobile (line below) without ever
// collecting the new CR's number. Combined, a CR-to-CR handoff reliably
// produced a CR with zero contact number on file, the exact same gap
// clAppointCR/assignACR had (see those functions' own doc comments) —
// just reached via a third, CL-independent path this fix had missed.
// mobile is now required here too, same enforcement point everywhere a
// CR/ACR can be created.
export async function handoffCR(groupId, currentUid, successorUid, currentProfile, mobile) {
  const trimmedMobile = String(mobile || '').trim();
  if (!trimmedMobile) {
    throw new Error('A mobile number is required to hand off CR.');
  }
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
  batch.update(doc(db, 'groups', groupId, 'members', currentUid), { role: 'member', legacyCRClaim: false, mobile: '' });
  batch.update(doc(db, 'groups', groupId, 'members', successorUid), { role: 'cr', mobile: trimmedMobile });
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
 * approval needed. Throws if the ACR slot is already full.
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
//
// BUGFIX (person requested this, same fix as clAppointCR above): ACR is
// also shown on FacultyAllCR.jsx's "CR/ACR contacts" list, so it needs a
// real mobile number too — this used to write only { role: 'acr' } with
// nothing collected. Now mandatory here as well.
export async function assignACR(groupId, targetUid, mobile) {
  const trimmedMobile = String(mobile || '').trim();
  if (!trimmedMobile) {
    throw new Error('A mobile number is required to appoint an ACR.');
  }
  const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  const { acr: acrCount } = _countRoles(membersSnap.docs);
  if (acrCount >= MAX_ACR) {
    throw new Error(`The ACR slot for this class is already full (max ${MAX_ACR}).`);
  }
  await updateDoc(doc(db, 'groups', groupId, 'members', targetUid), { role: 'acr', mobile: trimmedMobile });
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
  batch.update(doc(db, 'groups', groupId, 'members', targetUid), { role: 'member', legacyCRClaim: false, mobile: '' });
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

// ---------------------------------------------------------------------
// Join requests — class-membership gate
// ---------------------------------------------------------------------
// A brand-new student does NOT get to self-join a class directly. They
// submit a joinRequests/{uid} doc (their own name/roll + a self-typed
// contact email, no OTP), and the group's CR/ACR (or CL/Admin/HeadOfOps
// as a fallback) reviews it and either approves it — which is the ONLY
// path that creates the actual groups/{groupId}/members/{uid} doc — or
// rejects it. This mirrors the existing crRequests pattern exactly, just
// one authority tier earlier (before you're even a member, not before
// you're CR).
//
// Roll-middle-digits -> dept code map, kept in sync by hand with
// ROLL_DEPT_MAP in ProfileSetupModal.jsx and deptCodeFromRoll() in
// firestore.rules. Needed here only for the client-side "does this roll
// plausibly belong to this class" auto-suggest hint shown to the
// reviewing CR — it is never trusted as a security boundary (the
// reviewer's own judgement + Firestore's own create rule are what
// actually gate the members doc), so a map that drifts slightly out of
// date would just make the suggestion badge wrong, not open a hole.
const _JOIN_REQUEST_DEPT_MAP = {
  '25': 'ARCH', '23': 'BECM', '15': 'BME', '01': 'CE', '29': 'CHE',
  '07': 'CSE', '09': 'ECE', '03': 'EEE', '13': 'ESE', '11': 'IPE',
  '19': 'LE', '05': 'ME', '27': 'MSE', '31': 'MTE', '21': 'TE', '17': 'URP',
};

/**
 * Best-effort, client-side-only hint for the reviewing CR: does this
 * roll's batch+dept look like it actually belongs to groupId? Returned
 * alongside the request so the approval UI can show a "✓ matches this
 * class" / "⚠ doesn't look right" badge — the CR still makes the final
 * call either way, this never blocks or auto-approves anything.
 */
export function suggestedJoinMatch(roll, groupId) {
  const cleanRoll = String(roll || '').trim();
  const [wantBatch, wantDept] = String(groupId || '').split('_');
  if (!/^\d{7}$/.test(cleanRoll) || !wantBatch || !wantDept) {
    return { batchMatches: false, rollInRange: false };
  }
  const rollBatch = `2K${cleanRoll.slice(0, 2)}`;
  const rollDept = _JOIN_REQUEST_DEPT_MAP[cleanRoll.slice(2, 4)] || '';
  return {
    batchMatches: rollBatch === wantBatch,
    rollInRange: rollDept === wantDept,
  };
}

/**
 * Student self-service: ask to join a class. Creates (or, after a
 * rejection, resubmits) a joinRequests/{uid} doc — never touches
 * members/{uid} directly. contactEmail is shown to the reviewer only,
 * never checked by any code; it exists purely so the CR can eyeball it.
 */
export async function requestToJoinGroup(groupId, profile, contactEmail) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;

  // Founder / that dept's Senior Campus Lead / this class's own Campus
  // Lead: skip the CR/ACR approval queue entirely and land straight in
  // the roster, verified — but ONLY for their own class, same as
  // everyone else. See _checkIsPrivilegedJoiner's comment and the
  // matching firestore.rules branches (members/{memberUid} create,
  // joinRequests/{requestUid} create) for why these three specifically
  // and how each is scoped.
  const isPrivileged = await _checkIsPrivilegedJoiner(uid, groupId, profile);

  const ref_ = doc(db, 'groups', groupId, 'joinRequests', uid);
  const requestData = {
    uid,
    name: profile?.name || '',
    roll: profile?.studentId || '',
    contactEmail: String(contactEmail || '').trim(),
    status: isPrivileged ? 'approved' : 'pending',
    requestedAt: serverTimestamp(),
    ...(isPrivileged ? { decidedAt: serverTimestamp(), decidedBy: 'auto:privileged' } : {}),
    ...suggestedJoinMatch(profile?.studentId, groupId),
  };

  let existing;
  try {
    existing = await getDocFromServer(ref_);
  } catch (e) {
    console.warn('[JOIN REQUEST] Failed to check existing joinRequests doc, treating as fresh request:', e?.code, e?.message);
    existing = { exists: () => false };
  }

  if (existing.exists()) {
    const status = existing.data()?.status;
    if (status === 'pending' && !isPrivileged) {
      throw new Error('You already have a pending join request. Wait for your CR to act on it first.');
    }
    await updateDoc(ref_, requestData);
  } else {
    await setDoc(ref_, requestData);
  }

  if (isPrivileged) {
    // Mirror approveJoinRequest()'s member-doc + groups-summary-doc
    // writes, just self-targeted instead of CR/ACR-targeted.
    const batch = writeBatch(db);
    batch.set(doc(db, 'groups', groupId, 'members', uid), {
      name: profile?.name || '',
      roll: profile?.studentId || '',
      uid,
      verified: true,
      role: 'member',
      isAnonymous: false,
      joinedAt: serverTimestamp(),
      legacyCRClaim: false,
    });
    const [groupBatch, groupDept] = groupId.split('_');
    batch.set(doc(db, 'groups', groupId), {
      batch: groupBatch || '',
      dept: groupDept || '',
      lastActivityAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
  }
}

/** Live list of this group's pending join requests, for the CR/ACR review panel. */
export function subscribeJoinRequests(groupId, callback) {
  if (!groupId) return () => {};
  const key = `joinRequests:${groupId}`;
  return _subscribeSingleton(
    key,
    () => query(collection(db, 'groups', groupId, 'joinRequests'), orderBy('requestedAt')),
    (snap) => _snapToArray(snap).filter((r) => r.status === 'pending'),
    callback,
  );
}

/**
 * Founder/Admin/HeadOfOps-only: live list of EVERY pending join request
 * across EVERY group, in one collectionGroup query — this is the actual
 * bootstrap fallback for a brand-new class (no CR/CL exists yet, so
 * nobody else can approve that class's very first joinRequests doc) and
 * for a class whose CR/CL has gone quiet. Backs the Approvals tab's
 * "Student Manual Verification" section — approving here calls the exact
 * same approveJoinRequest(groupId, uid) a CR/ACR/CL would use, so an
 * approval from this path is indistinguishable from a normal one
 * downstream (same members/{uid} doc shape, verified: true).
 * Requires the collectionGroup read rule on /{path=**}/joinRequests/
 * {requestUid} in firestore.rules (Admin/HeadOfOps only).
 */
export function subscribeAllPendingJoinRequests(callback, onError) {
  const q = query(collectionGroup(db, 'joinRequests'), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => {
      // Each doc's path is groups/{groupId}/joinRequests/{uid} — groupId
      // isn't stored as a field on the doc itself (see requestJoinGroup),
      // so it has to be read back out of the path here.
      const groupId = d.ref.parent.parent?.id || '';
      return { id: d.id, groupId, ...d.data() };
    }));
  }, (err) => {
    // Deliberately NOT silently swallowed to [] anymore — a
    // permission-denied (rule gap) or failed-precondition (missing
    // index) here used to look identical to "genuinely nothing
    // pending" in the UI, which is exactly what caused the Campus
    // Lead's real pending request to render as "Nothing pending."
    console.error('[groupSync] subscribeAllPendingJoinRequests error:', err);
    callback([]);
    if (onError) onError(err);
  });
}

/**
 * Live status of the CURRENT user's own joinRequests/{uid} doc for this
 * group — null if none exists yet. Drives the "waiting for approval" /
 * "rejected, try again" states on the dashboard join-status card.
 */
export function subscribeOwnJoinRequestStatus(groupId, uid, callback) {
  if (!groupId || !uid) return () => {};
  const ref_ = doc(db, 'groups', groupId, 'joinRequests', uid);
  return onSnapshot(ref_, (snap) => callback(snap.exists() ? snap.data() : null), (err) => {
    console.error('[groupSync] subscribeOwnJoinRequestStatus error:', err);
    callback(null);
  });
}


/**
 * CR/ACR (or CL/Admin/HeadOfOps) action: approve a pending join request.
 * This is the ONLY path (besides direct roster appointment by staff)
 * that creates the actual members/{uid} doc going forward — plain
 * self-join is no longer how a student ends up with class access.
 */
export async function approveJoinRequest(groupId, targetUid) {
  const reqRef = doc(db, 'groups', groupId, 'joinRequests', targetUid);
  const reqSnap = await getDocFromServer(reqRef);
  if (!reqSnap.exists()) throw new Error('This join request no longer exists.');
  const req = reqSnap.data();

  const batch = writeBatch(db);
  batch.set(doc(db, 'groups', groupId, 'members', targetUid), {
    name: req.name || '',
    roll: req.roll || '',
    uid: targetUid,
    // Approval by a human reviewer IS the verification here — there is
    // no separate OTP tier in this flow, so an approved join request
    // always lands as verified: true.
    verified: true,
    role: 'member',
    isAnonymous: false,
    joinedAt: serverTimestamp(),
    legacyCRClaim: false,
  });
  batch.update(reqRef, { status: 'approved', decidedAt: serverTimestamp(), decidedBy: auth.currentUser?.uid || null });
  // BUGFIX (Founder's "Classes & Students" shows "0 classes" even with
  // real, verified members): joinGroup()'s self-join path (see its own
  // comment above) always keeps the lightweight groups/{groupId} summary
  // doc up to date so listAllGroups() can enumerate classes without a
  // separate index collection. This manual-approval path never did —
  // members/{targetUid} existing doesn't make the groups/{groupId}
  // PARENT doc exist in Firestore (a subcollection doc's parent path is
  // not automatically a real document), so any class whose roster was
  // built entirely through Approve here (rather than someone
  // self-joining first) stayed permanently invisible to the Admin
  // dashboard. Mirror the same denormalized write here — groupId's own
  // {BATCH}_{DEPT}[_{SECTION}] format (same parsing AdminDashboard.jsx's
  // parseGroupId already relies on) is used since the joinRequests doc
  // itself doesn't carry dept/batch as separate fields.
  const [groupBatch, groupDept] = groupId.split('_');
  batch.set(doc(db, 'groups', groupId), {
    batch: groupBatch || '',
    dept: groupDept || '',
    lastActivityAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

export async function rejectJoinRequest(groupId, targetUid) {
  await updateDoc(doc(db, 'groups', groupId, 'joinRequests', targetUid), {
    status: 'rejected', decidedAt: serverTimestamp(), decidedBy: auth.currentUser?.uid || null,
  });
}

/**
 * One-time repair for classes that predate the approveJoinRequest() fix
 * above: their members/{uid} docs are real, but the groups/{groupId}
 * PARENT doc was never written (the old approveJoinRequest() only ever
 * wrote members/{uid}, never the groups/{groupId} summary joinGroup()'s
 * self-join path always kept up to date), so listAllGroups() couldn't
 * see them and the Founder's "Classes & Students" dashboard showed
 * "0 classes" despite real, verified rosters existing underneath.
 *
 * Admin/Head of Ops only — run once from the Founder dashboard (see
 * AdminDashboard.jsx's "Repair missing classes" button). Safe to run more
 * than once: every write here is `{ merge: true }` and only touches
 * groups that are actually missing their parent doc.
 *
 * Returns the list of groupIds that were fixed, for a simple toast/alert.
 */
export async function backfillMissingGroupDocs() {
  // collectionGroup('members') sees every members/{uid} doc across every
  // group in one query — same read rule (isAdmin()/isHeadOfOps()) that
  // already backs subscribeAllPendingJoinRequests's collectionGroup use
  // elsewhere in this file, see /{path=**}/members/{memberUid} in
  // firestore.rules.
  const snap = await getDocs(collectionGroup(db, 'members'));
  const groupIds = new Set();
  snap.forEach((d) => {
    // Each members doc's path is groups/{groupId}/members/{uid} — the
    // groupId is the second-to-last segment.
    const parts = d.ref.path.split('/');
    const groupId = parts[parts.length - 3];
    if (groupId) groupIds.add(groupId);
  });

  const existing = await listAllGroups();
  const existingIds = new Set(existing.map((g) => g.id));
  const missing = [...groupIds].filter((id) => !existingIds.has(id));

  for (const groupId of missing) {
    const [groupBatch, groupDept] = groupId.split('_');
    await setDoc(doc(db, 'groups', groupId), {
      batch: groupBatch || '',
      dept: groupDept || '',
      lastActivityAt: serverTimestamp(),
    }, { merge: true });
  }

  return missing;
}

/**
 * Self-service: leave a class the CURRENT user is a member of. Removes
 * their own members/{uid} doc. Re-joining afterward always requires a
 * brand-new joinRequests approval — being previously verified/approved
 * does not grant an automatic re-join, by design (see conversation
 * history: leaving and rejoining should go through the CR again, not
 * silently restore old access).
 */
export async function leaveGroup(groupId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !groupId) return;
  await deleteDoc(doc(db, 'groups', groupId, 'members', uid));
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
/**
 * Live "is the CURRENT user actually an approved member of this group"
 * check — unlike subscribeMyRole (which defaults to the STRING 'member'
 * for both a real member AND someone with no members/{uid} doc at all,
 * since 'member' also happens to be the lowest real role), this reports
 * a genuine boolean based on the doc's existence. Needed anywhere that
 * must distinguish "really in this class" from "not in it yet, still
 * pending/no request" — e.g. gating the class-notices subscription so
 * it's never even attempted (and never hits permission-denied) for
 * someone still waiting on CR/ACR approval.
 */
// BUGFIX (excessive live listeners): same fix as subscribeMyRole/
// subscribeOwnMemberVerified above — this was a 4th separate onSnapshot()
// on the same groups/{groupId}/members/{uid} doc. Derives existence from
// the shared subscribeMembers() stream instead.
export function subscribeIsOwnMember(groupId, uid, callback) {
  if (!groupId || !uid) { callback(false); return () => {}; }
  return subscribeMembers(groupId, (members) => {
    callback(members.some((m) => m.id === uid));
  });
}

// BUGFIX (excessive live listeners): this used to open its own raw
// onSnapshot() directly on groups/{groupId}/members/{uid} — a SECOND live
// Firestore connection watching data that subscribeMembers() (used by
// Sidebar.jsx, mounted on every page alongside this — used by BottomNav.jsx,
// also mounted on every page) already watches via the deduped
// _subscribeSingleton registry above. Two separate always-on listeners for
// overlapping group-membership data, on every single page load, was a real
// contributor to "too much Firebase sync" — this now derives the same
// answer from subscribeMembers' already-shared stream instead of opening
// its own connection at all.
export function subscribeMyRole(groupId, uid, callback) {
  if (!groupId || !uid) { callback('member'); return () => {}; }
  return subscribeMembers(groupId, (members) => {
    const me = members.find((m) => m.id === uid);
    callback(me?.role || 'member');
  });
}

/**
 * Current user's own members/{uid}.verified flag — this is a human-approval
 * fact (set by approveJoinRequest / CL bootstrap), not an email-OTP result;
 * there is no OTP tier anymore. Used for the Blue Tick badge on Profile.jsx,
 * mirroring the same `m.verified` source ClassmatesList.jsx already uses
 * for every OTHER member's tick.
 */
// BUGFIX (excessive live listeners): same fix as subscribeMyRole just
// above — this used to open its own separate onSnapshot() on
// groups/{groupId}/members/{uid}, a third live connection watching data
// subscribeMembers() already streams via the shared singleton registry.
// Derives the same verified flag from that shared stream instead.
export function subscribeOwnMemberVerified(groupId, uid, callback) {
  if (!groupId || !uid) { callback(false); return () => {}; }
  return subscribeMembers(groupId, (members) => {
    const me = members.find((m) => m.id === uid);
    callback(me?.verified === true);
  });
}

export function subscribeCRStatus(groupId, callback) {
  if (!groupId) return () => {};
  const key = `crStatus:${groupId}`;
  return _subscribeDocSingleton(
    key,
    () => doc(db, 'groups', groupId, 'meta', 'crStatus'),
    (snap) => {
      const count = snap.exists() ? (snap.data().count || 0) : 0;
      return { hasCR: count > 0, count, slotsFull: count >= MAX_CR };
    },
    callback,
    'crStatus',
  );
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

// BUGFIX (major logic gap — routine never cleared on term change): a
// group's routineEntries accumulate forever with no term field of their
// own and no link back to which term they were added in — so when a CR
// moves the class to a new term (ClassSetup.jsx's handleTermChange),
// every class card from the OLD term just kept showing on the shared
// schedule grid and on everyone's Today page, permanently, alongside
// (and indistinguishable from) the new term's real classes.
//
// This clears every routineEntries doc for the group in one batch when
// the CR changes the term — same soft-delete each entry already
// supports individually, just applied to all of them at once. Deliberately
// scoped to routineEntries ONLY: meta/plannerSettings (courseTeacherMap —
// which teacher teaches which course) is untouched on purpose, since
// that's meant to persist/accumulate across terms (see the comment on
// isClassSetupComplete above) and a CR re-entering it every term would be
// exactly the busywork this app is trying to remove.
export async function clearRoutineForTermChange(groupId, profile) {
  if (!groupId) return;
  const snap = await getDocs(query(collection(db, 'groups', groupId, 'routineEntries'), where('deleted', '==', false)));
  if (snap.empty) return;
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { deleted: true, updatedBy: stamp, updatedAt: serverTimestamp() });
  });
  await batch.commit();
  await _writeAuditLog(groupId, 'clear-for-term-change', 'routineEntries', 'bulk', stamp);
}

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
  return _subscribeDocSingleton(
    key,
    () => doc(db, 'groups', groupId, 'meta', 'plannerSettings'),
    (snap) => (snap.exists() ? snap.data() : {}),
    callback,
    'plannerSettings',
  );
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
// Class on/off toggle — CR-triggered ad-hoc cancellation (slot-level or
// whole-day). Lives inside plannerSettings.scheduleFields.classOverrides,
// same doc as holidayDates, same merge-write pattern as
// updatePlannerSettings above (last-write-wins, no new conflict scheme).
// See store.js's isClassOff()/getClassOffReason() for the read side, and
// ClassRoutine.jsx for the toggle UI that calls these.
// ---------------------------------------------------------------------

// Toggles a single slot on/off for one date. `on: true` clears the
// override (back to "runs normally"); `on: false` writes an 'off' entry.
// Does NOT touch dayOff — a slot-level change never implicitly changes
// the whole-day override.
// Sets or clears a ONE-OFF per-date override for a single slot. `mode`:
//   'off'   — cancel just this date's occurrence
//   'on'    — explicit exception for this date (e.g. a single make-up
//             session on a date that would otherwise be caught by a
//             recurringOff entry — see isClassOff()'s precedence in
//             store.js, where a per-date 'on' always wins over recurring)
//   'clear' — remove the override entirely, back to whatever the default
//             resolution (recurring or none) would say for that date
// dateKey is always the CR's own explicit date-picker choice — this
// function never guesses or derives a date itself.
export async function setSlotOverride(groupId, profile, { dateKey, slotKey, mode, reason = null }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const classOverrides = { ...(scheduleFields.classOverrides || {}) };
  const forDate = { ...(classOverrides[dateKey] || {}) };
  const slots = { ...(forDate.slots || {}) };
  if (mode === 'clear') {
    delete slots[slotKey];
  } else {
    slots[slotKey] = { status: mode === 'on' ? 'on' : 'off', reason: reason || null, setBy: uid, setAt: serverTimestamp() };
  }
  forDate.slots = slots;
  classOverrides[dateKey] = forDate;
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, classOverrides },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Toggles the WHOLE DAY on/off for one date. `on: true` clears dayOff
// (back to "runs normally" — any existing per-slot overrides for that
// date are left as-is, since they may still be intentional individually).
export async function setDayOverride(groupId, profile, { dateKey, on, reason = null }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const classOverrides = { ...(scheduleFields.classOverrides || {}) };
  const forDate = { ...(classOverrides[dateKey] || {}) };
  if (on) {
    delete forDate.dayOff;
    delete forDate.dayOffReason;
  } else {
    forDate.dayOff = true;
    forDate.dayOffReason = reason || null;
  }
  classOverrides[dateKey] = forDate;
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, classOverrides },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Starts (or extends) an ONGOING weekly suspension for a slot, effective
// from `fromDateKey` (CR-picked, explicit — see setSlotOverride's note)
// and every matching weekday after it, until clearRecurringOff() is
// called. Does NOT touch any existing per-date classOverrides — a CR can
// still punch a single-date 'on' exception through an active recurring
// suspension for a genuine make-up class (see isClassOff() precedence).
export async function setRecurringOff(groupId, profile, { slotKey, fromDateKey, reason = null }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const recurringOff = { ...(scheduleFields.recurringOff || {}) };
  recurringOff[slotKey] = { from: fromDateKey, reason: reason || null, setBy: uid, setAt: serverTimestamp() };
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, recurringOff },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Ends an ongoing recurring suspension — the slot goes back to running
// every week as normal (subject to any per-date classOverrides that still
// exist, same as any other slot).
export async function clearRecurringOff(groupId, profile, { slotKey }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const recurringOff = { ...(scheduleFields.recurringOff || {}) };
  delete recurringOff[slotKey];
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, recurringOff },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---------------------------------------------------------------------
// Sessional/Lab alternating-week cadence (Phase 3 — see
// TEACHER_ID_SESSIONAL_PROGRESS.md / IMPLEMENTATION_PROMPT.md Section 3
// and src/lib/sessionalCadence.js for the full design). Lives inside
// plannerSettings.scheduleFields.sessionalCadence — same doc, same
// merge-write pattern, and (crucially) the SAME App.jsx boot-time mirror
// that already copies scheduleFields into local scheduleSettings for
// classOverrides/recurringOff, so todayItems.js/Attendance.jsx (plain
// synchronous readers, not React hooks — see App.jsx's own comment on
// why that mirror exists) get live group data with zero new wiring.
//
// setSessionalCadence is a single generic writer (unlike the on/off
// toggle's 4 separate functions) because sessionalCadence.js's pure
// helpers (toggleDateOverride, shiftCadenceFrom, defaultCadenceForNewSlot)
// already compute the next per-slot entry — this function's only job is
// to merge that computed entry into the shared doc, the same shape every
// other plannerSettings writer in this file uses.
// ---------------------------------------------------------------------

// Writes (replaces) the sessionalCadence entry for one slotKey. Callers
// compute `nextEntry` via sessionalCadence.js's pure helpers first (e.g.
// toggleDateOverride(currentEntry, date, 'off') for a single cancellation,
// or shiftCadenceFrom(currentEntry, newAnchorDate) for a deliberate
// "shift cadence from here" action) — this function never computes the
// cadence logic itself, only persists whatever was computed.
export async function setSessionalCadence(groupId, profile, { slotKey, nextEntry }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const sessionalCadence = { ...(scheduleFields.sessionalCadence || {}) };
  sessionalCadence[slotKey] = { ...nextEntry, setBy: uid, setAt: serverTimestamp() };
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, sessionalCadence },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Removes a slot's sessionalCadence entry entirely — back to "no cadence
// configured", which resolves to "runs every week" (today's default
// behavior, unaffected by this system — see sessionalCadence.js's
// getEffectiveOccurrence). Distinct from setting mode:'weekly': that's an
// explicit "this sessional runs every week" configuration a CR chose,
// while clearing removes the configuration altogether. Both currently
// behave the same for occurrence resolution, but clearing also drops any
// accumulated overrides, which mode:'weekly' would not.
export async function clearSessionalCadence(groupId, profile, { slotKey }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  const ref = doc(db, 'groups', groupId, 'meta', 'plannerSettings');
  const snap = await getDoc(ref);
  const scheduleFields = snap.exists() ? (snap.data().scheduleFields || {}) : {};
  const sessionalCadence = { ...(scheduleFields.sessionalCadence || {}) };
  delete sessionalCadence[slotKey];
  await setDoc(ref, {
    scheduleFields: { ...scheduleFields, sessionalCadence },
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---------------------------------------------------------------------
// Class Setup — mandatory CR-onboarding data
// ---------------------------------------------------------------------
// Single group-wide doc holding every piece of "the CR is supposed to
// set this for the whole class" data that used to be either scattered
// (deptBatchConfig.termStartDate) or silently per-student/local
// (roadmapConfig used to live in each student's own store, never synced
// — a CR filling it in did nothing for anyone else). This is the target
// for the mandatory, non-skippable CR onboarding popup: term start date,
// class-end/prep-leave/exam dates, exam count, and course-teacher map
// all live here now so every class member reads the same values and a
// CR can always come back to /class-setup to edit them later.
export function subscribeClassSetup(groupId, callback) {
  if (!groupId) return () => {};
  const key = `classSetup:${groupId}`;
  return _subscribeDocSingleton(
    key,
    () => doc(db, 'groups', groupId, 'meta', 'classSetup'),
    (snap) => (snap.exists() ? snap.data() : {}),
    callback,
    'classSetup',
  );
}

export async function updateClassSetup(groupId, profile, data) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await setDoc(doc(db, 'groups', groupId, 'meta', 'classSetup'), {
    ...data,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// The fields that make up "mandatory" completion — used by both the
// blocking onboarding modal and the /class-setup page to know when
// setup is actually done. Routine + course-teacher map are checked
// against their own subcollection/doc (not this list) since they aren't
// stored inline on classSetup itself.
export const CLASS_SETUP_REQUIRED_FIELDS = ['termStartDate', 'classEndDate', 'prepLeaveEndDate', 'postExamEndDate', 'currentTermKey'];

/**
 * @param {Array<{id:string}>} currentTermCourseIds - course ids (from
 *   getCoursesForTerm) for classSetup.currentTermKey. Optional for
 *   backward compatibility with old callers that don't have the course
 *   list handy — when omitted, falls back to the old (weaker) "at least
 *   one course has a teacher" check.
 *
 * Why this matters: courseTeacherMap accumulates entries across EVERY
 * term a CR has ever set (old terms' entries are never deleted — see
 * updatePlannerSettings), so checking "the map has any keys at all"
 * could be satisfied entirely by a past term's leftover data even if
 * the CURRENT term has zero teachers assigned. Passing the current
 * term's course ids lets us check the thing that actually matters: does
 * every course in the term the class is in RIGHT NOW have a teacher.
 */
export function isClassSetupComplete(classSetup, routineCount, courseTeacherMap, currentTermCourseIds) {
  const cs = classSetup || {};
  const fieldsDone = CLASS_SETUP_REQUIRED_FIELDS.every((k) => !!cs[k]);
  const routineDone = (routineCount || 0) > 0;
  const map = courseTeacherMap || {};
  // Every course (Theory and Sessional alike) needs exactly 2 teacher
  // names on record. Rotating-slot courses still have 2 fixed teachers
  // overall — which one taught a given date is resolved separately via
  // Attendance.jsx's per-date rotation log, not by reducing this count.
  const teacherMapDone = Array.isArray(currentTermCourseIds)
    ? currentTermCourseIds.length > 0 && currentTermCourseIds.every((id) => Array.isArray(map[id]) && map[id].length >= 2)
    : Object.keys(map).length > 0;
  return fieldsDone && routineDone && teacherMapDone;
}

// ---------------------------------------------------------------------
// Group (CR-level) notices
// ---------------------------------------------------------------------

export function subscribeGroupNotices(groupId, callback, opts = {}) {
  if (!groupId) return () => {};

  // Split per the rules' own targetType branch (see _mergeSubscriptions
  // above for why an unfiltered query was being denied outright for
  // EVERY reader, not just the ones who shouldn't see cr_only notices).
  // Any signed-in group member can read 'broadcast' notices (and legacy
  // docs with no targetType field, which the rule treats the same way)
  // — that needs only a where() clause matching that rule branch, no
  // role check. The 'cr_only' listener is attached ONLY when the caller
  // says the viewer qualifies, since the rule denies that query outright
  // for anyone else (same failure mode we're fixing, just narrowed to
  // the one subset of notices that's actually supposed to be gated).
  //
  // opts.canSeeCrOnly: pass true when the current viewer is this
  // group's CR/ACR/CL, an Admin, or a Faculty account — i.e. exactly the
  // set firestore.rules' groups/{groupId}/notices read rule allows to
  // see a cr_only doc. Callers that already track this via
  // subscribeMyRole (ClassNoticesPanel, ClassRoster/
  // useClassRosterState) pass it through; defaults to false so a caller
  // that hasn't resolved the viewer's role yet never attempts a query it
  // isn't cleared for.
  const canSeeCrOnly = !!opts.canSeeCrOnly;

  const broadcastKey = `groupNotices:${groupId}:broadcast`;
  const subscribeBroadcast = (cb) => _subscribeSingleton(
    broadcastKey,
    () => query(
      collection(db, 'groups', groupId, 'notices'),
      where('targetType', '==', 'broadcast'),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    _snapToArray,
    cb,
  );

  // targetType is optional on older docs (absent == visible to everyone,
  // per noticeUtils.js's `n.targetType !== 'cr_only'` check) but
  // Firestore's equality/`in` filters can't match "field is missing" the
  // way they match an explicit value, so a second where()-scoped
  // listener covers that legacy shape specifically.
  const legacyKey = `groupNotices:${groupId}:legacy`;
  const subscribeLegacy = (cb) => _subscribeSingleton(
    legacyKey,
    () => query(
      collection(db, 'groups', groupId, 'notices'),
      where('targetType', '==', null),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    _snapToArray,
    cb,
  );

  const crOnlyKey = `groupNotices:${groupId}:crOnly`;
  const subscribeCrOnly = (cb) => _subscribeSingleton(
    crOnlyKey,
    () => query(
      collection(db, 'groups', groupId, 'notices'),
      where('targetType', '==', 'cr_only'),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    _snapToArray,
    cb,
  );

  const fns = canSeeCrOnly
    ? [subscribeBroadcast, subscribeLegacy, subscribeCrOnly]
    : [subscribeBroadcast, subscribeLegacy];

  return _mergeSubscriptions(fns, callback);
}

// PHASE 5 (Blaze-ready future-proofing — see
// CLASS_TOGGLE_NOTIFICATION_PROMPT.md section 4 and
// docs/NOTIFICATION_ARCHITECTURE.md): optional per-notice hint about which
// delivery channels a notice is meant for. Only 'telegram' is actually
// consumed right now (by functions/index.js's onGroupNoticeCreateTelegram
// trigger, which ignores this field entirely and fires for every notice
// regardless). It exists purely so that once Blaze billing is enabled and
// an SMS fan-out is added, that new trigger can filter on
// channelHints.includes('sms') without having to backfill or guess intent
// on notices written before SMS existed. Not passed by any caller today —
// callers can opt a notice into SMS-eligibility later by passing e.g.
// channelHints: ['telegram', 'sms'].
export async function postGroupNotice(groupId, profile, { title, body, priority = 'normal', channelHints = null }) {
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  // Phase 1 of the Notice upgrade: capture the audience size AT SEND TIME
  // (not retroactively) — this group's current member count, i.e. every
  // student who will see this notice on the class feed. Counted from a
  // one-shot members read right before the write, same pattern already
  // used elsewhere for member counts (see getGroupMembersOnce/listAllGroups
  // in AdminDashboard.jsx).
  let audienceSize = null;
  try {
    const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
    audienceSize = membersSnap.size;
  } catch {
    // Best-effort — a failed count here should never block sending the
    // notice itself; the UI falls back to "Reach data not available"
    // when audienceSize is missing/null (see NoticeInsightsPanel, Phase 2).
  }
  await addDoc(collection(db, 'groups', groupId, 'notices'), {
    title, body, postedBy: stamp, createdAt: serverTimestamp(),
    // Phase 4 of the Notice upgrade: optional priority, defaults to
    // 'normal' so old notices (and any caller that doesn't pass one)
    // behave exactly as before. Only 'urgent' | 'normal' | 'info' are
    // meaningful — no validation here since composers are the only
    // callers and already constrain the value via a dropdown.
    priority,
    ...(audienceSize !== null ? { audienceSize } : {}),
    ...(channelHints !== null ? { channelHints } : {}),
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

  // BUGFIX (same root cause documented above _mergeSubscriptions, and
  // already fixed for subscribeGroupNotices — this one was missed): a
  // bare `query(collection('notices'), orderBy('createdAt'), limit(50))`
  // has no where() clause tying it to the /notices/{noticeId} read
  // rule's per-document `audience.type` branches, so Firestore can't
  // prove the whole result set would pass and denies the ENTIRE query
  // up front — not just the docs the reader shouldn't see. That's the
  // actual cause of the repeated "[groupSync] listener error for
  // globalNotices ... Missing or insufficient permissions" loop, not a
  // startup race or a role problem.
  //
  // Fix: one rule-provable, where()-scoped listener per audience.type
  // branch the current viewer actually qualifies for, merged
  // client-side — same shape as subscribeGroupNotices above.
  const uid = auth.currentUser.uid;

  const populationKey = 'globalNotices:population'; // 'all' | 'batch' | 'group' — not individually sensitive
  const subscribePopulation = (cb) => _subscribeSingleton(
    populationKey,
    () => query(
      collection(db, 'notices'),
      where('audience.type', 'in', ['all', 'batch', 'group']),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    _snapToArray,
    cb,
  );

  const studentUidsKey = 'globalNotices:studentUids';
  const subscribeStudentUids = (cb) => _subscribeSingleton(
    studentUidsKey,
    () => query(
      collection(db, 'notices'),
      where('audience.type', '==', 'student_uids'),
      where('audience.uids', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    _snapToArray,
    cb,
  );

  const fns = [subscribePopulation, subscribeStudentUids];

  // Faculty-only branches ('faculty_all' / 'faculty_uids') — only attach
  // these once we know the viewer is actually faculty, since the rule
  // denies them outright otherwise (same reasoning as
  // subscribeGroupNotices's canSeeCrOnly gate). faculty/{uid} is
  // readable by any signed-in user (see firestore.rules), so this is a
  // cheap one-shot check, not a permission risk.
  getDoc(doc(db, 'faculty', uid)).then((snap) => {
    if (!snap.exists()) return;

    const facultyAllKey = 'globalNotices:facultyAll';
    const subscribeFacultyAll = (cb) => _subscribeSingleton(
      facultyAllKey,
      () => query(
        collection(db, 'notices'),
        where('audience.type', '==', 'faculty_all'),
        orderBy('createdAt', 'desc'),
        fsLimit(50),
      ),
      _snapToArray,
      cb,
    );

    const facultyUidsKey = 'globalNotices:facultyUids';
    const subscribeFacultyUids = (cb) => _subscribeSingleton(
      facultyUidsKey,
      () => query(
        collection(db, 'notices'),
        where('audience.type', '==', 'faculty_uids'),
        where('audience.uids', 'array-contains', uid),
        orderBy('createdAt', 'desc'),
        fsLimit(50),
      ),
      _snapToArray,
      cb,
    );

    fns.push(subscribeFacultyAll, subscribeFacultyUids);
  }).catch(() => {
    // Best-effort — if this lookup fails, the viewer just doesn't get
    // the faculty-only branches attached; population/student branches
    // above are unaffected.
  });

  // Provider-only branches ('provider_all' / 'provider_uids') — Phase 5
  // of PROVIDER_SHELL_UX_OVERHAUL_PLAN.md. Direct clone of the faculty
  // branches above: only attach once we know the viewer is actually a
  // provider account (providers/{uid} exists), same reasoning as the
  // faculty gate — the read rule denies these branches outright
  // otherwise. providers/{uid} is readable by any signed-in user (see
  // firestore.rules), so this is a cheap one-shot check, not a
  // permission risk.
  getDoc(doc(db, 'providers', uid)).then((snap) => {
    if (!snap.exists()) return;

    const providerAllKey = 'globalNotices:providerAll';
    const subscribeProviderAll = (cb) => _subscribeSingleton(
      providerAllKey,
      () => query(
        collection(db, 'notices'),
        where('audience.type', '==', 'provider_all'),
        orderBy('createdAt', 'desc'),
        fsLimit(50),
      ),
      _snapToArray,
      cb,
    );

    const providerUidsKey = 'globalNotices:providerUids';
    const subscribeProviderUids = (cb) => _subscribeSingleton(
      providerUidsKey,
      () => query(
        collection(db, 'notices'),
        where('audience.type', '==', 'provider_uids'),
        where('audience.uids', 'array-contains', uid),
        orderBy('createdAt', 'desc'),
        fsLimit(50),
      ),
      _snapToArray,
      cb,
    );

    fns.push(subscribeProviderAll, subscribeProviderUids);
  }).catch(() => {
    // Best-effort — if this lookup fails, the viewer just doesn't get
    // the provider-only branches attached; population/student/faculty
    // branches above are unaffected.
  });

  return _mergeSubscriptions(fns, callback);
}

/**
 * Client-side filter: does this notice apply to this profile/groupId/uid?
 *
 * Kept even after the firestore.rules audit fix (see /notices/{noticeId}'s
 * read rule) — the rules change stops anyone OUTSIDE the intended
 * audience from reading a targeted notice's doc at all (the real privacy
 * boundary), but this function is still what decides SHOW/HIDE for a
 * reader who legitimately CAN read the doc (e.g. every signed-in user
 * can technically read an 'all' notice — this is what narrows a 'batch'/
 * 'group' notice down to the right people within that already-readable
 * set). For 'student_uids'/'faculty_uids', the rule already guarantees
 * only an included uid ever receives the doc via onSnapshot in the first
 * place, so this check is redundant-but-harmless defense in depth.
 */
/**
 * Faculty-side counterpart to noticeAppliesTo — does this root notice
 * apply to this signed-in faculty uid? Only 'faculty_all'/'faculty_uids'
 * ever match; every student-audience type ('all'/'batch'/'group'/
 * 'student_uids') is deliberately excluded here, same reasoning in
 * reverse: a faculty account should never see a student-addressed
 * broadcast just because 'all' sounds like it should mean everyone —
 * "all" in this notice system has always meant "all students" (see
 * Notice.jsx's own subtitle: "Announcements from Founder/Admin, and
 * CR/ACR"), and faculty notices are a new, separate channel opened by
 * this audit fix, not a widening of the existing 'all'.
 */
export function noticeAppliesToFaculty(notice, uid) {
  const a = notice?.audience;
  if (!a || !uid) return false;
  if (a.type === 'faculty_all') return true;
  if (a.type === 'faculty_uids') return Array.isArray(a.uids) && a.uids.includes(uid);
  return false;
}

/**
 * Provider-side counterpart to noticeAppliesToFaculty — does this root
 * notice apply to this signed-in provider uid? Only
 * 'provider_all'/'provider_uids' ever match; every student/faculty
 * audience type is deliberately excluded here, same reasoning as the
 * faculty counterpart above: a provider account should never see a
 * broadcast addressed to a different population just because a type
 * name sounds inclusive.
 */
export function noticeAppliesToProvider(notice, uid) {
  const a = notice?.audience;
  if (!a || !uid) return false;
  if (a.type === 'provider_all') return true;
  if (a.type === 'provider_uids') return Array.isArray(a.uids) && a.uids.includes(uid);
  return false;
}

/**
 * Faculty-facing global (Admin/Founder) notices — the counterpart to
 * subscribeAllNotices's student-side global branch in noticeUtils.js, but
 * meant to be called ONCE PER FACULTY SESSION (e.g. from
 * useFacultyGlobalNotices, mounted once per faculty page), not once per
 * taught class.
 *
 * Handoff item 1 (option a): subscribeAllNotices() is called once PER
 * groupId (once per class a faculty teaches) from 3 different pages
 * (FacultyDashboard.jsx, FacultyClassDetail.jsx, FacultyNoticeBroadcast.jsx).
 * If the faculty-facing global-notices subscription lived inside that
 * per-group function, a teacher with 5 classes would get 5 duplicate
 * listeners and 5 duplicate emissions of the same Admin→Faculty broadcast.
 * This function is deliberately separate and keyed off nothing but the
 * signed-in uid, so a page mounts it exactly once regardless of how many
 * classes that faculty teaches.
 *
 * Reuses subscribeGlobalNotices() under the hood, which is itself a
 * `_subscribeSingleton` — multiple mounts across pages during navigation
 * still share one underlying Firestore listener; this wrapper's job is
 * just the faculty-specific filter + shape, not listener management.
 *
 * @param {string} uid - current signed-in faculty uid (required — returns
 *   a no-op unsubscribe if missing, same guard style as subscribeGlobalNotices)
 * @param {(notices: Array) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeFacultyGlobalNotices(uid, callback) {
  if (!uid) return () => {};
  return subscribeGlobalNotices((notices) => {
    const applicable = notices
      .filter((n) => noticeAppliesToFaculty(n, uid))
      .map((n) => {
        const isFounder = n.createdBy?.name === 'Founder';
        return {
          ...n,
          from: isFounder ? 'Founder' : (n.createdBy?.name || 'Admin'),
          roleTag: isFounder ? 'Founder' : 'Admin',
          isFounder,
          section: 'admin',
          createdAt: n.createdAt && typeof n.createdAt.toMillis === 'function'
            ? n.createdAt.toMillis()
            : (typeof n.createdAt === 'number' ? n.createdAt : 0),
          // "Just for you" tag — mirrors the student-side isPersonal flag
          // in noticeUtils.js. Only faculty_uids is "personal"; faculty_all
          // is population-level (every faculty account), not individual.
          isPersonal: n.audience?.type === 'faculty_uids',
        };
      })
      .filter((n) => !n.deleted);
    callback(applicable);
  });
}

/**
 * Provider-facing global (Admin/Founder) notices — Phase 5 of
 * PROVIDER_SHELL_UX_OVERHAUL_PLAN.md. Direct clone of
 * subscribeFacultyGlobalNotices above: meant to be called ONCE PER
 * PROVIDER SESSION (e.g. from useProviderGlobalNotices, mounted once by
 * ProviderNotifications.jsx), keyed off nothing but the signed-in uid.
 *
 * Reuses subscribeGlobalNotices() under the hood, same
 * `_subscribeSingleton` sharing behavior as the faculty version.
 *
 * @param {string} uid - current signed-in provider uid (required —
 *   returns a no-op unsubscribe if missing)
 * @param {(notices: Array) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeProviderGlobalNotices(uid, callback) {
  if (!uid) return () => {};
  return subscribeGlobalNotices((notices) => {
    const applicable = notices
      .filter((n) => noticeAppliesToProvider(n, uid))
      .map((n) => {
        const isFounder = n.createdBy?.name === 'Founder';
        return {
          ...n,
          from: isFounder ? 'Founder' : (n.createdBy?.name || 'Admin'),
          roleTag: isFounder ? 'Founder' : 'Admin',
          isFounder,
          section: 'admin',
          createdAt: n.createdAt && typeof n.createdAt.toMillis === 'function'
            ? n.createdAt.toMillis()
            : (typeof n.createdAt === 'number' ? n.createdAt : 0),
          // "Just for you" tag — mirrors the faculty/student-side
          // isPersonal flag. Only provider_uids is "personal";
          // provider_all is population-level (every verified provider),
          // not individual.
          isPersonal: n.audience?.type === 'provider_uids',
        };
      })
      .filter((n) => !n.deleted);
    callback(applicable);
  });
}

export function noticeAppliesTo(notice, profile, groupId, uid = null) {
  const a = notice?.audience;
  if (!a) return false;
  if (a.type === 'all') return true;
  if (a.type === 'batch') return !!profile?.batch && a.batch === profile.batch.trim().toUpperCase();
  if (a.type === 'group') return !!groupId && a.groupId === groupId;
  if (a.type === 'student_uids') return !!uid && Array.isArray(a.uids) && a.uids.includes(uid);
  // 'faculty_all'/'faculty_uids' are handled entirely by the faculty-side
  // subscription path (see subscribeAllNotices's audience === 'faculty'
  // branch below) rather than here — this function is only ever called
  // from the student-facing branch, so a faculty-only audience type
  // should never match a student reader regardless of anything else.
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