// rollOwnership.js
//
// Prevents two different Firebase accounts from both claiming the same
// student roll number (e.g. someone logging in with Google AND separately
// with Email/Password, both entering "2113014" as their roll).
//
// One durable doc per roll: `rollOwners/{roll} -> { uid, claimedAt }`.
// - First account to save a profile with that roll "owns" it permanently.
// - Firestore rules (see firestore.rules `match /rollOwners/{roll}`) only
//   allow a CREATE by the matching uid, and only ALLOW an update if the
//   existing doc's uid already equals request.auth.uid — so a second
//   account can never overwrite someone else's claim, and the same
//   person switching devices under the same account is unaffected.
//
// This is separate from `verifiedRolls/{roll}` (kuetEmailVerify.js), which
// tracks "has this roll proven KUET email ownership" — this module tracks
// "which single uid is allowed to use this roll at all" and is checked
// BEFORE that step, at plain profile-save time (no email verification
// required to trigger this check).

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

/**
 * Attempt to claim a roll number for the current signed-in user.
 * Returns { ok: true } if the roll is free or already owned by this uid.
 * Returns { ok: false, ownedByOther: true } if a DIFFERENT account
 * already owns this roll AND this account has no verified-email proof
 * to reclaim it — caller should block profile save and show an error
 * (with an option to request admin help) instead of silently proceeding.
 *
 * Self-service reclaim path: if `verifiedRolls/{roll}` already exists
 * (this account proved ownership of the matching @stud.kuet.ac.bd
 * inbox via kuetEmailVerify.js) then this account IS the legitimate
 * owner of that roll, full stop — a stale/mistaken claim by some other
 * (unverified) account is safely overwritten. This is the primary,
 * no-admin-needed path for "I made a new account, my roll is stuck
 * on an old one."
 */
export async function claimRoll(roll) {
  const uid = auth.currentUser?.uid;
  const cleanRoll = String(roll || '').trim();
  if (!uid || !cleanRoll) return { ok: true }; // nothing to claim yet, don't block

  const ref = doc(db, 'rollOwners', cleanRoll);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    if (existing.data().uid === uid) return { ok: true }; // already ours

    // Someone else holds this roll. Check if THIS account can prove
    // institutional ownership and auto-reclaim it.
    const verifiedSnap = await getDoc(doc(db, 'verifiedRolls', cleanRoll));
    if (verifiedSnap.exists()) {
      try {
        await setDoc(ref, { uid, claimedAt: serverTimestamp(), reclaimedFrom: existing.data().uid });
        return { ok: true, reclaimed: true };
      } catch (err) {
        // Fall through to ownedByOther if the reclaim write itself
        // somehow gets denied (shouldn't happen per rules, but don't
        // silently pretend success).
      }
    }
    return { ok: false, ownedByOther: true };
  }

  await setDoc(ref, { uid, claimedAt: serverTimestamp() });
  return { ok: true };
}

/** One-shot check without writing anything — used for pre-submit validation. */
export async function isRollTakenByAnotherAccount(roll) {
  const uid = auth.currentUser?.uid;
  const cleanRoll = String(roll || '').trim();
  if (!cleanRoll) return false;
  const snap = await getDoc(doc(db, 'rollOwners', cleanRoll));
  if (!snap.exists()) return false;
  return snap.data().uid !== uid;
}

/**
 * Release a roll claim so it can be claimed by another (or the same,
 * on a different device/account) account. Two allowed callers per
 * firestore.rules:
 *  - The current owner releasing their own claim (self-service —
 *    e.g. "I signed up with the wrong Google account, let me switch").
 *  - An admin/Founder clearing a stuck or mistakenly-claimed roll.
 * Non-owners who aren't admin will get a permission-denied from
 * Firestore itself; this function doesn't pre-check that beyond
 * requiring a signed-in user, since only rules are the source of truth.
 */
export async function releaseRoll(roll) {
  const uid = auth.currentUser?.uid;
  const cleanRoll = String(roll || '').trim();
  if (!uid || !cleanRoll) return { ok: false, error: 'not-signed-in-or-no-roll' };

  try {
    await deleteDoc(doc(db, 'rollOwners', cleanRoll));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

/**
 * Fallback path for a stuck roll when the requester has no matching
 * KUET email to verify with (e.g. they lost mailbox access, or the
 * roll was mistakenly claimed by a friend's account). Creates an
 * in-app request the Founder/admin can see and resolve directly from
 * StaffDashboard — no outside contact channel needed. Admin resolving
 * it just calls releaseRoll(roll) (as admin) followed by the
 * requester re-running claimRoll().
 */
export async function requestRollUnlock(roll, note) {
  const uid = auth.currentUser?.uid;
  const cleanRoll = String(roll || '').trim();
  if (!uid || !cleanRoll) return { ok: false, error: 'not-signed-in-or-no-roll' };

  try {
    await setDoc(doc(db, 'rollUnlockRequests', `${cleanRoll}_${uid}`), {
      roll: cleanRoll,
      requestedBy: uid,
      note: String(note || '').trim(),
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code || err.message };
  }
}

// -------------------------------------------------------------
// Admin-side: view and resolve pending unlock requests. Only
// Founder/admin can read these per firestore.rules.
// -------------------------------------------------------------
export function subscribePendingRollUnlockRequests(callback) {
  const q = query(collection(db, 'rollUnlockRequests'), where('status', '==', 'pending'), orderBy('requestedAt'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

/**
 * Admin resolves an unlock request: releases the roll (so the requester
 * can re-claim it themself from Profile Setup) and marks the request
 * resolved. This is a two-step, not a batch, because rollOwners/{roll}
 * might not even exist anymore (e.g. already resolved another way) —
 * that shouldn't block marking the request itself as done.
 */
export async function resolveRollUnlockRequest(requestId, roll) {
  const cleanRoll = String(roll || '').trim();
  try {
    if (cleanRoll) {
      await deleteDoc(doc(db, 'rollOwners', cleanRoll));
    }
  } catch (err) {
    // Non-fatal — roll may already be free; still mark the request handled.
  }
  await updateDoc(doc(db, 'rollUnlockRequests', requestId), { status: 'resolved', resolvedAt: serverTimestamp() });
}

export async function dismissRollUnlockRequest(requestId) {
  await updateDoc(doc(db, 'rollUnlockRequests', requestId), { status: 'dismissed', resolvedAt: serverTimestamp() });
}