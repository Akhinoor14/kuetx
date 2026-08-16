// pendingPublicationsSync.js
//
// Community-submitted publication queue for the Founder/Admin Approvals
// area — mirrors manualVerifyRequests.js's shape and lifecycle
// (submit -> pending -> approve/reject), scoped specifically to
// publications a student/alumni/any signed-in user submits on someone
// else's behalf from the public /publications browse page.
//
// This is DELIBERATELY separate from a teacher adding their own
// publication (facultyPublicationsSync.js's addPublication) — that path
// stays direct/unmoderated because the teacher is asserting authorship
// of their own record. A third party submitting on a teacher's behalf
// has no such authority, so it goes through Founder review first.
//
// Collection: pendingPublicationSubmissions/{autoId}
//   teacherEmail, teacherName, teacherDeptCode  — who this is claimed to be for
//   title, authors, venue, year, link, volume, issue, pages, category
//   submittedBy: { uid, displayName, email }    — who submitted it
//   status: 'pending' | 'approved' | 'rejected'
//   createdAt, resolvedAt, resolvedBy
//
// On approve: writes a normal doc into facultyPublications with
// source: 'community', isManuallyEdited: true (so the daily scraper
// permanently skips it, same manual-wins contract as a teacher's own
// edit — see facultyPublicationsSync.js's header), then marks the
// pending doc 'approved'. On reject: just marks it 'rejected' (kept for
// audit, not deleted, matching manualVerifyRequests.js's convention of
// keeping a trail rather than hard-deleting).
//
// firestore.rules (NOT YET WRITTEN — see handoff doc) needs to enforce:
//   - create: any signed-in user, but status/submittedBy.uid must match
//     the caller, and fields besides those must be plausible strings
//   - read: Founder/Admin roles only (this is a moderation queue, not
//     public browse data)
//   - update: Founder/Admin roles only, and only status/resolvedAt/
//     resolvedBy transitions — never touching the original submitted
//     content, so there's a clean audit trail of what was actually
//     submitted vs what got approved

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

const PENDING_COLLECTION = 'pendingPublicationSubmissions';
const PUBLICATIONS_COLLECTION = 'facultyPublications';

/**
 * Submit a publication on someone else's behalf, for Founder review.
 * Never writes directly to facultyPublications.
 *
 * @param {{
 *   teacherEmail: string, teacherName?: string, teacherDeptCode?: string,
 *   title: string, authors?: string, venue?: string, year?: string,
 *   link?: string, volume?: string, issue?: string, pages?: string, category?: string,
 * }} details
 */
export async function submitPublicationForReview(details) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to submit a publication.');

  const teacherEmail = String(details?.teacherEmail || '').trim().toLowerCase();
  const title = String(details?.title || '').trim();
  if (!teacherEmail) throw new Error('Teacher email is required.');
  if (!title) throw new Error('Title is required.');

  await addDoc(collection(db, PENDING_COLLECTION), {
    teacherEmail,
    teacherName: String(details?.teacherName || '').trim() || null,
    teacherDeptCode: String(details?.teacherDeptCode || '').trim() || null,
    title,
    authors: String(details?.authors || '').trim() || null,
    venue: String(details?.venue || '').trim() || null,
    year: String(details?.year || '').trim() || null,
    link: String(details?.link || '').trim() || null,
    volume: String(details?.volume || '').trim() || null,
    issue: String(details?.issue || '').trim() || null,
    pages: String(details?.pages || '').trim() || null,
    category: String(details?.category || '').trim() || 'Journal',
    submittedBy: {
      uid: user.uid,
      displayName: user.displayName || null,
      email: user.email || null,
    },
    status: 'pending',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });
}

/** Live-subscribe to all pending (status === 'pending') submissions — for the Founder/Admin Approvals tab. */
export function subscribePendingPublicationSubmissions(onChange, onError) {
  const q = query(
    collection(db, PENDING_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn('[pendingPublicationsSync] subscribe failed', err); onError?.(err); }
  );
}

/**
 * Approve a pending submission: writes it into facultyPublications as a
 * real, scraper-protected entry, then marks the pending doc resolved.
 * @param {object} submission - the full pending doc (including id), as received from subscribePendingPublicationSubmissions.
 */
export async function approvePublicationSubmission(submission) {
  const approver = auth.currentUser;
  if (!approver) throw new Error('You must be signed in to approve a submission.');
  if (!submission?.id) throw new Error('Missing submission id.');

  await addDoc(collection(db, PUBLICATIONS_COLLECTION), {
    teacherEmail: submission.teacherEmail,
    teacherName: submission.teacherName || null,
    teacherDeptCode: submission.teacherDeptCode || null,
    title: submission.title,
    authors: submission.authors || null,
    venue: submission.venue || null,
    year: submission.year || null,
    link: submission.link || null,
    volume: submission.volume || null,
    issue: submission.issue || null,
    pages: submission.pages || null,
    category: submission.category || 'Journal',
    raw_citation: null,
    source: 'community',
    isManuallyEdited: true, // scraper must never overwrite a Founder-approved community submission
    scraped_at: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, PENDING_COLLECTION, submission.id), {
    status: 'approved',
    resolvedAt: serverTimestamp(),
    resolvedBy: approver.uid,
  });
}

/** Reject a pending submission — kept for audit (status flips to 'rejected'), not deleted. */
export async function rejectPublicationSubmission(submissionId) {
  const approver = auth.currentUser;
  if (!approver) throw new Error('You must be signed in to reject a submission.');
  if (!submissionId) throw new Error('Missing submission id.');

  await updateDoc(doc(db, PENDING_COLLECTION, submissionId), {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
    resolvedBy: approver.uid,
  });
}

/** Hard-delete a resolved (approved/rejected) submission — for cleanup only, never called on a still-pending doc. */
export async function deletePublicationSubmission(submissionId) {
  if (!submissionId) throw new Error('Missing submission id.');
  await deleteDoc(doc(db, PENDING_COLLECTION, submissionId));
}
