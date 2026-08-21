// FacultyClassDetail.jsx — §8.5 of the merged Faculty Module prompt
//
// Phase 5 scope: read-only tabs only (Students & CR / Syllabus / Schedule
// for this class). Sessions & Count (Phase 6), Attendance (§8.9/Phase 7),
// Marks (§9/Phase 7), and Notices-shortcut (§8.9's mention of a Notices tab
// shortcut) are NOT built here — their tab buttons are visible (so the
// final tab bar shape is stable and doesn't need re-laying-out later) but
// disabled with a "coming in a later phase" tooltip, per Working Method
// §12: visible-but-honest is better than a tab that silently does nothing
// if clicked.
//
// Header actions (Edit day/time/co-teacher, End Class, Delete) from §8.6
// are also explicitly NOT built in this phase — that's the next natural
// follow-up once Phase 6+ needs assignment mutation UI anyway, and this
// page's header intentionally only shows read-only assignment info for now.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CalendarClock, Circle, Clock, ExternalLink, FileText, GraduationCap, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ICONS } from '../../lib/iconRegistry';
import { confirmDialog, alertDialog } from '../../lib/dialog';
import ClassmatesList from '../../components/ClassmatesList';
import NoticeComposerToolbar from '../../components/NoticeComposerToolbar';
import NoticePrioritySelector from '../../components/NoticePrioritySelector';
import NoticeInsightsPanel from '../../components/NoticeInsightsPanel';

// Local calendar date as 'YYYY-MM-DD' — NOT toISOString(), which converts to
// UTC first and can silently roll back to yesterday's date for anyone west
// of UTC or, for KUET's UTC+6, roll forward past midnight-local a few hours
// early depending on when the clock ticks over relative to render. Same
// pattern used app-wide (Attendance.jsx, Diary.jsx, Extras.jsx, Money.jsx).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Roll-number-aware sort — groupSync.js's subscribeMembers() does a plain
// Firestore `orderBy('roll')`, which is a STRING sort (roll is stored as
// profile.studentId, a string). That silently produces wrong ordering
// whenever roll numbers aren't all the same digit-length ("1900123" sorts
// before "1900023" as text is not how you'd sort them numerically), and —
// worse — anyone whose roll happens to start with a character that sorts
// early/late (or is blank/non-numeric, which some CR/ACR-claimed or
// manually-added members can have) lands out of place, which is what
// produced the "CR/ACR at the top" symptom reported. This re-sorts the
// already-fetched members array numerically client-side wherever a roll-
// ordered roster is rendered (Marks tab, Attendance tab), without
// touching the Firestore query itself. Falls back to a locale string
// compare for any roll that isn't purely numeric, and pushes members with
// no roll at all to the end (rather than letting '' sort first).
//
// Extracted to groupUtils.js — this is now its 2nd call site (Admin's
// individual-student notice-targeting picker in AdminDashboard.jsx needs
// the exact same roll-sort over the exact same dept+batch member shape).
import { sortByRoll, generateDeptRollRoster, isMultiSectionDept } from '../../lib/groupUtils';
import { isValidRoll, toSevenDigitCore } from '../../lib/rollFormat';
import { exportAttendanceExcel, exportAttendancePdf } from '../../lib/attendanceExport';
import { DEPARTMENTS } from '../../store/store';

import { getDeptSyllabus } from '../../store/curriculumStore';
import { subscribeFacultyAssignment, setPlannedTotalClasses, updateAssignmentDayTimeSlots, findConflictingAssignment, generateInviteCode, subscribeJoinRequests, acceptJoinRequest, declineJoinRequest } from '../../lib/facultyClassSync';
import { subscribePendingLinkRequests, acceptRequest as acceptLinkRequest, declineRequest as declineLinkRequest, createProposalFromTeacher, withdrawRequest as withdrawLinkRequest, wasDeclinedFor } from '../../lib/teacherLinkRequests';
import { findMatchingRoutineEntryForAssignment } from '../../lib/facultyDisambiguation';
import { subscribeMembers, subscribePlannerLogs, subscribeRoutine } from '../../lib/groupSync';
import {
  createOrUpdateSessionAttendance, subscribeSessionAttendance, deleteSessionAttendance,
  computeStudentAttendancePercent, computeAttendanceComponentScore,
  setTeacherMarkComponents, getTeacherMarkComponents,
  saveStudentMarks, subscribeStudentRecords, sendAllReviewed,
  addBacklogStudent, moveStudentToSection, subscribeBacklogStudents,
  setStudentDiscontinued, clearStudentDiscontinued, subscribeDiscontinuedStudents,
} from '../../lib/facultyMarksSync';
import { exportStudentMarksPdf, exportClassSummaryPdf } from '../../lib/facultyPdfExport';
import { logFacultySession } from '../../lib/facultySessionSync';
import { getFacultyDoc } from '../../lib/facultySync';
import { getFacultyDisplayName } from '../../lib/facultyTitle';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import { auth } from '../../lib/firebase';
import { notify } from '../../lib/notify';
import * as noticeApi from '../../lib/noticeUtils';
import { deleteNoticeSoft } from '../../lib/noticeUtils';
import { renderFormattedNoticeBody } from '../../lib/noticeFormat';
import { postFacultyNotice } from '../../lib/facultyNoticeSync';
import {
  TIME_MODELS, DAYS, isSessionalType, getPresetSessionalSlots, isSlotOverlap,
} from '../../lib/timeModels';
import { useQuestionBankData, getR2FileUrl } from '../../hooks/useQuestionBankData';

// Order = real daily-use frequency (teacher's actual workflow), not a
// setup checklist. Attendance is opened almost every class day — and now
// carries Sessions & Count merged into it, since attendance auto-links
// the session log already (see AttendanceTab), so a separate tab for it
// was redundant. Mobile tab bar shows the first 4 as always-visible
// buttons + a "More" popover for the rest — see .faculty-tabs CSS.
const TABS = [
  { id: 'syllabus', label: 'Syllabus', icon: 'BookMarked', enabled: true },
  { id: 'qbank', label: 'Question Bank', icon: 'FileText', enabled: true },
  { id: 'students', label: 'Active Students', icon: 'Users', enabled: true },
  { id: 'marks', label: 'CT Marks', icon: 'GraduationCap', enabled: true },
  { id: 'attendance', label: 'Attendance', icon: 'CheckSquare', enabled: true },
  { id: 'schedule', label: 'Schedule', icon: 'Clock', enabled: true },
  { id: 'notices', label: 'Notices', icon: 'Bell', enabled: true },
];

// (Previously used to split tabs into an always-visible "primary" row +
// a "More" sheet on mobile. Both breakpoints now share one 2-column tab
// grid, so that split — and this constant — is no longer needed.)

