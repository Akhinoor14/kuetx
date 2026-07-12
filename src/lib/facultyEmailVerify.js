// facultyEmailVerify.js
//
// Faculty-side counterpart to kuetEmailVerify.js. Reuses the EXACT same
// passwordless magic-link mechanism (separate secondary Firebase App
// instance, sendSignInLinkToEmail / signInWithEmailLink) — the only real
// differences from the student version are:
//   1. Match rule is a DOMAIN SUFFIX check (*.kuet.ac.bd), not a fixed
//      name+roll regex — there's no curated per-teacher whitelist
//      (Deviation 1, MERGED_FACULTY_MODULE_PROMPT.md §2 item 1).
//   2. The durable Firestore record this writes is
//      verifiedFacultyEmails/{email}, a faculty-only sibling collection to
//      verifiedRolls/{roll} — kept separate so student and faculty
//      verification never share a namespace or a rules branch.
//   3. Deviation 2: for faculty this is a HARD GATE, not a soft badge —
//      until verifiedFacultyEmails/{email} exists, faculty/{uid}.verifiedAt
//      stays null and the whole Teacher shell stays locked (see
//      useIsFaculty.js / RequireFaculty.jsx).
//
// TEMP: testing bypass, remove before public launch — see Deviation 1b in
// MERGED_FACULTY_MODULE_PROMPT.md. This list skips ONLY the suffix check;
// the magic-link ownership-proof step below still applies in full to any
// address here, bypass or not. Do not add production teacher emails here —
// they should all naturally pass the real suffix rule.
const TESTING_BYPASS_EMAILS = ['guluvai479@gmail.com'];

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  setPersistence, inMemoryPersistence, signOut,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

const VERIFY_APP_NAME = 'kuetFacultyVerify';

function getVerifyApp() {
  return getApps().find((a) => a.name === VERIFY_APP_NAME) || initializeApp(firebaseConfig, VERIFY_APP_NAME);
}
const verifyAuth = getAuth(getVerifyApp());
const verifyDb = getFirestore(getVerifyApp()); // same project/database, Firestore auth context follows verifyAuth

// BUGFIX: same fix as kuetEmailVerify.js — verifyAuth used to default to
// browserLocalPersistence, leaving a real, persistent second Firebase Auth
// user in this browser's storage after every completed verification
// (visible in Firebase Console as a separate account from the teacher's
// actual main-session account — this is what showed up as "signing in
// connects two accounts/providers"). in-memory persistence plus the
// explicit signOut() after the Firestore write below means nothing
// outlives the single verification moment.
setPersistence(verifyAuth, inMemoryPersistence).catch(() => {});

// Any *.kuet.ac.bd subdomain matches (@ese.kuet.ac.bd, @me.kuet.ac.bd,
// @cse.kuet.ac.bd, etc.) — which department doesn't matter, cross-dept
// teaching assignments are common. @stud.kuet.ac.bd is a HARD EXCLUSION:
// structurally it matches *.kuet.ac.bd too, but it's the student
// subdomain and must never pass as faculty, no exception.
const FACULTY_DOMAIN_RE = /^[^\s@]+@([a-z0-9-]+\.)*kuet\.ac\.bd$/i;
const STUDENT_SUBDOMAIN_RE = /@stud\.kuet\.ac\.bd$/i;

const PENDING_EMAIL_KEY = 'kuetx_pending_faculty_verify_email';

/**
 * Does this email pass the faculty domain-suffix rule? This is a pure
 * format/domain check — it proves nothing about mailbox ownership on its
 * own, that's what the magic-link step below is for.
 */
export function isFacultyEmailFormat(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  if (TESTING_BYPASS_EMAILS.includes(trimmed.toLowerCase())) return true;
  if (STUDENT_SUBDOMAIN_RE.test(trimmed)) return false;
  return FACULTY_DOMAIN_RE.test(trimmed);
}

/** Best-guess department code from the subdomain, for profile pre-fill only — never trusted as a gate. */
export function guessDeptFromFacultyEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  const match = /^[^@]+@([a-z0-9-]+)\.kuet\.ac\.bd$/i.exec(trimmed);
  return match ? match[1] : null;
}

/**
 * Step 1: send the one-time sign-in link to a faculty email that already
 * passed isFacultyEmailFormat(). No account/password — Firebase just
 * emails the link. Safe to call again; only the most recently issued link
 * stays valid.
 */
