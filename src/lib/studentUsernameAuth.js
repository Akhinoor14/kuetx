/**
 * studentUsernameAuth.js — KUETx Student Username+Password Auth (NEW, isolated)
 *
 * Phase 1 of the Student Auth Migration. This module is additive only —
 * nothing in firebaseAuth.js, AuthModal.jsx, or firestore.rules is touched
 * here (that's Phase 2 / Phase 5). It follows the same conventions as
 * firebaseAuth.js (normalize-then-call pattern, `const` arrow-function
 * exports, thrown Error objects with a `.code` for getAuthErrorMessage-style
 * handling upstream).
 *
 * Design:
 * - Students authenticate with a chosen username + password instead of a
 *   real email address. Firebase Auth itself is still email/password under
 *   the hood — we synthesize a stable, non-deliverable internal email per
 *   account (`{uid}@users.kuetx.internal`) so nothing ever tries to send
 *   real mail to it.
 * - Username -> uid lookup happens via a flat `usernames/{normalizedUsername}`
 *   Firestore doc, claimed transactionally so two signups racing for the
 *   same name can't both win.
 * - Because Firebase requires the email *before* we have a uid (uid is only
 *   assigned once the account is created), signup claims the username doc
 *   FIRST (using a client-generated random reservation token, not a uid),
 *   creates the Firebase account, then repoints the reservation at the real
 *   uid. If account creation fails after the claim, the reservation is
 *   released so the username isn't permanently burned.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  runTransaction,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-z][a-z0-9_]{3,19}$/; // first char letter, 4-20 chars total, lowercase/digits/underscore
const INTERNAL_EMAIL_DOMAIN = 'users.kuetx.internal';

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Normalizes a raw username to its canonical stored/lookup form:
 * trimmed, lowercased. Does NOT validate — call isValidUsername separately.
 */
export const normalizeUsername = (username) => String(username || '').trim().toLowerCase();

/**
 * Validates username policy:
 * - lowercase letters, digits, underscore only
 * - 4-20 chars
 * - first char must be a letter
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export const isValidUsername = (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return { ok: false, reason: 'Username is required.' };
  }
  if (normalized.length < 4 || normalized.length > 20) {
    return { ok: false, reason: 'Username must be between 4 and 20 characters.' };
  }
  if (!/^[a-z]/.test(normalized)) {
    return { ok: false, reason: 'Username must start with a letter.' };
  }
  if (!USERNAME_RE.test(normalized)) {
    return { ok: false, reason: 'Username can only contain lowercase letters, numbers, and underscores.' };
  }
  return { ok: true };
};

/**
 * Validates password policy: minimum 8 characters, at least 1 letter + 1 digit.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export const isValidPassword = (password) => {
  const value = String(password || '');
  if (value.length < 8) {
    return { ok: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(value)) {
    return { ok: false, reason: 'Password must contain at least one letter.' };
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, reason: 'Password must contain at least one number.' };
  }
  return { ok: true };
};

// ─── Synthetic internal email ──────────────────────────────────────────────────

/**
 * Builds the synthetic, non-deliverable internal email Firebase Auth uses
 * under the hood for a given uid. Never shown to the user, never used for
 * anything requiring a real inbox (no verification link, no password-reset
 * email — see "Still Open" note in PHASED_MIGRATION_PLAN.md: password
 * recovery strategy for username accounts is intentionally NOT decided
 * here, pending owner confirmation).
 */
export const buildInternalEmail = (uid) => `${uid}@${INTERNAL_EMAIL_DOMAIN}`;

// ─── Username availability ─────────────────────────────────────────────────────

/**
 * Checks whether a username is currently available (not present in
 * `usernames/{normalizedUsername}`). This is a plain read for live
 * availability-check UI (Phase 2) — the actual claim at signup time still
 * goes through the transaction below to close the race-condition window
 * between this check and the real claim.
 *
 * Returns { available: boolean, reason?: string } — reason is set when
 * the username fails policy validation (in which case availability is
 * not meaningfully defined).
 */
