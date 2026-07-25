// facultyMarksSync.js — §8.9 (Attendance) + §9 (Marks) of the merged prompt
//
// ============================================================================
// MARKS MODEL — confirmed directly by the project owner, overriding this
// file's earlier draft (which had wrongly tried to force-fit store.js's
// student-facing MARK_WEIGHTS/getAttendanceMarks() into this):
// ============================================================================
//
//   - Fixed: each of the two teachers on a course gets exactly 45 marks.
//     Total across both teachers = 90, fixed, never configurable.
//   - Attendance is ALWAYS its own separate component within a teacher's
//     45, computed as (student's attendance % on this assignment) × the
//     teacher's own chosen weight for it — NOT store.js's getAttendanceMarks()
//     0-10 curve, which is a different, student-facing formula for a
//     different purpose (term-total estimate) and was never the right fit
//     here (confirmed).
//   - Everything else in that teacher's 45 is fully TEACHER-DEFINED: the
//     teacher creates their own named components (e.g. "CT", "Assignment",
//     "Presentation", "Quiz" — any label, any count) with their own point
//     caps, as long as (attendanceWeight + sum of all other component caps)
//     == 45. This replaces the earlier courseType-branching design
//     (Theory/Sessional/Project fixed field sets) entirely — there is now
//     ONE flexible per-teacher component system for every course type.
//   - This component breakdown is configured ONCE per teacher per
//     assignment (setTeacherMarkComponents), then used as the column
//     layout for every student's marks entry in that teacher's slot.
//
// Data shape on groups/{groupId}/facultyAssignments/{id}/studentRecords/{uid}:
//   {
//     teacher1Marks: { attendance: <computed>, [componentKey]: <entered>, ... },
//     teacher2Marks: { same shape, teacher2's own components },
//     status, lastSentAt, history
//   }
// and on the assignment doc itself (facultyClassSync.js's existing shape,
// extended by this file):
//   {
//     teacher1MarkComponents: { attendanceWeight: 15, components: [{key,label,max}, ...] },
//     teacher2MarkComponents: { same shape, independent of teacher1's }
//   }

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, setDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';

function sessionsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'sessions');
}
function studentRecordsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'studentRecords');
}

// ── §8.9 Attendance ─────────────────────────────────────────────────────

/** One row per class meeting for this assignment — a teacher creates this
 * when taking attendance for a specific date (auto-suggested from the
 * assignment's dayTimeSlots + Sessions & Count's logged count, but the
 * teacher confirms/edits per §8.9's "auto-count ... manual override
 * possible, with an audit log" note).
 *
 * APPEND-ONLY / LOCK MODEL (owner-confirmed): once a session for a date is
 * first saved, it becomes `locked: true` and further plain re-saves are
 * rejected — a teacher can't silently overwrite an already-submitted
 * date's marks by just reopening the date and re-clicking Save (that was
 * the old behavior; createOrUpdateSessionAttendance did a full overwrite
 * every time with no history at all). Free re-marking (P -> A -> P, etc.)
 * is still allowed for the FIRST save of a date, since that's normal
 * mistouch-correction before submission, not a correction of committed
 * data. To change an already-locked date afterward, the caller must pass
 * `isCorrection: true` explicitly (wired to a distinct "Edit this date"
 * action in the UI, not the normal Save button) — that path stays
 * allowed (teacher correction is a legitimate need) but every field that
 * actually changes is appended to `editHistory` (who/when/old/new),
 * mirroring the exact same never-overwritten audit-trail convention
 * saveStudentMarks() already uses for marks (§9.1). editHistory itself is
 * never rewritten or trimmed, only appended to. */
