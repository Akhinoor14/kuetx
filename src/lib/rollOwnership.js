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

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

/**
 * Attempt to claim a roll number for the current signed-in user.
 * Returns { ok: true } if the roll is free or already owned by this uid.
 * Returns { ok: false, ownedByOther: true } if a DIFFERENT account
 * already owns this roll — caller should block profile save and show
 * an error instead of silently proceeding.
 */
export async function claimRoll(roll) {
  const uid = auth.currentUser?.uid;
  const cleanRoll = String(roll || '').trim();
  if (!uid || !cleanRoll) return { ok: true }; // nothing to claim yet, don't block

  const ref = doc(db, 'rollOwners', cleanRoll);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    if (existing.data().uid === uid) return { ok: true }; // already ours
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
