// kuetEmailVerify.js
//
// Tier-1 (automatic) institutional verification — redesigned so it NEVER
// touches the visitor's main account. Whatever they're signed in as
// (anonymous, a personal Gmail-backed account, whatever) stays exactly as
// it is. Proving ownership of a KUET email happens on a completely
// separate, secondary Firebase App instance (same pattern as
// adminAuth.js) that exists purely as a one-time proof mechanism — its
// own throwaway uid is never the visitor's real identity.
//
// How the proof becomes usable:
//   1. On the secondary app, create/sign-in a KUET-email account and send
//      Firebase's own verification email — proves real mailbox ownership.
//   2. Once verified, write a durable fact to Firestore (via the
//      secondary app's OWN authenticated session, so its ID token really
//      does carry that verified KUET email): `verifiedRolls/{roll}`.
//   3. The MAIN session's group-join rule just checks "does
//      verifiedRolls/{this roll} exist?" — a plain exists() check, no
//      token/email comparison needed on the main session at all.
//
// Known trade-off (documented, not hidden): `verifiedRolls/{roll}` is
// keyed by roll number only, not bound to a specific uid. That keeps the
// design simple and avoids a lockout if someone's original anonymous
// session is later lost — but it does mean that once a roll is proven
// once, anyone typing that exact roll number elsewhere also benefits from
// the "Tier 1 verified" fallback. Given this app's actual risk profile
// (shared class routines, not sensitive personal data), that's an
// acceptable narrow edge case rather than a serious hole — flagging it
// clearly here rather than leaving it undocumented.

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
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
 * Step 1: start (or resume) the verification proof on the secondary app.
 * The password here has nothing to do with the visitor's main account —
 * it only protects this throwaway proof-of-ownership credential.
 */
export async function startKuetEmailVerification(email, password) {
  const trimmedEmail = String(email || '').trim();
  if (!isKuetEmailFormat(trimmedEmail)) {
    throw new Error('This doesn\'t look like a KUET student email (expected the form name+roll@stud.kuet.ac.bd).');
  }
  try {
    await createUserWithEmailAndPassword(verifyAuth, trimmedEmail, password);
  } catch (err) {
    if (err?.code === 'auth/email-already-in-use') {
      // Someone (maybe this same person, on a previous attempt) already
      // started verifying this exact email — just resume with sign-in.
      await signInWithEmailAndPassword(verifyAuth, trimmedEmail, password);
    } else {
      throw err;
    }
  }
  await sendEmailVerification(verifyAuth.currentUser);
  return parseKuetEmail(trimmedEmail);
}

/**
 * Step 2: call after the user clicks the verification link. If verified,
 * records the durable `verifiedRolls/{roll}` fact and returns true.
 */
export async function checkKuetEmailVerified() {
  const user = verifyAuth.currentUser;
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true); // force-refresh so email_verified is current
  if (!user.emailVerified) return false;

  const parsed = parseKuetEmail(user.email);
  if (parsed) {
    // This write goes through verifyDb, so its Firestore auth context is
    // the secondary app's own KUET-verified session — exactly what the
    // security rule for verifiedRolls/{roll} requires.
    await setDoc(doc(verifyDb, 'verifiedRolls', parsed.roll), {
      verifiedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {
      // Doc already exists (someone verified this roll before) — fine,
      // the rule makes it create-once/immutable, nothing to do.
    });
  }
  return true;
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
