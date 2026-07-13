// facultySync.js
//
// CRUD for faculty/{uid} — the Faculty Account doc (see
// MERGED_FACULTY_MODULE_PROMPT.md §3). Deliberately top-level (not
// group-scoped like routineEntries/plannerLogEntries), since one faculty
// account can teach across many dept+batch groups over a career.
//
// verifiedAt stays null until the magic-link flow (facultyEmailVerify.js)
// has actually recorded verifiedFacultyEmails/{officialEmail} — this file
// is what bridges that fact from the secondary-app verify collection back
// onto the main faculty/{uid} doc. Firestore rules enforce that
// verifiedAt can ONLY be set this way, never written directly by the
// client with an arbitrary value (see §10 of the spec) — this function
// just reflects that fact locally once it's true.

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { isFacultyEmailVerified } from './facultyEmailVerify';

const facultyDocRef = (uid) => doc(db, 'faculty', uid);
const facultyCollectionRef = () => collection(db, 'faculty');

/**
 * Create the initial faculty/{uid} shell right after account creation
 * (email+password, no Google Sign-In — Deviation 3). verifiedAt is
 * explicitly null here; the Teacher shell stays locked until the magic
 * link is clicked (Deviation 2, hard gate).
 */
export async function createFacultyShell(uid, officialEmail) {
  const ref = facultyDocRef(uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const data = {
    // BUGFIX: was `.trim()` only, no `.toLowerCase()`. Firebase Auth
    // always stores/returns emails lowercased (result.user.email from the
    // magic-link/OTP verify session is always lowercase), and
    // verifiedFacultyEmails/{email} is keyed by that same lowercase
    // value. If someone typed their email with any uppercase at
    // Register, officialEmail here kept the original casing — so
    // firestore.rules' exists(verifiedFacultyEmails/$(officialEmail))
    // check silently failed (case-sensitive doc-path lookup), verifiedAt
    // could never flip, and every subsequent verify attempt (link OR
    // code) looked successful but "didn't stick." This is what caused
    // "link diye verify korar poreo website bole verified na" even
    // though completeFacultyVerificationLink()/verifyOtp() both
    // genuinely succeeded — the mismatch was one level up, in the
    // update() this fact bridges into.
    officialEmail: String(officialEmail || '').trim().toLowerCase(),
    name: '',
    title: '',
    dept: '',
    preferredName: null,
    verifiedAt: null,
    careerStats: { uniqueStudentsTaught: 0, classesCompleted: 0 },
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  return data;
}

/** Plain one-shot read of the current user's faculty doc. Returns null if it doesn't exist. */
export async function getFacultyProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(facultyDocRef(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** Live subscription to the current user's faculty doc — used by useIsFaculty and the profile page. */
export function subscribeFacultyProfile(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(facultyDocRef(uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  });
}

/**
 * Faculty Profile Setup save (§8.3) — name, title, dept, optional phone/
 * office/photo/preferredName. Never touches verifiedAt or officialEmail;
 * those are set exactly once, elsewhere, by the account-creation and
 * verification steps respectively.
 */
export async function saveFacultyProfile(uid, fields) {
  const {
    name, title, dept, phone, officeRoom, photoUrl, preferredName,
  } = fields || {};
  await updateDoc(facultyDocRef(uid), {
    ...(name !== undefined ? { name } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(dept !== undefined ? { dept } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(officeRoom !== undefined ? { officeRoom } : {}),
    ...(photoUrl !== undefined ? { photoUrl } : {}),
    ...(preferredName !== undefined ? { preferredName } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function listAllFacultyAccounts() {
  const snap = await getDocs(facultyCollectionRef());
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}

export function isFacultyProfileComplete(fdoc) {
  if (!fdoc) return false;
  return Boolean(
    fdoc.verifiedAt &&
    String(fdoc.name || '').trim() &&
    String(fdoc.title || '').trim() &&
    String(fdoc.dept || '').trim()
  );
}

export const getFacultyDoc = getFacultyProfile;
export const subscribeFacultyDoc = subscribeFacultyProfile;
export const createFacultyAccountDoc = createFacultyShell;
export const markFacultyVerifiedIfEmailConfirmed = syncFacultyVerificationStatus;

/**
 * Called from the magic-link completion screen (App.jsx onboarding queue,
 * §5 Step 2.3) once completeFacultyVerificationLink() returns
 * { status: 'success' }. Re-checks verifiedFacultyEmails/{email} itself
 * rather than trusting the caller blindly, then flips faculty/{uid}
 * .verifiedAt — this is the ONLY place in the client that ever sets
 * verifiedAt, and Firestore rules additionally restrict this field so a
 * client can't just set it directly out of band (see rules note in
 * MERGED_FACULTY_MODULE_PROMPT.md §10).
 */
export async function syncFacultyVerificationStatus(uid, officialEmail) {
  // Defensive lowercase here too — protects existing faculty/{uid} docs
  // created BEFORE the officialEmail-casing fix in createFacultyShell()
  // above, which may still hold a mixed-case value. isFacultyEmailVerified
  // reads verifiedFacultyEmails/{email} by exact doc ID, and that
  // collection is always written lowercase (Firebase Auth's own casing),
  // so normalizing the lookup key here is what actually matters — not
  // relying on the caller (or an old stored doc) to already be lowercase.
  const normalizedEmail = String(officialEmail || '').trim().toLowerCase();
  const isVerified = await isFacultyEmailVerified(normalizedEmail);
  if (!isVerified) return false;
  const ref = facultyDocRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.verifiedAt) return true; // already synced
  // Also self-heal the stored officialEmail if it was saved with the old
  // (non-lowercased) logic — otherwise the *next* sync attempt would hit
  // the exact same rules mismatch again via resource.data.officialEmail.
  const updates = { verifiedAt: serverTimestamp() };
  if (snap.exists() && snap.data()?.officialEmail !== normalizedEmail) {
    updates.officialEmail = normalizedEmail;
  }
  await updateDoc(ref, updates);
  return true;
}

/** Convenience for the current signed-in user — most call sites don't have a uid handy otherwise. */
export function getCurrentFacultyUid() {
  return auth.currentUser?.uid || null;
}
