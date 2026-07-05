// kuetEmailVerify.js
//
// Tier-1 (automatic) institutional verification, built on top of the
// existing anonymous->real-account upgrade flow in firebaseAuth.js. KUET
// issues student email as `<name><7-digit-roll>@stud.kuet.ac.bd` (e.g.
// islam2313014@stud.kuet.ac.bd). Firebase's own sendEmailVerification()
// proves the person actually controls that inbox — no Cloud Function,
// no external service, works on the Spark plan.
//
// Once emailVerified is true, Firestore *rules* can check
// request.auth.token.email / email_verified directly (see
// emailVerifiedRoll() in firestore.rules) — this file is purely the
// client-side linking + roll-extraction half of that.

import { sendEmailVerification } from 'firebase/auth';
import { auth } from './firebase';
import { upgradeWithEmail } from './firebaseAuth';

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
  return {
    roll,
    batchYear: roll.slice(0, 2),   // e.g. "23"
    deptCode: roll.slice(2, 4),    // e.g. "13"
  };
}

/**
 * Step 1: link the KUET email to the current (anonymous or real) session
 * and send Firebase's verification email. Throws if the email doesn't
 * match the KUET student-email format at all — no point sending a
 * verification email that can never grant institutional trust.
 */
export async function startKuetEmailVerification(email, password) {
  if (!isKuetEmailFormat(email)) {
    throw new Error('This doesn\'t look like a KUET student email (expected the form name+roll@stud.kuet.ac.bd).');
  }
  const user = await upgradeWithEmail(email, password);
  await sendEmailVerification(user);
  return parseKuetEmail(email);
}

/**
 * Step 2: call after the user clicks the verification link and returns
 * to the app. Firebase Auth needs a token refresh to pick up the new
 * emailVerified flag — reload() + getIdToken(true) does that.
 */
export async function checkKuetEmailVerified() {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true); // force-refresh so email_verified is current in the ID token
  return user.emailVerified === true;
}

/**
 * Does the currently signed-in, verified KUET email match this exact
 * batch+dept group? Mirrors the check Firestore rules perform
 * server-side — used client-side just to decide whether to show "Tier 1
 * verified" UI instantly rather than waiting on a round trip.
 */
export function emailMatchesGroup(profile) {
  const user = auth.currentUser;
  if (!user?.emailVerified || !user.email) return false;
  const parsed = parseKuetEmail(user.email);
  if (!parsed) return false;
  const roll = String(profile?.studentId || '');
  return roll.length >= 4 && roll.slice(0, 2) === parsed.batchYear && roll.slice(2, 4) === parsed.deptCode;
}
