// facultyDirectoryMatch.js
//
// Auto-verification against the official KUET faculty directory
// (facultyDirectory/{normalizedEmail}, populated by the scheduled
// scraper — see /scripts/kuet_faculty_scraper.py and
// .github/workflows/kuet-faculty-scrape.yml). Read-only from the app's
// side: this collection is never written by the client, only by the
// scraper's service account.
//
// CONTEXT — this REVERSES a deliberate prior decision. facultyEmailVerify.js's
// header explains that auto (magic-link) verification was removed and
// replaced with Founder-manual-only, on purpose, after it caused bugs.
// Bringing back auto-verify here was a conscious product call (not an
// accidental regression) made because we now have a trustworthy
// independent source (KUET's own official directory) to match against,
// which the old magic-link mechanism never had. If this causes problems
// again, disable by making tryAutoVerifyFacultyFromDirectory() below a
// no-op (return null immediately) — every call site already handles a
// null return by falling back to the ordinary pending-request flow.
//
// MATCH RULE: email is the authoritative key (facultyDirectory doc ID is
// the normalized official email, same normalization
// isFacultyEmailVerified/syncFacultyVerificationStatus already use). Name
// is a secondary sanity check, not a primary key — two people never share
// an institutional email, but a directory scrape and a typed profile name
// can differ in spacing/honorifics, so name comparison is fuzzy
// (normalized, substring-tolerant) and only used to catch a gross
// mismatch (wrong person entirely), not to gate on an exact string match.
//
// SECURITY NOTE (read this before touching firestore.rules): the
// verifiedFacultyEmails/{email} write rule was tightened in Phase 2 of
// CR_TEACHER_LINKING_NOTES.md — no longer `allow write: if isSignedIn()`
// for any doc. It's now `isAdmin() || (isSignedIn() &&
// request.auth.token.email == email)`, so this file's own writes (below,
// keyed by the caller's own email) still work unchanged, and a student
// account can no longer write a claim for someone ELSE's email. This did
// NOT close the whole gap, though: a compromised/malicious faculty
// session can still self-write `autoVerified: true` for its own email
// without an actual directory hit, since the real match check still only
// lives here in client JS, not in the rules. Properly closing that still
// needs a server-side check (Cloud Function) to verify the caller against
// facultyDirectory, which this project can't deploy on the Spark (free)
// plan — see functions/index.js's header.

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Same normalization the registry/dialog code already uses elsewhere — trim + collapse whitespace, lowercase for comparison only. */
function normalizeForCompare(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Fuzzy name match: strips common honorifics (Dr., Prof., Mr., Ms.,
 * Engr., etc.) from both sides, then checks whether one normalized name
 * contains the other. Tolerant on purpose — directory names often carry
 * "Dr." or a middle initial the signup form's name doesn't, and vice
 * versa. This is a sanity check against a gross mismatch, not a strict
 * verifier (the email match is what actually establishes identity).
 */
// eslint-disable-next-line no-unused-vars -- kept for tryAutoVerifyFacultyFromDirectory's disabled body, see that function's header
function namesRoughlyMatch(typedName, directoryName) {
  const strip = (s) =>
    normalizeForCompare(s)
      .replace(/\b(dr|prof|professor|mr|ms|mrs|engr|eng|md|mohammad|mohammed|mohd|sk|sheikh)\.?\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = strip(typedName);
  const b = strip(directoryName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Look up the official directory by email only (cheap single-doc read,
 * no query/index needed). Returns the directory record or null.
 */
export async function lookupFacultyDirectoryEntry(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const snap = await getDoc(doc(db, 'facultyDirectory', normalizedEmail));
  return snap.exists() ? snap.data() : null;
}

/**
 * DISABLED — turned into a no-op on purpose (product decision, see
 * conversation this change came from): directory match should only ever
 * drive the Step 2 "is this you?" preview/pre-fill
 * (lookupFacultyDirectoryEntry, still active in SignUpWizard.jsx +
 * FacultyProfileSetupModal.jsx) — it must NOT grant instant dashboard
 * access on its own. Every faculty account, matched or not, now goes
 * through the same manualVerifyRequests pending queue and needs an
 * explicit Founder approval before verifiedAt is set. This restores the
 * original "Founder-manual-only" behavior that facultyEmailVerify.js's
 * header already describes as the deliberate baseline, without deleting
 * the matching code below — flip this back on later by restoring the
 * body from git history if a server-side (Cloud Function) check is ever
 * added to close the self-write gap described in this file's top
 * header, instead of trusting client JS as the sole gate.
 *
 * Every call site (manualVerifyRequests.js's ensureManualVerifyRequest)
 * already handles a `false` return by falling back to the ordinary
 * pending-request flow, so no caller needs to change.
 *
 * @param {string} uid
 * @param {{ name: string, email: string }} details
 */
export async function tryAutoVerifyFacultyFromDirectory(uid, details) {
  return false;
}
