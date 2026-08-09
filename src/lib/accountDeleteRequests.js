// accountDeleteRequests.js
//
// Founder dashboard side of self-service account deletion. See
// src/lib/accountDeletion.js (the person's side — files the request)
// and docs/ACCOUNT_DELETION_PLAN.md / docs/ACCOUNT_DELETION_DASHBOARD_PLAN.md
// for the full design. Mirrors manualVerifyRequests.js's
// subscribe/resolve shape on purpose — same request-queue pattern, same
// Approvals-tab UI conventions.
//
// resolveAccountDeleteRequest() deliberately reuses the app's EXISTING
// admin-delete functions (adminDeleteFaculty, adminDeleteProvider,
// removeRole) instead of raw deleteDoc calls on those collections —
// those functions carry real business logic this must not bypass:
//   - adminDeleteProvider THROWS if the provider is currently
//     'verified'/active (must be deactivated first) — a live
//     marketplace listing shouldn't vanish out from under students with
//     open bookings just because the owner requested account deletion.
//   - removeRole(uid, role, scope) also clears mirror docs
//     (depts/{dept}/meta/sclStatus, groups/{gid}/meta/clStatus) that a
//     blind deleteDoc on the role doc alone would leave stale/orphaned,
//     pointing at a uid that no longer exists.
// users/{uid}, students/{uid}, activity/{uid}, and emailFlags/{uid} have
// no existing admin-delete helper elsewhere in the app (nothing needed
// one before this feature), so those are plain existence-checked
// deleteDoc calls here.
//
// The Firebase Auth user itself is NOT deleted here — the client SDK
// has no way to delete an account other than the currently-signed-in
// session's own, so that stays a manual Firebase Console lookup
// (Authentication tab, by email) after this runs. Permanent limitation
// of staying on the Spark plan (see docs/ACCOUNT_DELETION_PLAN.md), not
// a TODO.

