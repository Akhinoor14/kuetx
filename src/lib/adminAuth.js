// adminAuth.js
//
// Admin login is deliberately isolated from the main app's Firebase Auth
// instance. If it reused `auth` from firebase.js, signing in as admin
// would replace the currently signed-in student session (even if that
// student is the same person, i.e. the site owner using their own
// device), and logging back out would create a *brand new* anonymous
// session — silently orphaning whatever personal cloud data was linked
// to the previous one.
//
// Using a second named Firebase App instance (same project) gives the
// admin flow its own isolated Auth state. Firebase's Firestore/Storage
// SDKs are keyed by project, not by app instance, so `adminAuth.currentUser.uid`
// still works against the exact same `admins/{uid}` documents.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseConfig, db } from './firebase';

const ADMIN_APP_NAME = 'admin';

function getAdminApp() {
  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  return existing || initializeApp(firebaseConfig, ADMIN_APP_NAME);
}

export const adminAuth = getAuth(getAdminApp());

/**
 * Attempts admin sign-in. Returns { ok: true } on success, or
 * { ok: false, reason } on failure. Never touches the main `auth` object.
 */
export async function adminSignIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(adminAuth, email, password);
    const isAdmin = await checkIsAdmin(cred.user.uid);
    if (!isAdmin) {
      await signOut(adminAuth);
      return { ok: false, reason: 'not-authorized' };
    }
    return { ok: true, uid: cred.user.uid };
  } catch (e) {
    return { ok: false, reason: e?.code || 'unknown-error' };
  }
}

/** Checks the `admins/{uid}` doc — the single source of truth for who's an owner. */
export async function checkIsAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

export async function adminSignOut() {
  await signOut(adminAuth);
}
