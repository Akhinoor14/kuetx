// termStartDateSync.js
//
// CR/ACR-controlled term start date, shared across every student in a
// dept+batch class ("group"). One doc per class: deptBatchConfig/{groupId}
// (groupId is the same `${batch}_${dept}` string getGroupId() already
// produces everywhere else in the app — see groupUtils.js).
//
// Why this exists: previously every student typed their own Term Start
// Date into ProfileSetupModal by hand. In practice everyone in a class
// starts the term on the same day, so this was ~50 people independently
// guessing/mistyping the same date, and nothing kept them in sync when a
// term got pushed back. Now the CR/ACR sets it ONCE for the whole class,
// and every student's timeline/alert calculations read from here.
//
// Students never write this doc — ProfileSetupModal shows it read-only.
// A student's own profile.termStartDate is kept only for backward
// compatibility with accounts that already had a manually-entered value;
// new reads should always prefer the shared config (see
// getEffectiveTermStartDate below) and fall back to the profile's own
// value only if the group hasn't set one yet.

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const configDoc = (groupId) => doc(db, 'deptBatchConfig', groupId);

const isValidIsoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !isNaN(parsed.getTime());
};

/**
 * One-time fetch of the CR-set term start date for a dept+batch group.
 * Returns null if no groupId, or the CR hasn't set one yet.
 */
export async function getGroupTermStartDate(groupId) {
  if (!groupId) return null;
  try {
    const snap = await getDoc(configDoc(groupId));
    if (snap.exists() && isValidIsoDate(snap.data().termStartDate)) {
      return snap.data().termStartDate;
    }
  } catch {
    // Rules may block read pre-migration, or offline — treat as "not set"
    // rather than throwing, same fallback style as appConfigSync.js.
  }
  return null;
}

/**
 * Live-subscribe to a dept+batch group's CR-set term start date. Fires
 * once immediately (null if unset/unreadable) and again on every CR edit.
 */
export function subscribeGroupTermStartDate(groupId, callback) {
  if (!groupId) {
    callback(null);
    return () => {};
  }
  return onSnapshot(configDoc(groupId), (snap) => {
    console.log('[KUETx DIAG] termStartDate snapshot fired, t=', performance.now());
    callback(snap.exists() && isValidIsoDate(snap.data().termStartDate) ? snap.data().termStartDate : null);
  }, (err) => {
    console.log('[KUETx DIAG] termStartDate ERROR fired:', err?.code, 't=', performance.now());
    callback(null);
  });
}

/**
 * CR/ACR-only write — sets the term start date for their whole dept+batch
 * class. Firestore rules (isGroupCR(groupId) || isGroupACR(groupId)) gate
 * the actual write permission; this just shapes and validates the
 * payload. Every student's profile in this group automatically reflects
 * the change on next read — nothing else needs to be touched per-student.
 */
export async function setGroupTermStartDate(groupId, dateStr) {
  if (!groupId) throw new Error('No group to set a term start date for.');
  if (!isValidIsoDate(dateStr)) throw new Error('Date should be in YYYY-MM-DD format.');
  await setDoc(configDoc(groupId), {
    termStartDate: dateStr,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Resolution helper for every read-site (timeline calc, alerts, Schedule,
 * Dashboard, etc.): prefer the CR-set group date; fall back to the
 * student's own profile.termStartDate only for backward compatibility
 * with values entered before this feature existed. New profiles never
 * get their own value written (ProfileSetupModal makes the field
 * read-only for students), so this fallback naturally fades out over
 * time as old profiles get re-saved.
 */
export function resolveEffectiveTermStartDate(groupTermStartDate, profileTermStartDate) {
  return groupTermStartDate || profileTermStartDate || null;
}
