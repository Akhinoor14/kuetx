// facultyDisambiguation.js — §8.7 of the merged Faculty Module prompt
//
// ============================================================================
// CORRECTED UNDERSTANDING (this session traced the full call chain, which
// this module's earlier draft had gotten wrong):
// ============================================================================
// Earlier assumption: TeacherSelector.jsx feeds CourseTeacherDialog.jsx,
// and changing their shared array shape (string[] -> {name,facultyUid,
// gridAlias}[]) would be a breaking change across 6+ pages.
//
// Actual traced reality:
//   - TeacherSelector.jsx has ZERO callers anywhere in this codebase. It's
//     dead code — nothing renders it. There was never a shared-shape risk
//     to begin with.
//   - CourseTeacherDialog.jsx is a completely separate, simpler component:
//     two plain text inputs (teacher1/teacher2), onSave(teachers) passing
//     back a plain string[] of <=2 names.
//   - Its output feeds store.js's courseTeacherMap — entirely LOCAL device
//     storage (store.set('scheduleSettings', ...)), never synced to
//     Firestore, never shared between CR and other students.
//   - The REAL Firestore-shared, CR-facing teacher field is
//     groups/{groupId}/routineEntries/{id}.teacherName — a single string
//     (only the FIRST teacher's name; Schedule.jsx explicitly destructures
//     `const { id, teacherNames, ...entryData } = newEntry` before writing
//     to Firestore, deliberately dropping the local-only teacherNames
//     array and keeping only the flattened teacherName string).
//
// RESOLUTION: rather than changing courseTeacherMap's shape (which would
// touch Courses.jsx, Schedule.jsx, Attendance.jsx, Assignments.jsx, and
// TermQS.jsx, none of which actually need to change for §8.7's real
// intent), this file adds a READ-ONLY enrichment layer: given a group's
// live routineEntries (already subscribed via groupSync.js's
// subscribeRoutine, unchanged) and that group's facultyAssignments, best-
// effort match each entry's free-text teacherName against a real verified
// faculty account's name. This is exactly the "join this to a real
// account?" prompt §8.7 describes (mirroring ClaimCRCard.jsx's UX
// pattern), implemented as a NEW component that can be dropped into
// Schedule.jsx later without changing any of that file's existing save/
// render logic — or used standalone. No existing file was edited to
// support this.

import { getDocs, collection } from 'firebase/firestore';
import { db } from './firebase';

function normalizeForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\bsir\.?$/i, '')
    .replace(/\bmadam\.?$/i, '')
    .replace(/[^a-z]/g, '')
    .trim();
}

/**
 * Best-effort match: for a given free-text teacherName (from a
 * routineEntries doc) and groupId, find any ACTIVE facultyAssignment in
 * that same group whose real faculty account's name normalizes to the
 * same string. Never a hard requirement — CR's existing free-text flow
 * works identically whether or not a match is found (§4 item 2's
 * "convenience, not a gate" principle, reused here for the same reason).
 */
export async function findMatchingFacultyForTeacherName(groupId, teacherName) {
  if (!groupId || !teacherName?.trim()) return null;
  const target = normalizeForMatch(teacherName);
  if (!target) return null;

  const snap = await getDocs(collection(db, 'groups', groupId, 'facultyAssignments'));
  for (const docSnap of snap.docs) {
    const a = docSnap.data();
    if (a.status !== 'active' || !a.teacherUids?.length) continue;
    // a.displayName is populated once a teacher's faculty profile has a
    // name (facultyClassSync.js's createFacultyAssignment leaves it null
    // at creation, a later phase can backfill it from faculty/{uid}.name)
    // — check both displayName and gridAlias, whichever is set.
    const candidateNames = [a.displayName, a.gridAlias].filter(Boolean);
    if (candidateNames.some((n) => normalizeForMatch(n) === target)) {
      return { assignmentId: docSnap.id, groupId, ...a };
    }
  }
  return null;
}

/**
 * Batch version for a whole schedule at once — one facultyAssignments read
 * per group (not per entry), matched against every entry's teacherName
 * client-side. Returns a Map keyed by routineEntry id -> matched
 * assignment (or absent if no match), for a caller to render a "link this
 * to the real account?" affordance per §8.7's ClaimCRCard.jsx-style UX.
 */
export async function findMatchingFacultyForSchedule(groupId, routineEntries) {
  if (!groupId || !routineEntries?.length) return new Map();
  const snap = await getDocs(collection(db, 'groups', groupId, 'facultyAssignments'));
  const activeAssignments = snap.docs
    .map((d) => ({ assignmentId: d.id, groupId, ...d.data() }))
    .filter((a) => a.status === 'active' && a.teacherUids?.length);

  const byNormalizedName = new Map();
  activeAssignments.forEach((a) => {
    [a.displayName, a.gridAlias].filter(Boolean).forEach((n) => {
      byNormalizedName.set(normalizeForMatch(n), a);
    });
  });

  const result = new Map();
  routineEntries.forEach((entry) => {
    const match = byNormalizedName.get(normalizeForMatch(entry.teacherName));
    if (match) result.set(entry.id, match);
  });
  return result;
}
