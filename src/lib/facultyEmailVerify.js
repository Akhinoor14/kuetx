// facultyEmailVerify.js
//
// Faculty-side counterpart to kuetEmailVerify.js — same passwordless
// magic-link mechanism (secondary Firebase App instance, no password ever
// created/seen), but two things are deliberately different here per the
// Faculty Module merged prompt (Deviations 1 + 2):
//
//   1. No curated whitelist. Any email whose domain ends in *.kuet.ac.bd
//      is accepted at the format-check stage, EXCEPT @stud.kuet.ac.bd
//      (hard-excluded, no exception — that's the student subdomain).
//      Which specific department subdomain doesn't matter; cross-department
//      assignments are common, so gating by exact dept suffix would
//      incorrectly reject legitimate teachers.
//
//   2. This is a HARD GATE, not a soft badge. Since there's no whitelist to
//      fall back on, proving mailbox ownership via the magic link is the
//      ONLY real evidence that the signer-upper is genuine KUET faculty.
//      useIsFaculty()/RequireFaculty.jsx will not unlock the Teacher shell
//      until verifiedFacultyEmails/{email} exists AND faculty/{uid}.verifiedAt
//      is set (facultySync.js writes that field once this resolves).
//
// Everything else (secondary app instance so the visitor's real session is
// never touched, single-use ~1hr link, in-flight oobCode de-dupe, cleaned
// URL after consumption) mirrors kuetEmailVerify.js exactly — see that file
// for the detailed rationale comments, not repeated here.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebase';

const VERIFY_APP_NAME = 'kuetFacultyVerify';

function getVerifyApp() {
  return getApps().find((a) => a.name === VERIFY_APP_NAME) || initializeApp(firebaseConfig, VERIFY_APP_NAME);
}
const verifyAuth = getAuth(getVerifyApp());
const verifyDb = getFirestore(getVerifyApp()); // same project, but Firestore auth context follows verifyAuth

// Any KUET subdomain (dept-specific or otherwise), case-insensitive, but
// NEVER the student subdomain — that exclusion is checked first and wins
// even though it would otherwise structurally match the wildcard below.
const STUDENT_SUBDOMAIN_RE = /@stud\.kuet\.ac\.bd$/i;
const KUET_ANY_SUBDOMAIN_RE = /@[a-z0-9-]+\.kuet\.ac\.bd$/i;

const PENDING_EMAIL_KEY = 'kuetx_pending_faculty_verify_email';

/**
 * Format/suffix check only — does this look like a real (non-student) KUET
 * institutional email? This is the first gate in signup (§5 Step 2 of the
 * merged prompt): fails here → blocked immediately, no further step, no
 * "request access" fallback (Deviation 2 makes this a hard requirement).
 */
export function isFacultyEmailFormat(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  if (STUDENT_SUBDOMAIN_RE.test(trimmed)) return false; // hard exclusion, no exception
  return KUET_ANY_SUBDOMAIN_RE.test(trimmed);
}

/** Best-effort department guess from the subdomain, for pre-filling the
 * (editable) Department field in Faculty Profile Setup — NOT authoritative,
 * since a teacher's email domain doesn't always match the department they
 * actually teach in (cross-dept assignment is common per Deviation 1). */
export function guessDeptFromFacultyEmail(email) {
  const trimmed = String(email || '').trim();
  const match = /@([a-z0-9-]+)\.kuet\.ac\.bd$/i.exec(trimmed);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Step: send the one-time sign-in link to the candidate faculty email.
 * No account, no password — just an email, exactly like the student flow.
 */
export async function sendFacultyVerificationLink(email) {
  const trimmedEmail = String(email || '').trim();
  if (!isFacultyEmailFormat(trimmedEmail)) {
    throw new Error('This doesn\'t look like a valid KUET institutional email address.');
  }
  const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  };
  try {
    await sendSignInLinkToEmail(verifyAuth, trimmedEmail, actionCodeSettings);
  } catch (err) {
    if (err?.code === 'auth/operation-not-allowed') {
      throw new Error('Email link sign-in isn\'t enabled on this project yet — this is a configuration issue, not a problem with your account.');
    }
    throw err;
  }
  window.localStorage.setItem(PENDING_EMAIL_KEY, trimmedEmail);
  return true;
}

/** Is the current page URL itself a faculty sign-in link? Check at app
 * boot before rendering the verification widget, same as the student flow. */
export function isFacultyVerifyLink(url = window.location.href) {
  return isSignInWithEmailLink(verifyAuth, url);
}

// Guards against double-processing the same link (StrictMode double-invoke,
// two tabs racing) — identical rationale to kuetEmailVerify.js.
const inFlightOrDoneOobCodes = new Map();

function extractOobCode(url) {
  try {
    return new URL(url).searchParams.get('oobCode');
  } catch {
    return null;
  }
}

/**
 * Complete the sign-in using the clicked link. Returns a plain result object
 * (never throws/prompts) so the caller can render a proper in-app holding
 * screen:
 *   - { status: 'not-a-link' }
 *   - { status: 'needs-email' }  — cross-device/browser-profile case
 *   - { status: 'success', email }
 *   - { status: 'error', message }
 *
 * On success this records verifiedFacultyEmails/{email} in Firestore — the
 * durable mailbox-ownership proof that facultySync.js checks before setting
 * faculty/{uid}.verifiedAt on the main session.
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
          return { status: 'error', message: 'Sign-in succeeded, but the verification record could not be saved. Please try again.' };
        }
      }
      return { status: 'success', email: verifiedEmail };
    } catch (err) {
      window.history.replaceState(null, '', window.location.pathname);
      if (err?.code === 'auth/invalid-action-code') {
        return { status: 'error', message: 'This verification link was already used or has expired (links last about 1 hour). Request a new one below.' };
      }
      if (err?.code === 'auth/invalid-email') {
        return { status: 'error', message: 'This doesn\'t match the address the link was sent to. Please enter the exact same email.' };
      }
      return { status: 'error', message: err?.message || 'Could not complete verification. Please try again.' };
    }
  })();

  if (oobCode) inFlightOrDoneOobCodes.set(oobCode, attempt);
  return attempt;
}

/**
 * Read-only check from the MAIN session — does this email already have a
 * recorded institutional verification? Cheap exists()-style read, used by
 * facultySync.js right before setting faculty/{uid}.verifiedAt.
 */
export async function isFacultyEmailInstitutionallyVerified(email, mainDb) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  const snap = await getDoc(doc(mainDb, 'verifiedFacultyEmails', trimmed));
  return snap.exists();
}