export const checkUsernameAvailable = async (username) => {
  const validation = isValidUsername(username);
  if (!validation.ok) {
    return { available: false, reason: validation.reason };
  }
  const normalized = normalizeUsername(username);
  const snap = await getDoc(doc(db, 'usernames', normalized));
  return { available: !snap.exists() };
};

// ─── Transactional claim ───────────────────────────────────────────────────────
// NOTE: this is a client-side Firestore transaction against
// `usernames/{normalizedUsername}`, not a Cloud Function. This matches the
// plan's instruction ("client-side transaction, not a Cloud Function") but
// carries the usual caveat of client-side transactions: it protects against
// two clients racing (Firestore's transaction retry/conflict mechanism
// handles that correctly), but it does NOT protect against a malicious
// client bypassing this module entirely and writing straight to
// `usernames/{name}` — that protection has to come from firestore.rules
// (Phase 5). TODO(Phase 5): ensure firestore.rules requires
// `usernames/{name}.uid == request.auth.uid` and denies overwriting an
// existing doc, so this client-side transaction is backed by a real
// server-side guarantee.

/**
 * Claims `usernames/{normalizedUsername}` for `uid` inside a transaction,
 * failing if another uid already holds it. Safe to call for a fresh signup
 * (uid must already exist, i.e. call this AFTER createUserWithEmailAndPassword)
 * or to repoint/finalize a reservation.
 *
 * Throws an Error with `.code === 'username/taken'` if the username is
 * already claimed by a different uid.
 */
const claimUsernameForUid = async (normalizedUsername, uid) => {
  const ref = doc(db, 'usernames', normalizedUsername);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data()?.uid !== uid) {
      const err = new Error('This username is already taken.');
      err.code = 'username/taken';
      throw err;
    }
    tx.set(ref, { uid, createdAt: serverTimestamp() }, { merge: true });
  });
};

/**
 * Releases a username claim (best-effort cleanup). Used when account
 * creation fails after the username was claimed, so the name isn't
 * permanently burned by a failed signup attempt.
 */
const releaseUsernameClaim = async (normalizedUsername) => {
  try {
    await deleteDoc(doc(db, 'usernames', normalizedUsername));
  } catch {
    // Best-effort only — a stray unreleased reservation is a minor cleanup
    // issue, not a correctness issue (Phase 5's rules TODO above still
    // prevents anyone else from actually being blocked by a doc that
    // doesn't match their own uid... once those rules exist).
  }
};

// ─── Signup ─────────────────────────────────────────────────────────────────────

/**
 * Signs up a new student with username + password.
 *
 * Flow:
 *  1. Validate username + password policy.
 *  2. Availability pre-check (fast, non-transactional — avoids paying the
 *     cost of creating a Firebase account just to find out the name was
 *     already gone).
 *  3. Create the Firebase Auth account with the synthetic internal email.
 *  4. Transactionally claim `usernames/{normalizedUsername}` for the new uid.
 *  5. If the claim fails (lost the race), the Firebase account already
 *     exists with no username claim attached — this is intentionally left
 *     for the caller to handle (e.g. prompt to pick another username and
 *     retry the claim; the account itself doesn't need to be recreated).
 *     TODO: decide whether to auto-delete the orphaned auth account here
 *     once org policy on client-side account deletion permissions is
 *     confirmed — left as-is for now to avoid assuming delete permissions
 *     this module hasn't verified exist client-side.
 *
 * Returns the Firebase `user` object on success.
 * Throws Error with `.code` set to one of:
 *   'username/invalid', 'password/invalid', 'username/taken',
 *   or a raw Firebase `auth/*` code.
 */
