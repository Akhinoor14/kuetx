// manualVerifyRequests.js
//
// Fallback path for institutional (KUET email) verification when the
// automatic Firebase email-link flow can't send — e.g. the daily
// send-quota is used up. Rather than leaving the person stuck, they can
// submit a manual verification request here (same shape for student and
// faculty, distinguished by `role`), which appears in the Founder's
// Approvals tab exactly like CL applications / CR requests already do.
// Approving here writes the same durable "verified" fact the automatic
// flow would have written, so downstream code never needs to know which
// path a given verification came through.

import {
  collection, doc, addDoc, getDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { syncFacultyVerificationStatus } from './facultySync';

const COLLECTION = 'manualVerifyRequests';

/**
 * Submit a manual verification request. Called from the fallback UI once
 * automatic sending has failed (auth/quota-exceeded or similar).
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
  return onSnapshot(
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
