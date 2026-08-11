// emailFlags.js — flagging existing accounts whose registered email looks
// fake/invalid (e.g. typo TLDs like .bom, .con, or domains with no MX
// record). This is a MANUAL, human-reviewed flag, not an automatic ban —
// automated MX/domain checks only run at NEW registration time
// (emailDomainCheck.js) where rejecting is cheap and instant. For accounts
// that already exist, deleting or auto-locking them on a heuristic risks
// destroying a real student's data over a false positive, so instead this
// gives the right person the ability to flag -> the account owner then
// gets asked (via EmailVerifyBanner/ProfileVerifyBanner-style UI) to fix
// their email or export a backup.
//
// Authority model (mirrors staffRoles.js's existing hierarchy, does not
// invent a new one):
//   - A Campus Lead (scope: their own dept+batch group) can flag any
//     member of THEIR group.
//   - A Senior Campus Lead (scope: their dept) can flag anyone in any
//     group under their dept.
//   - Head of Ops / Founder (admin) can flag anyone, anywhere — this is
//     also the FALLBACK: if a target's dept/group currently has no
//     SCL/CL assigned (vacant post), the flag request routes straight to
//     admins/Head of Ops instead of silently failing, same universal-
//     fallback principle used everywhere else in this app (CR unlock,
//     CL application, etc).
//
// Firestore rules (see firestore.rules) are the real enforcement of the
// authority checks above — this file just calls through to them.

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, addDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { isObviouslyBadDomain } from './emailDomainCheck';
import { withPromiseTimeout } from './safeSnapshot';

// ---------------------------------------------------------------------
// Flag a user's email as suspicious
// ---------------------------------------------------------------------
// targetUid: the account being flagged
// context: { dept, groupId } — the target's dept/group, used so Firestore
//   rules can verify the flagger's authority over that scope without a
//   second round-trip lookup.
// reason: short human note, e.g. "typo TLD .bom" or "no mailbox / bounced"

export async function flagSuspiciousEmail(targetUid, targetEmail, context, reason = '') {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await setDoc(doc(db, 'emailFlags', targetUid), {
    targetUid,
    targetEmail: targetEmail || null,
    dept: context?.dept || null,
    groupId: context?.groupId || null,
    reason: reason || '',
    status: 'pending', // pending -> resolved | dismissed
    flaggedBy: uid,
    flaggedAt: serverTimestamp(),
  });
}

export async function unflagEmail(targetUid) {
  await deleteDoc(doc(db, 'emailFlags', targetUid));
}

export async function resolveEmailFlag(targetUid, status) {
  // status: 'resolved' (user fixed it) | 'dismissed' (false positive)
  const uid = auth.currentUser?.uid;
  await setDoc(doc(db, 'emailFlags', targetUid), {
    status,
    resolvedBy: uid,
    resolvedAt: serverTimestamp(),
  }, { merge: true });
}

/** Live status of the CURRENT user's own flag, so their own UI can react (show a banner asking them to fix it). */
export function subscribeMyEmailFlag(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) { callback(null); return () => {}; }
  return onSnapshot(
    doc(db, 'emailFlags', uid),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => callback(null),
  );
}

/** All pending flags a given SCL/CL/admin is allowed to see, scoped to their dept/group. Used by StaffDashboard. */
export async function listPendingFlags({ dept, groupId } = {}) {
  let q;
  if (groupId) {
    q = query(collection(db, 'emailFlags'), where('groupId', '==', groupId), where('status', '==', 'pending'));
  } else if (dept) {
    q = query(collection(db, 'emailFlags'), where('dept', '==', dept), where('status', '==', 'pending'));
  } else {
    // Admin/Head of Ops fallback view — everything pending, regardless of scope.
    q = query(collection(db, 'emailFlags'), where('status', '==', 'pending'), orderBy('flaggedAt', 'desc'));
  }
  const snap = await withPromiseTimeout(getDocs(q), '[emailFlags] listPendingFlags');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------------
// Suspicious-domain counting — how many registered emails across the app
// fall outside a normal/expected pattern (typo TLDs, disposable domains,
// or just not @gmail/@stud.kuet.ac.bd/other common real domains). This is
// a COUNT ONLY, computed client-side by whoever has permission to read
// profiles at their scope (SCL/Admin) — it doesn't expose which specific
// account is bad beyond what flagging already surfaces, it's for the
// dashboard "N accounts look suspicious" summary number.
// ---------------------------------------------------------------------

const KNOWN_GOOD_DOMAINS = new Set([
  'gmail.com', 'stud.kuet.ac.bd', 'kuet.ac.bd', 'outlook.com', 'hotmail.com',
  'yahoo.com', 'icloud.com', 'protonmail.com', 'proton.me',
]);

export function isOutsideIdealDomain(email) {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@')[1].trim().toLowerCase();
  if (KNOWN_GOOD_DOMAINS.has(domain)) return false;
  // Not in the known-good list — could still be a legitimate personal/work
  // domain, so this alone doesn't mean fake. Combine with the MX-blocklist
  // check for the stronger "actually looks fake" signal used in flagging.
  return true;
}

/**
 * Counts, from a list of {uid, email} pairs (already scoped/fetched by the
 * caller per their own read permissions), how many fall outside the ideal
 * domain list vs how many are additionally flagged as obviously-bad
 * (blocklisted TLD/pattern). Two numbers because "outside ideal domain" is
 * a soft signal (e.g. a real personal domain) while "obviously bad" is a
 * hard signal (typo TLD, disposable mail).
 */
export function summarizeEmailHealth(users) {
  let outsideIdeal = 0;
  let obviouslyBad = 0;
  for (const u of users) {
    if (!u?.email) continue;
    if (isOutsideIdealDomain(u.email)) outsideIdeal += 1;
    if (isObviouslyBadDomain(u.email)) obviouslyBad += 1;
  }
  return { total: users.length, outsideIdeal, obviouslyBad };
}
