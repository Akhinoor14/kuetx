// bloodDonorSync.js
//
// Blood Bank directory — Founder-facing search by blood group (see
// AdminDashboard.jsx's BloodBankView / founderCategories.js's 'blood'
// entry). This is deliberately a SEPARATE top-level collection from the
// student's personal profile store (students/{dept}/{batch}/{uid} as of
// the Phase 5 migration — previously users/{uid}/data/profile), which is
// owner-read-only (see firestore.rules match /students/{dept}/{batch}/{uid})
// and therefore not something the Founder can query across all students.
//
// bloodDonors/{uid} mirrors the faculty/{uid} pattern: one small doc per
// student, containing only what the Blood Bank search actually needs
// (name, roll, dept, bloodGroup) — never the full profile. Write is
// restricted to the owning uid; read is open to any signed-in user (same
// rationale as faculty/{uid}: this is basic directory info, not private
// data, and the whole point of the feature is other people finding it in
// an emergency). See firestore.rules match /bloodDonors/{uid}.
//
// Called from App.jsx right after a student's profile save succeeds
// (mirrors how ProfileSetupModal's onSave already writes the local
// profile — this just fans the four directory-relevant fields out to the
// separate collection in the same moment). If bloodGroup is empty, the
// doc is deleted instead of written with a blank value, so an empty
// blood-group search filter never matches "everyone who has an account."

import { doc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const bloodDonorDocRef = (uid) => doc(db, 'bloodDonors', uid);
const bloodDonorCollectionRef = () => collection(db, 'bloodDonors');

/**
 * Sync (or clear) this student's Blood Bank directory entry from their
 * saved profile. Safe to call on every profile save — a no-op write when
 * nothing directory-relevant changed, and cheap either way (single doc).
 */
export async function syncBloodDonorEntry(uid, profile) {
  if (!uid) return;
  const bloodGroup = String(profile?.bloodGroup || '').trim();
  if (!bloodGroup) {
    // No blood group on file (or it was cleared) — remove any existing
    // entry rather than leaving a stale/blank one searchable.
    await deleteDoc(bloodDonorDocRef(uid)).catch(() => {});
    return;
  }
  await setDoc(bloodDonorDocRef(uid), {
    name: String(profile?.name || '').trim(),
    studentId: String(profile?.studentId || '').trim(),
    dept: String(profile?.dept || '').trim(),
    bloodGroup,
  }, { merge: true });
}

/** All donors with a given blood group — powers the Founder search page. */
export async function searchBloodDonorsByGroup(bloodGroup) {
  const bg = String(bloodGroup || '').trim().toUpperCase();
  if (!bg) return [];
  const q = query(bloodDonorCollectionRef(), where('bloodGroup', '==', bg));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Every donor on file, for the Founder's overview counts. */
export async function listAllBloodDonors() {
  const snap = await getDocs(bloodDonorCollectionRef());
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