export async function createOrUpdateSessionAttendance(groupId, assignmentId, { sessionId, date, dayName, slot, attendance, loggedBy, isCorrection = false }) {
  const ref = sessionId ? doc(sessionsCollection(groupId, assignmentId), sessionId) : null;
  const existingSnap = ref ? await getDoc(ref) : null;
  const existing = existingSnap?.exists() ? existingSnap.data() : null;

  if (existing?.locked && !isCorrection) {
    // Refuse the silent-overwrite path. The UI should never actually hit
    // this (it gates the normal Save button once a date is locked), but
    // this is the real enforcement point, not just a UI nicety.
    const err = new Error('This date is already saved and locked. Use "Edit this date" to make a correction.');
    err.code = 'session_locked';
    throw err;
  }

  const prevAttendance = existing?.attendance || {};
  const nextAttendance = attendance || {};
  const editEntries = isCorrection
    ? Object.keys({ ...prevAttendance, ...nextAttendance })
        .filter((uid) => prevAttendance[uid] !== nextAttendance[uid])
        .map((uid) => ({
          ts: new Date().toISOString(),
          studentUid: uid,
          oldValue: prevAttendance[uid] ?? null,
          newValue: nextAttendance[uid] ?? null,
          by: loggedBy || null,
        }))
    : [];

  const data = {
    date, dayName, slot,
    attendance: nextAttendance, // { [studentUid]: 'present' | 'absent' | 'late' | 'excused' }
    loggedBy, // { uid, role: 'faculty', name } — §8.8's discrepancy-signal shape, reused here
    locked: true,
    updatedAt: serverTimestamp(),
    ...(editEntries.length > 0 ? { editHistory: [...(existing?.editHistory || []), ...editEntries] } : {}),
  };
  if (sessionId) {
    await updateDoc(ref, data);
    return sessionId;
  }
  const created = await addDoc(sessionsCollection(groupId, assignmentId), { ...data, createdAt: serverTimestamp() });
  return created.id;
}

