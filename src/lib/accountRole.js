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

// PHASE 1 (Services/Provider marketplace, see SERVICES_PROVIDER_PLAN.md
// §3): 'provider' added as a third accountRole alongside student/teacher.
// Same "local UI-routing hint only, never a security boundary" caveat
// applies — providers/{uid}.status is the real server-verified gate
// (see useIsProvider.js / RequireProvider.jsx), same relationship
// accountRole has to faculty/{uid}.verifiedAt for teachers.
//
// BUGFIX (beta-era leftover local data, found via a real incident): this
// app used to be local/offline-only during its beta (500-600 users).
// Those accounts have since been removed from Firebase Auth entirely —
// but on devices/browsers that were used during beta, the OLD
// localStorage 'accountRole' value can still be sitting there, from
// before this key ever had a concept of "which account does this belong
// to." When a genuinely different account (a brand-new post-beta
// sign-up, or the current 4-5 active users, some of whom carried the
// same browser profile forward from beta) later signs in on that same
// device, getAccountRole() would return that stale leftover value —
// confirmed directly in one real case via
// localStorage.getItem('kuetx_accountRole') returning 'student' for an
// account that is actually a verified provider. Every fallback in
// buildQueue() only runs when local role is completely EMPTY
// (`if (!accountRole)`) — a wrong-but-present value was trusted forever,
// with no way to self-correct.
//
// The fix can't simply be "always re-fetch from server on every load,
// ignore local" — the app is deliberately offline-capable (local-first
// read, background sync), and role changes never happen offline anyway
// (Role Select is an online-only, one-time step), so a blanket
// server-always approach for role specifically wouldn't break offline
// support, BUT the broader ask (raised by the user) also covers not
// wanting to blindly trust ANY leftover local data across account
// boundaries, which the profile object already solves for via
// tagProfileOwner()/isProfileStaleForUid() in store.js. This applies the
// exact same pattern to accountRole: every write now stamps the uid it
// was set for; every read that matters for trust decisions checks that
// tag against the CURRENTLY signed-in uid. A value tagged for a
// different uid (or with no tag at all — i.e. from before this fix, the
// beta-era exact case) is stale leftover data, not this account's real
// role, and buildQueue() treats it the same as if nothing were cached
// locally at all (goes through full server-truth resolution). A value
// tagged for the SAME uid currently signed in is trusted immediately, no
// extra round-trip — this is what keeps normal repeat-visit loads fast
// and keeps offline support intact (an offline session's own writes for
// its own uid are never second-guessed).
const ROLE_KEY = 'accountRole';
const ROLE_OWNER_KEY = 'accountRoleOwnerUid';

export function getAccountRole() {
  return store.get(ROLE_KEY) || null; // null | 'student' | 'teacher' | 'provider'
}

/**
 * True iff a local accountRole value is present AND was tagged as
 * belonging to `uid` — i.e. safe to trust without a server round-trip.
 * False for: no local value, a value tagged for a different uid, or a
 * value with no owner tag at all (pre-fix / beta-era leftover data).
 */
export function isAccountRoleTrustedForUid(uid) {
  if (!uid) return false;
  const role = store.get(ROLE_KEY);
  if (!role) return false;
  const owner = store.get(ROLE_OWNER_KEY);
  return !!owner && owner === uid;
}

export function setAccountRole(role, uid = auth.currentUser?.uid) {
  if (role !== 'student' && role !== 'teacher' && role !== 'provider') {
    throw new Error(`Invalid accountRole: ${role}`);
  }
  store.set(ROLE_KEY, role);
  // uid defaults to the currently signed-in user — every existing call
  // site (Role Select, and every buildQueue() fallback/reconciliation
  // path) already only ever calls this while a real uid is signed in, so
  // this stays a no-op change for all of them; uid is only ever passed
  // explicitly by tests or a future cross-account utility.
  if (uid) store.set(ROLE_OWNER_KEY, uid);
}

/** Sign-out should clear this so a signed-out visitor doesn't get routed
 * by a stale role and Role Select correctly reappears on next sign-in.
 * Wired into logout() in firebaseAuth.js. */
export function clearAccountRole() {
  store.set(ROLE_KEY, null);
  store.set(ROLE_OWNER_KEY, null);
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
    return role === 'student' || role === 'teacher' || role === 'provider' ? role : null;
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
  if (!uid || (role !== 'student' && role !== 'teacher' && role !== 'provider')) return;
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
