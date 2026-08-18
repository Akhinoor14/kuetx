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
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, setDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { withPromiseTimeout } from './safeSnapshot';

function sessionsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'sessions');
}
function studentRecordsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'studentRecords');
}

/**
 * PHASE 4 (CR_TEACHER_LINKING_NOTES.md §12 Phase 4's "CR-side summary
 * view", Phase 0's own constraint restated there: count/status ONLY,
 * never the marks themselves). Recomputes a tiny COUNT-ONLY aggregate —
 * how many students have a draft/reviewed/sent record, never any grade
 * value or per-student breakdown — and writes it onto the PARENT
 * facultyAssignments doc (a doc CR/ACR already has ordinary read access
 * to via isGroupMember(), unlike studentRecords itself which Phase 0
 * deliberately closed off to them). Called after every write that could
 * change a status (saveStudentMarks, sendAllReviewed) so it stays live;
 * best-effort and non-blocking — if this aggregate write fails, the
 * actual marks write it followed has already succeeded, so the caller
 * doesn't need to know or retry.
 */
async function recomputeMarksSummary(groupId, assignmentId) {
  try {
    const snap = await getDocs(studentRecordsCollection(groupId, assignmentId));
    const summary = { draft: 0, reviewed: 0, sent: 0, total: snap.size };
    snap.docs.forEach((d) => {
      const status = d.data().status || 'draft';
      if (status in summary) summary[status] += 1;
    });
    await updateDoc(assignmentDocRef(groupId, assignmentId), {
      marksSummary: summary,
      marksSummaryUpdatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[facultyMarksSync] recomputeMarksSummary failed (non-fatal):', e);
  }
}
function backlogStudentsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'backlogStudents');
}

// ── Backlog / extra-student manual add (Attendance Rebuild Phase C, see
// ATTENDANCE_REBUILD_PLAN.md §3c) ───────────────────────────────────────
//
// Covers TWO real-world cases identically (confirmed with Akhinoor
// 2026-08-15 — no distinction in data model or UI flow):
//   1. A genuine backlog student (earlier batch, repeating this course).
//   2. A regular student of this batch+dept+section whose roll falls
//      outside generateDeptRollRoster()'s seat-range default (seat counts
//      are defaults, not hard caps — see groupUtils.js's doc comment).
// Scoped per-assignment (this course offering only), doc id = roll, so a
// re-add of the same roll for the same assignment naturally overwrites
// rather than duplicating.

const ROLL_PATTERN = /^\d{7}$/; // same regex as store.js's studentId validation, reused not reinvented

/** Adds (or overwrites) one backlog/extra-student entry for this
 * assignment. `section` is optional — only meaningful for multi-section
 * depts, tags which section's daily-attendance view the row surfaces in. */
export async function addBacklogStudent(groupId, assignmentId, { roll, name, section, addedBy }) {
  const cleanRoll = String(roll || '').trim();
  if (!ROLL_PATTERN.test(cleanRoll)) {
    throw new Error('Roll must be exactly 7 digits (standard KUET roll format).');
  }
  await setDoc(doc(backlogStudentsCollection(groupId, assignmentId), cleanRoll), {
    roll: cleanRoll,
    name: name || cleanRoll,
    section: section || null,
    addedBy: addedBy || null,
    addedAt: serverTimestamp(),
  });
  return cleanRoll;
}

/** Moves a backlog/extra-student entry to the other section — kept as a
 * simple field update, no approval workflow (confirmed with Akhinoor,
 * plan §4 item 1). No-op for single-section depts (section stays null). */
export async function moveBacklogStudentSection(groupId, assignmentId, roll, newSection) {
  await updateDoc(doc(backlogStudentsCollection(groupId, assignmentId), roll), { section: newSection || null });
}

/**
 * Phase D — moves ANY roster row (a generated-default row with no
 * Firestore doc of its own, or an existing backlog row) into a different
 * section. Resolves the open scope question flagged at the end of Phase
 * C's log entry: §4 item 1's "swap a student from Section A to B" reads
 * as applying to every row, not just backlog ones, and 3c already
 * describes the add-student mechanism as the generic way an
 * outside-the-generated-range/reassigned roll gets an explicit entry — a
 * section move is exactly that case (a generated row's section is
 * implicit/derived, so "moving" it necessarily means giving it its own
 * explicit doc, same as the over-quota case). If a backlog doc already
 * exists for this roll, this is a plain section update (same as
 * moveBacklogStudentSection above); if not (a generated-range row), this
 * creates one — `name` is passed by the caller (the roster row's
 * currently-displayed name, real or placeholder) so the new doc doesn't
 * regress to a bare roll string.
 */
