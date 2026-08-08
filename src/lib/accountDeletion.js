// accountDeletion.js
//
// Client-side caller for the deleteMyAccount Cloud Function (see
// functions/index.js for the full list of what gets wiped and why this
// has to be a server-side Admin SDK operation rather than a client-side
// Firestore delete). This file only handles the call + local sign-out;
// all the actual data destruction happens server-side.
//
// Confirmation is double-enforced: the modal requires typing/pasting the
// signed-in account's own email before this even gets called, AND the
// Cloud Function independently re-checks that same match server-side
// (request.data.confirm must equal the caller's real email) — so a
// tampered client can't skip the check.

import { httpsCallable } from 'firebase/functions';
import { functions, auth } from './firebase';
import { clearLocalDataOnLogout } from './accountLifecycle';

/**
 * Permanently deletes the signed-in account: every Firestore doc this
 * account owns (personal data, role docs, group memberships, etc.) and
 * the Firebase Auth user itself. Irreversible.
 *
 * @param {string} confirmText - must exactly match auth.currentUser.email
 *   (case-insensitive, trimmed) or the call is rejected server-side too.
 * @returns {Promise<void>}
 */
export async function deleteMyAccount(confirmText) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const call = httpsCallable(functions, 'deleteMyAccount');
  await call({ confirm: confirmText });

  // Server-side data is gone; clear this device's local copy too (same
  // helper Settings.jsx's normal logout uses) so nothing from the deleted
  // account lingers in localStorage/IndexedDB, then drop the now-defunct
  // local Auth session so onAuthChange fires and the app routes back to
  // a fresh sign-in screen instead of holding a session for a deleted user.
  await clearLocalDataOnLogout();
  try {
    await auth.signOut();
  } catch {
    // Already effectively signed out from the server's perspective;
    // nothing more to do even if this throws.
  }
}