import {
  collection, doc, getDoc, getDocs, deleteDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { retryableOnSnapshot } from './safeSnapshot';
import { adminDeleteFaculty } from './facultySync';
import { adminDeleteProvider } from './providerSync';
import { removeRole } from './staffSync';

const COLLECTION = 'accountDeleteRequests';

/** Live list of pending account-deletion requests, for the Founder's Approvals tab. */
export function subscribeAccountDeleteRequests(callback) {
  return retryableOnSnapshot(
    query(collection(db, COLLECTION), where('status', '==', 'pending'), orderBy('requestedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[accountDeleteRequests] subscribeAccountDeleteRequests error:', err);
      callback([]);
    },
  );
}

async function deleteIfExists(ref) {
  const snap = await getDoc(ref);
  if (snap.exists()) await deleteDoc(ref);
}

/**
 * Founder approves — deletes every Admin-only collection for this uid
 * that the client-side deleteMyAccount() couldn't touch itself (see
 * lib/accountDeletion.js), then marks the request 'completed'.
 *
 * Each step is independent and non-fatal on its own (a missing doc, or
 * one collection's failure, shouldn't block the rest) EXCEPT the
 * provider step, which can legitimately throw (still-verified provider)
 * — that error is allowed to propagate so the Founder sees it and can
 * deactivate the listing first, rather than the request silently
 * marking 'completed' while a live provider account is left behind.
 *
 * @param {string} requestId - same as the account's uid (deterministic doc id)
 */
export async function resolveAccountDeleteRequest(requestId) {
  const reqSnap = await getDoc(doc(db, COLLECTION, requestId));
  if (!reqSnap.exists()) return;
  const reqData = reqSnap.data();
  const uid = reqData.uid || requestId;

  // Read students/{uid}.groupId BEFORE deleting that doc — needed below
  // for the CR/ACR-blocked membership cleanup.
  let groupIdForMembershipCleanup = null;
  try {
    const studentSnap = await getDoc(doc(db, 'students', uid));
    if (studentSnap.exists()) groupIdForMembershipCleanup = studentSnap.data()?.groupId || null;
  } catch (err) {
    console.warn('[accountDeleteRequests] reading students/{uid}.groupId failed:', err);
  }

  // Faculty — via the existing admin helper. NOTE: this does NOT touch
  // faculty/{uid}/classIndex or faculty/{uid}/meetings — firestore.rules
  // scopes both to owner-only (request.auth.uid == uid), no isAdmin()
  // branch, so even the Founder's session can't reach another account's
  // docs there. Same documented limitation adminDeleteFaculty() already
  // has in facultySync.js. Harmless if left behind: unreadable by
  // anyone once faculty/{uid} itself is gone, since every read path in
  // this app resolves through the parent doc first.
  try {
    await adminDeleteFaculty(uid);
  } catch (err) {
    console.warn('[accountDeleteRequests] adminDeleteFaculty failed:', err);
  }

  // Provider — via the existing admin helper. Deliberately NOT
  // try/caught here: adminDeleteProvider throws on purpose if the
  // listing is still 'verified'/active, and that should stop this
  // whole resolve so the Founder sees it and deactivates first, rather
  // than the request quietly completing with a live listing untouched.
  await adminDeleteProvider(uid);

  try {
    const activitySnap = await getDoc(doc(db, 'activity', uid));
    if (activitySnap.exists()) {
      const moduleUsageSnap = await getDocs(collection(db, 'activity', uid, 'moduleUsage'));
      await Promise.all(moduleUsageSnap.docs.map((d) => deleteDoc(d.ref).catch(() => null)));
      await deleteDoc(doc(db, 'activity', uid));
    }
  } catch (err) {
    console.warn('[accountDeleteRequests] activity cleanup failed:', err);
  }

  try {
    await deleteIfExists(doc(db, 'emailFlags', uid));
  } catch (err) {
    console.warn('[accountDeleteRequests] emailFlags cleanup failed:', err);
  }

  // Staff roles — via removeRole() per existing role doc, not a blind
  // deleteDoc, so the depts/{dept}/meta/sclStatus and
  // groups/{gid}/meta/clStatus mirror docs get cleared too instead of
  // pointing at a uid that no longer exists.
  try {
    const rolesSnap = await getDocs(collection(db, 'staff', uid, 'roles'));
    for (const roleDoc of rolesSnap.docs) {
      const data = roleDoc.data();
      if (data?.role) {
        await removeRole(uid, data.role, data.scope).catch((err) =>
          console.warn('[accountDeleteRequests] removeRole failed for', roleDoc.id, err)
        );
      }
    }
  } catch (err) {
    console.warn('[accountDeleteRequests] staff roles cleanup failed:', err);
  }

  try {
    await deleteIfExists(doc(db, 'students', uid));
  } catch (err) {
    console.warn('[accountDeleteRequests] students cleanup failed:', err);
  }

  try {
    await deleteIfExists(doc(db, 'users', uid));
  } catch (err) {
    console.warn('[accountDeleteRequests] users cleanup failed:', err);
  }

  // CR/ACR-blocked group membership — flagged by the client at request
  // time (see lib/accountDeletion.js's groupLeaveBlocked). Admin has an
  // unconditional delete branch on groups/{groupId}/members/{uid} even
  // while role is 'cr'/'acr' (the block only applies to the member
  // deleting THEMSELF), so this is safe to do here even though the
  // person's own client couldn't do it.
  const blockedNote = (reqData.pendingAdminCleanup || []).find((n) =>
    typeof n === 'string' && n.startsWith('groups/{groupId}/members/{uid}')
  );
  if (blockedNote && groupIdForMembershipCleanup) {
    try {
      await deleteIfExists(doc(db, 'groups', groupIdForMembershipCleanup, 'members', uid));
    } catch (err) {
      console.warn('[accountDeleteRequests] CR/ACR membership cleanup failed:', err);
    }
  }

  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'completed',
    resolvedAt: serverTimestamp(),
    resolvedBy: auth.currentUser?.uid || null,
  });
}
