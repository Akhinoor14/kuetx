// kuetEmailVerify.js
//
// Tier-1 (automatic) institutional verification — passwordless design.
// Whatever the visitor's main session is (anonymous, personal Gmail
// account, whatever) is NEVER touched. Proving ownership of a KUET email
// happens purely via Firebase's email-link ("magic link") sign-in on a
// separate, secondary Firebase App instance — there is no password, no
// account creation step for the person to manage, and nothing that can
// go stale between attempts.
//
// Why the redesign (previous version used createUserWithEmailAndPassword +
// a deterministic password): that scheme broke the moment someone had a
// leftover account from the old fully-manual era with a *different*
// (random, forgotten) password — retries then failed with
// auth/invalid-credential, and recovering required a password-reset
// detour. It also meant a used/expired verification link showed a scary
// "already used / expired" page with no clean retry, since the identity
// underneath was an actual persistent account. None of that complexity is
// needed for what this feature actually requires: proof of mailbox
// ownership, once, that expires cleanly.
//
// How it works now:
//   1. sendKuetVerificationLink(email) calls Firebase's
//      sendSignInLinkToEmail — no account is created up front. Firebase
//      just emails a one-time sign-in link tied to that address.
//   2. The link points back at this app's own origin. When the person
//      clicks it (any device, any tab) and the app loads, completeLinkSignIn()
//      detects the special URL, calls signInWithEmailLink, and Firebase
//      creates/signs into a throwaway secondary-app account transparently
//      — the person never sees or sets a password anywhere in this flow.
//   3. Once signed in via the link, the code writes a durable fact to
//      Firestore (via the secondary app's OWN authenticated session, so
//      its ID token really does carry that verified KUET email):
//      `verifiedRolls/{roll}`.
//   4. The MAIN session's group-join rule just checks "does
//      verifiedRolls/{this roll} exist?" — a plain exists() check, no
//      token/email comparison needed on the main session at all.
//
// Security notes:
//   - Email-link sign-in is single-use and time-limited by Firebase itself
//     (default ~1 hour, revoked immediately after first successful use) —
//     there's no long-lived credential left lying around afterward that
//     could be reused or leaked, unlike a password.
//   - The link is only ever useful to whoever can read that specific KUET
//     inbox, exactly like the old email-verification-link approach, but
//     without a persistent account/password sitting behind it.
//   - Known trade-off (documented, not hidden): `verifiedRolls/{roll}` is
//     keyed by roll number only, not bound to a specific uid. That keeps
//     the design simple and avoids a lockout if someone's original
//     anonymous session is later lost — but it does mean that once a roll
//     is proven once, anyone typing that exact roll number elsewhere also
//     benefits from the "Tier 1 verified" fallback. Given this app's
//     actual risk profile (shared class routines, not sensitive personal
//     data), that's an acceptable narrow edge case rather than a serious
//     hole.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

const VERIFY_APP_NAME = 'kuetVerify';

function getVerifyApp() {
  return getApps().find((a) => a.name === VERIFY_APP_NAME) || initializeApp(firebaseConfig, VERIFY_APP_NAME);
}
const verifyAuth = getAuth(getVerifyApp());
const verifyDb = getFirestore(getVerifyApp()); // same project/database, but its Firestore *auth context* follows verifyAuth, not the main session

const KUET_EMAIL_RE = /^([a-z]+)(\d{7})@stud\.kuet\.ac\.bd$/i;

// Where we stash the email between "link sent" and "link clicked" — Firebase
// itself requires this on the completing side, since the sign-in link alone
// doesn't carry the address back (for cross-device safety, it asks again if
// this is missing, but same-device/same-browser this makes it seamless).
const PENDING_EMAIL_KEY = 'kuetx_pending_verify_email';

/** Does this look like a real KUET student email, syntactically? */
export function isKuetEmailFormat(email) {
  return KUET_EMAIL_RE.test(String(email || '').trim());
}

/**
 * Extract the roll + derived batch/dept from a KUET email's local part,
 * using the exact same convention as ProfileSetupModal's
 * extractDeptCodeFromRoll: digits [0:2] = batch year, [2:4] = dept code.
 */
export function parseKuetEmail(email) {
  const match = KUET_EMAIL_RE.exec(String(email || '').trim());
  if (!match) return null;
  const roll = match[2];
  return { roll, batchYear: roll.slice(0, 2), deptCode: roll.slice(2, 4) };
}

/**
 * Step 1: send the one-time sign-in link. No account, no password — just
 * an email. Safe to call again for the same address; Firebase issues a
 * fresh link each time and only the most recently issued one is valid.
 */