export function subscribeSessionAttendance(groupId, assignmentId, callback) {
  if (!groupId || !assignmentId) { callback([]); return () => {}; }
  const q = query(sessionsCollection(groupId, assignmentId), orderBy('date', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

/**
 * Attendance % for one student across every recorded session in this
 * assignment. This is the teacher-side equivalent of
 * computeEffectiveAttendance() — see the flagged-conflict note above for
 * why that student-local function couldn't be reused directly.
 */
export function computeStudentAttendancePercent(sessions, studentUid) {
  let held = 0;
  let attended = 0;
  sessions.forEach((s) => {
    const mark = s.attendance?.[studentUid];
    if (mark === 'present' || mark === 'absent' || mark === 'late' || mark === 'excused') {
      held++;
      if (mark === 'present' || mark === 'late' || mark === 'excused') attended++;
      // 'late'/'excused' counting as attended (not absent) is a judgment
      // call, not spec'd explicitly in §8.9 — flagged here rather than
      // silently picked. If the real KUET policy treats 'late' as a
      // partial/different case, this is the one line to change.
    }
  });
  if (held === 0) return null;
  return Math.round((attended / held) * 100);
}

/** Attendance component score = (attendance %) × (teacher's own chosen
 * weight for attendance within their 45) / 100. E.g. pct=80, weight=15 ->
 * 12. This is the ONLY attendance formula used here — confirmed directly
 * by the project owner, replacing the earlier draft's incorrect attempt to
 * reuse store.js's student-facing getAttendanceMarks(). */
export function computeAttendanceComponentScore(pct, attendanceWeight) {
  if (pct === null || pct === undefined || !attendanceWeight) return 0;
  return Math.round((pct / 100) * attendanceWeight * 10) / 10; // one decimal place
}

function assignmentDocRef(groupId, assignmentId) {
  return doc(db, 'groups', groupId, 'facultyAssignments', assignmentId);
}

/**
 * Teacher configures their OWN 45-mark breakdown once per assignment:
 * attendanceWeight (a fixed slice, always present) + any number of
 * teacher-named components (label + max), which must sum with
 * attendanceWeight to exactly 45. Stored on the assignment doc itself
 * (not per-student) since it's the same column layout for every student
 * in that teacher's slot.
 */
export async function setTeacherMarkComponents(groupId, assignmentId, teacherSlot, { attendanceWeight, components }) {
  const componentTotal = (components || []).reduce((sum, c) => sum + (Number(c.max) || 0), 0);
  const total = (Number(attendanceWeight) || 0) + componentTotal;
  if (total !== 45) {
    throw new Error(`Components must add up to exactly 45 (attendance ${attendanceWeight} + others ${componentTotal} = ${total}).`);
  }
  await updateDoc(assignmentDocRef(groupId, assignmentId), {
    [`${teacherSlot}MarkComponents`]: { attendanceWeight: Number(attendanceWeight), components },
  });
}

/** Read one teacher's configured component breakdown for this assignment
 * — null if that teacher hasn't set it up yet (UI should prompt them to
 * configure before entering any marks). */
export async function getTeacherMarkComponents(groupId, assignmentId, teacherSlot) {
  const snap = await getDoc(assignmentDocRef(groupId, assignmentId));
  if (!snap.exists()) return null;
  return snap.data()[`${teacherSlot}MarkComponents`] || null;
}

// ── §9 Marks ────────────────────────────────────────────────────────────

/**
 * Per-student marks doc. `teacherSlot` is 'teacher1' or 'teacher2' — which
 * of the assignment's exactly-two teacherUids this caller is (resolved by
 * the caller from facultyAssignments.teacherUids.indexOf(uid), since this
 * file has no independent way to know which slot a uid occupies without
 * the assignment doc in hand).
 *
 * `fields` is a flat object: { attendance: <computed score>, [componentKey]:
 * <entered value>, ... } — shaped by whatever that teacher configured via
 * setTeacherMarkComponents() above. This function itself is component-
 * agnostic; it just merges whatever `fields` it's given into that teacher's
 * slot. Confirmed model (project owner): every teacher's slot is always
 * exactly 45 total (attendanceWeight + their own named components), the
 * SAME rule for every course — no more Theory/Sessional/Project branching
 * at this layer. The UI (MarksTab in FacultyClassDetail.jsx) reads each
 * teacher's stored component config to render the right input columns.
 *
 * State cycle (§9.1): 'draft' -> 'reviewed' -> 'sent' -> (edit again ->
 * back to a re-sent state, no frozen/lock — §2 item 5). This function
 * itself does NOT decide the state transition; callers pass `status`
 * explicitly so the three distinct actions (autosave draft, mark
 * reviewed, send) stay caller-driven per §9.1's UI-level distinction.
 *
 * FLAGGED GAP — §9.5's secondary notification channel ("existing Alerts
 * feed noticeType: 'marks_release' with its own distinct icon/color") is NOT wired up
 * here. Audited alertUtils.js's computeAlerts(profile): it's entirely
 * local-store-driven (no Firestore read at all), and the existing
 * groups/{groupId}/notices collection (postFacultyNotice, Phase 4) is
 * GROUP-broadcast-shaped, not per-student — posting a marks-release event
 * there would incorrectly notify the whole class about one student's
 * grade. Building a real per-student server-side alert channel is a
 * genuinely new subsystem (not an extension of an existing one), so it's
 * deliberately left undone rather than forced into either mismatched shape.
 * §9.5's PRIMARY channel (the Term Planner card itself, TeacherVerifiedCard.jsx)
 * IS implemented and is the one place students currently see this.
 */
export async function saveStudentMarks(groupId, assignmentId, studentUid, teacherSlot, fields, status) {
  const ref = doc(studentRecordsCollection(groupId, assignmentId), studentUid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  const prevSlotData = existing[`${teacherSlot}Marks`] || {};

  // §9.1's audit trail — one entry per changed field, never overwritten.
  const historyEntries = Object.entries(fields)
    .filter(([k, v]) => prevSlotData[k] !== v)
    .map(([k, v]) => ({ ts: new Date().toISOString(), field: `${teacherSlot}Marks.${k}`, oldValue: prevSlotData[k] ?? null, newValue: v }));

  const wasSentBefore = existing.status === 'sent';
  const nextStatus = status || existing.status || 'draft';
  // §9.1: editing again after Sent auto-re-sends (no frozen state) —
  // surfaced to the student as "Marks updated", handled by the status
  // value itself flipping back to 'sent' with a fresh lastSentAt, not a
  // separate "resent" status (keeps the student-side state machine to the
  // three values §9.1 actually names).
  const lastSentAt = nextStatus === 'sent' ? serverTimestamp() : (existing.lastSentAt || null);

  await setDoc(ref, {
    ...existing,
    [`${teacherSlot}Marks`]: { ...prevSlotData, ...fields },
    status: nextStatus,
    lastSentAt,
    history: [...(existing.history || []), ...historyEntries],
  }, { merge: true });

  return { wasReSend: wasSentBefore && nextStatus === 'sent' };
}

export function subscribeStudentRecords(groupId, assignmentId, callback) {
  if (!groupId || !assignmentId) { callback([]); return () => {}; }
  return onSnapshot(studentRecordsCollection(groupId, assignmentId), (snap) => {
    callback(snap.docs.map((d) => ({ studentUid: d.id, ...d.data() })));
  }, () => callback([]));
}

/** §9.3 bulk "Send All Reviewed" — flips every currently-'reviewed' record
 * to 'sent' in one pass. Individual per-row "Send" reuses saveStudentMarks
 * directly with status='sent' instead of calling this. */
export async function sendAllReviewed(groupId, assignmentId, studentUids) {
  const snap = await getDocs(studentRecordsCollection(groupId, assignmentId));
  const reviewedIds = snap.docs.filter((d) => d.data().status === 'reviewed' && studentUids.includes(d.id)).map((d) => d.id);
  await Promise.all(reviewedIds.map((uid) =>
    updateDoc(doc(studentRecordsCollection(groupId, assignmentId), uid), { status: 'sent', lastSentAt: serverTimestamp() })
  ));
  return reviewedIds.length;
}

// ── Student-side read (§9.5) ────────────────────────────────────────────

/**
 * Student-side read: every Class Assignment in the student's own group that
 * has a 'sent' studentRecords entry for this uid — used by
 * TeacherVerifiedCard.jsx to show the read-only "Teacher-Verified" card
 * next to the existing self-reported Marks.jsx/Attendance.jsx fields.
 * Deliberately does NOT touch/read local store.js marks/attendance state —
 * this is a fully separate, additive data source per §2 item 6.
 */
export async function getMyTeacherVerifiedRecords(groupId, studentUid, currentTermKey = null) {
  if (!groupId || !studentUid) return [];
  const assignmentsSnap = await getDocs(collection(db, 'groups', groupId, 'facultyAssignments'));
  // Belt-and-suspenders term scoping: a teacher forgetting to "End Class"
  // when a term wraps up would otherwise leave last term's sent marks
  // permanently stuck on the student's Alerts card. Filtering on the
  // student's own currentTermKey (in addition to status === 'active')
  // means the card self-clears the moment the student's term rolls over,
  // regardless of whether the teacher ever ends the old assignment.
  const active = assignmentsSnap.docs.filter((d) => {
    const data = d.data();
    if (data.status !== 'active') return false;
    if (currentTermKey && data.term && data.term !== currentTermKey) return false;
    return true;
  });
  const results = await Promise.all(active.map(async (a) => {
    const recSnap = await getDoc(doc(db, 'groups', groupId, 'facultyAssignments', a.id, 'studentRecords', studentUid));
    if (!recSnap.exists() || recSnap.data().status !== 'sent') return null;
    return { assignmentId: a.id, courseCode: a.data().courseCode, courseTitle: a.data().courseTitle, courseType: a.data().courseType, ...recSnap.data() };
  }));
  return results.filter(Boolean);
}

/** Live variant — used so the card appears the instant a teacher sends
 * marks, without the student needing to refresh (§9.5's "card appears on its own,
 * pulse indicator" requirement). */
export function subscribeMyTeacherVerifiedRecords(groupId, studentUid, callback, currentTermKey = null) {
  if (!groupId || !studentUid) { callback([]); return () => {}; }
  // onSnapshot on a collection-of-subcollections isn't a single query —
  // subscribe to the assignments list, then fan out one-shot reads on
  // each record whenever that list changes. Good enough for a handful of
  // courses per term; not built for hundreds of assignments.
  return onSnapshot(collection(db, 'groups', groupId, 'facultyAssignments'), async (snap) => {
    const active = snap.docs.filter((d) => {
      const data = d.data();
      if (data.status !== 'active') return false;
      if (currentTermKey && data.term && data.term !== currentTermKey) return false;
      return true;
    });
    const results = await Promise.all(active.map(async (a) => {
      const recSnap = await getDoc(doc(db, 'groups', groupId, 'facultyAssignments', a.id, 'studentRecords', studentUid));
      if (!recSnap.exists() || recSnap.data().status !== 'sent') return null;
      return { assignmentId: a.id, courseCode: a.data().courseCode, courseTitle: a.data().courseTitle, courseType: a.data().courseType, ...recSnap.data() };
    }));
    callback(results.filter(Boolean));
  }, () => callback([]));
}

