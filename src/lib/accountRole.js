// accountRole.js
//
// The one-time Role Select choice ("Student" vs "Faculty Member") from §5
// Step 1 of the merged Faculty Module prompt. Deliberately a tiny, separate
// file rather than folded into store.js's growing DEFAULT_PROFILE shape —
// this flag is NOT part of the student profile object at all (a faculty
// account never has a studentId/roll/batch), so keeping it as its own
// store key avoids ever accidentally merging it into student-profile reads
// like getProfile() does with DEFAULT_PROFILE.
//
// This is a LOCAL, self-reported UI routing hint only — it decides which
// auth branch/onboarding queue to show, nothing more. It is never used to
// grant access to anything (see useIsFaculty.js / RequireFaculty.jsx for
// the actual server-verified gate). Someone could clear this and pick
// differently; the worst case is just seeing the wrong onboarding branch
// once, not a security issue.
//
// BUGFIX: this used to be the ONLY place role lived — pure localStorage,
// per-browser, nothing server-side. That meant a real account's role was
// unrecoverable on a new device or after clearing storage, and every
// pre-existing account (created before this feature existed) had no way
// to ever be distinguished from "not yet decided." App.jsx's buildQueue()
// now also checks faculty/{uid} doc existence as one server-side signal
// (unambiguous proof of 'teacher'). This file adds the second, explicit
// one the spec asks for directly: users/{uid}.role, written once at Role
// Select and read back on every sign-in — so role survives across
// devices/storage-clears for BOTH roles, not just teacher (which happened
// to already have an indirect proof via the faculty doc).

import { store } from '../store/store';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export function getAccountRole() {
  return store.get('accountRole') || null; // null | 'student' | 'teacher'
}

export function setAccountRole(role) {
  if (role !== 'student' && role !== 'teacher') {
    throw new Error(`Invalid accountRole: ${role}`);
  }
  store.set('accountRole', role);
}

/** Sign-out (or "choose again") should clear this so Role Select reappears
 * — not currently wired to the sign-out button; noted here for Phase 8/
 * final-pass follow-up if the logout flow needs it. */
export function clearAccountRole() {
  store.set('accountRole', null);
}

/**
 * Reads the server-side role record for the given uid, if one exists.
 * Returns null on any error (offline, doc missing, etc.) rather than
 * throwing — callers should treat that the same as "not yet decided" and
 * fall back to whatever else they already do (e.g. the faculty/{uid}
 * existence check in App.jsx's buildQueue()).
 */
export async function fetchServerAccountRole(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const role = snap.exists() ? snap.data()?.role : null;
    return role === 'student' || role === 'teacher' ? role : null;
  } catch {
    return null;
  }
}

/**
 * Persists the role choice to users/{uid}.role — once. Firestore rules
 * (see firestore.rules match /users/{uid}) enforce that this field can
 * only ever be set when it didn't already exist, so this is safe to call
 * defensively (e.g. to backfill an account that only has the local flag)
 * without risking overwriting a value chosen differently on another
 * device; the rules reject that write instead of silently corrupting it.
 */
export async function persistAccountRoleToServer(role) {
  const uid = auth.currentUser?.uid;
  if (!uid || (role !== 'student' && role !== 'teacher')) return;
  try {
    await setDoc(doc(db, 'users', uid), { role }, { merge: true });
  } catch (e) {
    // Non-fatal — the local flag (and, for teacher, faculty/{uid}
    // existence) still lets buildQueue() function correctly this session;
    // this just means cross-device sync for a STUDENT role specifically
    // won't be backed up until a future successful write.
    console.warn('[accountRole] persistAccountRoleToServer failed', e);
  }
}