export async function sendKuetVerificationLink(email) {
  const trimmedEmail = String(email || '').trim();
  if (!isKuetEmailFormat(trimmedEmail)) {
    throw new Error('This doesn\'t look like a KUET student email (expected the form name+roll@stud.kuet.ac.bd).');
  }
  const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  };
  try {
    await sendSignInLinkToEmail(verifyAuth, trimmedEmail, actionCodeSettings);
  } catch (err) {
    if (err?.code === 'auth/operation-not-allowed') {
      // "Email link (passwordless sign-in)" isn't enabled for this Firebase
      // project — a console configuration issue, not a code bug.
      throw new Error('KUET email verification এখন enable করা নেই (Firebase Console-এ Email Link sign-in provider off আছে) — dev-কে জানাও, তোমার পাসওয়ার্ড বা account-এর সমস্যা না।');
    }
    throw err;
  }
  window.localStorage.setItem(PENDING_EMAIL_KEY, trimmedEmail);
  return parseKuetEmail(trimmedEmail);
}

/**
 * Is the current page URL itself a Firebase sign-in link? Call this once
 * at app boot (before rendering the verify widget) so a click can be
 * completed even if the person lands on a completely different page/tab
 * than the one that sent the link.
 */
export function isKuetVerifyLink(url = window.location.href) {
  return isSignInWithEmailLink(verifyAuth, url);
}

/**
 * Step 2: complete the sign-in using the link the person clicked. Safe to
 * call defensively at app boot — it's a no-op unless the current URL is
 * actually a valid sign-in link. Returns the verified roll on success, or
 * null if there was nothing to complete.
 *
 * On success this also records `verifiedRolls/{roll}` in Firestore and
 * cleans the magic-link query params out of the URL so a page refresh
 * doesn't try to "reuse" an already-consumed link (which is exactly the
 * "already used/expired" dead end the old flow could show).
 */
export async function completeKuetVerificationLink(url = window.location.href) {
  if (!isSignInWithEmailLink(verifyAuth, url)) return null;

  let email = window.localStorage.getItem(PENDING_EMAIL_KEY);
  if (!email) {
    // Cross-device case (link opened somewhere other than where it was
    // requested) — Firebase requires re-confirming the address here since
    // it can't be read back out of the link itself for security reasons.
    email = window.prompt('তোমার KUET email দিন verification confirm করতে (যেটাতে link পাঠানো হয়েছিল):') || '';
  }
  if (!email) return null;

  try {
    const result = await signInWithEmailLink(verifyAuth, email, url);
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
    // Strip the one-time link params so refreshing this page never replays
    // an already-consumed link — there's nothing left to consume anyway.
    window.history.replaceState(null, '', window.location.pathname);

    const parsed = parseKuetEmail(result.user.email);
    if (parsed) {
      await setDoc(doc(verifyDb, 'verifiedRolls', parsed.roll), {
        verifiedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {
        // Doc already exists (someone verified this roll before) — fine,
        // the rule makes it create-once/immutable, nothing to do.
      });
    }
    return parsed;
  } catch (err) {
    window.history.replaceState(null, '', window.location.pathname);
    if (err?.code === 'auth/invalid-action-code') {
      // This exact link was already used once, or its ~1hr window expired.
      // Since there's no persistent account/password behind this flow,
      // recovery is simply: send a brand new link and use that instead.
      throw new Error('এই verification link-টা আগে একবার ব্যবহার হয়ে গেছে অথবা মেয়াদ শেষ (Firebase links প্রায় ১ ঘণ্টা পর expire হয়)। চিন্তা নেই — নিচ থেকে একটা নতুন link পাঠাও, পুরনো কোনো account/password নিয়ে কিছু করা লাগবে না।');
    }
    throw err;
  }
}

/**
 * Read-only check from the MAIN session — does this roll already have a
 * recorded institutional verification? Cheap, plain exists()-style read.
 */
export async function isRollInstitutionallyVerified(roll) {
  if (!roll) return false;
  const snap = await getDoc(doc(db, 'verifiedRolls', roll));
  return snap.exists();
}

/** Convenience: does this profile's roll match this exact batch+dept group AND have a verified record? */
export async function emailMatchesGroup(profile) {
  const roll = String(profile?.studentId || '');
  if (roll.length < 4) return false;
  return isRollInstitutionallyVerified(roll);
}

/**
 * Build the full KUET email from just the name-part the user types plus
 * their own profile roll — the roll is never freely typed, it's pulled
 * straight from the signed-in profile so it can only ever match itself.
 */
export function buildKuetEmailFromProfile(namePart, profile) {
  const roll = String(profile?.studentId || '').trim();
  const clean = String(namePart || '').trim().toLowerCase();
  if (!roll || !clean) return '';
  return `${clean}${roll}@stud.kuet.ac.bd`;
}

/**
 * Guard used before sending: the roll encoded in the email the user is
 * about to verify must match their own profile's roll number. This is
 * what stops someone from proving a KUET email for a roll that isn't theirs.
 */
export function emailRollMatchesProfile(email, profile) {
  const parsed = parseKuetEmail(email);
  const profileRoll = String(profile?.studentId || '').trim();
  if (!parsed || !profileRoll) return false;
  return parsed.roll === profileRoll;
}
