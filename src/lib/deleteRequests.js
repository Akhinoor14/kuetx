// deleteRequests.js
//
// Question Bank DELETE-request pipeline: a Campus Lead can never remove a
// live public paper directly (see qbUploadRequests.js for how it got
// published in the first place) — they select one or more papers and
// submit a deleteRequests/{id} review doc instead. Only Founder or Head
// of Ops can act on it; approving calls the Worker's
// DELETE /public-object, which is the only thing that actually removes
// the R2 object. Bulk-friendly: one doc holds N items, each individually
// approvable/rejectable, same "batch upload = many independent rows"
// shape as qbUploadRequests.
//
// Mirrors qbUploadRequests.js's submit -> subscribe -> approve/reject
// lifecycle on purpose.

import {
  collection, doc, addDoc, getDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

const COLLECTION = 'deleteRequests';
const WORKER_URL = import.meta.env.VITE_QB_WORKER_URL;

/**
 * Campus Lead submits a bulk (or single) delete request for one or more
 * live papers in their own group's dept.
 *
 * @param {{groupId, dept}} meta
 * @param {Array<{key, dept, term, courseCode, label}>} items - full R2
 *   object key per item, plus display fields for the review UI.
 */
export async function submitDeleteRequest(meta, items) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!meta?.groupId || !meta?.dept) throw new Error('Missing groupId/dept');
  if (!Array.isArray(items) || items.length === 0) throw new Error('No papers selected');

  const docRef = await addDoc(collection(db, COLLECTION), {
    requestedBy: uid,
    groupId: meta.groupId,
    dept: meta.dept,
    status: 'pending',
    requestedAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    items: items.map((item) => ({ ...item, status: 'pending' })),
  });
  return docRef.id;
}

/** Founder/Head of Ops view — every pending delete request, oldest first. */
export function subscribePendingDeleteRequests(callback) {
  return onSnapshot(
    query(collection(db, COLLECTION), where('status', '==', 'pending'), orderBy('requestedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

// Partial-batch bookkeeping: given the item list as it will be AFTER this
// action, figure out the parent doc's rolled-up status. 'partial' when
// the batch is a mix of deleted/rejected, 'approved' only once every item
// resolved to deleted, 'rejected' only once every item resolved to
// rejected, otherwise stays 'pending' (some items still pending review).
function rollupStatus(items) {
  const stillPending = items.some((i) => i.status === 'pending');
  if (stillPending) return 'pending';
  const allDeleted = items.every((i) => i.status === 'deleted');
  const allRejected = items.every((i) => i.status === 'rejected');
  if (allDeleted) return 'approved';
  if (allRejected) return 'rejected';
  return 'partial';
}

/**
 * Founder/Head of Ops approves one or more items within a request. Calls
 * the Worker to actually delete the R2 objects, then updates each
 * approved item's status based on which keys the Worker confirms it
 * removed (matches the "some approved some rejected within a batch"
 * requirement — an item the Worker reports as notFound is marked
 * 'failed' rather than silently left pending forever).
 *
 * @param {string} requestId
 * @param {string[]} keys - full R2 keys of the items being approved now
 */
export async function approveDeleteRequestItems(requestId, keys) {
  if (!WORKER_URL) throw new Error('VITE_QB_WORKER_URL is not configured');
  if (!Array.isArray(keys) || keys.length === 0) return;

  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`${WORKER_URL}/public-object`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete');

  const deletedSet = new Set(data.deleted || []);
  const notFoundSet = new Set(data.notFound || []);

  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return;
  const reqData = snap.data();
  const reviewerUid = auth.currentUser?.uid;

  const nextItems = reqData.items.map((item) => {
    if (!keys.includes(item.key)) return item;
    if (deletedSet.has(item.key)) return { ...item, status: 'deleted' };
    if (notFoundSet.has(item.key)) return { ...item, status: 'failed' };
    return item;
  });

  await updateDoc(doc(db, COLLECTION, requestId), {
    items: nextItems,
    status: rollupStatus(nextItems),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Founder/Head of Ops rejects one or more items within a request. No
 * Worker call — nothing to delete, this just marks those items rejected.
 *
 * @param {string} requestId
 * @param {string[]} keys - full R2 keys of the items being rejected now
 */
export async function rejectDeleteRequestItems(requestId, keys) {
  if (!Array.isArray(keys) || keys.length === 0) return;

  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return;
  const reqData = snap.data();
  const reviewerUid = auth.currentUser?.uid;

  const nextItems = reqData.items.map((item) =>
    keys.includes(item.key) ? { ...item, status: 'rejected' } : item
  );

  await updateDoc(doc(db, COLLECTION, requestId), {
    items: nextItems,
    status: rollupStatus(nextItems),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
  });
}