export async function sendFacultyVerificationLink(email) {
  const trimmedEmail = String(email || '').trim();
  if (!isFacultyEmailFormat(trimmedEmail)) {
    throw new Error('This doesn\'t look like a KUET faculty email (expected something@<dept>.kuet.ac.bd).');
  }
  const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  };
  try {
    await sendSignInLinkToEmail(verifyAuth, trimmedEmail, actionCodeSettings);
  } catch (err) {
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error('Faculty email verification is not enabled yet (Email Link sign-in provider is off in Firebase Console) — this is a configuration issue, not a problem with your account.');
    }
    throw err;
  }
  window.localStorage.setItem(PENDING_EMAIL_KEY, trimmedEmail);
  return trimmedEmail;
}

/** Is the current page URL a faculty magic-link? Check at app boot before rendering the verify holding screen. */
export function isFacultyVerifyLink(url = window.location.href) {
  return isSignInWithEmailLink(verifyAuth, url);
}

// Same in-flight/duplicate-processing guard as kuetEmailVerify.js — avoids
// a spurious "already used" error if the same link gets processed twice
// concurrently (e.g. React StrictMode double-invoke, or two tabs racing).
const inFlightOrDoneOobCodes = new Map();

function extractOobCode(url) {
  try {
    return new URL(url).searchParams.get('oobCode');
  } catch {
    return null;
  }
}

/**
 * Step 2: complete sign-in from the clicked link. On success, writes
 * verifiedFacultyEmails/{email} using the secondary app's OWN
 * authenticated session (so the write genuinely carries proof of that
 * inbox), then the caller is responsible for setting faculty/{uid}.verifiedAt
 * from the MAIN session (facultySync.js) once it observes this record.
 *
 * Returns:
 *   - { status: 'not-a-link' }
 *   - { status: 'needs-email' }  — cross-device/cross-browser-profile case
 *   - { status: 'success', email }
 *   - { status: 'error', message }
 */
export async function completeFacultyVerificationLink(url = window.location.href, emailOverride = null) {
  if (!isSignInWithEmailLink(verifyAuth, url)) return { status: 'not-a-link' };

  const email = (emailOverride || window.localStorage.getItem(PENDING_EMAIL_KEY) || '').trim();
  if (!email) {
    return { status: 'needs-email' };
  }

  const oobCode = extractOobCode(url);
  if (oobCode && inFlightOrDoneOobCodes.has(oobCode)) {
    return inFlightOrDoneOobCodes.get(oobCode);
  }

  const attempt = (async () => {
    try {
      const result = await signInWithEmailLink(verifyAuth, email, url);
      window.localStorage.removeItem(PENDING_EMAIL_KEY);
      window.history.replaceState(null, '', window.location.pathname);

      const verifiedEmail = String(result.user.email || '').trim();
      try {
        await setDoc(doc(verifyDb, 'verifiedFacultyEmails', verifiedEmail), {
          verifiedAt: serverTimestamp(),
        }, { merge: true });
      } catch (writeErr) {
        if (writeErr?.code !== 'permission-denied') {
          await signOut(verifyAuth).catch(() => {});
          return { status: 'error', message: 'Sign-in succeeded but the verification record could not be saved. Please try again, or contact the developer if this keeps happening.' };
        }
      }
      // BUGFIX: sign out of the throwaway verify session the moment its
      // job (the Firestore write above) is done — the main session
      // (auth, from firebase.js, holding the teacher's actual account)
      // was never touched by any of this.
      await signOut(verifyAuth).catch(() => {});
      return { status: 'success', email: verifiedEmail };
    } catch (err) {
      window.history.replaceState(null, '', window.location.pathname);
      if (err?.code === 'auth/invalid-action-code') {
        return { status: 'error', message: 'This verification link was already used, or it expired (links last about 1 hour). No account or password was ever created here — just request a new link below.' };
      }
      if (err?.code === 'auth/invalid-email') {
        return { status: 'error', message: 'This doesn\'t match the email the link was sent to. Please enter the exact same address.' };
      }
      return { status: 'error', message: err?.message || 'Verification could not be completed. Please try again.' };
    }
  })();

  if (oobCode) inFlightOrDoneOobCodes.set(oobCode, attempt);
  return attempt;
}

/**
 * Read-only check from the MAIN session — does this email already have a
 * recorded, mailbox-proven verification? Plain exists()-style read.
 */
export async function isFacultyEmailVerified(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  const snap = await getDoc(doc(db, 'verifiedFacultyEmails', trimmed));
  return snap.exists();
}