// Editing day/time only needs day+slot — unlike Add Class, dept/batch/
// term/course are already fixed for an existing assignment, so this is a
// small standalone modal rather than routing through AddClassModal's
// bigger dept->batch->term->course flow. Mirrors AddClassModal's own
// slot-conflict pattern (soft warning via findConflictingAssignment, never
// a hard block) so editing behaves consistently with creating.
function EditDayTimeModal({ assignment, groupId, onClose, onSaved }) {
  const currentSlot = assignment.dayTimeSlots?.[0] || {};
  const [modelId, setModelId] = useState(currentSlot.modelId || '50min');
  const [day, setDay] = useState(currentSlot.day || DAYS[0]);
  const isSessionalCourse = isSessionalType(assignment.courseType);
  const currentIsFullBlock = isSessionalCourse
    && getPresetSessionalSlots(currentSlot.modelId || '50min').includes(currentSlot.slot);
  const [sessionalMode, setSessionalMode] = useState(currentIsFullBlock ? 'full' : 'single');
  const [sessionalSlot, setSessionalSlot] = useState(
    currentIsFullBlock ? currentSlot.slot : (getPresetSessionalSlots(modelId)[0] || ''),
  );
  const [slot, setSlot] = useState(currentSlot.slot || TIME_MODELS['50min'].slots[0]);
  const [saving, setSaving] = useState(false);
  const [slotConflict, setSlotConflict] = useState(null);

  useEffect(() => {
    const presets = getPresetSessionalSlots(modelId);
    if (presets.length && !presets.includes(sessionalSlot)) setSessionalSlot(presets[0]);
  }, [modelId]);

  const effectiveSlot = (isSessionalCourse && sessionalMode === 'full') ? sessionalSlot : slot;

  useEffect(() => {
    setSlotConflict(null);
    let cancelled = false;
    findConflictingAssignment(groupId, {
      courseCode: assignment.courseCode, term: assignment.term,
      dayTimeSlots: [{ day, slot: effectiveSlot }],
      excludeAssignmentId: assignment.id,
    }).then((match) => { if (!cancelled) setSlotConflict(match); }).catch(() => {});
    return () => { cancelled = true; };
  }, [day, effectiveSlot, groupId, assignment.id, assignment.courseCode, assignment.term]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssignmentDayTimeSlots(groupId, assignment.id, [{ day, slot: effectiveSlot, modelId }]);
      notify('Class time updated.', 'success');
      onSaved();
    } catch (e) {
      notify(e.message || 'Could not update the class time.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>Edit Class Time</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Day</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
            >
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Time model</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.values(TIME_MODELS).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  style={{
                    flex: 1, fontSize: 12, padding: '7px 8px',
                    border: modelId === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: modelId === m.id ? 'rgba(59,130,246,0.08)' : 'var(--bg)',
                    color: 'var(--text)', borderRadius: 7, cursor: 'pointer',
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {isSessionalCourse && (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Slot type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setSessionalMode('full')}
                  style={{
                    flex: 1, fontSize: 12, padding: '7px 8px',
                    border: sessionalMode === 'full' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: sessionalMode === 'full' ? 'rgba(59,130,246,0.08)' : 'var(--bg)',
                    color: 'var(--text)', borderRadius: 7, cursor: 'pointer',
                  }}
                >
                  Full sessional block
                </button>
                <button
                  onClick={() => setSessionalMode('single')}
                  style={{
                    flex: 1, fontSize: 12, padding: '7px 8px',
                    border: sessionalMode === 'single' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: sessionalMode === 'single' ? 'rgba(59,130,246,0.08)' : 'var(--bg)',
                    color: 'var(--text)', borderRadius: 7, cursor: 'pointer',
                  }}
                >
                  Single slot
                </button>
              </div>
            </div>
          )}

          {isSessionalCourse && sessionalMode === 'full' ? (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Time slot</label>
              <select
                value={sessionalSlot}
                onChange={(e) => setSessionalSlot(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
              >
                {getPresetSessionalSlots(modelId).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>Time slot</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
              >
                {TIME_MODELS[modelId].slots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {slotConflict && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, #dc2626 8%, var(--card))',
              border: '1px solid color-mix(in srgb, #dc2626 35%, transparent)', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5,
            }}>
              ⚠️ <strong>{slotConflict.courseCode}</strong> ({slotConflict.courseTitle || 'another course'}) is already
              scheduled for {assignment.batch?.toUpperCase()} {assignment.dept} on {day} at {slotConflict.conflictingSlot?.slot} — that
              overlaps the time you picked. Double-check this is intentional before saving.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              className="accent-fill-glass"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 16px', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Single-class notice composer + sent-history, always scoped to THIS
// class only — unlike the sidebar Broadcast Notice page (multi-class).
// Two targetType choices, matching what students/CR already understand
// from the rest of the notice system:
//   - 'broadcast' → every student in this class sees it ("Class only")
//   - 'cr_only'   → only this class's CR/ACR see it ("CR only")
//
// Audit fix: this composer was the one surface never migrated through
// Phases 2/3/4 of the Notice upgrade (the plan's "wire into all 3
// composers" language undercounted — this class-page composer is a 4th).
// Brought up to parity here: markdown toolbar (Phase 3), priority
// selector (Phase 4), delete + Insights panel (Phase 2), and the sent-
// notices list now renders via the shared formatter instead of raw text.
function NoticesTab({ groupId, isVerified, assignment }) {
  const [facultyDoc, setFacultyDoc] = useState(null);
  const [notices, setNotices] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('broadcast');
  const [priority, setPriority] = useState('normal');
  const [showPreview, setShowPreview] = useState(false);
  const noticeTextareaRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyDoc);
  }, []);

  useEffect(() => {
    if (!groupId) { setNotices([]); return; }
    return noticeApi.subscribeAllNotices({}, groupId, setNotices, 'faculty', { viewerUid: auth.currentUser?.uid });
  }, [groupId]);

  const handleSend = async () => {
    if (!isVerified) {
      notify('Teacher Verification is required before you can send notices.', 'error');
      return;
    }
    if (!title.trim() || !body.trim()) {
      notify('Please enter both a title and a message.', 'error');
      return;
    }
    setSending(true);
    try {
      await postFacultyNotice(groupId, facultyDoc, auth.currentUser.uid, {
        title: title.trim(), body: body.trim(), targetType, priority,
        courseCode: assignment?.courseCode || '', courseTitle: assignment?.courseTitle || '',
      });
      setTitle('');
      setBody('');
      setPriority('normal');
      setShowPreview(false);
      notify('Notice sent.', 'success');
    } catch (e) {
      notify(e.message || 'Could not send this notice.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!(await confirmDialog("Delete this notice? It will be removed from your class's feed."))) return;
    setDeletingId(noticeId);
    try {
      await deleteNoticeSoft(noticeId, groupId);
    } catch (err) {
      alertDialog(`Failed to delete: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 14, display: 'grid', gap: 8 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
        />
        {!showPreview ? (
          <>
            <NoticeComposerToolbar textareaRef={noticeTextareaRef} value={body} onChange={setBody} disabled={!isVerified} />
            <textarea
              ref={noticeTextareaRef}
              placeholder="Message"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical' }}
            />
          </>
        ) : (
          <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', minHeight: 60, fontSize: 13, color: 'var(--text)' }}>
            {body ? renderFormattedNoticeBody(body) : <span style={{ color: 'var(--muted)' }}>Nothing to preview yet.</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          disabled={!isVerified}
          style={{
            alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            background: 'none', border: 'none', padding: 0, cursor: isVerified ? 'pointer' : 'not-allowed',
          }}
        >
          {showPreview ? 'Back to edit' : 'Preview'}
        </button>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="radio" checked={targetType === 'broadcast'} onChange={() => setTargetType('broadcast')} style={{ width: 13, height: 13 }} />
            Class only (all students)
          </label>
          <label style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="radio" checked={targetType === 'cr_only'} onChange={() => setTargetType('cr_only')} style={{ width: 13, height: 13 }} />
            CR only
          </label>
        </div>
        <NoticePrioritySelector value={priority} onChange={setPriority} disabled={!isVerified} />
        <button
          className="accent-fill-glass"
          onClick={handleSend}
          disabled={sending || !isVerified}
          title={!isVerified ? 'Teacher Verification needed before you can send notices' : undefined}
          style={{ padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: (sending || !isVerified) ? 'not-allowed' : 'pointer', opacity: (sending || !isVerified) ? 0.5 : 1 }}
        >
          {sending ? 'Sending…' : 'Send Notice'}
        </button>
        {!isVerified && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            🔒 Needs Teacher Verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {notices.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notices sent to this class yet.</div>
        )}
        {notices.map((n) => (
          <div key={n.id} style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)', opacity: n.deleted ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{n.title}</span>
                {n.deleted && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase',
                    border: '1px solid var(--danger)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                  }}>
                    Deleted
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {n.targetType === 'cr_only' ? 'CR only' : 'Class only'}
                </span>
                {!n.deleted && (
                  <button
                    type="button"
                    onClick={() => handleDeleteNotice(n.id)}
                    disabled={deletingId === n.id}
                    aria-label={`Delete notice: ${n.title}`}
                    style={{
                      display: 'flex', alignItems: 'center', color: 'var(--danger)',
                      background: 'none', border: 'none', cursor: deletingId === n.id ? 'not-allowed' : 'pointer',
                      padding: 0, opacity: deletingId === n.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{renderFormattedNoticeBody(n.body)}</div>
            <NoticeInsightsPanel noticeId={n.id} groupId={groupId} audienceSize={n.audienceSize} title={n.title} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SyllabusTab({ assignment }) {
  if (!assignment) return null;
  const syllabus = getDeptSyllabus(assignment.dept);
  const course = syllabus?.courses?.[assignment.courseCode];
  const accent = 'var(--accent)';

  if (!course) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
        No syllabus entry found for {assignment.courseCode} yet.
      </div>
    );
  }

  const topics = course.topics || [];
  const references = course.references || [];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${accent}`, background: 'var(--card)' }}>
      <div style={{ padding: '14px', background: `color-mix(in srgb, ${accent} 8%, transparent)`, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: accent, letterSpacing: '0.05em' }}>{assignment.courseCode}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{course.title}</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', background: accent, color: '#fff', borderRadius: 4, flexShrink: 0 }}>
            {course.credit} cr
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>⏱ {course.contactHour || 'N/A'} · {topics.length} topics</div>
      </div>

      {references.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.04)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>📖 References</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {references.map((ref, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>• {ref}</div>
            ))}
          </div>
        </div>
      )}

      {topics.length > 0 ? (
        <div>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
            Topics ({topics.length})
          </div>
          <div>
            {/* Topics are always shown in full — no click-to-expand toggle.
                Previously each topic was truncated to 100 chars and needed
                a tap to reveal the rest, on both mobile and desktop; that
                extra step served no purpose since the teacher opens this
                tab specifically to read the syllabus. */}
            {topics.map((topic, i) => (
              <div key={i} style={{ borderBottom: i < topics.length - 1 ? '1px solid var(--border)' : 'none', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>{topic}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>⚠️ No detailed topics listed for this course.</div>
      )}
    </div>
  );
}

function ScheduleTab({ assignment, groupId, isVerified, onEditDayTime }) {
  const slots = assignment?.dayTimeSlots || [];
  return (
    <div>
      {!slots.length ? (
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>No day/time slot set for this class yet.</div>
          <button
            className="accent-fill-glass"
            onClick={onEditDayTime}
            disabled={!isVerified}
            title={!isVerified ? 'Teacher Verification needed before you can set a class schedule' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              color: '#fff', fontWeight: 700, fontSize: 12.5,
              cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.5,
            }}
          >
            <Clock size={13} /> Set day &amp; time
          </button>
          {!isVerified && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              🔒 Needs Teacher Verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {slots.map((s, i) => (
              <div key={i} className="faculty-row">
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{s.day}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.slot}</div>
                {s.modelId && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{TIME_MODELS[s.modelId]?.name || s.modelId}</span>}
              </div>
            ))}
          </div>
          <button
            onClick={onEditDayTime}
            disabled={!isVerified}
            title={!isVerified ? 'Teacher Verification needed before you can edit the class schedule' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5,
              cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.5,
            }}
          >
            <Pencil size={13} /> Edit day &amp; time
          </button>
          {!isVerified && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              🔒 Needs Teacher Verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
            </div>
          )}
        </div>
      )}

      {/* ── Full Batch Routine (read-only) ──────────────────────────────
          Shows the whole batch+dept group's live routineEntries (the same
          data CR/students maintain in Schedule.jsx), regardless of whether
          this faculty has set their own day/time above — this section is
          about the batch's routine, not this faculty's own slot, so it
          renders in both the empty and non-empty branches above. */}
      <BatchRoutineGrid assignment={assignment} groupId={groupId} />
    </div>
  );
}

const normCourseCode = (s) => String(s || '').trim().toUpperCase();

function BatchRoutineGrid({ assignment, groupId }) {
  // null = loading, [] = loaded-but-empty
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!groupId) { setEntries([]); return; }
    // BUGFIX: Firestore's routineEntries can genuinely contain duplicate
    // docs for the same real-world slot (e.g. a CR double-saved the same
    // class before this bug was noticed) — subscribeRoutine returns every
    // non-deleted doc as-is, with no dedup of its own. The student-side
    // Schedule.jsx (pages/Schedule.jsx's normalizeScheduleEntries) already
    // collapses these by a day+slot+course+teacher+type+room+note key
    // before rendering, which is why the same duplicate data reads clean
    // there but rendered as 3-4 repeated chips here — this view read the
    // raw entries straight into the table with no equivalent step. Same
    // key shape as normalizeScheduleEntries so both pages agree on what
    // counts as "the same entry", intentionally NOT deduped by Firestore
    // doc id (duplicates are separate docs by definition).
    return subscribeRoutine(groupId, (raw) => {
      const seen = new Set();
      const deduped = (raw || []).filter((e) => {
        const key = [e.day, e.slot, e.courseId, e.teacherName || '', e.type || '', e.room || '', e.note || ''].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setEntries(deduped);
    });
  }, [groupId]);

  const activeTemplate = TIME_MODELS['50min'];
  const slotList = activeTemplate.slots;
  const isBreakSlot = (slot) => String(slot).toLowerCase().includes('break');

  // Anchor + rowSpan layout, mirrored from FacultySchedule.jsx's tableLayout
  // (same isSlotOverlap-based merge so a wide "Full sessional block" slot
  // string lands on one spanning cell instead of matching nothing). Unlike
  // that file, a whole batch's routine can legitimately have MULTIPLE
  // different courses anchored to the same day+slot (parallel
  // sections/labs), so `starts[day][slot]` here is treated as a real list
  // to render — not assumed to have at most one entry.
  const tableLayout = useMemo(() => {
    const starts = {};
    const covered = {};
    DAYS.forEach((day) => {
      starts[day] = {};
      covered[day] = new Set();
    });

    (entries || []).forEach((entry) => {
      if (!starts[entry.day]) return;

      const overlappingSlots = slotList.filter(
        (s) => !isBreakSlot(s) && isSlotOverlap(s, entry.slot),
      );
      const exactMatch = overlappingSlots.find((s) => s === entry.slot);
      const firstSlot = exactMatch || overlappingSlots[0];
      if (!firstSlot) return; // no period in the 50min template overlaps this slot at all

      const slotsFromFirst = exactMatch
        ? overlappingSlots.slice(overlappingSlots.indexOf(exactMatch))
        : overlappingSlots;
      const rowSpan = Math.max(1, slotsFromFirst.length || 1);

      if (!starts[entry.day][firstSlot]) starts[entry.day][firstSlot] = [];
      starts[entry.day][firstSlot].push({ entry, rowSpan });
      slotsFromFirst.slice(1).forEach((s) => covered[entry.day].add(s));
    });

    return { starts, covered };
  }, [entries, slotList]);

  const loading = entries === null;

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarClock size={13} /> Full Batch Routine (Read-only)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(59,130,246,0.18)', border: '1.5px solid var(--accent)', display: 'inline-block' }} />
            Your class
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--card)', border: '1px solid var(--border)', display: 'inline-block' }} />
            Other classes
          </span>
        </div>
      </div>

      {loading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>}

      {!loading && entries.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
          This batch's group hasn't set up a routine yet.
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 90, textAlign: 'left', fontSize: 11 }}>
                  Time
                </th>
                {DAYS.map((d) => (
                  <th key={d} style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 120, fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                    {d.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotList.map((slot) => {
                const breakSlot = isBreakSlot(slot);
                return (
                  <tr key={slot}>
                    <td style={{
                      padding: '8px 8px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                      fontWeight: 700, fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace',
                      whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)',
                    }}>
                      {slot}
                    </td>
                    {DAYS.map((d) => {
                      // A slot covered by an earlier anchor's rowSpan renders no
                      // <td> at all — the anchor cell's rowSpan already occupies
                      // that table position; emitting one here would break the
                      // row's column count.
                      if (!breakSlot && tableLayout.covered[d]?.has(slot)) return null;

                      const anchored = tableLayout.starts[d]?.[slot] || [];
                      const rowSpan = anchored.length
                        ? Math.max(...anchored.map((a) => a.rowSpan))
                        : 1;

                      return (
                        <td
                          key={d}
                          rowSpan={rowSpan > 1 ? rowSpan : undefined}
                          style={{
                            padding: 5, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                            verticalAlign: 'top', minHeight: 50,
                            background: breakSlot ? 'rgba(239,68,68,0.08)' : 'transparent',
                          }}
                        >
                          {anchored.map(({ entry, rowSpan: rs }) => {
                            // BUGFIX: raw routineEntries docs don't always
                            // have a non-empty courseCode (it's only
                            // populated when Schedule.jsx's course picker
                            // found a matching course.code at save time —
                            // see pages/Schedule.jsx's newEntry object).
                            // Matching on courseCode alone meant the
                            // teacher's OWN class silently lost its
                            // "Your class" highlight whenever that field
                            // came back blank. courseId is the field the
                            // routine entry is actually keyed by, so check
                            // that first and only fall back to courseCode
                            // for older docs that might predate courseId
                            // being saved.
                            const own = (entry.courseId && assignment?.courseId)
                              ? entry.courseId === assignment.courseId
                              : normCourseCode(entry.courseCode) === normCourseCode(assignment?.courseCode);
                            return (
                              <div key={entry.id} style={{
                                padding: '6px 8px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.3, marginBottom: 4,
                                height: rs > 1 ? '100%' : undefined,
                                background: own ? 'rgba(59,130,246,0.10)' : 'var(--card)',
                                border: own ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                                color: own ? 'var(--text)' : 'var(--muted)',
                                fontWeight: own ? 700 : 500,
                              }}>
                                {/* Same fallback chain as normalizeScheduleEntries'
                                    consumers elsewhere: courseCode (short,
                                    preferred) → displayName (what the CR
                                    typed/picked) → courseName (full name) →
                                    a visible placeholder rather than a blank
                                    chip if every field came back empty. */}
                                <div>{entry.courseCode || entry.displayName || entry.courseName || 'Unknown course'}</div>
                                <div style={{ fontSize: 10, marginTop: 1, opacity: 0.85 }}>
                                  {entry.teacherName || 'Teacher not set'}
                                </div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Phase E — mobile 2-row swipeable roster row (ATTENDANCE_REBUILD_PLAN.md
// §3e). Two independent swipe zones per row, matching the plan's spec:
//   Row 1 (identity): resting position shows Roll, swipe left↔right
//     reveals Name, snaps back to Roll on release (identity swipe is
//     momentary — there's no "pinned" state for it in the plan, only the
//     attendance row below gets a pinned resting position).
//   Row 2 (attendance): resting position is the editable mark for the
//     currently selected `date` (today by default) using the exact same
//     effectiveMark/togglePresentAbsent/setMark/expandedRoll state Phase D
//     built — swiping left↔right cycles through OTHER dates' historical
//     marks (read-only), and releasing always snaps back to the pinned
//     editable date rather than leaving the teacher stranded on a
//     read-only history card, per the plan's explicit pinning requirement.
// No swipe library: package.json has none (checked before this phase), so
// this is plain pointer events + a CSS transform — proportionate to a
// 2-row card, not worth a new dependency.
function AttendanceMobileRow({
  m, stats, effectiveMark, isExpanded, rosterLocked, multiSection, activeSection,
  markColors, markLabels, sessions, date, togglePresentAbsent, setMark, setExpandedRoll,
  handleMoveSection, draftMarks, isDiscontinued, discontinuing, handleToggleDiscontinue,
}) {
  // Row 1 state: false = showing Roll (resting), true = showing Name.
  const [showName, setShowName] = useState(false);

  // Row 2 — spreadsheet history strip (per Akhinoor: same idea as
  // desktop's date grid, just mobile-shaped). Name/Roll stays sticky on
  // the far left (Row 1 above); here in Row 2, today's editable Mark
  // button sits pinned first, and dragging it right→left reveals older
  // dates scrolling in from the right — same "newest at the right edge"
  // ordering as desktop, just entered via a native horizontal scroll
  // instead of a discrete swipe-and-snap. Oldest→newest, excluding
  // today's own `date` (that's the pinned Mark button, not a strip cell).
  const historyDates = (sessions || [])
    .map((s) => s.date)
    .filter((d) => d !== date)
    .sort();

  // Row 1's own tiny swipe (Roll ↔ Name), kept exactly as before — this
  // one still needs a discrete swipe-and-snap since it's toggling between
  // two fixed labels, not scrolling through a list.
  const identityDrag = useRef(null);
  const onIdentityPointerDown = (e) => {
    identityDrag.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  };
  const onIdentityPointerUp = (e) => {
    const startX = identityDrag.current;
    identityDrag.current = null;
    if (startX == null) return;
    const endX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? startX;
    if (Math.abs(endX - startX) < 40) return; // px — deliberate swipe vs. tap/scroll
    setShowName((v) => !v);
  };

  if (isDiscontinued) {
    return (
      <div className="attendance-mrow" style={{ opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{m.name || m.roll || '—'}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'color-mix(in srgb, #dc2626 14%, var(--card))', color: '#dc2626' }}>
              Discontinued
            </span>
          </div>
          <button
            onClick={() => handleToggleDiscontinue(m.roll, m.name, true)}
            disabled={discontinuing === m.roll}
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--accent)', fontWeight: 700, fontSize: 10.5, cursor: discontinuing === m.roll ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            {discontinuing === m.roll ? '…' : 'Mark active'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-mrow">
      {/* Row 1 — identity: Roll (resting) ↔ Name (swiped) */}
      <div
        className="attendance-mrow-track attendance-mrow-identity"
        onPointerDown={onIdentityPointerDown}
        onPointerUp={onIdentityPointerUp}
        onPointerCancel={() => { identityDrag.current = null; }}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', fontFamily: showName ? 'inherit' : 'JetBrains Mono, monospace' }}>
            {showName ? (m.name || 'Unnamed') : (m.roll || '—')}
          </span>
          {m.isPlaceholder && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              No account
            </span>
          )}
          {m.isBacklog && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'color-mix(in srgb, var(--accent) 14%, var(--card))', color: 'var(--accent)' }}>
              Added
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            color: stats.pct === null ? 'var(--muted)' : stats.pct >= 75 ? '#16a34a' : stats.pct >= 60 ? '#d97706' : '#dc2626',
          }}>
            {stats.pct === null ? '—' : `${stats.pct}%`}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {stats.presentCount}/{stats.markedCount}
          </span>
        </div>
      </div>

      {/* Row 2 — spreadsheet strip: Mark button pinned first (not inside
          the scroll area, so it's always reachable without scrolling),
          then older session dates scroll in to its right on drag —
          exactly the same oldest→newest/newest-at-the-right convention as
          the desktop history strip, just touch-scrolled instead of a
          discrete swipe-and-snap. The ⋯ (discontinue) button stays
          pinned at the far right, outside the scroll area too, so it's
          never lost off-screen. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => !rosterLocked && togglePresentAbsent(m.roll, effectiveMark)}
          disabled={rosterLocked}
          style={{
            width: 56, height: 30, borderRadius: 7, fontSize: 11.5, fontWeight: 700, flexShrink: 0,
            cursor: rosterLocked ? 'not-allowed' : 'pointer',
            border: `1px solid ${markColors[effectiveMark]}`,
            background: `${markColors[effectiveMark]}22`,
            color: markColors[effectiveMark],
          }}
        >
          {markLabels[effectiveMark]}
        </button>
        {historyDates.length > 0 && (
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', flex: '1 1 auto', minWidth: 0 }} className="attendance-history-scroll">
            {historyDates.map((d) => {
              const mark = sessions.find((s) => s.date === d)?.attendance?.[m.roll] || null;
              const cellColor = mark === 'present' ? '#16a34a' : mark === 'absent' ? '#dc2626' : 'var(--border)';
              const cellLabel = mark === 'present' ? 'P' : mark === 'absent' ? 'A' : '·';
              return (
                <div
                  key={d}
                  title={new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  style={{
                    width: 30, height: 30, flexShrink: 0, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                    border: `1px solid ${cellColor}`, background: `${cellColor}1c`,
                    color: mark ? cellColor : 'var(--muted)',
                  }}
                >
                  {cellLabel}
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={() => !rosterLocked && setExpandedRoll((v) => (v === m.roll ? null : m.roll))}
          disabled={rosterLocked}
          title="Discontinue"
          style={{
            width: 26, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: rosterLocked ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          ⋯
        </button>
        {multiSection && (
          <button
            onClick={() => handleMoveSection(m.roll, m.name, activeSection === 'A' ? 'B' : 'A')}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 10, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
          >
            → Sec {activeSection === 'A' ? 'B' : 'A'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>Stopped taking this course?</span>
          <button
            onClick={() => { handleToggleDiscontinue(m.roll, m.name, false); setExpandedRoll(null); }}
            disabled={discontinuing === m.roll}
            style={{
              padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              cursor: discontinuing === m.roll ? 'not-allowed' : 'pointer',
              border: '1px solid #dc2626', background: '#dc262622', color: '#dc2626',
            }}
          >
            {discontinuing === m.roll ? 'Marking…' : 'Mark Discontinued'}
          </button>
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ assignment, groupId }) {
  const [members, setMembers] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [backlogStudents, setBacklogStudents] = useState(null);
  const [discontinuedStudents, setDiscontinuedStudents] = useState(null);
  const [facultyName, setFacultyName] = useState('');

  const multiSection = isMultiSectionDept(assignment?.dept);
  const [activeSection, setActiveSection] = useState(() => (assignment?.section === 'B' ? 'B' : 'A'));

  // Add student — inline popover under the "+ Add student" button.
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addRollInput, setAddRollInput] = useState('');
  const [addSectionInput, setAddSectionInput] = useState('A');
  const [addingStudent, setAddingStudent] = useState(false);

  // Zoom level for the grid — index into ZOOM_STEPS below.
  const [zoomIdx, setZoomIdx] = useState(1);
  const ZOOM_STEPS = [28, 34, 42];
  const cellSize = ZOOM_STEPS[zoomIdx];

  // Save status pill — 'idle' | 'saving' | 'saved'.
  const [saveStatus, setSaveStatus] = useState('idle');

  const [showSummary, setShowSummary] = useState(false);
  // Which sub-menu modal is open from "⋯" — null | 'menu' | 'coteacher' | 'discontinued' | 'export'
  const [openPanel, setOpenPanel] = useState(null);

  const [discontinueRollInput, setDiscontinueRollInput] = useState('');
  const [discontinuing, setDiscontinuing] = useState(null); // roll mid-action, or null

  const [exportingFormat, setExportingFormat] = useState(null);

  const mergedRosterRef = useRef([]);

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    return subscribeMembers(groupId, setMembers);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !assignment) { setSessions([]); return; }
    return subscribeSessionAttendance(groupId, assignment.id, setSessions);
  }, [groupId, assignment]);

  useEffect(() => {
    if (!groupId || !assignment) { setBacklogStudents([]); return; }
    return subscribeBacklogStudents(groupId, assignment.id, setBacklogStudents);
  }, [groupId, assignment]);

  useEffect(() => {
    if (!groupId || !assignment) { setDiscontinuedStudents([]); return; }
    return subscribeDiscontinuedStudents(groupId, assignment.id, setDiscontinuedStudents);
  }, [groupId, assignment]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then((fdoc) => setFacultyName(getFacultyDisplayName(fdoc?.preferredName || fdoc?.name, fdoc?.title)));
  }, []);

  const myUid = auth.currentUser?.uid;
  const isJoinedClass = (assignment?.teacherUids || []).length > 1;

  // ── Co-teacher: invite code, join requests, link invites ──────────────
  const [inviteCode, setInviteCode] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const code = await generateInviteCode(groupId, assignment.id);
      setInviteCode(code);
    } catch (e) {
      notify(e.message || 'Could not generate an invite code.', 'error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const [joinRequests, setJoinRequests] = useState([]);
  const [resolvingRequest, setResolvingRequest] = useState(null);
  useEffect(() => {
    if (!groupId || !assignment?.id) return undefined;
    return subscribeJoinRequests(groupId, assignment.id, setJoinRequests);
  }, [groupId, assignment?.id]);
  const pendingJoinRequests = joinRequests.filter((r) => r.status === 'pending');

  const handleAcceptJoin = async (requestingUid) => {
    setResolvingRequest(requestingUid);
    try {
      await acceptJoinRequest(groupId, assignment.id, requestingUid);
      notify('Co-teacher joined.', 'success');
    } catch (e) {
      notify(e.message || 'Could not accept this request.', 'error');
    } finally {
      setResolvingRequest(null);
    }
  };
  const handleDeclineJoin = async (requestingUid) => {
    setResolvingRequest(requestingUid);
    try {
      await declineJoinRequest(groupId, assignment.id, requestingUid);
    } catch (e) {
      notify(e.message || 'Could not decline this request.', 'error');
    } finally {
      setResolvingRequest(null);
    }
  };

  const [pendingLinkInvites, setPendingLinkInvites] = useState([]);
  const [resolvingLinkInvite, setResolvingLinkInvite] = useState(null);
  useEffect(() => {
    if (!groupId || !assignment?.id) return undefined;
    const uid = auth.currentUser?.uid;
    return subscribePendingLinkRequests(groupId, (all) => {
      setPendingLinkInvites(all.filter((r) =>
        r.direction === 'cr_to_teacher'
        && r.targetFacultyUid === uid
        && r.assignmentId === assignment.id
      ));
    }, () => setPendingLinkInvites([]));
  }, [groupId, assignment?.id]);

  const handleAcceptLinkInvite = async (requestId) => {
    setResolvingLinkInvite(requestId);
    try {
      await acceptLinkRequest(groupId, requestId);
      notify('Linked to the CR\u2019s schedule.', 'success');
    } catch (e) {
      notify(e.message || 'Could not accept this invite.', 'error');
    } finally {
      setResolvingLinkInvite(null);
    }
  };
  const handleDeclineLinkInvite = async (requestId) => {
    setResolvingLinkInvite(requestId);
    try {
      await declineLinkRequest(groupId, requestId);
    } catch (e) {
      notify(e.message || 'Could not decline this invite.', 'error');
    } finally {
      setResolvingLinkInvite(null);
    }
  };

  const pendingCoTeacherCount = pendingJoinRequests.length + pendingLinkInvites.length;

  // ── Add / Discontinue students ─────────────────────────────────────────
  const handleAddStudent = async () => {
    setAddingStudent(true);
    try {
      await addBacklogStudent(groupId, assignment.id, {
        roll: addRollInput.trim(),
        name: '',
        section: multiSection ? addSectionInput : null,
        addedBy: { uid: auth.currentUser.uid, name: facultyName },
      });
      notify('Student added.', 'success');
      setAddRollInput('');
      setShowAddStudent(false);
    } catch (e) {
      notify(e.message || 'Could not add this student.', 'error');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleDiscontinueByRoll = async () => {
    const roll = discontinueRollInput.trim();
    if (!isValidRoll(roll)) return;
    setDiscontinuing(roll);
    try {
      const existing = mergedRosterRef.current.find((m) => m.roll === roll);
      await setStudentDiscontinued(groupId, assignment.id, {
        roll,
        name: existing?.name || roll,
        setBy: { uid: auth.currentUser.uid, name: facultyName },
      });
      notify('Marked discontinued.', 'success');
      setDiscontinueRollInput('');
    } catch (e) {
      notify(e.message || 'Could not update this roll.', 'error');
    } finally {
      setDiscontinuing(null);
    }
  };

  const handleReactivate = async (roll) => {
    setDiscontinuing(roll);
    try {
      await clearStudentDiscontinued(groupId, assignment.id, roll);
    } catch (e) {
      notify(e.message || 'Could not update this roll.', 'error');
    } finally {
      setDiscontinuing(null);
    }
  };

  if (members === null || sessions === null || backlogStudents === null || discontinuedStudents === null) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>;
  }

  const findMemberByRoll = (roll) => {
    const core = toSevenDigitCore(roll);
    return members.find((m) => toSevenDigitCore(m.roll) === core);
  };

  const sectionForRoster = multiSection ? activeSection : null;
  const generatedRolls = generateDeptRollRoster(assignment?.dept, assignment?.batch, sectionForRoster);
  const backlogForSection = (backlogStudents || []).filter((b) => !multiSection || b.section === activeSection);
  const backlogRolls = new Set(backlogForSection.map((b) => b.roll));

  const generatedRoster = generatedRolls
    .filter((g) => !backlogRolls.has(g.roll))
    .map((g) => {
      const realMember = findMemberByRoll(g.roll);
      return {
        id: realMember?.id || `placeholder:${g.roll}`,
        roll: g.roll,
        name: realMember?.name || g.roll,
        isPlaceholder: !realMember,
        isBacklog: false,
      };
    });

  const backlogRoster = backlogForSection.map((b) => {
    const realMember = findMemberByRoll(b.roll);
    return {
      id: realMember?.id || `backlog:${b.roll}`,
      roll: b.roll,
      name: realMember?.name || b.name || b.roll,
      isPlaceholder: !realMember,
      isBacklog: true,
    };
  });

  const discontinuedRolls = new Set((discontinuedStudents || []).map((d) => d.roll));
  const mergedRoster = sortByRoll([...generatedRoster, ...backlogRoster])
    .filter((m) => !discontinuedRolls.has(m.roll));
  mergedRosterRef.current = mergedRoster;

  // Full dept+batch roster, both sections — used for export only.
  const fullMergedRoster = (() => {
    if (!multiSection) return mergedRoster;
    const allGeneratedRolls = generateDeptRollRoster(assignment?.dept, assignment?.batch, null);
    const allBacklogRolls = new Set((backlogStudents || []).map((b) => b.roll));
    const allGenerated = allGeneratedRolls
      .filter((g) => !allBacklogRolls.has(g.roll))
      .map((g) => {
        const realMember = findMemberByRoll(g.roll);
        return {
          id: realMember?.id || `placeholder:${g.roll}`,
          roll: g.roll,
          name: realMember?.name || g.roll,
          isPlaceholder: !realMember,
          isBacklog: false,
        };
      });
    const allBacklog = (backlogStudents || []).map((b) => {
      const realMember = findMemberByRoll(b.roll);
      return {
        id: realMember?.id || `backlog:${b.roll}`,
        roll: b.roll,
        name: realMember?.name || b.name || b.roll,
        isPlaceholder: !realMember,
        isBacklog: true,
      };
    });
    return sortByRoll([...allGenerated, ...allBacklog]).filter((m) => !discontinuedRolls.has(m.roll));
  })();

  // Every date any session exists for (this teacher's own sessions —
  // matches the old "mine" default; co-teacher's marks aren't a separate
  // column set here, both teachers write into the same per-date session
  // via loggedBy on that doc, same as before).
  const mySessions = (sessions || []).filter((s) => s.loggedBy?.uid === myUid);
  const historyDates = [...new Set(mySessions.map((s) => s.date))].sort();
  const sessionByDate = Object.fromEntries(mySessions.map((s) => [s.date, s]));

  const MARK_CYCLE = { present: 'absent', absent: 'late', late: 'present' };
  const MARK_COLOR = {
    present: '#16a34a',
    absent: '#dc2626',
    late: '#d97706',
  };
  const MARK_LABEL = { present: 'P', absent: 'A', late: 'L' };

  // One cell click -> update that date's session doc directly (debounced
  // per date so rapid clicks across a row/column don't fire a write per
  // click). No lock/edit-mode: every date's doc is always writable.
  const pendingWrites = useRef({}); // date -> timeout id
  const draftByDate = useRef({}); // date -> { [roll]: mark } local buffer merged into what's shown

  const [, forceRerender] = useState(0);

  const getEffectiveMark = (date, roll) => {
    const draft = draftByDate.current[date];
    if (draft && roll in draft) return draft[roll];
    const existing = sessionByDate[date];
    return existing?.attendance?.[roll] || 'present';
  };

  const flushDate = async (date) => {
    const draft = draftByDate.current[date];
    if (!draft) return;
    setSaveStatus('saving');
    try {
      const existing = sessionByDate[date];
      const attendance = { ...(existing?.attendance || {}), ...draft };
      const rollToUid = Object.fromEntries(
        (members || []).filter((m) => m.roll).map((m) => [m.roll, m.id])
      );
      await createOrUpdateSessionAttendance(groupId, assignment.id, {
        sessionId: existing?.id || null,
        date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        slot: assignment.dayTimeSlots?.[0]?.slot || '',
        attendance,
        rollToUid,
        loggedBy: { uid: auth.currentUser.uid, role: 'faculty', name: facultyName },
      });
      delete draftByDate.current[date];
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      notify(e.message || 'Could not save attendance.', 'error');
      setSaveStatus('idle');
    }
  };

  const cycleMark = (date, roll) => {
    const current = getEffectiveMark(date, roll);
    const next = MARK_CYCLE[current] || 'present';
    draftByDate.current[date] = { ...(draftByDate.current[date] || {}), [roll]: next };
    forceRerender((n) => n + 1);
    if (pendingWrites.current[date]) clearTimeout(pendingWrites.current[date]);
    pendingWrites.current[date] = setTimeout(() => flushDate(date), 500);
  };

  const addTodayColumn = () => {
    const today = todayStr();
    if (!historyDates.includes(today)) {
      draftByDate.current[today] = draftByDate.current[today] || {};
      forceRerender((n) => n + 1);
    }
  };
  const [pickingDate, setPickingDate] = useState(false);
  const [pickedDate, setPickedDate] = useState('');
  const addPickedDateColumn = () => {
    if (!pickedDate) return;
    draftByDate.current[pickedDate] = draftByDate.current[pickedDate] || {};
    setPickingDate(false);
    setPickedDate('');
    forceRerender((n) => n + 1);
  };

  const displayDates = [...new Set([...historyDates, ...Object.keys(draftByDate.current)])].sort();

  // ── Summary stats (for the Summary modal) ──────────────────────────────
  const rowStatsByRoll = {};
  mergedRoster.forEach((m) => {
    let held = 0;
    let present = 0;
    mySessions.forEach((s) => {
      const mark = s.attendance?.[m.roll];
      if (mark === undefined) return;
      held += 1;
      if (mark === 'present' || mark === 'late') present += 1;
    });
    rowStatsByRoll[m.roll] = { held, present, pct: held > 0 ? Math.round((present / held) * 100) : null };
  });
  const withPct = mergedRoster
    .map((m) => ({ ...m, ...rowStatsByRoll[m.roll] }))
    .filter((m) => m.held > 0);
  const mostRegular = [...withPct].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const mostAbsent = [...withPct].sort((a, b) => a.pct - b.pct).slice(0, 5);
  const classPerformancePct = withPct.length
    ? Math.round(withPct.reduce((sum, m) => sum + m.pct, 0) / withPct.length)
    : null;

  const handleExport = async (format) => {
    setExportingFormat(format);
    try {
      if (format === 'excel') {
        exportAttendanceExcel(assignment, fullMergedRoster, sessions, facultyName);
      } else {
        await exportAttendancePdf(assignment, fullMergedRoster, sessions, facultyName);
      }
    } catch (e) {
      notify(e.message || 'Export failed.', 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const btnBase = {
    padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)',
    color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
  };

  return (
    <div>
      {/* Top bar — two fixed rows (predictable on mobile; not a flex-wrap
          that could reflow unpredictably). Row 1: identity (course code +
          section). Row 2: actions (add/status/summary/menu). */}
      <div className="attendance-topbar" style={{
        position: 'sticky', top: 0, zIndex: 6, background: 'var(--bg)', paddingBottom: 8, marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
            {assignment?.courseCode}
          </div>
          {multiSection && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {['A', 'B'].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveSection(sec)}
                  style={{
                    padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    border: activeSection === sec ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: activeSection === sec ? 'color-mix(in srgb, var(--accent) 12%, var(--card))' : 'transparent',
                    color: activeSection === sec ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button style={btnBase} onClick={() => { setShowAddStudent((v) => !v); setAddSectionInput(activeSection); }}>
              <Plus size={13} /> <span className="attendance-btn-label">Add student</span>
            </button>
            {showAddStudent && (
              <div style={{
                position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 8, display: 'flex', gap: 6, alignItems: 'center',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                <input
                  type="text"
                  placeholder="7-digit roll"
                  value={addRollInput}
                  onChange={(e) => setAddRollInput(e.target.value)}
                  style={{ width: 110, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
                />
                {multiSection && (
                  <select
                    value={addSectionInput}
                    onChange={(e) => setAddSectionInput(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                )}
                <button
                  className="accent-fill-glass"
                  onClick={handleAddStudent}
                  disabled={addingStudent || !isValidRoll(addRollInput.trim())}
                  style={{ padding: '6px 12px', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (addingStudent || !isValidRoll(addRollInput.trim())) ? 0.5 : 1 }}
                >
                  {addingStudent ? '…' : 'Add'}
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, minWidth: 50 }}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : ''}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
            <button style={btnBase} onClick={() => setShowSummary(true)}>Summary</button>
            <button style={{ ...btnBase, position: 'relative' }} onClick={() => setOpenPanel('menu')}>
              <MoreHorizontal size={15} />
              {pendingCoTeacherCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%',
                  background: '#dc2626',
                }} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── The grid ─────────────────────────────────────────────────── */}
      <div className="faculty-summary-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            disabled={zoomIdx === 0}
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', opacity: zoomIdx === 0 ? 0.4 : 1 }}
          >
            −
          </button>
          <button
            onClick={() => setZoomIdx((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', opacity: zoomIdx === ZOOM_STEPS.length - 1 ? 0.4 : 1 }}
          >
            +
          </button>
        </div>

        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {/* Sticky roll column */}
          <div style={{ flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
            <div style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              Roll
            </div>
            {mergedRoster.map((m) => (
              <div
                key={m.id}
                title={m.name}
                style={{
                  height: cellSize, display: 'flex', alignItems: 'center', padding: '0 10px',
                  fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)',
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}
              >
                {m.roll}
                {m.isPlaceholder && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted)', marginLeft: 5, flexShrink: 0 }} />}
              </div>
            ))}
          </div>

          {/* Date columns */}
          {displayDates.map((d) => (
            <div key={d} style={{ flexShrink: 0, borderRight: '1px solid var(--border)' }}>
              <div style={{
                height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: cellSize + 6, fontSize: 9.5, fontWeight: 800, color: 'var(--muted)', borderBottom: '1px solid var(--border)',
              }}>
                {new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
              </div>
              {mergedRoster.map((m) => {
                const mark = getEffectiveMark(d, m.roll);
                const color = MARK_COLOR[mark];
                return (
                  <button
                    key={m.id}
                    onClick={() => cycleMark(d, m.roll)}
                    style={{
                      display: 'block', width: cellSize + 6, height: cellSize,
                      border: 'none', borderBottom: '1px solid var(--border)',
                      background: `${color}20`, color, fontWeight: 800, fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {MARK_LABEL[mark]}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Add-date column */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setPickingDate((v) => !v)}
                title="Add date"
                style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 800, fontSize: 13, lineHeight: 1 }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {pickingDate && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
            />
            <button className="accent-fill-glass" onClick={addPickedDateColumn} style={{ padding: '6px 12px', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Add
            </button>
            <button onClick={() => { addTodayColumn(); setPickingDate(false); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
              Today
            </button>
          </div>
        )}
      </div>

      {/* ── ⋯ menu (level 1) ────────────────────────────────────────── */}
      {openPanel === 'menu' && (
        <div
          onClick={() => setOpenPanel(null)}
          className="attendance-modal-overlay"
        >
          <div onClick={(e) => e.stopPropagation()} className="attendance-modal-sheet" style={{ minWidth: 220, overflow: 'hidden' }}>
            <button onClick={() => setOpenPanel('coteacher')} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Co-teacher
              {pendingCoTeacherCount > 0 && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, color: '#dc2626' }}>{pendingCoTeacherCount}</span>}
            </button>
            <button onClick={() => setOpenPanel('discontinued')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Discontinued
            </button>
            <button onClick={() => setOpenPanel('export')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Export
            </button>
          </div>
        </div>
      )}

      {/* ── Co-teacher modal ────────────────────────────────────────── */}
      {openPanel === 'coteacher' && (
        <div className="attendance-modal-overlay" onClick={() => setOpenPanel(null)}>
          <div className="attendance-modal-sheet" style={{ width: 320, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setOpenPanel(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            {pendingJoinRequests.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{r.requestingName || 'Teacher'} wants to join</span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleAcceptJoin(r.id)} disabled={resolvingRequest === r.id} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #16a34a', background: '#16a34a22', color: '#16a34a', cursor: 'pointer' }}>✓</button>
                  <button onClick={() => handleDeclineJoin(r.id)} disabled={resolvingRequest === r.id} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #dc2626', background: '#dc262622', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                </span>
              </div>
            ))}
            {pendingLinkInvites.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text)' }}>CR link invite</span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleAcceptLinkInvite(r.id)} disabled={resolvingLinkInvite === r.id} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #16a34a', background: '#16a34a22', color: '#16a34a', cursor: 'pointer' }}>✓</button>
                  <button onClick={() => handleDeclineLinkInvite(r.id)} disabled={resolvingLinkInvite === r.id} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #dc2626', background: '#dc262622', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                </span>
              </div>
            ))}

            {!isJoinedClass && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{inviteCode || 'No code yet'}</span>
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="accent-fill-glass"
                  style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  {generatingInvite ? '…' : 'Generate'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Discontinued modal ──────────────────────────────────────── */}
      {openPanel === 'discontinued' && (
        <div className="attendance-modal-overlay" onClick={() => setOpenPanel(null)}>
          <div className="attendance-modal-sheet" style={{ width: 300, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setOpenPanel(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="7-digit roll"
                value={discontinueRollInput}
                onChange={(e) => setDiscontinueRollInput(e.target.value)}
                style={{ flex: 1, padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
              />
              <button
                onClick={handleDiscontinueByRoll}
                disabled={!isValidRoll(discontinueRollInput.trim()) || !!discontinuing}
                style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #dc2626', background: '#dc262622', color: '#dc2626', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (!isValidRoll(discontinueRollInput.trim()) || discontinuing) ? 0.5 : 1 }}
              >
                Discontinue
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {(discontinuedStudents || []).length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>None</span>
              )}
              {(discontinuedStudents || []).map((d) => (
                <span
                  key={d.roll}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 14,
                    background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text)',
                  }}
                >
                  {d.roll}
                  <button
                    onClick={() => handleReactivate(d.roll)}
                    disabled={discontinuing === d.roll}
                    style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ────────────────────────────────────────────── */}
      {openPanel === 'export' && (
        <div className="attendance-modal-overlay" onClick={() => setOpenPanel(null)}>
          <div className="attendance-modal-sheet" style={{ width: 220, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setOpenPanel(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <button
              onClick={() => handleExport('excel')}
              disabled={!!exportingFormat}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 4px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {exportingFormat === 'excel' ? 'Exporting…' : 'Excel (.xlsx)'}
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!exportingFormat}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 4px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {exportingFormat === 'pdf' ? 'Exporting…' : 'PDF'}
            </button>
          </div>
        </div>
      )}

      {/* ── Summary modal ───────────────────────────────────────────── */}
      {showSummary && (
        <div className="attendance-modal-overlay" onClick={() => setShowSummary(false)}>
          <div className="attendance-modal-sheet" style={{ width: 340, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setShowSummary(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            {classPerformancePct !== null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>Class Performance</span>
                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: classPerformancePct >= 75 ? '#16a34a' : classPerformancePct >= 60 ? '#d97706' : '#dc2626' }}>
                  {classPerformancePct}%
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginBottom: 6 }}>Most Regular</div>
                {mostRegular.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data</div>}
                {mostRegular.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
                    <span style={{ color: 'var(--text)' }}>{s.roll}</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>Most Absent</div>
                {mostAbsent.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data</div>}
                {mostAbsent.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
                    <span style={{ color: 'var(--text)' }}>{s.roll}</span>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// QuestionBank page reads (useQuestionBankData/getR2FileUrl), scoped to
// THIS class's own department only: a teacher assigned to ESE shouldn't
// have to wade through 15 other departments to find their own course's
// past papers. Opens straight to this assignment's own course+term (if
// papers exist there) and lets the teacher switch to any other
// term/course within the SAME dept — never cross-department.
function QuestionBankTab({ assignment }) {
  const { tree, loading, error } = useQuestionBankData();
  const navigate = useNavigate();
  const dept = assignment?.dept;
  const term = assignment?.term;
  const courseCode = assignment?.courseCode;
  const activeCourseKey = courseCode?.replace(/\s+/g, '');

  const papers = (dept && term && activeCourseKey) ? (tree?.[dept]?.[term]?.[activeCourseKey] || []) : [];

  // BUGFIX: this used to be a raw <a href target="_blank"> straight to the
  // R2 file URL, which bypassed the in-app PDF reader entirely (opened a
  // new browser tab / triggered a raw-file download instead) — the same
  // in-app viewer the student-side QuestionBank.jsx page already uses via
  // its own openPaper(). Mirrored that exact navigate() pattern here so
  // faculty gets the same in-app reading experience instead of a second,
  // inconsistent code path. (Paired with App.jsx's allowFaculty fix on the
  // /question-bank/view route itself, which was student-only until now.)
  function openPaper(paper) {
    const url = getR2FileUrl(paper.key);
    navigate(`/question-bank/view?src=${encodeURIComponent(url)}&title=${encodeURIComponent(paper.label)}`);
  }

  if (loading) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading question bank…</div>;
  }
  if (error) {
    return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13, padding: '16px 0' }}>Could not load the question bank: {error}</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Showing past papers for <strong style={{ color: 'var(--text)' }}>{courseCode}</strong> — {dept} {term}.
      </div>

      {papers.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Not found.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {papers.map((p) => (
            <button
              key={p.key}
              onClick={() => openPaper(p)}
              className="faculty-row"
              style={{ textDecoration: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', width: '100%' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                <FileText size={14} color="var(--accent)" /> {p.label}
              </span>
              <ExternalLink size={13} color="var(--muted)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MarksSetupForm({ assignment, groupId, teacherSlot, onSaved, existingConfig, onCancel }) {
  const [attendanceWeight, setAttendanceWeight] = useState(existingConfig?.attendanceWeight ?? 15);
  const [components, setComponents] = useState(
    existingConfig?.components?.length ? existingConfig.components.map((c) => ({ ...c })) : [{ key: 'ct', label: 'CT', max: 30 }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const componentTotal = components.reduce((sum, c) => sum + (Number(c.max) || 0), 0);
  const total = Number(attendanceWeight || 0) + componentTotal;

  const addComponent = () => setComponents((prev) => [...prev, { key: `c${prev.length}`, label: '', max: 0 }]);
  const removeComponent = (idx) => setComponents((prev) => prev.filter((_, i) => i !== idx));
  const updateComponent = (idx, field, value) => setComponents((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: field === 'max' ? Number(value) : value } : c));

  const handleSave = async () => {
    setError('');
    if (total !== 45) {
      setError(`Attendance (${attendanceWeight}) + components (${componentTotal}) must total exactly 45 -- currently ${total}.`);
      return;
    }
    if (components.some((c) => !c.label.trim())) {
      setError('Every component needs a name.');
      return;
    }
    setSaving(true);
    try {
      await setTeacherMarkComponents(groupId, assignment.id, teacherSlot, {
        attendanceWeight: Number(attendanceWeight),
        components: components.map((c) => ({ ...c, key: c.key || c.label.toLowerCase().replace(/\s+/g, '_') })),
      });
      notify('Marks breakdown saved.', 'success');
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save this breakdown.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', marginBottom: 6 }}>
        {existingConfig ? 'Edit your marks breakdown' : 'Set up your marks breakdown'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        You have 45 marks total for this course. Attendance is always its own component
        (scored as a percentage of the weight you set here) -- everything else is entirely
        up to you: name your own components (CT, Assignment, Presentation, Quiz, whatever
        fits) and set each one's maximum. Everything must add up to exactly 45.
        {existingConfig && ' Changing a component\'s max here does not retroactively rescale marks you\'ve already entered for it -- re-check any student whose max you shrink.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <label style={{ fontSize: 12.5, color: 'var(--text)', flex: 1 }}>Attendance weight</label>
        <input
          type="number" min={0} max={45} value={attendanceWeight}
          onChange={(e) => setAttendanceWeight(e.target.value)}
          style={{ width: 64, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
        />
      </div>

      {components.map((c, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="text" placeholder="Component name (e.g. CT, Assignment)" value={c.label}
            onChange={(e) => updateComponent(idx, 'label', e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <input
            type="number" min={0} max={45} value={c.max}
            onChange={(e) => updateComponent(idx, 'max', e.target.value)}
            style={{ width: 64, padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
          />
          <button onClick={() => removeComponent(idx)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
            <X size={15} />
          </button>
        </div>
      ))}

      <button
        onClick={addComponent}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}
      >
        <Plus size={13} /> Add component
      </button>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: total === 45 ? 'var(--accent)' : 'var(--danger, #dc2626)' }}>
        Total: {total} / 45
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        {existingConfig && (
          <button
            onClick={onCancel}
            disabled={saving}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
        )}
        <button
          className="accent-fill-glass"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '9px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : existingConfig ? 'Save Changes' : 'Save Breakdown'}
        </button>
      </div>
    </div>
  );
}

function MarksTab({ assignment, groupId }) {
  const { isFounderBypass, facultyProfile, isResolved: isFacultyResolved } = useIsFaculty();
  const [members, setMembers] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [records, setRecords] = useState(null);
  const [teacherSlot, setTeacherSlot] = useState(null); // 'teacher1' | 'teacher2' | null
  const [markConfig, setMarkConfig] = useState(undefined); // undefined = loading, null = not configured yet
  const [draft, setDraft] = useState({}); // { studentUid: { componentKey: value } }
  const [savingUid, setSavingUid] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [exportingUid, setExportingUid] = useState(null);
  const [exportingClass, setExportingClass] = useState(false);
  // Real names for "Teacher 1" / "Teacher 2" on the exported PDF — resolved
  // from assignment.teacherUids (index 0 = teacher1, index 1 = teacher2)
  // via each teacher's own faculty profile, same source FacultyProfile.jsx
  // itself reads from. Falls back to the generic "Teacher 1"/"Teacher 2"
  // label if a slot is empty (co-teacher not yet joined) or the profile
  // has no name set yet.
  const [teacherNames, setTeacherNames] = useState({ teacher1: '', teacher2: '' });
  // Whether the "edit breakdown" form is showing over the normal marks
  // grid. Previously there was NO way back into MarksSetupForm once
  // markConfig existed — a teacher who wanted to change a component's max,
  // rename something, or add/remove a component after the first save had
  // no path to do so at all. This toggles that form back open on demand.
  const [editingBreakdown, setEditingBreakdown] = useState(false);

  useEffect(() => {
    const uids = assignment?.teacherUids || [];
    if (!uids.length) { setTeacherNames({ teacher1: '', teacher2: '' }); return; }
    let cancelled = false;
    Promise.all(uids.slice(0, 2).map((uid) => (uid ? getFacultyDoc(uid) : null))).then(([t1doc, t2doc]) => {
      if (cancelled) return;
      setTeacherNames({
        teacher1: t1doc ? getFacultyDisplayName(t1doc?.preferredName || t1doc?.name, t1doc?.title) : '',
        teacher2: t2doc ? getFacultyDisplayName(t2doc?.preferredName || t2doc?.name, t2doc?.title) : '',
      });
    }).catch(() => { if (!cancelled) setTeacherNames({ teacher1: '', teacher2: '' }); });
    return () => { cancelled = true; };
  }, [assignment?.teacherUids]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (assignment?.teacherUids) {
      const idx = assignment.teacherUids.indexOf(uid);
      setTeacherSlot(idx === 0 ? 'teacher1' : idx === 1 ? 'teacher2' : null);
    }
  }, [assignment]);

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    return subscribeMembers(groupId, setMembers);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !assignment) { setSessions([]); return; }
    return subscribeSessionAttendance(groupId, assignment.id, setSessions);
  }, [groupId, assignment]);

  useEffect(() => {
    if (!groupId || !assignment) { setRecords([]); return; }
    return subscribeStudentRecords(groupId, assignment.id, setRecords);
  }, [groupId, assignment]);

  useEffect(() => {
    if (!groupId || !assignment || !teacherSlot) return;
    getTeacherMarkComponents(groupId, assignment.id, teacherSlot).then(setMarkConfig);
  }, [groupId, assignment, teacherSlot]);

  if (members === null || sessions === null || records === null || (teacherSlot && markConfig === undefined)) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading...</div>;
  }

  if (!teacherSlot) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
        You aren't one of the two teachers on record for this class assignment, so marks entry isn't available here.
      </div>
    );
  }

  // Blue Tick gate — this mirrors the exact same isVerifiedFaculty hard
  // gate firestore.rules enforces on the actual write (saveStudentMarks
  // -> studentRecords create/update). Now redundant with RequireFaculty's
  // own route-level check (both require verifiedAt), but kept as
  // defense-in-depth and because it shows a clearer, marks-specific
  // message here instead of relying on the generic route-level one.
  if (!isFacultyResolved) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Checking verification status...</div>;
  }
  if (!isFounderBypass && !facultyProfile?.verifiedAt) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0', lineHeight: 1.6 }}>
        🔒 Marks entry needs Teacher Verification first. Your request is already in the
        Founder&rsquo;s review queue — you&rsquo;ll get access here as soon as it&rsquo;s approved.
      </div>
    );
  }

  if (!markConfig || editingBreakdown) {
    return (
      <MarksSetupForm
        assignment={assignment}
        groupId={groupId}
        teacherSlot={teacherSlot}
        existingConfig={markConfig || null}
        onCancel={() => setEditingBreakdown(false)}
        onSaved={() => {
          setEditingBreakdown(false);
          getTeacherMarkComponents(groupId, assignment.id, teacherSlot).then(setMarkConfig);
        }}
      />
    );
  }

  const recordsByUid = Object.fromEntries((records || []).map((r) => [r.studentUid, r]));
  // Attendance sessions are keyed by ROLL NUMBER (not uid) as of Phase B of
  // the Attendance Rebuild — see ATTENDANCE_REBUILD_PLAN.md §3b. A
  // placeholder student (no account yet) and a later-registered real
  // account for the same roll share the same attendance history with no
  // migration step, since the key never changes when an account appears.
  // computeStudentAttendancePercent itself is key-agnostic (just reads
  // sessions[i].attendance[key]), so passing roll here is enough — no
  // change needed inside facultyMarksSync.js.
  const attendancePctFor = (studentRoll) => computeStudentAttendancePercent(sessions, studentRoll);

  const getFieldValue = (studentUid, key) => {
    if (draft[studentUid]?.[key] !== undefined) return draft[studentUid][key];
    return recordsByUid[studentUid]?.[`${teacherSlot}Marks`]?.[key] ?? '';
  };

  const setField = (studentUid, key, value, max) => {
    let v = value === '' ? '' : Number(value);
    // The HTML `max` attribute on <input type="number"> is only a soft
    // hint — it doesn't stop someone typing or pasting a bigger number.
    // Clamp for real here so a component can never be saved above its
    // own configured cap.
    if (v !== '' && typeof max === 'number' && v > max) v = max;
    if (v !== '' && v < 0) v = 0;
    setDraft((prev) => ({ ...prev, [studentUid]: { ...prev[studentUid], [key]: v } }));
  };

  const buildFieldsForSave = (studentUid, studentRoll) => {
    const d = draft[studentUid] || {};
    const existing = recordsByUid[studentUid]?.[`${teacherSlot}Marks`] || {};
    const pct = attendancePctFor(studentRoll);
    const fields = { attendance: computeAttendanceComponentScore(pct, markConfig.attendanceWeight) };
    markConfig.components.forEach((c) => {
      // A component the teacher never touched (no draft edit, no existing
      // saved value) stays genuinely UNSET here — not defaulted to 0.
      // Writing a real 0 made every never-entered component look like an
      // actually-scored zero on the student's PDF/record. null means
      // "not entered yet"; the PDF/UI render null as "—".
      const draftVal = d[c.key];
      const existingVal = existing[c.key];
      if (draftVal !== undefined) fields[c.key] = draftVal === '' ? null : draftVal;
      else if (existingVal !== undefined) fields[c.key] = existingVal;
      else fields[c.key] = null;
    });
    return fields;
  };

  const handleSave = async (studentUid, studentRoll, status) => {
    setSavingUid(studentUid);
    try {
      const fields = buildFieldsForSave(studentUid, studentRoll);
      const result = await saveStudentMarks(groupId, assignment.id, studentUid, teacherSlot, fields, status);
      setDraft((prev) => { const next = { ...prev }; delete next[studentUid]; return next; });
      notify(result.wasReSend ? 'Marks updated -- student notified.' : status === 'sent' ? 'Marks sent.' : 'Saved.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save marks.', 'error');
    } finally {
      setSavingUid(null);
    }
  };

  const handleSendAllReviewed = async () => {
    setSendingAll(true);
    try {
      const count = await sendAllReviewed(groupId, assignment.id, members.map((m) => m.id));
      notify(`Sent marks for ${count} student${count === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
      notify(e.message || 'Could not send marks.', 'error');
    } finally {
      setSendingAll(false);
    }
  };

  const handleExportStudent = async (student) => {
    setExportingUid(student.id);
    try {
      await exportStudentMarksPdf(assignment, student, recordsByUid[student.id] || {}, teacherNames);
    } catch (e) {
      notify(e.message || 'Could not export PDF.', 'error');
    } finally {
      setExportingUid(null);
    }
  };

  const handleExportClass = async () => {
    setExportingClass(true);
    try {
      await exportClassSummaryPdf(assignment, members, recordsByUid, teacherNames);
    } catch (e) {
      notify(e.message || 'Could not export PDF.', 'error');
    } finally {
      setExportingClass(false);
    }
  };

  const statusDot = (status) => {
    if (status === 'sent') return <span title="Sent" style={{ color: '#16a34a' }}>&#9679;</span>;
    if (status === 'reviewed') return <span title="Reviewed" style={{ color: '#d97706' }}>&#9679;</span>;
    return <span title="Draft" style={{ color: '#9ca3af' }}>&#9679;</span>;
  };

  const numInput = (studentUid, key, max) => (
    <input
      type="number"
      min={0}
      max={max}
      value={getFieldValue(studentUid, key)}
      onChange={(e) => setField(studentUid, key, e.target.value, max)}
      style={{ width: 40, padding: '4px 5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          You are <strong style={{ color: 'var(--text)' }}>{teacherSlot === 'teacher1' ? 'Teacher 1' : 'Teacher 2'}</strong> -- your own 45-mark quota (attendance {markConfig.attendanceWeight} + {markConfig.components.map((c) => `${c.label} ${c.max}`).join(' + ')})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setEditingBreakdown(true)}
            style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
          >
            Edit Breakdown
          </button>
          <button
            className="accent-fill-glass"
            onClick={handleSendAllReviewed}
            disabled={sendingAll}
            style={{ padding: '6px 12px', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', opacity: sendingAll ? 0.6 : 1 }}
          >
            {sendingAll ? 'Sending...' : 'Send All Reviewed'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={handleExportClass}
          disabled={exportingClass}
          style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}
        >
          {exportingClass ? 'Exporting...' : 'Export Class Summary PDF'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {sortByRoll(members).map((m) => {
          const rec = recordsByUid[m.id];
          const pct = attendancePctFor(m.roll);
          return (
            <div key={m.id} className="faculty-marks-card">
              <div className="faculty-marks-card-student">
                <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>
                  {statusDot(rec?.status)} {m.name || 'Unnamed'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {m.roll || '--'} -- Attendance: {pct === null ? '--' : `${pct}%`} -&gt; {computeAttendanceComponentScore(pct, markConfig.attendanceWeight)}/{markConfig.attendanceWeight}
                </div>
              </div>

              <div className="faculty-marks-card-inputs">
                {markConfig.components.map((c) => (
                  <label key={c.key} className="faculty-marks-card-input-label">
                    <span>{c.label}</span>
                    {numInput(m.id, c.key, c.max)}
                  </label>
                ))}
              </div>

              <div className="faculty-marks-card-actions">
                <button
                  onClick={() => handleSave(m.id, m.roll, 'reviewed')}
                  disabled={savingUid === m.id}
                  className="faculty-marks-card-btn"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(m.id, m.roll, 'sent')}
                  disabled={savingUid === m.id}
                  className="faculty-marks-card-btn accent-fill-glass"
                  style={{ color: '#fff', fontWeight: 700 }}
                >
                  Send
                </button>
                <button
                  onClick={() => handleExportStudent(m)}
                  disabled={exportingUid === m.id}
                  className="faculty-marks-card-btn faculty-marks-card-btn-icon"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  title="Export this student's marks as PDF"
                >
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FacultyClassDetail() {
  const { assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || '';
  const [assignment, setAssignment] = useState(null); // null = loading
  const [tab, setTab] = useState('attendance');
  const [editingDayTime, setEditingDayTime] = useState(false);
  // Blue Tick status, needed here (not just inside MarksTab) to also gate
  // the Schedule tab's "Edit/Set day & time" button — a fake/unverified
  // account editing a real class's schedule affects everyone who reads
  // it (students' Schedule.jsx grid), so that write stays blocked even
  // though the rest of this page (Students, Syllabus, Sessions,
  // Attendance, Question Bank, Notices tab's own read view) is browsable.
  const { isFounderBypass, facultyProfile } = useIsFaculty();
  const isVerified = isFounderBypass || !!facultyProfile?.verifiedAt;
  // Lazy-mount: a tab only mounts (and starts its Firestore subscription)
  // the first time it's opened, but once mounted it's kept alive for the
  // rest of this page visit — see the render block below.
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['attendance']));

  const selectTab = (id) => {
    setTab(id);
    setMountedTabs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  useEffect(() => {
    if (!groupId || !assignmentId) { setAssignment(null); return; }
    return subscribeFacultyAssignment(groupId, assignmentId, setAssignment);
  }, [groupId, assignmentId]);

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="page-container" style={{ padding: '10px 24px 40px' }}>
        <div className="faculty-class-hero faculty-class-hero-compact">
          <div className="faculty-class-hero-main">
            {assignment && (
              <div className="faculty-class-hero-meta">
                {assignment.batch?.toUpperCase()} {assignment.dept}
              </div>
            )}
            <div className="faculty-class-hero-head">
              <div className="faculty-class-hero-icon">
                <GraduationCap size={24} color="var(--accent)" />
              </div>
              <h1 className="faculty-class-hero-title">
                {assignment ? `${assignment.courseCode}${assignment.courseTitle ? ' — ' + assignment.courseTitle : ''}` : 'Class Detail'}
              </h1>
            </div>
            {assignment && (
              <div className="faculty-class-hero-sub">
                {assignment.term} · {assignment.courseType}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar — 2-column chip grid on mobile (wraps into rows), a
            single horizontal row on desktop (see .faculty-tabs-grid's
            >=640px rule in index.css). No JS breakpoint logic, no "More"
            sheet — the row/grid switch is CSS-only.
            Disabled tabs stay visible but non-interactive, with a title
            tooltip explaining why, rather than being hidden entirely.

            The chip row + whatever tab content follows now live inside
            ONE shell (.faculty-tabs-shell) instead of the chips floating
            directly on the page background with the content flush right
            underneath — previously there was no visual boundary at all
            between "here are the tabs" and "here's the tab's content",
            so it read as one flat, undifferentiated block (most visible
            on mobile, where the chip grid itself has no card of its
            own). The shell gives a single soft card with an internal
            divider under the chips, so the section reads as one clearly
            bounded unit while staying simple — no extra nesting per tab. */}
        <div className="faculty-tabs-shell">
          <div className="faculty-tabs-grid">
            {TABS.map((t) => {
              const Icon = ICONS[t.icon] || Circle;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => t.enabled && selectTab(t.id)}
                  disabled={!t.enabled}
                  title={t.enabled ? undefined : 'Coming in a later phase'}
                  className={`faculty-tab-chip${active ? ' active' : ''}`}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {!groupId && (
            <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13, padding: '16px 0' }}>
              Missing group reference for this class — please open it from My Classes.
            </div>
          )}

          {groupId && assignment === null && (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>
          )}

          {/* Each panel stays mounted once first opened (display:none when not
              active) instead of being unmounted/remounted on every tab switch.
              The Sessions/Attendance/Marks tabs each hold a live Firestore
              subscription — remounting them on every switch tore that
              subscription down and re-attached it from scratch each time,
              which is what made switching back to a tab feel slow (a fresh
              network round-trip + a "Loading…" flash even though the data
              hadn't actually changed). Keeping them mounted means the
              subscription — and whatever it already loaded — just stays
              live in the background, so returning to a tab is instant. */}
          {groupId && assignment && TABS.filter((t) => t.enabled).map((t) => {
            const active = tab === t.id;
            if (!mountedTabs.has(t.id)) return null;
            return (
              <div key={t.id} className="faculty-tab-panel" style={{ display: active ? 'block' : 'none' }}>
                {t.id === 'students' && <ClassmatesList groupId={groupId} showActions={false} viewerRole="faculty" groupMeta={{ dept: assignment.dept, batch: assignment.batch, term: assignment.term }} />}
                {t.id === 'syllabus' && <SyllabusTab assignment={assignment} />}
                {t.id === 'schedule' && (
                  <ScheduleTab assignment={assignment} groupId={groupId} isVerified={isVerified} onEditDayTime={() => setEditingDayTime(true)} />
                )}
                {t.id === 'attendance' && <AttendanceTab assignment={assignment} groupId={groupId} />}
                {t.id === 'marks' && <MarksTab assignment={assignment} groupId={groupId} />}
                {t.id === 'qbank' && <QuestionBankTab assignment={assignment} />}
                {t.id === 'notices' && <NoticesTab groupId={groupId} isVerified={isVerified} assignment={assignment} />}
              </div>
            );
          })}
        </div>
      </div>

      {editingDayTime && assignment && (
        <EditDayTimeModal
          assignment={assignment}
          groupId={groupId}
          onClose={() => setEditingDayTime(false)}
          onSaved={() => setEditingDayTime(false)}
        />
      )}
    </div>
  );
}

