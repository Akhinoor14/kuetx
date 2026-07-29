/**
 * providerPhoneAuth.js — KUETx Service Provider Phone+Password Auth
 *
 * Service providers (salon, medicine shop, hotel, book store, photocopy/
 * stationery shop, etc.) are not KUET students or faculty, so neither the
 * institutional-email gate (faculty) nor a chosen username (student) fits.
 * Instead, the provider's own 11-digit mobile number (01XXXXXXXXX) IS the
 * login identity — the same number the Founder already calls to verify
 * them, so there's nothing extra to remember.
 *
 * This is a direct structural copy of studentUsernameAuth.js's pattern:
 * Firebase Auth is still email/password under the hood; we synthesize a
 * stable, non-deliverable internal email per account
 * (`{uid}@users.kuetx.internal` — same domain/helper studentUsernameAuth.js
 * uses, so both modules resolve to logins that can never collide with a
 * real email address). Phone -> uid lookup happens via a flat
 * `providerPhones/{normalizedPhone}` Firestore doc, claimed transactionally
 * so two signups racing for the same number can't both win.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc,
  runTransaction,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { buildInternalEmail } from './studentUsernameAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

// Exactly 11 digits, must start with 01 (Bangladeshi mobile format).
const PHONE_RE = /^01[0-9]{9}$/;

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Normalizes a raw phone number to its canonical stored/lookup form:
 * strips everything except digits. Does NOT validate — call
 * isValidProviderPhone separately.
 */
export const normalizeProviderPhone = (phone) => String(phone || '').replace(/\D/g, '');

/**
 * Validates provider phone policy: exactly 11 digits, starting with "01".
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export const isValidProviderPhone = (phone) => {
  const normalized = normalizeProviderPhone(phone);
  if (!normalized) {
    return { ok: false, reason: 'ফোন নাম্বার আবশ্যক।' };
  }
  if (normalized.length !== 11) {
    return { ok: false, reason: 'ফোন নাম্বার অবশ্যই ১১ ডিজিটের হতে হবে।' };
  }
  if (!PHONE_RE.test(normalized)) {
    return { ok: false, reason: 'ফোন নাম্বার অবশ্যই 01 দিয়ে শুরু হতে হবে (যেমন: 01712345678)।' };
  }
  return { ok: true };
};

/**
 * Validates password policy: minimum 8 characters, at least 1 letter + 1 digit.
 * Same policy as studentUsernameAuth.js's isValidPassword — kept as a
 * separate local copy rather than importing it, since the two modules are
 * meant to be independently readable and this rule is trivial enough not
 * to be worth a shared-utils dependency between them.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export const isValidProviderPassword = (password) => {
  const value = String(password || '');
  if (value.length < 8) {
    return { ok: false, reason: 'পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।' };
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, reason: 'পাসওয়ার্ডে অন্তত ১টা অক্ষর এবং ১টা সংখ্যা থাকতে হবে।' };
  }
  return { ok: true };
};

// ─── Phone availability ─────────────────────────────────────────────────────

/**
 * Checks whether a phone number is currently available (not present in
 * `providerPhones/{normalizedPhone}`). Plain read for live availability-
 * check UI — the actual claim at signup time still goes through the
 * transaction below to close the race-condition window between this check
 * and the real claim.
 *
 * Returns { available: boolean, reason?: string } — reason is set when the
 * phone fails policy validation (in which case availability is not
 * meaningfully defined).
 */
export const checkProviderPhoneAvailable = async (phone) => {
  const validation = isValidProviderPhone(phone);
  if (!validation.ok) {
    return { available: false, reason: validation.reason };
  }
  const normalized = normalizeProviderPhone(phone);
  const snap = await getDoc(doc(db, 'providerPhones', normalized));
  return { available: !snap.exists() };
};

// ─── Transactional claim ───────────────────────────────────────────────────────
// Same caveat as studentUsernameAuth.js's claimUsernameForUid: this
// client-side transaction protects against two clients racing for the same
// number, but not against a client bypassing this module and writing
// straight to providerPhones/{phone} — that needs a firestore.rules entry
// mirroring the existing usernames/{name} one (see that file's own TODO).

