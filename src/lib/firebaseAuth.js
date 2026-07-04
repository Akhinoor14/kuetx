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
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';

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
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  return result.user;
};

export const loginWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

// ─── Password reset ───────────────────────────────────────────────────────────
// Sends a reset link to the given email via Firebase's hosted reset flow.
// Firebase handles the actual password change page - no custom UI needed for that part.

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
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, credential);
  if (displayName) {
    await updateProfile(result.user, { displayName });
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
  };
  return messages[code] || `Login error: ${code}`;
};