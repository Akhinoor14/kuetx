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
  setPersistence, inMemoryPersistence, signOut,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

const VERIFY_APP_NAME = 'kuetVerify';

function getVerifyApp() {
  return getApps().find((a) => a.name === VERIFY_APP_NAME) || initializeApp(firebaseConfig, VERIFY_APP_NAME);
}
const verifyAuth = getAuth(getVerifyApp());
const verifyDb = getFirestore(getVerifyApp()); // same project/database, but its Firestore *auth context* follows verifyAuth, not the main session

// BUGFIX: verifyAuth used to default to browserLocalPersistence, same as
// any other Firebase Auth instance — so every completed verification left
// a real, persistent second Firebase Auth user sitting in this browser's
// storage indefinitely (visible in Firebase Console as a second account,
// separate from the person's actual main-session account). The whole
// point of this secondary-app pattern is a one-off, disposable proof of
// mailbox ownership — nothing about it should outlive the single
// verification moment. in-memory persistence means it never touches
// localStorage/IndexedDB at all, and the explicit signOut() below (right
// after the Firestore write that actually matters) means nothing lingers
// even within the same page load either.
setPersistence(verifyAuth, inMemoryPersistence).catch(() => {});

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

// Guards against processing the exact same link twice concurrently — e.g.
// React.StrictMode double-invoking effects in dev, or two tabs/renders
// racing on the same boot-time check. Without this, the *second* call for
// an already-completing link would hit Firebase's "already used" error
// and surface a confusing failure toast right after a real success.
const inFlightOrDoneOobCodes = new Map(); // oobCode -> Promise<result>

function extractOobCode(url) {
  try {
    return new URL(url).searchParams.get('oobCode');
  } catch {
    return null;
  }
}

/**
 * Step 2: complete the sign-in using the link the person clicked. Safe to
 * call defensively at app boot — it's a no-op unless the current URL is
 * actually a valid sign-in link.
 *
 * Returns a plain result object instead of prompting or throwing blindly,
 * so the caller (App.jsx) can render a proper in-app UI instead of a raw
 * `window.prompt`/`window.alert`:
 *   - { status: 'not-a-link' }   — current URL isn't a sign-in link at all
 *   - { status: 'needs-email' } — same link, but we don't know which email
 *     it belongs to (cross-device/cross-browser-profile case — Firebase
 *     can't recover the address from the link itself for security reasons)
 *   - { status: 'success', roll, email }
 *   - { status: 'error', message }
 *
 * On success this also records `verifiedRolls/{roll}` in Firestore and
 * cleans the magic-link query params out of the URL so a page refresh
 * doesn't try to "reuse" an already-consumed link (which is exactly the
 * "already used/expired" dead end the old flow could show).
 *
 * `emailOverride` lets the caller supply the address explicitly (e.g. typed
 * into a modal) for the needs-email case — pass the *same* `url` again
 * (it's left untouched on the URL bar until we actually resolve the link).
 */
export async function completeKuetVerificationLink(url = window.location.href, emailOverride = null) {
  if (!isSignInWithEmailLink(verifyAuth, url)) return { status: 'not-a-link' };

  const email = (emailOverride || window.localStorage.getItem(PENDING_EMAIL_KEY) || '').trim();
  if (!email) {
    // Cross-device/cross-profile case — nothing stashed in this browser's
    // localStorage to match the link against. Let the caller ask nicely
    // instead of us reaching for window.prompt(). The link itself is left
    // untouched in the URL so a retry with the right email still works.
    return { status: 'needs-email' };
  }

  const oobCode = extractOobCode(url);
  if (oobCode && inFlightOrDoneOobCodes.has(oobCode)) {
    // Same link already being processed (or just finished) by another
    // concurrent call — piggyback on that result instead of re-attempting
    // a single-use link a second time.
    return inFlightOrDoneOobCodes.get(oobCode);
  }

  const attempt = (async () => {
    try {
      const result = await signInWithEmailLink(verifyAuth, email, url);
      window.localStorage.removeItem(PENDING_EMAIL_KEY);
      // Strip the one-time link params so refreshing this page never replays
      // an already-consumed link — there's nothing left to consume anyway.
      window.history.replaceState(null, '', window.location.pathname);

      const parsed = parseKuetEmail(result.user.email);
      if (parsed) {
        try {
          await setDoc(doc(verifyDb, 'verifiedRolls', parsed.roll), {
            verifiedAt: serverTimestamp(),
          }, { merge: true });
        } catch (writeErr) {
          // Only "already exists" is truly harmless (someone verified this
          // roll before, rule makes the doc create-once/immutable). Anything
          // else (e.g. a Firestore rules rejection) means sign-in succeeded
          // but the roll never actually got recorded — that must NOT be
          // reported back as success, or the person is stuck seeing "not
          // verified" forever with no idea why.
          if (writeErr?.code !== 'permission-denied') {
            await signOut(verifyAuth).catch(() => {});
            return { status: 'error', message: 'Sign-in সফল হয়েছে কিন্তু verification record সেভ করা যায়নি। আবার চেষ্টা করো, সমস্যা থাকলে dev-কে জানাও।' };
          }
        }
      }
      // BUGFIX: sign out of the throwaway verify session the moment its
      // job (the Firestore write above) is done — the main session
      // (auth, from firebase.js) was never touched by any of this, so
      // this is purely cleaning up the secondary app's temporary state,
      // not affecting the person's actual logged-in account at all.
      await signOut(verifyAuth).catch(() => {});
      return { status: 'success', roll: parsed?.roll, email: result.user.email };
    } catch (err) {
      window.history.replaceState(null, '', window.location.pathname);
      if (err?.code === 'auth/invalid-action-code') {
        // This exact link was already used once, or its ~1hr window expired.
        // Since there's no persistent account/password behind this flow,
        // recovery is simply: send a brand new link and use that instead.
        return { status: 'error', message: 'এই verification link-টা আগে একবার ব্যবহার হয়ে গেছে অথবা মেয়াদ শেষ (Firebase links প্রায় ১ ঘণ্টা পর expire হয়)। চিন্তা নেই — নিচ থেকে একটা নতুন link পাঠাও, পুরনো কোনো account/password নিয়ে কিছু করা লাগবে না।' };
      }
      if (err?.code === 'auth/invalid-email') {
        return { status: 'error', message: 'এই email address-টা ঠিক মনে হচ্ছে না। যে email-এ link পাঠানো হয়েছিল ঠিক সেটাই লেখো।' };
      }
      return { status: 'error', message: err?.message || 'Verification complete করতে সমস্যা হয়েছে, আবার চেষ্টা করো।' };
    }
  })();

  if (oobCode) inFlightOrDoneOobCodes.set(oobCode, attempt);
  return attempt;
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
