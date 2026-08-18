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
//   - Its output feeds courseTeacherMap. CORRECTION (later session): this
//     was wrong when written — courseTeacherMap is NOT local-only. It's
//     group-shared, synced to Firestore via groups/{groupId}/meta/
//     plannerSettings (see groupSync.js's subscribePlannerSettings/
//     updatePlannerSettings, and ClassSetup.jsx/ClassSetupModal.jsx/
//     useClassManagementState.js, which are the actual write sites).
//     store.get('scheduleSettings').courseTeacherMap is only the
//     pre-group/local-fallback copy for students not yet in a synced
//     class; once a group exists, every page reads the live group value
//     instead (see Courses.jsx/TermQS.jsx/Assignments.jsx/Schedule.jsx's
//     own subscribePlannerSettings calls).
//     Separately, as of the teacher-ID migration (see teacherRegistry.js),
//     courseTeacherMap's values are teacherIds, not name strings — this
//     module is unaffected either way since it works entirely off
//     routineEntries.teacherName (a resolved display string written by
//     Schedule.jsx), never courseTeacherMap directly.
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
// intent), this file adds an enrichment layer: given a group's live
// routineEntries (already subscribed via groupSync.js's subscribeRoutine,
// unchanged) and that group's facultyAssignments, best-effort match each
// entry's free-text teacherName against a real verified faculty account's
// name. This is exactly the "join this to a real account?" prompt §8.7
// describes (mirroring ClaimCRCard.jsx's UX pattern).
//
// UPDATE (Phase 3/4, CR_TEACHER_LINKING_NOTES.md): the paragraph above
// describes this file's ORIGINAL, Phase-pre-3 shape — at that point it
// really was read-only (TeacherClaimBanner.jsx just showed a suggestion,
// dismiss only hid it in localStorage, nothing was ever written). That is
// no longer true. Phase 3 gave the CR-direction match a real accept/
// decline write path (teacherLinkRequests.js's createInviteFromCr) and
// added the reverse match (findMatchingRoutineEntryForAssignment, below
// — teacher's own assignment -> matching routineEntry, the mirror of
// findMatchingFacultyForSchedule above it). Phase 4 then used the result
// of an ACCEPTED match (routineEntries.linkedFacultyUid, written by
// applyLinkAfterAccept) to drive Schedule.jsx's verified-badge UI
// directly — so Schedule.jsx WAS edited to support this, contrary to the
// original paragraph's last line. This file itself stays a pure
// query/matching module either way (no writes happen here — see
// teacherLinkRequests.js for those) — only the surrounding claim about
// "read-only" and "no existing file edited" is what's now outdated and
// corrected by this note.

import { getDocs, collection } from 'firebase/firestore';
import { db } from './firebase';
import { withPromiseTimeout } from './safeSnapshot';

// PHASE 3 (CR_TEACHER_LINKING_NOTES.md) — reverse direction of the same
// match, for the teacher_to_cr flow. Everything above this point in the
// file (normalizeForMatch, findMatchingFacultyForTeacherName,
// findMatchingFacultyForSchedule) matches FROM a routineEntry's free-text
// teacherName TO a real faculty account. This is the mirror: given a
// faculty account's OWN assignment (courseCode/dept/batch/section/term —
// already known, since the teacher just created/joined it), find a
// routineEntries doc in that same group whose teacherName normalizes to
// that account's own display name. Reuses the exact same
// normalizeForMatch() so a name that would match one direction matches
// the other too, by construction.

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

  const snap = await withPromiseTimeout(
    getDocs(collection(db, 'groups', groupId, 'facultyAssignments')),
    '[facultyDisambiguation] findMatchingFacultyForTeacherName',
  );
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
  const snap = await withPromiseTimeout(
    getDocs(collection(db, 'groups', groupId, 'facultyAssignments')),
    '[facultyDisambiguation] findMatchingFacultyForSchedule',
  );
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

/**
 * Reverse direction (Phase 3's "teacher_to_cr" flow): given a faculty
 * account's own display name/gridAlias and the group/courseCode their
 * assignment belongs to, find any routineEntries doc in that same group,
 * for that same courseCode, whose free-text teacherName normalizes to
 * that same name. Deliberately also filters by courseCode (unlike the
 * forward direction's per-group scan, which doesn't need to — a CR only
 * ever sees one grid per group, but a teacher's assignment is specific to
 * one course, and matching a same-named teacher on a DIFFERENT course in
 * the same grid would be a false positive, e.g. two different courses
 * both taught by someone named "Dr. Rahman").
 *
 * Never a hard requirement — same "convenience, not a gate" principle as
 * the rest of this module. Returns null if no match, or if the entry is
 * already linked to a different assignment (linkedAssignmentId set and
 * not equal to this one) — an already-linked entry shouldn't be
 * re-proposed against.
 *
 * @param {string} groupId
 * @param {{ displayName?: string, gridAlias?: string, courseCode: string }} assignment
 * @returns {Promise<{ entryId: string, teacherName: string } | null>}
 */
export async function findMatchingRoutineEntryForAssignment(groupId, assignment) {
  if (!groupId || !assignment?.courseCode) return null;
  const candidateNames = [assignment.displayName, assignment.gridAlias].filter(Boolean);
  if (!candidateNames.length) return null;
  const targets = new Set(candidateNames.map(normalizeForMatch).filter(Boolean));
  if (!targets.size) return null;

  const snap = await withPromiseTimeout(
    getDocs(collection(db, 'groups', groupId, 'routineEntries')),
    '[facultyDisambiguation] findMatchingRoutineEntryForAssignment',
  );
  for (const docSnap of snap.docs) {
    const e = docSnap.data();
    if (e.deleted) continue;
    if (e.courseCode !== assignment.courseCode) continue;
    if (e.linkedAssignmentId && e.linkedAssignmentId !== assignment.assignmentId) continue;
    if (e.linkedFacultyUid) continue; // already linked to someone — don't re-propose
    if (targets.has(normalizeForMatch(e.teacherName))) {
      return { entryId: docSnap.id, teacherName: e.teacherName || '' };
    }
  }
  return null;
}
