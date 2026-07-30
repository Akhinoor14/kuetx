// facultyEmailVerify.js
//
// Faculty institutional-email helpers. The magic-link (passwordless
// sign-in-link) verification mechanism that used to live in this file has
// been removed entirely — faculty verification is manual-only now (see
// ManualVerifyFallback.jsx + manualVerifyRequests.js): the Founder
// confirms the person by hand over WhatsApp and approves the request,
// which writes verifiedFacultyEmails/{email} directly. What's left here
// are the pure, still-needed pieces:
//   1. isFacultyEmailFormat — format/domain check (*.kuet.ac.bd, not
//      @stud.kuet.ac.bd), used at Register submit time and to gate the
//      Register form's copy/validation.
//   2. guessDeptFromFacultyEmail — best-effort department pre-fill from
//      the email's subdomain, for the Faculty profile form only, never
//      trusted as a source of truth.
//   3. isFacultyEmailVerified — read-only check of
//      verifiedFacultyEmails/{email}, which manual approval writes to.
//      Still used by facultySync.js's syncFacultyVerificationStatus to
//      bridge that fact onto faculty/{uid}.verifiedAt.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// TEMP: testing bypass, remove before public launch. This list skips
// ONLY the domain-suffix check for isFacultyEmailFormat — it does NOT
// grant verifiedAt on its own; a Founder still has to manually approve
// via ManualVerifyFallback like any other faculty account. Do not add
// production teacher emails here — they should all naturally pass the
// real suffix rule.
const TESTING_BYPASS_EMAILS = ['guluvai479@gmail.com'];

// Any *.kuet.ac.bd subdomain matches (@ese.kuet.ac.bd, @me.kuet.ac.bd,
// @cse.kuet.ac.bd, etc.) — which department doesn't matter, cross-dept
// teaching assignments are common. @stud.kuet.ac.bd is a HARD EXCLUSION:
// structurally it matches *.kuet.ac.bd too, but it's the student
// subdomain and must never pass as faculty, no exception.
const FACULTY_DOMAIN_RE = /^[^\s@]+@([a-z0-9-]+\.)*kuet\.ac\.bd$/i;
const STUDENT_SUBDOMAIN_RE = /@stud\.kuet\.ac\.bd$/i;

/**
 * Does this email pass the faculty domain-suffix rule? This is a pure
 * format/domain check — it proves nothing about mailbox ownership.
 * Ownership is only ever established by the Founder's manual review now.
 */
export function isFacultyEmailFormat(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  if (TESTING_BYPASS_EMAILS.includes(trimmed.toLowerCase())) return true;
  if (STUDENT_SUBDOMAIN_RE.test(trimmed)) return false;
  return FACULTY_DOMAIN_RE.test(trimmed);
}

// BUGFIX: this used to return the raw lowercase subdomain as-is (e.g.
// "ese", "arch", "iem", "iict") and callers pre-filled the dept <select>
// with that value directly. But DEPARTMENTS/INSTITUTES codes are
// mixed-case ("ESE", "Arch", "IPE" — IPE's own subdomain is @iem, a
// historical mismatch) and don't always match the subdomain 1:1, so the
// raw subdomain never matched any <option value>, and the "pre-fill" was
// silently a no-op every time. This maps the subdomain onto the actual
// ACADEMIC_UNITS code so the guess can actually land in the dropdown.
const SUBDOMAIN_TO_UNIT_CODE = {
  ce: 'CE', eee: 'EEE', me: 'ME', cse: 'CSE', ece: 'ECE',
  iem: 'IPE', becm: 'BECM', arch: 'Arch', urp: 'URP', le: 'LE',
  te: 'TE', bme: 'BME', mse: 'MSE', ese: 'ESE', che: 'ChE', mte: 'MTE',
  iict: 'IICT', idm: 'IDM', iept: 'IEPT',
  math: 'MATH', chem: 'CHEM', phy: 'PHY', hum: 'HUM',
};

/** Best-guess department code from the subdomain, for profile pre-fill only — never trusted as a gate. */
export function guessDeptFromFacultyEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  const match = /^[^@]+@([a-z0-9-]+)\.kuet\.ac\.bd$/i.exec(trimmed);
  const subdomain = match ? match[1] : null;
  return subdomain ? (SUBDOMAIN_TO_UNIT_CODE[subdomain] || null) : null;
}

/**
 * Read-only check — does this email have a recorded, Founder-approved
 * manual verification? Plain exists()-style read against
 * verifiedFacultyEmails/{email}, written only by
 * manualVerifyRequests.js's approveManualVerifyRequest now.
 */
export async function isFacultyEmailVerified(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  const snap = await getDoc(doc(db, 'verifiedFacultyEmails', trimmed));
  return snap.exists();
}
