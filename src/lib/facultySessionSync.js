// facultySessionSync.js — §8.8 of the merged Faculty Module prompt
//
// Extends (does NOT parallel) ClassManagement.jsx's existing Planner tab:
// writes into the SAME groups/{groupId}/plannerLogEntries subcollection
// that CR/ACR's quickLogClass() already uses (see that function in
// ClassManagement.jsx for the doc shape being matched here: courseId,
// displayName, type, teacherName, loggedAt, day, slot, note).
//
// Deliberately does NOT call groupSync.js's addPlannerLogEntry() directly
// — that function internally calls getIdentityStamp(profile, uid) for the
// `updatedBy` stamp, which is roll-number-shaped (student identity) and
// cannot represent a faculty account. This mismatch was flagged back in
// Phase 1 and resolved the same way in Phase 4 (facultyNoticeSync.js): write
// the doc directly with a stamp shape that actually fits. Per §8.8's own
// spec, the ADDITIONAL field needed here is `loggedBy: {uid, role, name}`
// (role: 'cr' | 'faculty') — distinct from `updatedBy`, which is what
// groupSync.js's generic audit-log convention already stamps every write
// with. Both are written here: `updatedBy` for consistency with every
// other groups/{groupId}/* collection's audit trail, `loggedBy` as the
// extra discrepancy-signal field §8.8 specifically asks for.
//
// Also computes an auto-incrementing sequence number per §8.8 ("প্রতি
// logged session-এ auto-incrementing sequence number") — scoped per
// courseId within the assignment's group, computed from the live
// subscription's current count rather than a stored counter doc, since
// plannerLogEntries is already subscribed to elsewhere and this avoids a
// second read.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * @param existingLogsForCourse - the CR-Planner-tab-visible plannerLogEntries
 *   array (from subscribePlannerLogs in groupSync.js), pre-filtered by the
 *   caller to this courseId, so the sequence number accounts for CR-logged
 *   sessions too (not just faculty-logged ones) — a teacher's "Class 5" and
 *   a CR's manual "+1" for the same course share one running count, since
 *   they're the same underlying fact (how many sessions has this course had).
 * @param date - optional 'YYYY-MM-DD'. When provided (e.g. auto-logged from
 *   an Attendance save), loggedAt is pinned to that date instead of "now",
 *   and `source: 'attendance'` is stamped so this entry is distinguishable
 *   from a teacher's own manual "+1" tap. Manual calls (no date passed)
 *   behave exactly as before.
 */
export async function logFacultySession(groupId, { uid, name, courseId, courseCode, courseType, existingLogsForCourse = [], date = null, source = 'manual' }) {
  if (!groupId || !courseId) throw new Error('Missing class/course reference.');
  const sequenceNumber = (existingLogsForCourse?.length || 0) + 1;

  const stamp = { uid, name: name || 'Faculty', roll: '' };
  await addDoc(collection(db, 'groups', groupId, 'plannerLogEntries'), {
    courseId,
    displayName: courseCode,
    type: courseType || 'Theory',
    teacherName: name || 'Faculty',
    loggedAt: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString(),
    day: 'Manual',
    slot: 'Manual',
    note: source === 'attendance' ? `Class ${sequenceNumber} — auto-logged from attendance` : `Class ${sequenceNumber} — logged by faculty`,
    sequenceNumber,
    source, // 'manual' | 'attendance' — lets the UI/audit trail tell them apart
    loggedBy: { uid, role: 'faculty', name: name || 'Faculty' },
    deleted: false,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  return sequenceNumber;
}
