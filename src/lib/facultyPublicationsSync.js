// facultyPublicationsSync.js
//
// CRUD + subscriptions for facultyPublications/{docId} — the collection
// seeded daily by scripts/kuet_faculty_scraper.py (profile-page scrape of
// KUET's own department sites) and ALSO directly editable by the owning
// teacher from /faculty/publications.
//
// MANUAL-WINS CONTRACT (read before touching this file or the scraper):
// every write that goes through this file sets isManuallyEdited: true.
// The scraper checks that flag before every write and permanently skips
// any doc where it's true — see push_to_firestore() in
// kuet_faculty_scraper.py. The reason a teacher edits a scraped entry in
// the first place is that the scraper got something wrong, so once a
// human has touched a doc, that correction outranks every future scrape
// forever (not just the next run). There is no "revert to scraped
// version" path — if a teacher wants the scraped version back, they'd
// have to delete their doc and wait for the next scrape to re-add it as
// a fresh scraper-owned entry.
//
// firestore.rules enforces teacherEmail on the doc must equal the
// caller's auth token email for create/update/delete — this file relies
// on that for the actual security boundary, not on anything client-side.

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const PUBLICATIONS_COLLECTION = 'facultyPublications';

/**
 * Live-subscribe to one teacher's own publications, newest year first.
 * Used by PublicationsCard.jsx (profile preview) and the faculty-side
 * /faculty/publications edit view. Returns the unsubscribe function —
 * caller must call it on unmount.
 */
export function subscribeToTeacherPublications(teacherEmail, onChange, onError) {
  const normalizedEmail = String(teacherEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, PUBLICATIONS_COLLECTION),
    where('teacherEmail', '==', normalizedEmail),
    orderBy('year', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/**
 * Live-subscribe to EVERY publication across every teacher — backs the
 * standalone /publications (student) and /faculty/publications (faculty)
 * browse pages, which share the same PublicationsBrowse.jsx component.
 * No department/year filtering is done server-side here on purpose: the
 * whole collection is expected to stay small enough (one doc per
 * publication, a few thousand rows at KUET's scale) that client-side
 * filtering in the page component is simpler than maintaining composite
 * indexes for every filter combination. Revisit if the collection grows
 * large enough that this read becomes expensive.
 */
export function subscribeToAllPublications(onChange, onError) {
  const q = query(collection(db, PUBLICATIONS_COLLECTION), orderBy('year', 'desc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/**
 * Add a brand-new publication the teacher typed in themselves (not
 * present on the KUET site at all). Always flagged isManuallyEdited so
 * the scraper never touches or dedupes against it.
 */
export async function addPublication(teacherEmail, fields) {
  const normalizedEmail = String(teacherEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('addPublication: teacherEmail is required');

  // Denormalize teacherName + teacherDeptCode from facultyDirectory (same
  // fields the scraper stamps on scraper-created docs — see
  // push_to_firestore() in kuet_faculty_scraper.py) so a hand-added
  // publication shows and filters correctly on the combined
  // /publications browse page too, not just scraped ones.
  let teacherName = null;
  let teacherDeptCode = null;
  try {
    const dirSnap = await getDoc(doc(db, 'facultyDirectory', normalizedEmail));
    if (dirSnap.exists()) {
      const dirData = dirSnap.data();
      teacherName = dirData.name || null;
      teacherDeptCode = dirData.department || null;
    }
  } catch {
    // Non-fatal — the publication still saves without these, just won't
    // show a name/department on the browse page until the next scrape
    // links it up (it never will, since the doc is manually-edited — see
    // module header — so this is a best-effort lookup, not required).
  }

  return addDoc(collection(db, PUBLICATIONS_COLLECTION), {
    teacherEmail: normalizedEmail,
    teacherName,
    teacherDeptCode,
    title: fields.title || null,
    authors: fields.authors || null,
    venue: fields.venue || null,
    year: fields.year || null,
    link: fields.link || null,
    volume: fields.volume || null,
    issue: fields.issue || null,
    pages: fields.pages || null,
    category: fields.category || 'Other',
    raw_citation: fields.raw_citation || fields.title || '',
    source: 'manual',
    isManuallyEdited: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Edit an existing publication — whether it started as a scraper entry
 * or a manual one. Either way this flips isManuallyEdited: true, which
 * is what actually excludes it from future scraper overwrites (see
 * module header). Only pass the fields that changed; existing fields on
 * the doc not included in `fields` are left as-is (updateDoc, not set).
 */
export async function updatePublication(docId, fields) {
  if (!docId) throw new Error('updatePublication: docId is required');
  return updateDoc(doc(db, PUBLICATIONS_COLLECTION, docId), {
    ...fields,
    source: 'manual',
    isManuallyEdited: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a publication. firestore.rules requires the doc's teacherEmail
 * to match the caller's own auth email, so this can never delete another
 * teacher's entry even if a stale docId were passed in.
 */
export async function deletePublication(docId) {
  if (!docId) throw new Error('deletePublication: docId is required');
  return deleteDoc(doc(db, PUBLICATIONS_COLLECTION, docId));
}
