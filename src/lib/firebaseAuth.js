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
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  linkWithPopup,
  linkWithRedirect,
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
// BUGFIX (redirect sign-in silently stuck / getRedirectResult() always
// null): this used to be unconditionally signInWithRedirect() everywhere,
// reasoning that popups can be blocked by popup-blockers or break inside
// mobile in-app webviews (Facebook/Instagram/Messenger). That reasoning
// was right, but it missed a bigger, now-mandatory constraint: Firebase's
// redirect flow relies on a cross-origin iframe between this app's domain
// (www.kuetx.com) and the Firebase-hosted authDomain
// (kuetx-8a184.firebaseapp.com) to hand the signed-in result back after
// the redirect returns. Since Chrome M115 (already true on Firefox 109+/
// Safari 16.1+), browsers that block third-party storage access break
// that iframe silently — signInWithRedirect() itself succeeds and the
// user completes sign-in on Google's side, but getRedirectResult() comes
// back null on return, with no error thrown. See:
// https://firebase.google.com/docs/auth/web/redirect-best-practices
// The supported fixes are (a) serve the authDomain from this app's own
// domain + Firebase Hosting proxy — a real infra change, not a code
// change, or (b) use signInWithPopup() instead, which doesn't depend on
// that iframe at all. We use (b) as the primary path now, since it's the
// one that requires no hosting/DNS changes and fixes the flow immediately
// on every desktop browser. Redirect is kept as an automatic fallback
// only for the specific case popups genuinely can't handle (blocked, or
// unsupported in an in-app webview), so that narrower case still degrades
// gracefully instead of leaving the person stuck.

const POPUP_UNSUPPORTED_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-closed-by-user', // treat as "try redirect", not a hard failure
]);

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    if (POPUP_UNSUPPORTED_CODES.has(err?.code)) {
      console.warn('[KUETx Auth] Popup sign-in unavailable, falling back to redirect:', err?.code);
      await signInWithRedirect(auth, googleProvider);
      return null; // page is navigating away; result picked up by handleGoogleRedirectResult()
    }
    throw err;
  }
};

// Only still needed for the redirect fallback path above (popup-blocked /
// in-app-webview case). Resolves to the user if a redirect-based sign-in
// completed, or null if the app just loaded normally (no redirect was in
// progress, or this is the normal popup-based path where nothing gets
// left pending). Throws the original Firebase error (e.g.
// auth/credential-already-in-use during an upgrade attempt) if the
// redirect completed with a failure — callers should catch this.
export const handleGoogleRedirectResult = async () => {
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
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
  // Accounts that never went through REAL email/password registration
  // (Google, anonymous) aren't subject to this gate at all — only flag
  // genuine email/password accounts with an unverified, reachable address.
  //
  // Student accounts created via studentUsernameAuth.js are ALSO
  // providerId === 'password' under the hood (Firebase Auth requires an
  // email string for that provider), but the "email" is a synthesized,
  // non-deliverable placeholder ({uid}@users.kuetx.internal — see
  // studentUsernameAuth.js) that no verification link can ever reach.
  // Without this check, every username-based student got stuck staring
  // at a permanently-unresolvable "verify your email" banner. Those
  // accounts are verified a different way entirely (manual CR/ACR/CL
  // approval — see member.verified / subscribeOwnMemberVerified), so
  // this reachability gate simply doesn't apply to them.
  const isEmailPasswordAccount = user.providerData.some((p) => p.providerId === 'password');
  if (!isEmailPasswordAccount) return true;
  const isInternalSyntheticAccount = (user.email || '').toLowerCase().endsWith('@users.kuetx.internal');
  if (isInternalSyntheticAccount) return true;
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
  // Same popup-first / redirect-fallback reasoning as loginWithGoogle
  // above. auth/credential-already-in-use (this Google account already
  // belongs to a real, non-anonymous account — can't link it to a new
  // anonymous uid) can surface directly from the popup call now; the
  // redirect-fallback case still surfaces it from getRedirectResult()
  // after the page reloads (handled in useFirebaseAuth.js) — both paths
  // throw the same error code either way.
  try {
    const result = await linkWithPopup(user, googleProvider);
    return result.user;
  } catch (err) {
    if (POPUP_UNSUPPORTED_CODES.has(err?.code)) {
      console.warn('[KUETx Auth] Popup upgrade unavailable, falling back to redirect:', err?.code);
      await linkWithRedirect(user, googleProvider);
      return null;
    }
    throw err;
  }
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

// BUGFIX (stale role flash after account switch/sign-out): useIsFaculty.js
// and useIsProvider.js each cache their last-known status in sessionStorage
// (CACHE_KEY in each file) purely as a same-tab optimistic-paint
// optimization — but nothing ever cleared those keys on sign-out, so
// switching accounts in the same tab (or a session that outlives a
// sign-out) could start the NEXT account's hooks from the PREVIOUS
// account's cached isProvider/isFaculty value. Since Sidebar.jsx/
// Navbar.jsx/NoCRBanner.jsx/etc. all read these hooks' values, that
// stale-false cache is what caused the brief student-shell flash on a
// provider account's first paint (see Sidebar.jsx's doc comment for the
// full chain — this is the actual root fix, upstream of all the
// isResolved guards added there, which remain in place as defence in
// depth for the same-tab-race case this can't fully close: e.g. a
// background tab whose hooks are already resolved with the old account's
// values won't re-run this until its own onAuthStateChanged fires).
const ROLE_STATUS_CACHE_KEYS = [
  'kuetx:lastKnownFacultyStatus',
  'kuetx:lastKnownProviderStatus',
  'kuetx:lastKnownIsRealCR',
];

function clearRoleStatusCaches() {
  ROLE_STATUS_CACHE_KEYS.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  });
}

export const logout = async () => {
  await signOut(auth);
  clearRoleStatusCaches();
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