// manualVerifyRequests.js
//
// Safety-net verification queue for the Founder/Admin's Approvals tab,
// same shape for student and faculty (distinguished by `role`).
//
// As of the auto-submit change: ensureManualVerifyRequest() is called
// automatically, silently, in the background — once per account, as soon
// as enough profile data exists (name+roll for students, name+dept/email
// for faculty) — via a DETERMINISTIC doc ID (manualVerifyRequests/{uid})
// so it can never create a duplicate no matter how many times it's
// called (profile re-saves, repeat app loads, etc). This guarantees the
// Founder/Admin has visibility into every account, not just the ones
// whose owner happened to click "Verify manually."
//   - Students: this is a PARALLEL safety net, not the primary path —
//     Blue Tick (System 1: CR/ACR class-roster approval, see
//     groupSync.js) is still how most students actually get verified.
//     A student who's approved via System 1 first just leaves this
//     request sitting unapproved/stale; nothing auto-resolves it.
//   - Faculty: this IS the only path (no CR/ACR-equivalent exists for
//     faculty), so the same auto-submit is faculty's sole route to
//     verifiedAt=true.
//
// The legacy submitManualVerifyRequest() (addDoc, random ID) is what the
// "Contact Founder on WhatsApp" button used to call to create the
// request; the request is no longer created by that click (it already
// exists by then via ensureManualVerifyRequest), so that button is now
// purely an optional faster-nudge WhatsApp deep link.
//
// Approving here writes the same durable "verified" fact the automatic
// (CR/ACR or magic-link) flow would have written, so downstream code
// never needs to know which path a given verification came through.

