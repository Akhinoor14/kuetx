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
// verifiedFacultyEmails/{email} write rule currently reads
// `allow write: if isSignedIn();` — ANY signed-in account (including a
// student one) can already write there directly, with or without this
// file. That's a pre-existing gap, not something this file introduces or
// widens. Tightening it properly needs a server-side check (Cloud
// Function) to actually verify the caller against facultyDirectory,
// which this project can't deploy on the Spark (free) plan — see
// functions/index.js's header. Flagged here so it isn't lost; not fixed
// in this change.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { syncFacultyVerificationStatus } from './facultySync';

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
function namesRoughlyMatch(typedName, directoryName) {
  const strip = (s) =>
    normalizeForCompare(s).replace(/\b(dr|prof|professor|mr|ms|mrs|engr|eng)\.?\b/g, '').trim();
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
 * Attempt to auto-verify a faculty account against the official
 * directory. Called from manualVerifyRequests.js's ensureManualVerifyRequest
 * BEFORE it files a pending request — a successful match here means no
 * pending request is needed at all (the account is already verified by
 * the time the Founder's Approvals tab would have shown it).
 *
 * On a match: writes verifiedFacultyEmails/{email} (autoVerified: true,
 * matchedDirectoryName so a Founder auditing later can see what it
 * matched against), then bridges it onto faculty/{uid}.verifiedAt via the
 * same syncFacultyVerificationStatus() the manual-approval path already
 * uses — so downstream code never has to know which path a given
 * verification came through.
 *
 * Returns true if auto-verification succeeded, false if there was no
 * directory match (or the name didn't roughly agree) and the caller
 * should fall back to the ordinary manual pending-request flow. Never
 * throws — a directory-lookup failure (offline, permission hiccup) is
 * exactly like "no match", not an error worth surfacing to the signup
 * flow.
 *
 * @param {string} uid
 * @param {{ name: string, email: string }} details
 */
export async function tryAutoVerifyFacultyFromDirectory(uid, details) {
  try {
    const email = String(details?.email || '').trim().toLowerCase();
    const name = String(details?.name || '').trim();
    if (!uid || !email || !name) return false;

    const entry = await lookupFacultyDirectoryEntry(email);
    if (!entry) return false;
    if (!namesRoughlyMatch(name, entry.name)) return false;

    await setDoc(
      doc(db, 'verifiedFacultyEmails', email),
      {
        verifiedAt: serverTimestamp(),
        autoVerified: true,
        matchedDirectoryName: entry.name,
        matchedDirectoryDept: entry.department || null,
      },
      { merge: true },
    );
    await syncFacultyVerificationStatus(uid, email);
    return true;
  } catch (err) {
    console.warn('[facultyDirectoryMatch] tryAutoVerifyFacultyFromDirectory failed, falling back to manual review', err);
    return false;
  }
}
