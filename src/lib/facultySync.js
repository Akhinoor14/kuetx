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
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
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
  }, (err) => {
    console.error('[facultySync] subscribeFacultyProfile error:', err);
    callback(null);
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
  const ref = facultyDocRef(uid);
  const payload = {
    ...(name !== undefined ? { name } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(dept !== undefined ? { dept } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(officeRoom !== undefined ? { officeRoom } : {}),
    ...(photoUrl !== undefined ? { photoUrl } : {}),
    ...(preferredName !== undefined ? { preferredName } : {}),
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(ref, payload);
  } catch (err) {
    // BUGFIX: updateDoc() throws 'permission-denied' — indistinguishable
    // client-side from a genuine rules rejection — when the target
    // document doesn't exist at all, not just when the write is actually
    // disallowed. buildQueue() in App.jsx deliberately routes an account
    // with no faculty/{uid} shell yet (e.g. createFacultyAccountDoc()
    // failed or was interrupted at Role Select — network blip, ad-blocker,
    // tab closed mid-request, etc.) into this same Profile Setup screen
    // rather than leaving it stuck with nothing queued — see that file's
    // buildQueue() comment. So this save path has to be able to complete
    // even when the shell was never created, not just update an existing
    // one. We only self-heal on 'not-found'-shaped denial (i.e. no doc
    // exists yet); a real rules rejection on an EXISTING doc — someone
    // else's uid, or verifiedAt tampering — must still surface as an
    // error rather than being papered over here.
    const snap = await getDoc(ref).catch(() => null);
    if (snap && !snap.exists()) {
      await setDoc(ref, {
        officialEmail: String(auth.currentUser?.email || '').trim().toLowerCase(),
        verifiedAt: null,
        careerStats: { uniqueStudentsTaught: 0, classesCompleted: 0 },
        createdAt: serverTimestamp(),
        ...payload,
      });
      return;
    }
    throw err;
  }
}

export async function listAllFacultyAccounts() {
  const snap = await getDocs(facultyCollectionRef());
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}

export function isFacultyProfileComplete(fdoc) {
  if (!fdoc) return false;
  // BUGFIX: this used to also require fdoc.verifiedAt to be truthy. Under
  // the manual verification policy, verifiedAt stays null until an Admin
  // grants the Blue Tick (firestore.rules only lets Admin set it — a
  // faculty account can never self-verify), so that condition was
  // permanently false for every not-yet-approved account. buildQueue()
  // re-checks this function right after FacultyProfileSetupModal's onSave
  // fires; with verifiedAt in the check, saveFacultyProfile() would
  // succeed (fields genuinely saved) but isFacultyProfileComplete() would
  // still return false, so buildQueue() pushed 'faculty-profile' right
  // back onto the queue and the modal reopened instantly — clicking
  // "Finish Setup" looked like it did nothing ("click korle kono kaj hoy
  // na"), even though the save itself worked. verifiedAt is purely the
  // Blue Tick flag (gates actually teaching — creating class assignments,
  // logging sessions, posting notices, entering marks — via RequireFaculty
  // / firestore.rules' isVerifiedFaculty), not a profile-completeness
  // signal, so it deliberately stays out of this check.
  return Boolean(
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
 * { status: 'success' }.
 *
 * MANUAL VERIFICATION POLICY: this does NOT set faculty/{uid}.verifiedAt
 * (the "Blue Tick") — Firestore rules only allow an Admin to do that (see
 * firestore.rules' faculty/{uid} update rule), and rightly so: clicking a
 * magic link only proves the person controls a *.kuet.ac.bd mailbox, not
 * that Admin has reviewed/approved the account. An earlier version of
 * this function tried to self-write verifiedAt here — that write was
 * always silently rejected by the rules (a faculty account changing its
 * own verifiedAt from null to non-null never matches the self-update
 * branch), so it was dead code that looked like it worked but never did.
 *
 * All this does now is confirm verifiedFacultyEmails/{email} exists —
 * i.e. the magic link really was completed — so the caller can show
 * "email verified, waiting on Admin approval" instead of a false
 * "verification failed" message. The actual Blue Tick is granted from
 * AdminDashboard's Faculty → Pending tab.
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
  // Self-heal a stored officialEmail that was saved with the old
  // (non-lowercased) logic — this write is allowed (it only touches
  // officialEmail, not verifiedAt, and the self-update branch permits a
  // faculty account editing its own non-verifiedAt fields).
  const ref = facultyDocRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.officialEmail !== normalizedEmail) {
    await updateDoc(ref, { officialEmail: normalizedEmail });
  }
  return true;
}

/** Convenience for the current signed-in user — most call sites don't have a uid handy otherwise. */
export function getCurrentFacultyUid() {
  return auth.currentUser?.uid || null;
}

/**
 * Admin-only: grant the Blue Tick directly from AdminDashboard's Faculty
 * → Pending tab. This is THE way verifiedAt gets set now — Firestore
 * rules (faculty/{uid} update rule) only allow an Admin to touch
 * verifiedAt/verifiedBy, and only those two keys, so this call is safe to
 * expose as a plain button click with no extra confirmation dance needed
 * client-side (the rules are the real enforcement).
 */
export async function adminVerifyFaculty(uid) {
  await updateDoc(facultyDocRef(uid), {
    verifiedAt: serverTimestamp(),
    verifiedBy: auth.currentUser?.uid || null,
  });
}

/**
 * Admin-only: remove a faculty account entirely — covers both a mistaken
 * approval (Verified) and rejecting a bad Pending signup. Firestore rules
 * (faculty/{uid} delete rule) restrict this to Admin already, so this is
 * safe to expose as a plain button click, same as adminVerifyFaculty
 * above. Does NOT touch the underlying Firebase Auth account or any
 * facultyAssignments the teacher already joined — those are separate
 * collections with their own lifecycle; this only removes the faculty
 * directory entry itself. If the person signs back in afterward, they'll
 * go through profile setup + verification again as if new.
 */
export async function adminDeleteFaculty(uid) {
  await deleteDoc(facultyDocRef(uid));
}