import {
  collection, doc, addDoc, getDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { syncFacultyVerificationStatus } from './facultySync';
import { retryableOnSnapshot } from './safeSnapshot';

const COLLECTION = 'manualVerifyRequests';

/**
 * Auto-create a manual verification request in the background, with no
 * button click required. Uses a DETERMINISTIC doc ID (manualVerifyRequests/{uid})
 * instead of addDoc's random ID, specifically so this is idempotent — safe
 * to call on every profile save / app load without ever creating a
 * duplicate. Call sites should still avoid calling this pointlessly (e.g.
 * on a re-save with unchanged data), but even if they do, this is a no-op
 * past the first successful write.
 *
 * Silently no-ops (does not throw) on missing uid/name/roll-or-dept, and
 * swallows write errors — this always runs alongside a "real" primary
 * action (profile save, faculty shell creation) that must not be blocked
 * or surfaced-as-failed by a problem in this best-effort background task.
 *
 * @param {'student'|'faculty'} role
 * @param {{ name: string, email: string, googleEmail?: string, roll?: string, dept?: string }} details
 *   `email` should be the institutional/verifiable address for faculty
 *   (used downstream by approveManualVerifyRequest — see facultySync.js's
 *   verification bridge). `googleEmail` is optional secondary context
 *   (the personal Gmail used to sign in) — informational only, never used
 *   for verification.
 */
export async function ensureManualVerifyRequest(role, details) {
  const uid = auth.currentUser?.uid;
  const name = String(details?.name || '').trim();
  const roll = details?.roll ? String(details.roll).trim() : null;
  const dept = details?.dept ? String(details.dept).trim() : null;
  const googleEmail = details?.googleEmail ? String(details.googleEmail).trim() : null;
  if (!uid || !name) return; // not enough data yet — nothing to submit
  if (role === 'student' && !roll) return;
  if (role === 'faculty' && !dept && !details?.email) return;

  try {
    const ref = doc(db, COLLECTION, uid);
    // BUGFIX: this used to getDoc(ref) first and bail out early if the
    // doc already existed. But firestore.rules' read rule for
    // manualVerifyRequests/{requestId} is `resource.data.uid ==
    // request.auth.uid` — when the doc doesn't exist yet, `resource` is
    // null in the rule's evaluation context, so `resource.data.uid`
    // denies the read outright, even for the doc's own future owner.
    // That's the actual cause of the repeated "[manualVerifyRequests]
    // ensureManualVerifyRequest failed ... Missing or insufficient
    // permissions" — not a role/verification issue, and it hit EVERY
    // first-time caller (the doc never exists yet on someone's very
    // first app load), not just some subset.
    //
    // The pre-check was redundant anyway: the create rule already has
    // its own server-side `!exists(.../manualVerifyRequests/$(requestId))`
    // guard, so at-most-one-per-account is still enforced even without
    // this client-side read. On a repeat call the doc already exists, so
    // this setDoc (no merge — a plain create-shaped write) is evaluated
    // against the `create` rule, fails the `!exists()` clause, and is
    // rejected — caught below as a harmless no-op, same end result the
    // old existing.exists() early-return gave, just without the extra
    // read that was breaking the very first call for every user. This
    // intentionally can never touch status/reviewedAt/reviewedBy on an
    // already-resolved request, since the rules' `update` op (the only
    // one that could reach those fields) is restricted to Admin/HeadOfOps.
    await setDoc(ref, {
      role,
      name,
      email: String(details?.email || '').trim(),
      googleEmail,
      roll,
      dept,
      uid,
      status: 'pending',
      requestedAt: serverTimestamp(),
      autoSubmitted: true, // distinguishes this from a WhatsApp-click submission, for the Approvals UI
    });
  } catch (err) {
    // Best-effort background safety net — never let this block or throw
    // out of a caller's primary save/signup flow.
    //
    // A repeat call (profile re-save, repeat app load) after the doc
    // already exists is EXPECTED to be rejected here — the create rule's
    // `!exists()` guard denies it on purpose, as the idempotency
    // safeguard described above. That's not a real failure, so it's
    // swallowed silently instead of spamming the console with a
    // permission-denied warning on every load after the first.
    if (err?.code !== 'permission-denied') {
      console.warn('[manualVerifyRequests] ensureManualVerifyRequest failed', err);
    }
  }
}

/**
 * Submit a manual verification request directly (legacy addDoc path).
 * Kept only for callers that explicitly want a fresh doc regardless of
 * ensureManualVerifyRequest's dedup — currently unused now that both
 * student and faculty requests are created automatically via
 * ensureManualVerifyRequest, but left in place in case a future manual
 * "request again" action is needed.
 *
 * @param {'student'|'faculty'} role
 * @param {{ name: string, email: string, roll?: string, dept?: string }} details
 */
export async function submitManualVerifyRequest(role, details) {
  const payload = {
    role,
    name: String(details.name || '').trim(),
    email: String(details.email || '').trim(),
    roll: details.roll ? String(details.roll).trim() : null,
    dept: details.dept ? String(details.dept).trim() : null,
    uid: auth.currentUser?.uid || null,
    status: 'pending',
    requestedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

/** Live list of pending manual verification requests, for the Founder's Approvals tab. */
export function subscribeManualVerifyRequests(callback) {
  return retryableOnSnapshot(
    query(collection(db, COLLECTION), where('status', '==', 'pending'), orderBy('requestedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[manualVerifyRequests] subscribeManualVerifyRequests error:', err);
      callback([]);
    },
  );
}

/**
 * Founder approves — writes the same durable verified-fact the automatic
 * flow writes (verifiedRolls/{roll} for students, faculty/{uid}.verifiedAt
 * for faculty), then marks the request resolved.
 */
export async function approveManualVerifyRequest(requestId) {
  const reqSnap = await getDoc(doc(db, COLLECTION, requestId));
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  const reviewerUid = auth.currentUser?.uid;

  if (reqData.role === 'student' && reqData.roll) {
    // Same minimal shape kuetEmailVerify.js writes — verifiedRolls/{roll}
    // is create-once/immutable per Firestore rules, so this must match
    // exactly (no extra fields) or the write will be rejected. The audit
    // trail (who reviewed, via which path) lives on the request doc
    // itself instead, updated just below.
    await setDoc(doc(db, 'verifiedRolls', reqData.roll), {
      verifiedAt: serverTimestamp(),
    }, { merge: true });
  } else if (reqData.role === 'faculty' && reqData.uid && reqData.email) {
    // Firestore rules forbid setting faculty/{uid}.verifiedAt directly
    // from the client (see facultySync.js) — it can only be flipped by
    // syncFacultyVerificationStatus() after verifiedFacultyEmails/{email}
    // exists. Manual approval has to go through the exact same bridge the
    // automatic magic-link flow uses, not shortcut around it.
    const normalizedEmail = String(reqData.email).trim().toLowerCase();
    await setDoc(doc(db, 'verifiedFacultyEmails', normalizedEmail), {
      verifiedAt: serverTimestamp(),
    }, { merge: true });
    await syncFacultyVerificationStatus(reqData.uid, normalizedEmail);
  }

  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid || null,
  });
}

/** Founder rejects — no verified-fact written, request just marked resolved. */
export async function rejectManualVerifyRequest(requestId) {
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: auth.currentUser?.uid || null,
  });
}
