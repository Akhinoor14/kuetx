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
    'auth/email-already-in-use': 'এই email দিয়ে আগেই account আছে।',
    'auth/invalid-email': 'Email address টা valid না।',
    'auth/weak-password': 'Password কমপক্ষে ৬ character হতে হবে।',
    'auth/user-not-found': 'এই email দিয়ে কোনো account নেই।',
    'auth/wrong-password': 'Password ভুল।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করো।',
    'auth/popup-closed-by-user': 'Login popup বন্ধ হয়ে গেছে।',
    'auth/credential-already-in-use': 'এই Google account অন্য একটা account এ already linked।',
    'auth/network-request-failed': 'Network error। Internet connection check করো।',
    'auth/missing-email': 'Email address দাও।',
    'auth/provider-already-linked': 'তোমার account-এ আগে থেকেই একটা email linked আছে।',
    'auth/requires-recent-login': 'নিরাপত্তার জন্য আবার login করে আসতে হবে।',
    'auth/domain-not-real': 'এই email address-এ mail পৌঁছাবে না মনে হচ্ছে। বানান চেক করো, বা Google দিয়ে login করো।',
  };
  return messages[code] || `Login error: ${code}`;
};