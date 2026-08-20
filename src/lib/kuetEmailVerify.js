// kuetEmailVerify.js
//
// Pure, stateless helpers for the self-reported "KUET email" text field on
// a student's profile. There is no OTP / magic-link / Firebase-secondary-app
// verification flow anymore — that entire mechanism (sendKuetVerificationLink,
// completeKuetVerificationLink, isRollInstitutionallyVerified, the
// `verifiedRolls/{roll}` Firestore collection, KuetEmailVerifyWidget,
// OtpInput) was removed. Current model: a student fills in their info
// (including this email) themselves; their class's CL reviews and
// accepts/rejects the claim manually. "Verified" (Blue Tick) now means
// "a human (CL/Faculty) approved this membership" — see member.verified in
// groupSync.js / ClassmatesList.jsx / Profile.jsx's subscribeOwnMemberVerified,
// not anything checked here.
//
// What's left in this file is only pure, synchronous format validation —
// no network calls, no Firebase, no side effects.

import { toSevenDigitCore } from './rollFormat';

// NOTE: kept at 7-digit intentionally. Unlike the student's own profile
// roll (which can be 7 or 8 digit, see rollFormat.js), it is NOT
// confirmed whether KUET's official student email local-part uses the
// 8-digit format for students who have an 8-digit roll, or still uses
// the legacy 7-digit convention internally. Flagged as an open question
// in CR_PERMISSION_AND_ROLL_UPGRADE_PLAN.md §৩ক.৭ — revisit if this
// turns out to reject real 8-digit students' KUET emails.
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
 * Guard used on the profile form: the roll encoded in the typed KUET email
 * must match the person's own profile roll number, so they can't enter a
 * KUET email for a roll that isn't theirs.
 *
 * The email itself is still parsed as 7-digit only (see KUET_EMAIL_RE
 * note above), but the profile roll may be 7 or 8 digit — so we compare
 * against the profile roll's 7-digit core, not the raw string. This way
 * an 8-digit-roll student whose KUET email uses the legacy 7-digit local
 * part still matches correctly.
 */
export function emailRollMatchesProfile(email, profile) {
  const parsed = parseKuetEmail(email);
  const profileRoll = String(profile?.studentId || '').trim();
  if (!parsed || !profileRoll) return false;
  const profileCore = toSevenDigitCore(profileRoll);
  return parsed.roll === profileCore;
}
