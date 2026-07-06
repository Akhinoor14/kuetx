// adminAuth.js
//
// Admin status is derived from the main app's already-signed-in session
// (Google sign-in via `auth` in firebase.js). The `admins/{uid}` Firestore
// doc is the single source of truth for who's an owner — this file just
// exposes a helper to check that doc against a given uid.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Checks the `admins/{uid}` doc — the single source of truth for who's an owner. */
export async function checkIsAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}