// facultyClassSync.js
//
// CRUD for groups/{groupId}/facultyAssignments/{assignmentId} and the
// denormalized faculty/{uid}/classIndex/{assignmentId} fan-out pointer
// (§3, §8.4, §8.6 of the merged Faculty Module prompt). Follows the
// soft-delete convention used by groupSync.js's addRoutineEntry-family
// functions (status flag, never a hard Firestore delete) rather than
// reusing softDeleteEntry/restoreEntry verbatim — those two helpers are
// written specifically for groups/{groupId}/routineEntries's document
// shape (§0's reuse note calls out reusing the PATTERN, not literally
// importing functions whose queries are hardcoded to a different
// collection path). Kept the same status-flag idea here, scoped to this
// collection instead.

import {
  collection, collectionGroup, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { getGroupId } from './groupUtils';
import { isSlotOverlap } from './timeModels';

function assignmentsCollection(groupId) {
  return collection(db, 'groups', groupId, 'facultyAssignments');
}

function classIndexCollection(uid) {
  return collection(db, 'faculty', uid, 'classIndex');
}

/**
 * §8.4 "+ Add Class" — creates a brand-new Class Assignment with exactly
 * one teacher slot filled (the creator). A second teacher joins later via
 * joinFacultyAssignment(). Also writes the faculty/{uid}/classIndex fan-out
 * pointer so "My Classes" never needs a collectionGroup query across every
 * group in the app.
 */
export async function createFacultyAssignment(uid, {
  dept, batch, term, courseCode, courseTitle, courseType, dayTimeSlots, gridAlias, section,
}) {
  // section is required for the 4 multi-section depts (CE/EEE/ME/CSE) —
  // getGroupId() returns null without it for those depts, same as it does
  // for a missing dept/batch. Single-section depts pass section as
  // undefined/null and are unaffected.
  const groupId = getGroupId({ dept, batch, section });
  if (!groupId) throw new Error('Department, batch, and (for multi-section departments) section are required to create a class.');

  const docRef = await addDoc(assignmentsCollection(groupId), {
    teacherUids: [uid],
    displayName: null, // filled in once the teacher's faculty profile has a name (Phase 4 profile step)
    gridAlias: gridAlias || null,
    courseId: `${dept}:${term}:${courseCode}`,
    courseCode,
    courseTitle: courseTitle || '',
    courseType: courseType || 'Theory',
    term,
    dept,
    batch,
    section: section || null,
    dayTimeSlots: dayTimeSlots || [],
    plannedTotalClasses: null,
    status: 'active',
    createdBy: uid,
    createdAt: serverTimestamp(),
    endedAt: null,
  });

  await setDoc(doc(classIndexCollection(uid), docRef.id), {
    groupId, assignmentId: docRef.id, courseCode, dept, batch, section: section || null, term, status: 'active',
  });

  return docRef.id;
}

/**
 * §4 item 1 — joining an assignment someone else already started (the
 * "second teacher" case). Refuses if the assignment already has 2 teachers
 * (Deviation: always exactly 2, never more — §2 item 4) or already
 * includes this uid.
 */
export async function joinFacultyAssignment(uid, groupId, assignmentId) {
  const ref = doc(assignmentsCollection(groupId), assignmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('This class assignment no longer exists.');
  const data = snap.data();
  const teacherUids = data.teacherUids || [];
  if (teacherUids.includes(uid)) return; // already joined, no-op
  if (teacherUids.length >= 2) {
    throw new Error('This class already has two teachers assigned — contact your Campus Lead.');
  }
  await updateDoc(ref, { teacherUids: [...teacherUids, uid] });
  await setDoc(doc(classIndexCollection(uid), assignmentId), {
    groupId, assignmentId, courseCode: data.courseCode, dept: data.dept,
    batch: data.batch, term: data.term, status: data.status,
  });
}

/** §8.6 "End Class" — status flag only, never removes the doc. Attendance/
 * marks history under this assignment is untouched. */
export async function endFacultyAssignment(groupId, assignmentId) {
  await updateDoc(doc(assignmentsCollection(groupId), assignmentId), {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}

/**
 * Sets (or clears) how many total classes a faculty member plans to hold
 * for this course this term. This is what the Dashboard's "Classes
 * Remaining" stat card and the Sessions tab's "X of Y planned" line read
 * from — until this is called at least once, plannedTotalClasses stays
 * null and both of those just show a "set a plan" placeholder instead of
 * a number, since there's nothing to count down from.
 */
export async function setPlannedTotalClasses(groupId, assignmentId, total) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid number of classes (greater than 0).');
  }
  await updateDoc(doc(assignmentsCollection(groupId), assignmentId), {
    plannedTotalClasses: Math.round(n),
  });
}

/** §8.6 "Delete" — soft-delete flag distinct from "ended" (an ended class
 * is still visible in history/filters; a deleted one is hidden everywhere
 * except an explicit restore path, mirroring groupSync.js's soft-delete
 * convention for routineEntries). */
export async function softDeleteFacultyAssignment(groupId, assignmentId) {
  await updateDoc(doc(assignmentsCollection(groupId), assignmentId), {
    status: 'deleted',
    deletedAt: serverTimestamp(),
  });
}

export async function restoreFacultyAssignment(groupId, assignmentId) {
  await updateDoc(doc(assignmentsCollection(groupId), assignmentId), {
    status: 'active',
    deletedAt: null,
  });
}

/**
 * §4 item 2 companion check — this one is a WARNING, not a join-offer.
 * Looks in the same batch/dept group for any OTHER active, OTHER-course
 * assignment whose day+slot time-overlaps the one being picked (real
 * overlap via isSlotOverlap, not exact-string match — a 3-period
 * sessional block and a single-period theory class an hour into it still
 * count). This is about the batch's own timetable clashing (two different
 * courses claiming the same students at once), not one teacher's personal
 * schedule — that's why it's scoped to a single groupId and doesn't check
 * courseCode against itself. excludeAssignmentId lets an in-place edit
 * skip comparing an assignment's own current slot against itself.
 *
 * NOTE: this was imported by FacultyClasses.jsx from day one but never
 * actually defined here, so the "⚠️ overlaps the time you picked" warning
 * silently never fired (the caller wraps it in .catch(() => {}), so the
 * missing export failed quietly instead of crashing). Implemented now.
 *
 * Best-effort only: never throws, returns null on any read failure so a
 * transient permission/network hiccup can't block Create/Save.
 */
export async function findConflictingAssignment(groupId, { courseCode, term, dayTimeSlots, excludeAssignmentId }) {
  try {
    const q = query(
      assignmentsCollection(groupId),
      where('term', '==', term),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id === excludeAssignmentId) continue;
      const data = d.data();
      if (data.courseCode === courseCode) continue; // same course, not a clash
      const otherSlots = data.dayTimeSlots || [];
      for (const wanted of (dayTimeSlots || [])) {
        const hit = otherSlots.find((s) => s.day === wanted.day && isSlotOverlap(s.slot, wanted.slot));
        if (hit) {
          return {
            assignmentId: d.id, courseCode: data.courseCode, courseTitle: data.courseTitle,
            conflictingSlot: hit,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Edits an existing assignment's day/time (§8.6 "Edit day/time", called
 * out in FacultyClassDetail.jsx's header comment as not-yet-built — this
 * is that follow-up). Same collection/doc shape as createFacultyAssignment;
 * only dayTimeSlots changes.
 */
export async function updateAssignmentDayTimeSlots(groupId, assignmentId, dayTimeSlots) {
  if (!Array.isArray(dayTimeSlots) || dayTimeSlots.length === 0) {
    throw new Error('Pick a day and time for this class.');
  }
  await updateDoc(doc(assignmentsCollection(groupId), assignmentId), {
    dayTimeSlots,
  });
}


/**
 * One-shot read of every classIndex pointer for "My Classes" — cheap,
 * denormalized, no collectionGroup query needed (§3's stated rationale for
 * this fan-out collection existing at all).
 */
export async function getMyClassIndex(uid) {
  const snap = await getDocs(classIndexCollection(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Live subscription variant, for My Classes staying in sync without a
 * manual refresh (e.g. after creating a new class in the same session). */
export function subscribeMyClassIndex(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  return onSnapshot(classIndexCollection(uid), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    // BUGFIX CONTEXT: this error handler used to silently swallow every
    // failure and call back with an empty array — which is exactly what
    // made the missing firestore.rules block for this subcollection
    // invisible (it looked identical to "genuinely has no classes yet").
    // Keeping the empty-array callback (so the UI doesn't hard-crash) but
    // logging the real error means a future rules regression shows up in
    // the console instead of silently looking like empty state again.
    console.error('subscribeMyClassIndex failed — check firestore.rules for faculty/{uid}/classIndex:', err);
    callback([]);
  });
}

/** Full assignment doc for Class Detail (§8.5) — needs groupId, which the
 * classIndex pointer already carries, so callers always have it in hand
 * before calling this. */
export async function getFacultyAssignment(groupId, assignmentId) {
  const snap = await getDoc(doc(assignmentsCollection(groupId), assignmentId));
  return snap.exists() ? { id: assignmentId, groupId, ...snap.data() } : null;
}

export function subscribeFacultyAssignment(groupId, assignmentId, callback) {
  if (!groupId || !assignmentId) { callback(null); return () => {}; }
  return onSnapshot(doc(assignmentsCollection(groupId), assignmentId), (snap) => {
    callback(snap.exists() ? { id: assignmentId, groupId, ...snap.data() } : null);
  }, () => callback(null));
}

/**
 * §4 item 2 disambiguation helper (best-effort, not authoritative) — finds
 * any ACTIVE assignment in this group/course/term that already has an open
 * teacher slot, so "+ Add Class" can offer "join this instead of creating
 * a duplicate" when it's an obvious match. Never blocks creating a new one
 * if nothing matches; this is a convenience, not a gate.
 */
export async function findJoinableAssignment(groupId, courseCode, term) {
  const q = query(
    assignmentsCollection(groupId),
    where('courseCode', '==', courseCode),
    where('term', '==', term),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  const openSlot = snap.docs.find((d) => (d.data().teacherUids || []).length < 2);
  return openSlot ? { id: openSlot.id, groupId, ...openSlot.data() } : null;
}

/**
 * Admin-only cross-group listing of every active Class Assignment, for
 * §7's "Class Assignments" subcategory in AdminDashboard.jsx. Uses a
 * collectionGroup query — genuinely necessary here (unlike most other
 * reads in this module, which deliberately avoid collectionGroup per §10's
 * own rule-writing guidance) because there is no per-teacher fan-out
 * collection for a CROSS-teacher, CROSS-department admin view the way
 * faculty/{uid}/classIndex serves an individual teacher's own "My
 * Classes". Requires the collectionGroup index added to
 * firestore.indexes.json (collectionGroup: facultyAssignments, status ASC
 * + createdAt DESC) — without that index this query throws at runtime
 * with a Firestore-provided index-creation link, not a silent failure.
 */
export async function listAllActiveFacultyAssignments() {
  const q = query(
    collectionGroup(db, 'facultyAssignments'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    // Each doc's own path is groups/{groupId}/facultyAssignments/{id} —
    // groupId isn't a stored field on the doc itself, so it's parsed back
    // out of the reference path here (parent.parent is the groups/{groupId}
    // doc reference).
    const groupId = d.ref.parent.parent?.id || '';
    return { id: d.id, groupId, ...d.data() };
  });
}

