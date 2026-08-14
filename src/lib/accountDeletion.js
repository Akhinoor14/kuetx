// accountDeletion.js
//
// Self-service account deletion — the permanent design for this
// project. This project stays on Firebase Spark (free plan) for good
// (no billing account available for Blaze), so this is not a stopgap —
// it's the real implementation. See docs/ACCOUNT_DELETION_PLAN.md for
// the full reasoning: this file deletes everything current
// firestore.rules let an owner delete themself, and queues everything
// the rules reserve for Admin (root profile/role docs,
// faculty/provider/staff/activity/emailFlags records, the Auth user
// itself) into accountDeleteRequests/{uid} for a Founder to clear
// manually via the Firebase Console.
//
// DO NOT "fix" this by loosening firestore.rules to make more
// collections self-deletable — that tradeoff (see the plan doc's "Why
// this isn't just a code gap") was deliberately not taken and isn't
// being revisited. functions/index.js's deleteMyAccount Cloud Function
// is dead/reference code only — this project isn't moving to Blaze, so
// nothing should ever be wired up to call it.

import {
  collection, doc, getDoc, getDocs, deleteDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { clearLocalDataOnLogout } from './accountLifecycle';
import { clearAccountRole } from './accountRole';
import { leaveGroup } from './groupSync';
import { withPromiseTimeout } from './safeSnapshot';

const REQUEST_COLLECTION = 'accountDeleteRequests';

// Collections/paths this Spark-tier path CAN actually delete itself,
// given current firestore.rules owner-delete grants. Kept as a single
// note so the "what did we actually clear" summary written into the
// request doc (for the Founder's context) and the deletion logic below
// can't drift apart from each other.
const CLIENT_DELETABLE_NOTE =
  'users/{uid}/data/*, users/{uid}/meta/*, bookingAlerts/{uid}, bloodDonors/{uid}, ' +
  'own group membership (if plain member — CR/ACR requires handoff first)';

// Everything else — the parts firestore.rules reserve for Admin/HeadOfOps
// or block outright (`allow delete: if false`). Listed explicitly in the
// request doc so the Founder doesn't have to go rediscover this from the
// rules file every time.
const ADMIN_ONLY_COLLECTIONS = [
  'users/{uid} (root doc)',
  'students/{uid} (profile: dept/batch/roll)',
  'faculty/{uid} + faculty/{uid}/private/verification',
  'providers/{uid} + providers/{uid}/contact/phone',
  'activity/{uid} + activity/{uid}/moduleUsage/*',
  'emailFlags/{uid}',
  'staff/{uid}/roles/*',
  'Firebase Auth user (delete via Console > Authentication)',
];

async function deleteSubcollectionDocs(colRef) {
  const snap = await withPromiseTimeout(getDocs(colRef), '[accountDeletion] deleteSubcollectionDocs');
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => null)));
  return snap.size;
}

/**
 * Deletes everything the client SDK is currently allowed to delete for
 * the signed-in account, then files an accountDeleteRequests/{uid} doc
 * listing what still needs manual Founder cleanup (root profile/role
 * docs, faculty/provider/staff/activity/emailFlags records, and — if
 * still applicable — CR/ACR membership that couldn't self-delete).
 *
 * @param {string} confirmText - must exactly match auth.currentUser.email
 *   (case-insensitive, trimmed). Checked here client-side; there is no
 *   server-side re-check in Spark-tier mode since this doesn't run
 *   through a Cloud Function — the modal's confirmation IS the guard for
 *   now, not just a UX nicety on top of a real one, so it stays required.
 * @returns {Promise<{ pendingAdminCleanup: string[], groupLeaveBlocked: boolean }>}
 *   groupLeaveBlocked is true if the account still holds a CR/ACR slot
 *   that couldn't be self-removed — the caller should say so plainly,
 *   not silently swallow it.
 */
export async function deleteMyAccount(confirmText) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  const expected = (user.email || '').trim().toLowerCase();
  const provided = String(confirmText || '').trim().toLowerCase();
  if (!expected || !provided || provided !== expected) {
    throw new Error('Confirmation text does not match.');
  }

  const uid = user.uid;
  let groupLeaveBlocked = false;

  // 1. Personal store — users/{uid}/data/* and users/{uid}/meta/*.
  //    Rules: owner write (delete included) on both. Safe to wipe fully.
  await deleteSubcollectionDocs(collection(db, 'users', uid, 'data'));
  await deleteSubcollectionDocs(collection(db, 'users', uid, 'meta'));

  // 2. bookingAlerts/{uid}/items/* — owner-delete allowed on the items
  //    subcollection; the parent bookingAlerts/{uid} doc itself is just
  //    an implicit container (never directly written), nothing to
  //    delete there separately.
  await deleteSubcollectionDocs(collection(db, 'bookingAlerts', uid, 'items'));

  // 3. bloodDonors/{uid} — owner-delete allowed on the doc itself.
  try {
    await deleteDoc(doc(db, 'bloodDonors', uid));
  } catch {
    // Doc may simply not exist (never registered as a donor) — fine.
  }

  // 4. Group membership — only self-deletable while role is plain
  //    'member' (see firestore.rules' groups/{groupId}/members/{uid}
  //    delete rule). Resolve the group via students/{uid}.groupId if
  //    present; read the membership doc's role before attempting delete
  //    so a CR/ACR is reported, not silently left in place unexplained.
  try {
    const studentSnap = await getDoc(doc(db, 'students', uid));
    const groupId = studentSnap.exists() ? studentSnap.data()?.groupId : null;
    if (groupId) {
      const memberSnap = await getDoc(doc(db, 'groups', groupId, 'members', uid));
      if (memberSnap.exists()) {
        const role = memberSnap.data()?.role;
        if (role === 'cr' || role === 'acr') {
          groupLeaveBlocked = true; // caller must tell the person to step down first
        } else {
          await leaveGroup(groupId);
        }
      }
    }
  } catch (err) {
    console.warn('[accountDeletion] group membership cleanup failed:', err);
  }

  // 5. Everything left (root docs, faculty/provider/staff/activity/
  //    emailFlags, Auth user itself) is Admin/HeadOfOps-gated or fully
  //    delete-blocked by rules — queue it instead of failing silently.
  const pendingAdminCleanup = [...ADMIN_ONLY_COLLECTIONS];
  if (groupLeaveBlocked) {
    pendingAdminCleanup.push('groups/{groupId}/members/{uid} — blocked: account still holds CR/ACR, needs step-down or Founder override');
  }

  await setDoc(doc(db, REQUEST_COLLECTION, uid), {
    uid,
    email: user.email || null,
    status: 'pending',
    requestedAt: serverTimestamp(),
    clientDeletedNote: CLIENT_DELETABLE_NOTE,
    pendingAdminCleanup,
  });

  // 6. Clear this device's local copy and drop the session, same as a
  //    normal logout.
  await clearLocalDataOnLogout();
  clearAccountRole(); // BUGFIX: same stale-role issue as logout() in firebaseAuth.js — this signs out independently, so needs the same fix.
  try {
    await auth.signOut();
  } catch {
    // Non-fatal — the request doc above is already filed either way.
  }

  return { pendingAdminCleanup, groupLeaveBlocked };
}