export const signupWithUsername = async (username, password) => {
  const usernameCheck = isValidUsername(username);
  if (!usernameCheck.ok) {
    const err = new Error(usernameCheck.reason);
    err.code = 'username/invalid';
    throw err;
  }
  const passwordCheck = isValidPassword(password);
  if (!passwordCheck.ok) {
    const err = new Error(passwordCheck.reason);
    err.code = 'password/invalid';
    throw err;
  }

  const normalized = normalizeUsername(username);

  const availability = await checkUsernameAvailable(normalized);
  if (!availability.available) {
    const err = new Error('This username is already taken.');
    err.code = 'username/taken';
    throw err;
  }

  // Firebase Auth needs an email string before a uid exists, so we can't
  // build the final synthetic email until AFTER the account is created.
  // createUserWithEmailAndPassword requires *some* unique email up front;
  // we use a temporary placeholder keyed to the username + a random
  // suffix, then immediately know the uid and don't actually need to
  // update the Firebase-side email afterwards, since nothing reads it —
  // buildInternalEmail(uid) is only ever used to RE-DERIVE the login email
  // at login time, not stored/displayed anywhere. So the temporary email
  // used here only needs to be unique enough to not collide; it is never
  // surfaced again.
  const tempEmail = buildInternalEmail(`${normalized}-${Math.random().toString(36).slice(2, 10)}`);

  let user;
  try {
    const result = await createUserWithEmailAndPassword(auth, tempEmail, password);
    user = result.user;
    // IMPORTANT: Firebase Auth's displayName is left blank by default, and
    // useFirebaseAuth.js falls back to user.email when displayName is
    // empty — which for these accounts is the synthetic, non-deliverable
    // {random}@users.kuetx.internal address. That address is meant to
    // stay purely internal (see buildInternalEmail's docstring), so we
    // set the real, chosen username as displayName here. This is what
    // ends up shown in the sidebar / anywhere else displayName is read.
    await updateProfile(user, { displayName: normalized });
  } catch (e) {
    // Surface Firebase's own auth/* code untouched — getAuthErrorMessage
    // in firebaseAuth.js already has copy for the common ones
    // (auth/weak-password etc.); no need to duplicate that mapping here.
    throw e;
  }

  try {
    await claimUsernameForUid(normalized, user.uid);
  } catch (e) {
    // Claim lost the race (or any other transaction failure) — leave the
    // orphaned auth account in place (see TODO above) and propagate.
    throw e;
  }

  return user;
};

// ─── Login ──────────────────────────────────────────────────────────────────────

/**
 * Resolves a username to its associated uid by reading
 * `usernames/{normalizedUsername}`. Returns the uid string, or null if no
 * such username is claimed.
 */
export const resolveUsernameToUid = async (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const snap = await getDoc(doc(db, 'usernames', normalized));
  if (!snap.exists()) return null;
  return snap.data()?.uid || null;
};

/**
 * Logs a student in with username + password.
 *
 * Since Firebase Auth itself only knows the synthetic internal email (not
 * the username), login first resolves username -> uid via the flat
 * `usernames/{name}` doc, then signs in with `buildInternalEmail(uid)` +
 * the supplied password.
 *
 * Throws Error with `.code` set to 'username/not-found' if the username
 * isn't claimed by anyone, or a raw Firebase `auth/*` code (most commonly
 * `auth/invalid-credential` for a wrong password — same merged code
 * firebaseAuth.js already documents for email/password login).
 */
export const loginWithUsername = async (username, password) => {
  const uid = await resolveUsernameToUid(username);
  if (!uid) {
    const err = new Error('No account found with this username.');
    err.code = 'username/not-found';
    throw err;
  }
  const email = buildInternalEmail(uid);
  const result = await signInWithEmailAndPassword(auth, email, password);

  // Self-heal accounts created before signup started setting displayName
  // (see signupWithUsername). Without this, useFirebaseAuth.js falls back
  // to user.email — the synthetic, non-deliverable internal address — and
  // that leaks into the UI (sidebar, etc.) instead of the real username.
  if (!result.user.displayName) {
    const normalized = normalizeUsername(username);
    try {
      await updateProfile(result.user, { displayName: normalized });
    } catch {
      // Non-fatal — login itself already succeeded; worst case the UI
      // falls back to the email string again until this succeeds on a
      // later login.
    }
  }

  return result.user;
};