const claimPhoneForUid = async (normalizedPhone, uid) => {
  const ref = doc(db, 'providerPhones', normalizedPhone);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data()?.uid !== uid) {
      const err = new Error('এই ফোন নাম্বার দিয়ে ইতিমধ্যে একটা account আছে।');
      err.code = 'providerPhone/taken';
      throw err;
    }
    tx.set(ref, { uid, createdAt: serverTimestamp() }, { merge: true });
  });
};

/**
 * Releases a phone claim (best-effort cleanup). Used when account creation
 * fails after the phone was claimed, so the number isn't permanently
 * burned by a failed signup attempt.
 */
const releasePhoneClaim = async (normalizedPhone) => {
  try {
    await deleteDoc(doc(db, 'providerPhones', normalizedPhone));
  } catch {
    // Best-effort only, same as studentUsernameAuth.js's releaseUsernameClaim.
  }
};

// ─── Signup ─────────────────────────────────────────────────────────────────────

/**
 * Signs up a new service provider with phone number + password.
 *
 * Flow (mirrors signupWithUsername exactly, phone in place of username):
 *  1. Validate phone + password policy.
 *  2. Availability pre-check.
 *  3. Create the Firebase Auth account with a temporary synthetic email.
 *  4. Transactionally claim `providerPhones/{normalizedPhone}` for the new uid.
 *  5. If the claim fails (lost the race), the Firebase account already
 *     exists with no phone claim attached — left for the caller to handle,
 *     same as the student path.
 *
 * Returns the Firebase `user` object on success.
 * Throws Error with `.code` set to one of:
 *   'providerPhone/invalid', 'password/invalid', 'providerPhone/taken',
 *   or a raw Firebase `auth/*` code.
 */
export const signupWithProviderPhone = async (phone, password) => {
  const phoneCheck = isValidProviderPhone(phone);
  if (!phoneCheck.ok) {
    const err = new Error(phoneCheck.reason);
    err.code = 'providerPhone/invalid';
    throw err;
  }
  const passwordCheck = isValidProviderPassword(password);
  if (!passwordCheck.ok) {
    const err = new Error(passwordCheck.reason);
    err.code = 'password/invalid';
    throw err;
  }

  const normalized = normalizeProviderPhone(phone);

  const availability = await checkProviderPhoneAvailable(normalized);
  if (!availability.available) {
    const err = new Error('এই ফোন নাম্বার দিয়ে ইতিমধ্যে একটা account আছে।');
    err.code = 'providerPhone/taken';
    throw err;
  }

  // Same temp-email-then-claim two-step as signupWithUsername — see that
  // function's own comment for why the temp email never needs to be
  // surfaced again.
  const tempEmail = buildInternalEmail(`provider-${normalized}-${Math.random().toString(36).slice(2, 10)}`);

  let user;
  try {
    const result = await createUserWithEmailAndPassword(auth, tempEmail, password);
    user = result.user;
  } catch (e) {
    throw e;
  }

  try {
    await claimPhoneForUid(normalized, user.uid);
  } catch (e) {
    throw e;
  }

  return user;
};

// ─── Login ──────────────────────────────────────────────────────────────────────

/**
 * Resolves a provider phone number to its associated uid by reading
 * `providerPhones/{normalizedPhone}`. Returns the uid string, or null if
 * no such number is claimed.
 */
export const resolveProviderPhoneToUid = async (phone) => {
  const normalized = normalizeProviderPhone(phone);
  if (!normalized) return null;
  const snap = await getDoc(doc(db, 'providerPhones', normalized));
  if (!snap.exists()) return null;
  return snap.data()?.uid || null;
};

/**
 * Logs a service provider in with phone number + password. Same
 * resolve-then-sign-in shape as loginWithUsername.
 *
 * Throws Error with `.code` set to 'providerPhone/not-found' if the number
 * isn't claimed by anyone, or a raw Firebase `auth/*` code.
 */
export const loginWithProviderPhone = async (phone, password) => {
  const uid = await resolveProviderPhoneToUid(phone);
  if (!uid) {
    const err = new Error('এই ফোন নাম্বার দিয়ে কোনো account পাওয়া যায়নি।');
    err.code = 'providerPhone/not-found';
    throw err;
  }
  const email = buildInternalEmail(uid);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};
