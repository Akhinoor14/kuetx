/**
 * firebaseAuth.js — KUETx Firebase Authentication
 *
 * Supports:
 * - Anonymous login (use app without account)
 * - Google Sign-In
 * - Email/Password Sign-In & Registration
 * - Anonymous → permanent account upgrade (link)
 * - Sign out
 */

import {
  signInAnonymously,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';
import { checkEmailDomain } from './emailDomainCheck';

const googleProvider = new GoogleAuthProvider();

// BUGFIX: email was never trimmed/lowercased anywhere before being sent to
// Firebase. Firebase's own identitytoolkit backend treats a leading/trailing
// space (very common from mobile keyboard autocomplete or copy-paste) or
// mixed case as a DIFFERENT request from the same address typed cleanly —
// register with " User@Gmail.com", then later login/reset with
// "user@gmail.com" (no stray space), and it fails with auth/invalid-credential
// even though it's obviously the same person/account. One normalization
// helper here means every function below benefits automatically — no caller
// can forget it.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// ─── Auth state listener ──────────────────────────────────────────────────────

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

export const getCurrentUser = () => auth.currentUser;

export const isAnonymous = () => auth.currentUser?.isAnonymous ?? true;

// ─── Anonymous login ──────────────────────────────────────────────────────────

export const loginAnonymously = async () => {
  const result = await signInAnonymously(auth);
  return result.user;
};

// ─── Google Sign-In ───────────────────────────────────────────────────────────

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

// ─── Email/Password ───────────────────────────────────────────────────────────

export const registerWithEmail = async (email, password, displayName) => {
  email = normalizeEmail(email);
  const domainCheck = await checkEmailDomain(email);
  if (!domainCheck.ok) {
    const err = new Error('Email domain rejected');
    err.code = 'auth/domain-not-real';
    err.domainReason = domainCheck.reason;
    err.domainSuggestion = domainCheck.suggestion || null;
    throw err;
  }
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  // Prove the address is actually reachable — MX check only proves the
  // domain CAN receive mail, not that this exact inbox exists or that
  // the person typing it owns it. Firebase's own verification link is
  // what actually confirms that, and it's what password-recovery will
  // rely on later, so we send it right away rather than leaving it for
  // the person to notice is missing.
  try {
    await sendEmailVerification(result.user);
  } catch {
    // Non-fatal — account still exists, verification banner in-app will
    // offer a resend button if this initial send failed (e.g. quota).
  }
  return result.user;
};

// ─── Email verification status ───────────────────────────────────────────────
// Firebase's emailVerified flag on the user object is only refreshed on
// token refresh / re-login by default. Call reloadUser() after the person
// says "I clicked the link" so the UI can immediately reflect the new state
// instead of waiting for their next sign-in.

export const isEmailVerified = () => {
  const user = auth.currentUser;
  if (!user) return false;
  // Accounts that never went through email/password registration (Google,
  // anonymous) aren't subject to this gate at all — only flag email/password
  // accounts with an unverified address.
  const isEmailPasswordAccount = user.providerData.some((p) => p.providerId === 'password');
  if (!isEmailPasswordAccount) return true;
  return !!user.emailVerified;
};

export const resendVerificationEmail = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  await sendEmailVerification(user);
};

export const reloadUser = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  return auth.currentUser;
};

export const loginWithEmail = async (email, password) => {
  email = normalizeEmail(email);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

// ─── Password reset ───────────────────────────────────────────────────────────
// Sends a reset link to the given email via Firebase's hosted reset flow.
// Firebase handles the actual password change page - no custom UI needed for that part.
//
// KNOWN GAP (intentional, not an oversight — do not "fix" by adding a
// domain check here): accounts registered with a fake/unreachable email
// BEFORE emailDomainCheck.js's gate went live in AuthModal can silently
// fail to receive this reset email — Firebase does not reveal whether
// the send succeeded to a real inbox, by design, to avoid leaking which
// emails have accounts. There is no client-side fix for that: we can't
// domain-check here and block, because a legitimate user typing a
// CORRECT email that just doesn't have an account yet would then get a
// scary rejection instead of Firebase's normal "check your inbox"
// (Firebase intentionally doesn't distinguish "no account" from "sent"
// either, same privacy reasoning). The only real rescue path for a
// pre-existing fake-email account is the emailFlags.js human-review
// system (CL/SCL/Admin flags it, owner fixes it or exports a JSON
// backup via the banner) — see emailFlags.js's file header.
export const resetPassword = async (email) => {
  email = normalizeEmail(email);
  await sendPasswordResetEmail(auth, email);
};

// ─── Upgrade anonymous → real account ────────────────────────────────────────
// Called when an anonymous user wants to "save" their data permanently.
// All existing Firestore data (written under their anonymous uid) stays intact.

export const upgradeWithGoogle = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  const result = await linkWithPopup(user, googleProvider);
  return result.user;
};

export const upgradeWithEmail = async (email, password, displayName) => {
  email = normalizeEmail(email);
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  const domainCheck = await checkEmailDomain(email);
  if (!domainCheck.ok) {
    const err = new Error('Email domain rejected');
    err.code = 'auth/domain-not-real';
    err.domainReason = domainCheck.reason;
    err.domainSuggestion = domainCheck.suggestion || null;
    throw err;
  }
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, credential);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  try {
    await sendEmailVerification(result.user);
  } catch {
    // non-fatal, same as registerWithEmail
  }
  return result.user;
};

// ─── Sign out ─────────────────────────────────────────────────────────────────

export const logout = async () => {
  await signOut(auth);
};

// ─── Error messages in Bangla/English ────────────────────────────────────────

export const getAuthErrorMessage = (code) => {
  const messages = {
    'auth/email-already-in-use': 'This email address is already in use.',
    'auth/invalid-email': 'The email address is invalid.',
    'auth/weak-password': 'The password must be at least 6 characters long.',
    'auth/user-not-found': 'There is no account with this email address.',
    'auth/wrong-password': 'The password is incorrect.',
    // BUGFIX: modern Firebase (v9.6.0+) no longer returns the specific
    // auth/user-not-found / auth/wrong-password codes above for a failed
    // email+password sign-in — it merges both into one generic
    // auth/invalid-credential, deliberately, so a client can't be used to
    // enumerate which emails have accounts (typing random emails and
    // watching which error comes back would otherwise leak that). Neither
    // code above was actually being hit anymore, so every failed login
    // fell through to the raw `Login error: auth/invalid-credential`
    // fallback instead of a helpful message. This covers both real causes
    // (wrong password, or no account with this email) honestly in one line,
    // without revealing which one it actually was.
    'auth/invalid-credential': 'The email address or password is incorrect. Please check your details and try again.',
    'auth/too-many-requests': 'Too many attempts were made. Please try again later.',
    'auth/popup-closed-by-user': 'The sign-in popup was closed.',
    'auth/credential-already-in-use': 'This Google account is already linked to another account.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/missing-email': 'Please enter an email address.',
    'auth/provider-already-linked': 'This account already has an email linked to it.',
    'auth/requires-recent-login': 'Please sign in again for security reasons.',
    'auth/domain-not-real': 'This email address does not appear to be able to receive mail. Please check the spelling or use a different email address.',
  };
  return messages[code] || `Login error: ${code}`;
};