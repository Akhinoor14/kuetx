// facultySync.js
//
// CRUD + live subscription for the faculty/{uid} document — the Faculty
// Module's analogue of groupSync.js's member-profile handling. Follows the
// same conventions used elsewhere in this codebase: identity stamps on
// writes, serverTimestamp() for created/updated markers, and a single
// singleton-style subscription helper rather than ad-hoc onSnapshot calls
// scattered across pages.
//
// Deviation 2 (hard gate) is enforced here, not just in the UI: this file
// is the ONLY place that ever sets faculty/{uid}.verifiedAt, and it only
// does so after confirming verifiedFacultyEmails/{email} actually exists
// (see markFacultyVerifiedIfEmailConfirmed below). Firestore rules should
// additionally block any client write to verifiedAt directly (see §10 of
// the merged prompt) — this file assumes that rule exists and is not
// itself the security boundary, just the intended call path.

import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { isFacultyEmailInstitutionallyVerified } from './facultyEmailVerify';

function facultyDocRef(uid) {
  return doc(db, 'faculty', uid);
}

/**
 * Create the faculty/{uid} doc right after account creation (§5 Step 2 of
 * the merged prompt). Always starts with verifiedAt: null — the Teacher
 * shell stays locked until the magic-link flow confirms mailbox ownership.
 * Safe to call again for the same uid (merge: true) in case signup is
 * retried after a transient failure.
 */
export async function createFacultyAccountDoc(uid, officialEmail) {
  const ref = facultyDocRef(uid);
  await setDoc(ref, {
    officialEmail: String(officialEmail || '').trim(),
    verifiedAt: null,
    name: null,
    title: null,
    dept: null,
    preferredName: null,
    careerStats: { uniqueStudentsTaught: 0, classesCompleted: 0 },
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Called from the verification holding screen once the magic link has been
 * clicked (facultyEmailVerify.js's completeFacultyVerificationLink resolved
 * with status: 'success'). Re-checks verifiedFacultyEmails/{email} directly
 * before writing verifiedAt — belt-and-suspenders against a stale/replayed
 * call reaching this function without the underlying proof actually existing.
 */
export async function markFacultyVerifiedIfEmailConfirmed(uid, officialEmail) {
  const email = String(officialEmail || '').trim();
  const confirmed = await isFacultyEmailInstitutionallyVerified(email, db);
  if (!confirmed) {
    throw new Error('Verification record not found yet — please use the link from your inbox.');
  }
  await updateDoc(facultyDocRef(uid), {
    verifiedAt: serverTimestamp(),
  });
  return true;
}

/**
 * Faculty Profile Setup (§5 Step 3) — Name, Title, Department, optional
 * Phone/Office/Photo/preferredName. Does not touch verifiedAt/officialEmail/
 * careerStats — those are managed elsewhere.
 */
export async function saveFacultyProfile(uid, { name, title, dept, phone, officeRoom, photoUrl, preferredName }) {
  await updateDoc(facultyDocRef(uid), {
    name: String(name || '').trim(),
    title: String(title || '').trim(),
    dept: String(dept || '').trim(),
    phone: phone ? String(phone).trim() : null,
    officeRoom: officeRoom ? String(officeRoom).trim() : null,
    photoUrl: photoUrl || null,
    preferredName: preferredName ? String(preferredName).trim() : null,
  });
}

/** One-shot read — used by isFacultyProfileComplete() in App.jsx's buildQueue. */
export async function getFacultyDoc(uid) {
  const snap = await getDoc(facultyDocRef(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Live subscription to the current faculty doc — used by useIsFaculty.js
 * and the verification holding screen (to auto-advance the instant
 * verifiedAt flips from null to a timestamp, without a manual refresh).
 */
export function subscribeFacultyDoc(uid, callback) {
  if (!uid) {
    callback(null);
    return () => {};
  }
  return onSnapshot(facultyDocRef(uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  }, () => {
    callback(null);
  });
}

/** True once Name + Title + Department are all filled in — gates the
 * 'profile' buildQueue step for accountRole === 'teacher' (§5). */
export function isFacultyProfileComplete(facultyDoc) {
  return !!(facultyDoc?.name && facultyDoc?.title && facultyDoc?.dept);
}

/** Admin-only "list every faculty account" read, for §7's Admin Faculty
 * category (Directory + Signup Requests subcategories). Individual
 * faculty/{uid} reads are open to any signed-in user per §10, but a full
 * collection scan like this one is only ever called from
 * AdminDashboard.jsx, which is itself gated by RequireStaff/isAdmin at the
 * page level — not re-guarded here since every other "list all X" helper
 * this codebase already has (listAllGroups, etc.) follows the same
 * page-level-gate-only convention rather than duplicating an admin check
 * inside the data-layer function itself. */
export async function listAllFacultyAccounts() {
  const snap = await getDocs(collection(db, 'faculty'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