export async function moveStudentToSection(groupId, assignmentId, { roll, name, newSection, movedBy }) {
  const ref = doc(backlogStudentsCollection(groupId, assignmentId), roll);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { section: newSection || null });
    return;
  }
  await setDoc(ref, {
    roll,
    name: name || roll,
    section: newSection || null,
    addedBy: movedBy || null,
    addedAt: serverTimestamp(),
    // Distinguishes "this doc exists only because of a section move" from
    // a genuine manual add — purely informational, no read path branches
    // on it (a moved row still shows the "Added" badge, which is
    // accurate: it IS now an explicit entry, not a generated default).
    movedFromGenerated: true,
  });
}

export async function removeBacklogStudent(groupId, assignmentId, roll) {
  await deleteDoc(doc(backlogStudentsCollection(groupId, assignmentId), roll));
}

export function subscribeBacklogStudents(groupId, assignmentId, callback) {
  if (!groupId || !assignmentId) { callback([]); return () => {}; }
  return onSnapshot(backlogStudentsCollection(groupId, assignmentId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

// ── Discontinued students (persistent per-assignment/term status) ──────
//
// BUGFIX (build failure — subscribeDiscontinuedStudents/setStudentDiscontinued/
// clearStudentDiscontinued were imported and used throughout
// FacultyClassDetail.jsx's discontinue-toggle UI, firestore.rules already
// had no matching subcollection, and this file never actually defined any
// of the three — the whole data layer was missing while the UI shipped
// ahead of it). Mirrors backlogStudents' exact shape one collection over,
// since the two are structurally identical (a per-assignment,
// doc-id-by-roll student-status subcollection): a persistent flag that a
// given roll has stopped taking this course this term, independent of any
// single day's attendance mark. Once set, FacultyClassDetail.jsx drops
// that roll from markableRoster (daily marking) and every attendance %/
// summary calculation for this assignment — see that file's own comment
// on handleToggleDiscontinue for the full UI-side behavior this backs.
function discontinuedStudentsCollection(groupId, assignmentId) {
  return collection(db, 'groups', groupId, 'facultyAssignments', assignmentId, 'discontinuedStudents');
}

/** Marks a roll discontinued for this assignment/term. Doc id = roll, so
 * re-marking an already-discontinued roll naturally overwrites rather
 * than duplicating (matches addBacklogStudent's own re-add behavior). */
export async function setStudentDiscontinued(groupId, assignmentId, { roll, name, setBy }) {
  const cleanRoll = String(roll || '').trim();
  if (!ROLL_PATTERN.test(cleanRoll)) {
    throw new Error('Roll must be exactly 7 digits (standard KUET roll format).');
  }
  await setDoc(doc(discontinuedStudentsCollection(groupId, assignmentId), cleanRoll), {
    roll: cleanRoll,
    name: name || cleanRoll,
    setBy: setBy || null,
    setAt: serverTimestamp(),
  });
  return cleanRoll;
}

/** Clears a roll's discontinued flag — the student returns to normal
 * daily marking / attendance calculations immediately. */
export async function clearStudentDiscontinued(groupId, assignmentId, roll) {
  await deleteDoc(doc(discontinuedStudentsCollection(groupId, assignmentId), roll));
}

export function subscribeDiscontinuedStudents(groupId, assignmentId, callback) {
  if (!groupId || !assignmentId) { callback([]); return () => {}; }
  return onSnapshot(discontinuedStudentsCollection(groupId, assignmentId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
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
 * never rewritten or trimmed, only appended to.
 *
 * KEYING (Attendance Rebuild Phase B, see ATTENDANCE_REBUILD_PLAN.md §3b):
 * `attendance` is keyed by ROLL NUMBER, not Firebase uid. This is
 * deliberate — the Attendance roster includes every roll in a dept+batch
 * whether or not that student has registered an account yet (a
 * "placeholder" entry). Keying by roll means a placeholder's marked
 * attendance is preserved automatically once that student later creates
 * a real account for the same roll — no migration/merge step needed,
 * since the key never changes. Every caller (AttendanceTab, MarksTab's
 * attendancePctFor) passes roll, not uid, into this map.
 *
 * AUDIT SNAPSHOT (Phase B follow-up, same doc §3b): `rollToUid` is an
 * OPTIONAL secondary map, `{ [roll]: uid | null }`, recording which real
 * account (if any) sat behind a roll at the moment attendance was taken.
 * This is deliberately NOT the source of truth for anything — the
 * primary attendance map stays 100% roll-keyed and every read path
 * (computeStudentAttendancePercent, MarksTab, the roster UI) only ever
 * looks at `attendance`, never at this. `rollToUid` exists purely so a
 * later debug/admin need ("which account was this roll's attendance
 * actually recorded against on this date") has a real trail instead of
 * nothing, at near-zero cost (the uid is already sitting in the caller's
 * roster data when it calls this). Merged (not overwritten) across
 * saves, same accumulate-only spirit as editHistory — a roll that had no
 * account on an earlier save keeps that `null` entry from being lost if
 * a later save's caller happens not to pass it again, and a roll that
 * later gets an account can have its entry filled in without touching
 * the ones already recorded for other rolls. */
export async function createOrUpdateSessionAttendance(groupId, assignmentId, { sessionId, date, dayName, slot, attendance, rollToUid, loggedBy, isCorrection = false }) {
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
        .filter((roll) => prevAttendance[roll] !== nextAttendance[roll])
        .map((roll) => ({
          ts: new Date().toISOString(),
          studentRoll: roll,
          oldValue: prevAttendance[roll] ?? null,
          newValue: nextAttendance[roll] ?? null,
          by: loggedBy || null,
        }))
    : [];

  const data = {
    date, dayName, slot,
    attendance: nextAttendance, // { [studentRoll]: 'present' | 'absent' | 'late' | 'excused' } — keyed by roll, see doc comment above
    // Audit-only snapshot, see doc comment above — merged so an earlier
    // save's entries (including explicit nulls for placeholders) are
    // never dropped just because a later save didn't repeat them.
    rollToUid: { ...(existing?.rollToUid || {}), ...(rollToUid || {}) },
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

// Deletes one attendance session doc outright (not a soft-delete/flag —
// the record is gone). Used by the "Delete this session" action, which
// only ever targets the CURRENT teacher's own session for the selected
// date (see `existingSessionForDate` in FacultyClassDetail.jsx) — never
// a co-teacher's. Deliberately does NOT touch `plannerLogs`/Sessions &
// Count: that auto-link is a date-level "was a class held" fact shared
// across teachers (see the comment above `wasFirstSaveForDate`'s usage),
// and correctly reversing it here would mean re-deriving whether any
// OTHER session still justifies the day's count entry — safer to leave
// the count as-is and let the teacher adjust Sessions & Count manually
// if a whole day's only session gets deleted.
export async function deleteSessionAttendance(groupId, assignmentId, sessionId) {
  if (!groupId || !assignmentId || !sessionId) return;
  await deleteDoc(doc(sessionsCollection(groupId, assignmentId), sessionId));
}

/**
 * Attendance % for one student across every recorded session in this
 * assignment. This is the teacher-side equivalent of
 * computeEffectiveAttendance() — see the flagged-conflict note above for
 * why that student-local function couldn't be reused directly.
 *
 * `studentRoll` — as of Phase B, session.attendance is keyed by roll
 * number (not uid), so this must be called with the student's roll, not
 * their Firebase uid. The function itself is key-agnostic (just reads
 * sessions[i].attendance[studentRoll]) so nothing internal changed —
 * only what callers pass in.
 */
export function computeStudentAttendancePercent(sessions, studentRoll) {
  let held = 0;
  let attended = 0;
  sessions.forEach((s) => {
    const mark = s.attendance?.[studentRoll];
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

  recomputeMarksSummary(groupId, assignmentId); // fire-and-forget, see doc comment above

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
  const snap = await withPromiseTimeout(getDocs(studentRecordsCollection(groupId, assignmentId)), '[facultyMarksSync] sendAllReviewed');
  const reviewedIds = snap.docs.filter((d) => d.data().status === 'reviewed' && studentUids.includes(d.id)).map((d) => d.id);
  await Promise.all(reviewedIds.map((uid) =>
    updateDoc(doc(studentRecordsCollection(groupId, assignmentId), uid), { status: 'sent', lastSentAt: serverTimestamp() })
  ));
  recomputeMarksSummary(groupId, assignmentId); // fire-and-forget, see doc comment above
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
  const assignmentsSnap = await withPromiseTimeout(getDocs(collection(db, 'groups', groupId, 'facultyAssignments')), '[facultyMarksSync] getMyTeacherVerifiedRecords');
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

