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
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CalendarClock, Circle, Clock, ExternalLink, FileText, GraduationCap, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import { exportAttendanceExcel, exportAttendancePdf } from '../../lib/attendanceExport';
import { DEPARTMENTS } from '../../store/store';

import { getDeptSyllabus } from '../../store/curriculumStore';
import { subscribeFacultyAssignment, setPlannedTotalClasses, updateAssignmentDayTimeSlots, findConflictingAssignment, generateInviteCode } from '../../lib/facultyClassSync';
import { subscribeMembers, subscribePlannerLogs, subscribeRoutine } from '../../lib/groupSync';
import {
  createOrUpdateSessionAttendance, subscribeSessionAttendance,
  computeStudentAttendancePercent, computeAttendanceComponentScore,
  setTeacherMarkComponents, getTeacherMarkComponents,
  saveStudentMarks, subscribeStudentRecords, sendAllReviewed,
  addBacklogStudent, moveStudentToSection, subscribeBacklogStudents,
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
// [QB-DEPRECATED 2026-08-15] আর ব্যবহার হচ্ছে না, দেখো PROGRESS_QB_WEBSITE_INTEGRATION.md
// import { useQuestionBankData, getR2FileUrl } from '../../hooks/useQuestionBankData';

// Order = real daily-use frequency (teacher's actual workflow), not a
// setup checklist. Attendance is opened almost every class day — and now
// carries Sessions & Count merged into it, since attendance auto-links
// the session log already (see AttendanceTab), so a separate tab for it
// was redundant. Mobile tab bar shows the first 4 as always-visible
// buttons + a "More" popover for the rest — see .faculty-tabs CSS.
const TABS = [
  { id: 'syllabus', label: 'Syllabus', icon: 'BookMarked', enabled: true },
  // [QB-DEPRECATED 2026-08-15] পুরনো PDF question-bank tab বন্ধ, দেখো
  // PROGRESS_QB_WEBSITE_INTEGRATION.md
  // { id: 'qbank', label: 'Question Bank', icon: 'FileText', enabled: true },
  { id: 'students', label: 'Students & CR', icon: 'Users', enabled: true },
  { id: 'marks', label: 'Marks', icon: 'GraduationCap', enabled: true },
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
    return subscribeRoutine(groupId, setEntries);
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
                            const own = normCourseCode(entry.courseCode) === normCourseCode(assignment?.courseCode);
                            return (
                              <div key={entry.id} style={{
                                padding: '6px 8px', borderRadius: 9, fontSize: 11.5, lineHeight: 1.3, marginBottom: 4,
                                height: rs > 1 ? '100%' : undefined,
                                background: own ? 'rgba(59,130,246,0.10)' : 'var(--card)',
                                border: own ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                                color: own ? 'var(--text)' : 'var(--muted)',
                                fontWeight: own ? 700 : 500,
                              }}>
                                <div>{entry.courseCode || entry.displayName || 'Unknown course'}</div>
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
  handleMoveSection, draftMarks,
}) {
  // Row 1 state: false = showing Roll (resting), true = showing Name.
  const [showName, setShowName] = useState(false);
  // Row 2 state: index into `historyDates` below; 0 always means "today's
  // editable date" (the pinned resting position). >0 means "viewing an
  // older date's mark, read-only."
  const [historyIndex, setHistoryIndex] = useState(0);

  // Other held dates, most recent first, excluding the currently selected
  // `date` itself (that's index 0 / the pinned live row, handled
  // separately since it's editable and the others aren't).
  const historyDates = (sessions || [])
    .map((s) => s.date)
    .filter((d) => d !== date)
    .sort((a, b) => (a < b ? 1 : -1));

  const dragState = useRef(null); // { startX, axis: 'identity'|'attendance', el }

  const onPointerDown = (axis) => (e) => {
    if (rosterLocked && axis === 'attendance') return;
    dragState.current = {
      startX: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      axis,
    };
  };

  const onPointerMove = (e) => {
    // Only used for a live visual nudge; committed on release in
    // onPointerUp below. Kept intentionally simple (no drag-following
    // transform) — a snap-on-release swipe reads clearly enough for a
    // 2-state card and avoids fighting the page's own vertical scroll.
  };

  const onPointerUp = (axis) => (e) => {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag || drag.axis !== axis) return;
    const endX = e.clientX ?? e.changedTouches?.[0]?.clientX ?? drag.startX;
    const dx = endX - drag.startX;
    const THRESHOLD = 40; // px — deliberate swipe vs. an accidental tap/scroll
    if (Math.abs(dx) < THRESHOLD) return;

    if (axis === 'identity') {
      setShowName((v) => !v);
    } else if (axis === 'attendance') {
      if (dx < 0) {
        // swipe left → step forward into history
        setHistoryIndex((v) => Math.min(v + 1, historyDates.length));
      } else {
        // swipe right → step back toward the pinned live date
        setHistoryIndex((v) => Math.max(v - 1, 0));
      }
    }
  };

  const viewingHistory = historyIndex > 0;
  const historyDate = viewingHistory ? historyDates[historyIndex - 1] : null;
  const historyMark = historyDate
    ? (sessions.find((s) => s.date === historyDate)?.attendance?.[m.roll] || null)
    : null;

  return (
    <div className="attendance-mrow">
      {/* Row 1 — identity: Roll (resting) ↔ Name (swiped) */}
      <div
        className="attendance-mrow-track attendance-mrow-identity"
        onPointerDown={onPointerDown('identity')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp('identity')}
        onPointerCancel={() => { dragState.current = null; }}
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

      {/* Row 2 — attendance: pinned editable date (resting) ↔ swiped
          read-only history */}
      <div
        className="attendance-mrow-track"
        onPointerDown={onPointerDown('attendance')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp('attendance')}
        onPointerCancel={() => { dragState.current = null; }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        {!viewingHistory ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => !rosterLocked && togglePresentAbsent(m.roll, effectiveMark)}
                disabled={rosterLocked || effectiveMark === 'late' || effectiveMark === 'excused'}
                title={effectiveMark === 'late' || effectiveMark === 'excused' ? 'Clear via “…” to use the quick toggle again' : ''}
                style={{
                  width: 64, height: 30, borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                  cursor: (rosterLocked || effectiveMark === 'late' || effectiveMark === 'excused') ? 'not-allowed' : 'pointer',
                  border: `1px solid ${markColors[effectiveMark]}`,
                  background: `${markColors[effectiveMark]}22`,
                  color: markColors[effectiveMark],
                  opacity: (effectiveMark === 'late' || effectiveMark === 'excused') ? 0.75 : 1,
                }}
              >
                {markLabels[effectiveMark]}
              </button>
              <button
                onClick={() => !rosterLocked && setExpandedRoll((v) => (v === m.roll ? null : m.roll))}
                disabled={rosterLocked}
                title="Late / Excused"
                style={{
                  width: 26, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: rosterLocked ? 'not-allowed' : 'pointer',
                }}
              >
                ⋯
              </button>
              {multiSection && (
                <button
                  onClick={() => handleMoveSection(m.roll, m.name, activeSection === 'A' ? 'B' : 'A')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 10, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  → Sec {activeSection === 'A' ? 'B' : 'A'}
                </button>
              )}
            </div>
            {historyDates.length > 0 && (
              <span className="attendance-mrow-swipehint">← history</span>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>{historyDate}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700,
                border: `1px solid ${historyMark ? markColors[historyMark] : 'var(--border)'}`,
                background: historyMark ? `${markColors[historyMark]}22` : 'transparent',
                color: historyMark ? markColors[historyMark] : 'var(--muted)',
              }}>
                {historyMark ? markLabels[historyMark] : '—'}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--muted)', fontStyle: 'italic' }}>read-only</span>
            </div>
            <button
              onClick={() => setHistoryIndex(0)}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              → today
            </button>
          </>
        )}
      </div>

      {isExpanded && !viewingHistory && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          {['late', 'excused'].map((mark) => (
            <button
              key={mark}
              onClick={() => !rosterLocked && setMark(m.roll, mark)}
              disabled={rosterLocked}
              style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: rosterLocked ? 'not-allowed' : 'pointer',
                border: draftMarks[m.roll] === mark ? `1px solid ${markColors[mark]}` : '1px solid var(--border)',
                background: draftMarks[m.roll] === mark ? `${markColors[mark]}22` : 'var(--bg)',
                color: draftMarks[m.roll] === mark ? markColors[mark] : 'var(--muted)',
              }}
            >
              {markLabels[mark]} · {mark === 'late' ? 'Late' : 'Excused'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ assignment, groupId }) {
  const [members, setMembers] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [plannerLogs, setPlannerLogs] = useState(null);
  const [backlogStudents, setBacklogStudents] = useState(null);
  const [facultyName, setFacultyName] = useState('');
  const [date, setDate] = useState(() => todayStr());
  // Phase C — merged roster (see ATTENDANCE_REBUILD_PLAN.md §3c). Multi-
  // section depts (CE/EEE/ME/CSE) need a Section A/B toggle above the
  // roster; single-section depts ignore this entirely. Defaults to the
  // assignment's own section if it has one (a class assignment is already
  // scoped to one section via its groupId), otherwise 'A'.
  const multiSection = isMultiSectionDept(assignment?.dept);
  const [activeSection, setActiveSection] = useState(() => (assignment?.section === 'B' ? 'B' : 'A'));
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addRollInput, setAddRollInput] = useState('');
  const [addNameInput, setAddNameInput] = useState('');
  const [addSectionInput, setAddSectionInput] = useState('A');
  const [addingStudent, setAddingStudent] = useState(false);
  // Sessions & Count, merged in — attendance-taking auto-logs a session
  // (see handleSave's auto-link below), so manual "+1 Log Class" is now
  // a rare fallback (e.g. a class held but attendance skipped that day).
  const [logging, setLogging] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planInput, setPlanInput] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [showSessionLog, setShowSessionLog] = useState(false);
  // Tracks whether the current `date` value is just "whatever today was"
  // (auto) vs. something the faculty deliberately picked (manual). This
  // tab stays mounted forever once opened (see the comment on TABS render
  // below), so a plain `useState(() => todayStr())` only ever computes
  // "today" once at first mount — if the browser tab is left open across
  // midnight, `date` silently stays frozen on yesterday. The visibility
  // listener below re-derives today() whenever the tab/window regains
  // focus, but only overwrites `date` while it's still in "auto" mode, so
  // a faculty member reviewing an older date's attendance doesn't get
  // yanked back to today mid-edit.
  const isAutoDate = useRef(true);
  const [draftMarks, setDraftMarks] = useState({}); // { studentUid: 'present'|'absent'|'late'|'excused' }
  const [saving, setSaving] = useState(false);
  // Once a date's session is locked (already saved), the roster below is
  // read-only by default — this flips true only after the teacher
  // explicitly clicks "Edit this date", which is the one path allowed to
  // touch a locked date (audited via editHistory, see
  // createOrUpdateSessionAttendance). Resets to false on every date
  // change so a teacher can't accidentally carry edit-mode from one
  // locked date over to another.
  const [unlockedForEdit, setUnlockedForEdit] = useState(false);

  // Phase G (§3g) — Export button state. `exportingFormat` tracks which
  // format is mid-export (or null) so the button can show its own
  // "Exporting…" state without a generic shared spinner blocking the rest
  // of the tab (unlike Save, an export doesn't touch Firestore or the
  // roster state at all, so there's no reason to disable anything else
  // while it runs).
  const [exportingFormat, setExportingFormat] = useState(null); // null | 'excel' | 'pdf'
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Phase F (§3f) — is TODAY one of this assignment's own scheduled days?
  // `dayTimeSlots` is this faculty's own day/time slot(s) for this exact
  // class (set via EditDayTimeModal, e.g. [{ day: 'Sunday', slot: ... }]),
  // not the whole-batch routine (BatchRoutineGrid) — §3f is explicit this
  // should key off "Class Setup schedule," i.e. this assignment's own
  // slot, not every course the batch happens to have that day. Recomputed
  // on every render (cheap — a few-item array compare) so it stays correct
  // if the teacher edits day/time while this tab is still mounted.
  const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isScheduledToday = (assignment?.dayTimeSlots || []).some((s) => s.day === todayWeekday);

  useEffect(() => {
    // Phase F (§3f) — only auto-land on today if today is actually a
    // scheduled day for THIS class (per assignment.dayTimeSlots), per the
    // plan's read of "ajker date ta mile tahole sei date ta default
    // dekhabe": auto-set today only when today matches a scheduled day,
    // otherwise leave the date field for the teacher to pick manually
    // rather than defaulting to today (which would silently be a day this
    // class doesn't even meet) or guessing a "last scheduled day" (not
    // what was asked for). `isScheduledToday` below is recomputed fresh
    // each run since `assignment` can change (e.g. day/time edited via
    // EditDayTimeModal while this tab stays mounted).
    const resyncIfAuto = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isAutoDate.current) return;
      if (!isScheduledToday) return; // leave `date` exactly as it is — no auto-jump on an unscheduled day
      const now = todayStr();
      setDate((prev) => (prev === now ? prev : now));
    };
    resyncIfAuto();
    document.addEventListener('visibilitychange', resyncIfAuto);
    window.addEventListener('focus', resyncIfAuto);
    return () => {
      document.removeEventListener('visibilitychange', resyncIfAuto);
      window.removeEventListener('focus', resyncIfAuto);
    };
  }, [isScheduledToday]);

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

  // Feeds the auto-link to Sessions & Count below — needed to (a) dedup
  // against a session that's already logged for this date (either by this
  // same auto-link earlier, or manually by the teacher/CR) and (b) compute
  // the right sequence number when we do create one.
  useEffect(() => {
    if (!groupId) { setPlannerLogs([]); return; }
    return subscribePlannerLogs(groupId, setPlannerLogs);
  }, [groupId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then((fdoc) => setFacultyName(getFacultyDisplayName(fdoc?.preferredName || fdoc?.name, fdoc?.title)));
  }, []);

  const courseId = assignment?.courseId;
  const logsForCourse = (plannerLogs || []).filter((l) => l.courseId === courseId);
  const plannedTotal = assignment?.plannedTotalClasses;

  const handleManualLog = async () => {
    setLogging(true);
    try {
      await logFacultySession(groupId, {
        uid: auth.currentUser.uid,
        name: facultyName,
        courseId,
        courseCode: assignment.courseCode,
        courseType: assignment.courseType,
        existingLogsForCourse: logsForCourse,
      });
      notify('Session logged.', 'success');
    } catch (e) {
      notify(e.message || 'Could not log this session.', 'error');
    } finally {
      setLogging(false);
    }
  };

  const openPlanEditor = () => {
    setPlanInput(plannedTotal ? String(plannedTotal) : '');
    setEditingPlan(true);
  };

  const handleSavePlan = async () => {
    setSavingPlan(true);
    try {
      await setPlannedTotalClasses(groupId, assignment.id, planInput);
      notify('Plan saved.', 'success');
      setEditingPlan(false);
    } catch (e) {
      notify(e.message || 'Could not save the plan.', 'error');
    } finally {
      setSavingPlan(false);
    }
  };


  // one was already taken (so re-opening today's attendance doesn't blank
  // out what was already marked — §8.9's "manual override possible" note
  // implies edits should start from the existing state, not from scratch).
  useEffect(() => {
    const existing = (sessions || []).find((s) => s.date === date);
    setDraftMarks(existing?.attendance || {});
    setUnlockedForEdit(false);
  }, [date, sessions]);

  // Phase H fix (see ATTENDANCE_REBUILD_PLAN.md §7's hand-off entry) — a
  // date is NOT a unique key once two joined teachers can both take
  // attendance for the same class. `existingSessionForDate` used to match
  // on date alone, so Teacher B opening the same date would silently
  // adopt Teacher A's session id and `handleSave` would overwrite Teacher
  // A's attendance via `updateDoc`. Scoped to the CURRENT teacher's own
  // session for this date — this is "my session to edit/save."
  // `allSessionsForDate` holds every session (any teacher) for the merged
  // "All sessions" read-only view below.
  const myUid = auth.currentUser?.uid;
  const allSessionsForDate = (sessions || []).filter((s) => s.date === date);
  const existingSessionForDate = allSessionsForDate.find((s) => s.loggedBy?.uid === myUid);

  // My/All toggle for the summary stats + per-row columns below. Defaults
  // to 'mine' — a teacher's own numbers are what they expect to see when
  // they open the tab; 'all' is an explicit opt-in to see the blended
  // class picture across every joined teacher.
  const [sessionScope, setSessionScope] = useState('mine'); // 'mine' | 'all'
  const isJoinedClass = (assignment?.teacherUids || []).length > 1;
  const scopedSessions = (!isJoinedClass || sessionScope === 'all')
    ? (sessions || [])
    : (sessions || []).filter((s) => s.loggedBy?.uid === myUid);

  // Phase I — "Invite co-teacher" code, generated on demand from here.
  // `inviteCode` holds the freshly (re)generated code for THIS session
  // only — it's never re-read from Firestore after mount (the doc has no
  // client-side read-back need beyond what generateInviteCode() already
  // returns), so a page refresh simply shows the button again rather than
  // an old code. That's fine: Teacher A can always click again for a new
  // one, and only one code is ever live per assignment (generateInviteCode
  // invalidates the previous one on every call).
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

  const setMark = (studentRoll, mark) => {
    setDraftMarks((prev) => ({ ...prev, [studentRoll]: prev[studentRoll] === mark ? undefined : mark }));
  };

  // Phase D — 2-state Present/Absent quick-toggle (§3d). Late/Excused stay
  // in the data model (Marks tab's computeStudentAttendancePercent treats
  // 'late'/'excused' as attended, same as 'present') — only hidden from
  // this quick-entry surface, reachable via the "…" expand on each row
  // instead of being removed outright, per §4 item 4's confirmed default.
  const [expandedRoll, setExpandedRoll] = useState(null); // which row's "…" (Late/Excused) is open, one at a time

  // Present/Absent 2-state click: flips only between those two, leaving an
  // existing Late/Excused mark (set via "…") untouched by a stray click on
  // the main toggle — a teacher who deliberately marked someone Late
  // shouldn't have that silently reset to Present/Absent by brushing the
  // main toggle instead of reopening "…" and explicitly clearing it.
  const togglePresentAbsent = (studentRoll, effectiveMark) => {
    if (effectiveMark === 'late' || effectiveMark === 'excused') return;
    setMark(studentRoll, effectiveMark === 'absent' ? 'present' : 'absent');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const wasFirstSaveForDate = !existingSessionForDate;
      const isCorrection = !!existingSessionForDate?.locked && unlockedForEdit;
      // §3d's default-present-on-save rule: a row with NO explicit mark
      // (never clicked at all — the common "just click absentees" case)
      // is only materialized as 'present' HERE, at save time, never in
      // render/state. This is deliberate: `draftMarks` staying sparse
      // during editing means a date the teacher opened but never actually
      // saved doesn't silently pick up hundreds of bogus 'present'
      // entries just from having been displayed — only an actual Save
      // click commits the default. mergedRoster (Phase C) is already the
      // complete roll set for the active section, generated + backlog, so
      // this correctly defaults placeholder/backlog rows too, not just
      // real accounts.
      const attendanceToSave = { ...draftMarks };
      mergedRoster.forEach((m) => {
        if (attendanceToSave[m.roll] === undefined) attendanceToSave[m.roll] = 'present';
      });
      // Audit-only snapshot (see createOrUpdateSessionAttendance's doc
      // comment) — which real account, if any, sat behind each roll at
      // save time. Only rolls with a real account get an entry here; a
      // roll with no account simply isn't present (not stored as null),
      // since most of a dept's roster stays placeholder-only for a long
      // time and there's no value in writing hundreds of null entries.
      const rollToUid = Object.fromEntries(
        (members || []).filter((m) => m.roll).map((m) => [m.roll, m.id])
      );
      await createOrUpdateSessionAttendance(groupId, assignment.id, {
        sessionId: existingSessionForDate?.id || null,
        date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        slot: assignment.dayTimeSlots?.[0]?.slot || '',
        attendance: attendanceToSave,
        rollToUid,
        loggedBy: { uid: auth.currentUser.uid, role: 'faculty', name: facultyName },
        isCorrection,
      });
      setUnlockedForEdit(false);

      // Auto-link to Sessions & Count: taking attendance for a date IS
      // strong proof a class was actually held that day, so the first
      // attendance save for a given date also bumps the session count —
      // no separate manual "+1" needed for the common case. Only on the
      // FIRST save for this date (editing an already-taken date's marks
      // shouldn't double-count), and only if nothing's already logged for
      // this exact date (a teacher's own earlier manual "+1", or a CR's,
      // both count — we never create a second entry for the same day).
      if (wasFirstSaveForDate) {
        const courseId = assignment?.courseId;
        const logsForCourse = (plannerLogs || []).filter((l) => l.courseId === courseId);
        // Sessions & Count auto-link is a class-level "was a class held
        // this day" fact, not a per-teacher one — a second joined teacher
        // saving their own attendance for a date already logged by the
        // first teacher (or a CR) correctly should NOT double-count, so
        // this check intentionally stays date-only (matching
        // `logFacultySession`'s own dedup), unlike `existingSessionForDate`
        // above which is deliberately per-teacher.
        const alreadyLoggedThisDate = logsForCourse.some((l) => String(l.loggedAt || '').slice(0, 10) === date);
        if (!alreadyLoggedThisDate) {
          try {
            await logFacultySession(groupId, {
              uid: auth.currentUser.uid,
              name: facultyName,
              courseId,
              courseCode: assignment.courseCode,
              courseType: assignment.courseType,
              existingLogsForCourse: logsForCourse,
              date,
              source: 'attendance',
            });
          } catch (linkErr) {
            // Attendance itself already saved successfully above — don't
            // fail the whole save (or confuse the teacher) over the
            // secondary Sessions & Count link failing.
            console.error('Could not auto-log session count from attendance:', linkErr);
          }
        }
      }

      notify('Attendance saved.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudent = async () => {
    setAddingStudent(true);
    try {
      await addBacklogStudent(groupId, assignment.id, {
        roll: addRollInput.trim(),
        name: addNameInput.trim(),
        section: multiSection ? addSectionInput : null,
        addedBy: { uid: auth.currentUser.uid, name: facultyName },
      });
      notify('Student added.', 'success');
      setAddRollInput('');
      setAddNameInput('');
      setShowAddStudent(false);
    } catch (e) {
      notify(e.message || 'Could not add this student.', 'error');
    } finally {
      setAddingStudent(false);
    }
  };

  const handleMoveSection = async (roll, name, newSection) => {
    try {
      await moveStudentToSection(groupId, assignment.id, {
        roll, name, newSection,
        movedBy: { uid: auth.currentUser.uid, name: facultyName },
      });
    } catch (e) {
      notify(e.message || 'Could not move this student.', 'error');
    }
  };

  if (members === null || sessions === null || plannerLogs === null || backlogStudents === null) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>;
  }

  // Phase C — merged roster (ATTENDANCE_REBUILD_PLAN.md §3b/§3c). Every
  // roll the generator produces for the active section, matched against a
  // real member by roll (isPlaceholder if none), plus backlog/extra-
  // student entries tagged for this section, concat'd on and clearly
  // marked isBacklog so the UI can badge them apart from the generated
  // default roster. Generated range is a starting DEFAULT ONLY — never
  // treated as exhaustive; a backlog entry is exactly how a roll outside
  // that range gets in (see groupUtils.js's generateDeptRollRoster doc).
  const sectionForRoster = multiSection ? activeSection : null;
  const generatedRolls = generateDeptRollRoster(assignment?.dept, assignment?.batch, sectionForRoster);
  const backlogForSection = (backlogStudents || []).filter((b) => !multiSection || b.section === activeSection);
  const backlogRolls = new Set(backlogForSection.map((b) => b.roll));

  const generatedRoster = generatedRolls
    .filter((g) => !backlogRolls.has(g.roll)) // a backlog entry for a roll inside the generated range takes over that row (e.g. a real name was added for it)
    .map((g) => {
      const realMember = members.find((m) => m.roll === g.roll);
      return {
        id: realMember?.id || `placeholder:${g.roll}`,
        roll: g.roll,
        name: realMember?.name || g.roll,
        section: g.section,
        isPlaceholder: !realMember,
        isBacklog: false,
      };
    });

  const backlogRoster = backlogForSection.map((b) => {
    const realMember = members.find((m) => m.roll === b.roll);
    return {
      id: realMember?.id || `backlog:${b.roll}`,
      roll: b.roll,
      name: realMember?.name || b.name || b.roll,
      section: b.section,
      isPlaceholder: !realMember,
      isBacklog: true,
    };
  });

  const mergedRoster = sortByRoll([...generatedRoster, ...backlogRoster]);

  // Phase G (§3g/§4 item 1) — export always covers the FULL dept+batch
  // roster (both sections merged, section-tagged), never just whichever
  // section is currently active for daily marking. Rebuilt independently
  // of `mergedRoster` above (generateDeptRollRoster(dept, batch, null) is
  // "both" mode, already supported — no changes needed there) rather than
  // trying to reuse the per-section roster, since a single-section export
  // would silently miss half a multi-section dept's students. For a
  // single-section dept this naturally collapses to the same roster as
  // `mergedRoster` (no `section` tag on any row), so the export code
  // doesn't need a separate single-vs-multi branch.
  const fullMergedRoster = (() => {
    if (!multiSection) return mergedRoster; // already the full dept roster
    const allGeneratedRolls = generateDeptRollRoster(assignment?.dept, assignment?.batch, null);
    const allBacklogRolls = new Set((backlogStudents || []).map((b) => b.roll));
    const allGenerated = allGeneratedRolls
      .filter((g) => !allBacklogRolls.has(g.roll))
      .map((g) => {
        const realMember = members.find((m) => m.roll === g.roll);
        return {
          id: realMember?.id || `placeholder:${g.roll}`,
          roll: g.roll,
          name: realMember?.name || g.roll,
          section: g.section,
          isPlaceholder: !realMember,
          isBacklog: false,
        };
      });
    const allBacklog = (backlogStudents || []).map((b) => {
      const realMember = members.find((m) => m.roll === b.roll);
      return {
        id: realMember?.id || `backlog:${b.roll}`,
        roll: b.roll,
        name: realMember?.name || b.name || b.roll,
        section: b.section,
        isPlaceholder: !realMember,
        isBacklog: true,
      };
    });
    return sortByRoll([...allGenerated, ...allBacklog]);
  })();

  const handleExport = async (format) => {
    setShowExportMenu(false);
    setExportingFormat(format);
    try {
      // Phase H — deliberately NOT `scopedSessions`. Export is a register
      // handed to admin/dept, which wants the full picture (every joined
      // teacher's sessions), not whichever teacher happens to have the
      // My/All toggle set a certain way when they click Export. Raw
      // `sessions` is correct here regardless of the on-screen toggle.
      if (format === 'excel') {
        exportAttendanceExcel(assignment, fullMergedRoster, sessions, facultyName);
      } else {
        await exportAttendancePdf(assignment, fullMergedRoster, sessions, facultyName);
      }
    } catch (e) {
      notify(e.message || 'Could not export attendance.', 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const marks = ['present', 'absent', 'late', 'excused'];
  const markColors = { present: '#16a34a', absent: '#dc2626', late: '#d97706', excused: '#6b7280' };
  const markLabels = { present: 'P', absent: 'A', late: 'L', excused: 'E' };

  // Attendance summary — counts a student as "present" for a session if
  // marked present OR late (late still means they showed up), matching
  // how the Marks tab's attendance% weighting treats it elsewhere in the
  // Faculty Module. Sessions with no mark recorded for a student at all
  // (they weren't on the roster yet, joined late in the term, etc.) don't
  // count against them — the denominator is sessions held, not sessions
  // where every single student was necessarily markable.
  // Phase H — respects the My/All toggle (`scopedSessions`) instead of
  // always reading the full `sessions` array. Before this fix, these
  // numbers silently blended every joined teacher's sessions with no
  // attribution, even though the UI never said so.
  const totalClasses = scopedSessions.length;
  const attendanceSummary = totalClasses > 0
    ? mergedRoster.map((m) => {
        const presentCount = scopedSessions.filter((s) => {
          const mark = s.attendance?.[m.roll];
          return mark === 'present' || mark === 'late';
        }).length;
        const markedCount = scopedSessions.filter((s) => s.attendance?.[m.roll]).length;
        const pct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;
        return { id: m.id, name: m.name || 'Unnamed', roll: m.roll || '—', pct, markedCount };
      }).filter((s) => s.pct !== null).sort((a, b) => b.pct - a.pct)
    : [];
  const mostRegular = attendanceSummary.slice(0, 3);
  const mostAbsent = attendanceSummary.slice().sort((a, b) => a.pct - b.pct).slice(0, 3);
  // Phase D §3d — trailing per-row columns (Total classes held so far /
  // Present count / Percentage) reuse this exact same per-student calc
  // instead of a second implementation, keyed by roll for O(1) lookup
  // per roster row below. Distinct from `attendanceSummary` above only in
  // that this ISN'T filtered to markedCount>0 — a brand-new placeholder
  // with zero markable sessions still needs a row (showing 0/0/—) rather
  // than disappearing from the per-row columns the way it correctly does
  // from the summary card's ranked lists.
  const rowStatsByRoll = {};
  mergedRoster.forEach((m) => {
    const presentCount = scopedSessions.filter((s) => {
      const mark = s.attendance?.[m.roll];
      return mark === 'present' || mark === 'late';
    }).length;
    const markedCount = scopedSessions.filter((s) => s.attendance?.[m.roll]).length;
    const pct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;
    rowStatsByRoll[m.roll] = { presentCount, markedCount, pct };
  });
  // Class Performance — overall class attendance health in one number.
  // Defined as the plain average of every markable student's own
  // attendance % (attendanceSummary already excludes students with zero
  // markable sessions, e.g. a brand-new joiner). This is the standard,
  // easiest-to-defend definition (equivalent to total-present /
  // total-possible across the whole roster when every student has the
  // same number of held sessions, and still fair when a few students
  // joined late and have fewer markable sessions than others — each
  // student's own % counts equally rather than one late-joiner's small
  // denominator skewing a pooled total/total ratio).
  const classPerformancePct = attendanceSummary.length > 0
    ? Math.round(attendanceSummary.reduce((sum, s) => sum + s.pct, 0) / attendanceSummary.length)
    : null;

  return (
    <div>
      {/* Phase D §3d — compact "print header" bar (dept, course code/title,
          batch(+section), term, teacher name(s), date), kept live in the
          UI (not just baked into the export) so what the teacher sees on
          screen matches what gets exported — WYSIWYG per the plan. Phase
          G's Export button sits in this same card, next to the header it
          reuses. */}
      <div className="faculty-summary-card" style={{ marginBottom: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
            {(DEPARTMENTS.find((d) => d.code.toUpperCase() === String(assignment?.dept || '').toUpperCase())?.name) || assignment?.dept}
            {assignment?.courseCode ? ` · ${assignment.courseCode}` : ''}
            {assignment?.courseTitle ? ` — ${assignment.courseTitle}` : ''}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{assignment?.batch}{multiSection ? ` · Section ${activeSection}` : ''}</span>
            {assignment?.term && <span>{assignment.term}</span>}
            {facultyName && <span>{facultyName}</span>}
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{date}</span>
          </div>
        </div>

        {/* Export — Excel default, PDF secondary (§3g, per Akhinoor's
            stated preference). Small format-choice menu on one button
            rather than two separate buttons, since export is a rare
            action compared to the daily marking flow above it. Always
            pulls the FULL dept+batch roster (fullMergedRoster, both
            sections merged) regardless of which section is currently
            active for marking — §4 item 1. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={!!exportingFormat || sessions.length === 0}
            title={sessions.length === 0 ? 'No attendance sessions saved yet' : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
              fontWeight: 700, fontSize: 12, cursor: (exportingFormat || sessions.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (exportingFormat || sessions.length === 0) ? 0.5 : 1,
            }}
          >
            {exportingFormat ? `Exporting ${exportingFormat === 'excel' ? 'Excel' : 'PDF'}…` : 'Export'}
          </button>
          {showExportMenu && !exportingFormat && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 5,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 140,
            }}>
              <button
                onClick={() => handleExport('excel')}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Excel (.xlsx)
              </button>
              <button
                onClick={() => handleExport('pdf')}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sessions & Count + Attendance Summary — merged into ONE seamless
          card (was two separate .faculty-summary-card blocks stacked with
          a gap, which read as disconnected). An internal divider separates
          the count/plan/log section from the regularity summary instead. */}
      <div className="faculty-summary-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{logsForCourse.length}</div>
            {!editingPlan ? (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>classes logged{plannedTotal ? ` of ${plannedTotal} planned` : ''}</span>
                <button
                  onClick={openPlanEditor}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {plannedTotal ? 'Edit plan' : 'Set a plan'}
                </button>
                <button
                  onClick={() => setShowSessionLog((v) => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {showSessionLog ? 'Hide log' : 'View log'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={planInput}
                  onChange={(e) => setPlanInput(e.target.value)}
                  placeholder="e.g. 30"
                  style={{
                    width: 70, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5,
                  }}
                />
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>total classes planned</span>
                <button
                  className="accent-fill-glass"
                  onClick={handleSavePlan}
                  disabled={savingPlan || !planInput}
                  style={{ padding: '5px 10px', borderRadius: 6, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: savingPlan ? 'wait' : 'pointer', opacity: savingPlan || !planInput ? 0.6 : 1 }}
                >
                  {savingPlan ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingPlan(false)}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {showSessionLog && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={handleManualLog}
                disabled={logging}
                title="Class held but attendance wasn't taken for it — logs it manually"
                style={{
                  background: 'none', border: 'none', padding: 0, color: 'var(--muted)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                  opacity: logging ? 0.6 : 1,
                }}
              >
                {logging ? 'Logging…' : "Class held but attendance missed? Log it manually"}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {logsForCourse.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No sessions logged yet for this course.</div>
              ) : (
                [...logsForCourse].reverse().map((l) => {
                  const loggedDate = l.loggedAt ? new Date(l.loggedAt) : null;
                  const dateLabel = loggedDate && !Number.isNaN(loggedDate.getTime())
                    ? loggedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                      <span style={{ color: 'var(--text)' }}>
                        Class {l.sequenceNumber || '—'} · {l.teacherName || 'Unknown'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{dateLabel}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                          {l.loggedBy?.role === 'faculty' ? '👨‍🏫 Faculty' : l.loggedBy?.role === 'cr' ? 'CR' : '—'}
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {!isJoinedClass && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>Co-teacher</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {inviteCode
                    ? 'Share this code — it works once and expires in 24h.'
                    : 'Generate a code so a second teacher can join this class instantly.'}
                </div>
              </div>
              {inviteCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 16, letterSpacing: '0.12em',
                    padding: '6px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent)',
                  }}>
                    {inviteCode}
                  </span>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                  >
                    {generatingInvite ? '…' : 'Regenerate'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: generatingInvite ? 0.6 : 1 }}
                >
                  {generatingInvite ? 'Generating…' : 'Invite co-teacher'}
                </button>
              )}
            </div>
          </div>
        )}

        {totalClasses > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Attendance Summary</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Phase H — only meaningful once a second teacher has
                    joined this assignment (see teacherUids). A solo
                    teacher's "mine" and "all" are identical, so hiding
                    this avoids a confusing no-op toggle in the common
                    case. */}
                {isJoinedClass && (
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setSessionScope('mine')}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: sessionScope === 'mine' ? 'var(--accent)' : 'var(--card)',
                        color: sessionScope === 'mine' ? '#fff' : 'var(--muted)',
                      }}
                    >
                      My sessions
                    </button>
                    <button
                      onClick={() => setSessionScope('all')}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: sessionScope === 'all' ? 'var(--accent)' : 'var(--card)',
                        color: sessionScope === 'all' ? '#fff' : 'var(--muted)',
                      }}
                    >
                      All sessions
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{totalClasses} class{totalClasses === 1 ? '' : 'es'} held</div>
              </div>
            </div>

            {classPerformancePct !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '12px 14px', borderRadius: 12, marginBottom: 12,
                background: `linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card))`,
                border: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Class Performance</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Average attendance across {attendanceSummary.length} student{attendanceSummary.length === 1 ? '' : 's'}</div>
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace',
                  color: classPerformancePct >= 75 ? '#16a34a' : classPerformancePct >= 60 ? '#d97706' : '#dc2626',
                }}>
                  {classPerformancePct}%
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{
                borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)',
                padding: '11px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>✓</span> Most Regular
                </div>
                {mostRegular.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data yet.</div>}
                <div style={{ display: 'grid', gap: 5 }}>
                  {mostRegular.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5,
                      padding: '5px 8px', borderRadius: 7,
                      background: i === 0 ? 'color-mix(in srgb, #16a34a 10%, var(--surface))' : 'var(--surface)',
                    }}>
                      <span style={{ color: 'var(--text)', fontWeight: i === 0 ? 700 : 500 }}>{s.roll}</span>
                      <span style={{ color: '#16a34a', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)',
                padding: '11px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>⚠</span> Most Absent
                </div>
                {mostAbsent.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data yet.</div>}
                <div style={{ display: 'grid', gap: 5 }}>
                  {mostAbsent.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5,
                      padding: '5px 8px', borderRadius: 7,
                      background: i === 0 ? 'color-mix(in srgb, #dc2626 10%, var(--surface))' : 'var(--surface)',
                    }}>
                      <span style={{ color: 'var(--text)', fontWeight: i === 0 ? 700 : 500 }}>{s.roll}</span>
                      <span style={{ color: '#dc2626', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Date picker only here — the actual Save/Update button moved below
          the student roster (see bottom of this tab), since a teacher
          marking attendance scrolls down through the whole class list and
          the button should be right there when they finish, not back up
          at the top of the screen. */}
      <div className="faculty-summary-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={date}
          onChange={(e) => { isAutoDate.current = false; setDate(e.target.value); }}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
        />
        {date !== todayStr() && (
          <button
            onClick={() => { isAutoDate.current = true; setDate(todayStr()); }}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}
          >
            Today
          </button>
        )}
        {/* Phase F (§3f) — visible only when today ISN'T one of this
            class's scheduled days, so the teacher understands why the
            date field didn't auto-jump to today on its own (and knows
            picking a date manually is expected here, not a bug). Never
            shown once the teacher has picked a date manually for a
            scheduled day either — this is purely about explaining the
            "no auto-date today" state, not a general reminder. */}
        {isAutoDate.current && !isScheduledToday && date === todayStr() && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            No class scheduled today — pick a date manually if needed.
          </span>
        )}
        {existingSessionForDate?.locked && !unlockedForEdit && (
          <>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              🔒 Already saved for this date — locked.
            </span>
            <button
              onClick={() => setUnlockedForEdit(true)}
              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--accent)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
            >
              Edit this date
            </button>
          </>
        )}
        {existingSessionForDate?.locked && unlockedForEdit && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Correcting a locked date — every change will be recorded in the audit trail.
          </span>
        )}
        {existingSessionForDate && !existingSessionForDate.locked && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Already recorded for this date — editing will update it.</span>
        )}
      </div>

      {/* Section toggle (multi-section depts only — CE/EEE/ME/CSE) +
          "+ Add student" (backlog / over-quota extra student, see
          ATTENDANCE_REBUILD_PLAN.md §3c). Both sit above the roster. */}
      <div className="faculty-summary-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {multiSection ? (
          <div style={{ display: 'flex', gap: 4 }}>
            {['A', 'B'].map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: activeSection === sec ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: activeSection === sec ? 'color-mix(in srgb, var(--accent) 12%, var(--card))' : 'transparent',
                  color: activeSection === sec ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                Section {sec}
              </button>
            ))}
          </div>
        ) : <div />}
        <button
          onClick={() => { setShowAddStudent((v) => !v); setAddSectionInput(activeSection); }}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          + Add student
        </button>
      </div>

      {showAddStudent && (
        <div className="faculty-summary-card" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="7-digit roll"
            value={addRollInput}
            onChange={(e) => setAddRollInput(e.target.value)}
            style={{ width: 110, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={addNameInput}
            onChange={(e) => setAddNameInput(e.target.value)}
            style={{ flex: '1 1 140px', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
          />
          {multiSection && (
            <select
              value={addSectionInput}
              onChange={(e) => setAddSectionInput(e.target.value)}
              style={{ padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5 }}
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          )}
          <button
            className="accent-fill-glass"
            onClick={handleAddStudent}
            disabled={addingStudent || !/^\d{7}$/.test(addRollInput.trim())}
            style={{ padding: '7px 14px', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (addingStudent || !/^\d{7}$/.test(addRollInput.trim())) ? 0.5 : 1 }}
          >
            {addingStudent ? 'Adding…' : 'Add'}
          </button>
          <button
            onClick={() => setShowAddStudent(false)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {(() => {
        const rosterLocked = !!existingSessionForDate?.locked && !unlockedForEdit;
        return (
          <div className="faculty-summary-card attendance-desktop-roster" style={{ padding: 0, overflow: 'hidden', opacity: rosterLocked ? 0.6 : 1 }}>
            {/* Header row — spreadsheet-style column labels (§3d). This
                block is the desktop rebuild; below 768px it's hidden via
                .attendance-desktop-roster and AttendanceMobileRoster
                (Phase E, §3e) renders instead — see index.css. */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 64px 56px 96px',
              gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)',
              fontSize: 10.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              <span>Name / Roll</span>
              <span style={{ textAlign: 'center' }}>Held</span>
              <span style={{ textAlign: 'center' }}>Present</span>
              <span style={{ textAlign: 'center' }}>%</span>
              <span style={{ textAlign: 'center' }}>Mark</span>
            </div>

            {mergedRoster.map((m) => {
              // Effective mark for TODAY's row: explicit draft mark if the
              // teacher touched it, otherwise 'present' is only what's
              // SHOWN (the default-present quick-entry affordance) — not
              // written into draftMarks itself, per §3d's care-point (see
              // handleSave's comment for where it actually gets committed).
              const effectiveMark = draftMarks[m.roll] || 'present';
              const stats = rowStatsByRoll[m.roll] || { presentCount: 0, markedCount: 0, pct: null };
              const isExpanded = expandedRoll === m.roll;
              return (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 64px 56px 96px', gap: 8, alignItems: 'center', padding: '8px 12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{m.name || 'Unnamed'}</span>
                        {m.isPlaceholder && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                            No account yet
                          </span>
                        )}
                        {m.isBacklog && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'color-mix(in srgb, var(--accent) 14%, var(--card))', color: 'var(--accent)' }}>
                            Added
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{m.roll || '—'}</span>
                        {multiSection && (
                          <button
                            onClick={() => handleMoveSection(m.roll, m.name, activeSection === 'A' ? 'B' : 'A')}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Move to Section {activeSection === 'A' ? 'B' : 'A'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>{stats.markedCount}</div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>{stats.presentCount}</div>
                    <div style={{
                      textAlign: 'center', fontSize: 12.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                      color: stats.pct === null ? 'var(--muted)' : stats.pct >= 75 ? '#16a34a' : stats.pct >= 60 ? '#d97706' : '#dc2626',
                    }}>
                      {stats.pct === null ? '—' : `${stats.pct}%`}
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                      {/* 2-state Present/Absent quick toggle (§3d). Green =
                          Present (the default), red = Absent, one click
                          flips between the two. A Late/Excused mark (set
                          via "…" below) shows its own letter here instead
                          and the main toggle is disabled for that row
                          until "…" clears it — avoids a stray click
                          silently downgrading a deliberate L/E mark. */}
                      <button
                        onClick={() => !rosterLocked && togglePresentAbsent(m.roll, effectiveMark)}
                        disabled={rosterLocked || effectiveMark === 'late' || effectiveMark === 'excused'}
                        title={effectiveMark === 'late' || effectiveMark === 'excused' ? 'Clear via “…” to use the quick toggle again' : ''}
                        style={{
                          width: 56, height: 28, borderRadius: 7, fontSize: 11, fontWeight: 700,
                          cursor: (rosterLocked || effectiveMark === 'late' || effectiveMark === 'excused') ? 'not-allowed' : 'pointer',
                          border: `1px solid ${markColors[effectiveMark]}`,
                          background: `${markColors[effectiveMark]}22`,
                          color: markColors[effectiveMark],
                          opacity: (effectiveMark === 'late' || effectiveMark === 'excused') ? 0.75 : 1,
                        }}
                      >
                        {markLabels[effectiveMark]}
                      </button>
                      <button
                        onClick={() => !rosterLocked && setExpandedRoll((v) => (v === m.roll ? null : m.roll))}
                        disabled={rosterLocked}
                        title="Late / Excused"
                        style={{
                          width: 24, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)',
                          color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: rosterLocked ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px 12px', justifyContent: 'flex-end' }}>
                      {['late', 'excused'].map((mark) => (
                        <button
                          key={mark}
                          onClick={() => !rosterLocked && setMark(m.roll, mark)}
                          disabled={rosterLocked}
                          style={{
                            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: rosterLocked ? 'not-allowed' : 'pointer',
                            border: draftMarks[m.roll] === mark ? `1px solid ${markColors[mark]}` : '1px solid var(--border)',
                            background: draftMarks[m.roll] === mark ? `${markColors[mark]}22` : 'var(--bg)',
                            color: draftMarks[m.roll] === mark ? markColors[mark] : 'var(--muted)',
                          }}
                        >
                          {markLabels[mark]} · {mark === 'late' ? 'Late' : 'Excused'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Phase E — mobile 2-row swipeable roster (§3e). Same underlying
          state as the desktop table above (effectiveMark/togglePresentAbsent/
          setMark/expandedRoll/rowStatsByRoll) — reused as-is, not
          reimplemented, per the plan's explicit instruction. Rendered only
          below 768px (desktop table hides itself via CSS at the same
          breakpoint) so there's exactly one roster mounted at a time. */}
      {(() => {
        const rosterLocked = !!existingSessionForDate?.locked && !unlockedForEdit;
        return (
          <div className="faculty-summary-card attendance-mobile-roster" style={{ padding: 0, overflow: 'hidden', opacity: rosterLocked ? 0.6 : 1 }}>
            {mergedRoster.map((m) => {
              const effectiveMark = draftMarks[m.roll] || 'present';
              const stats = rowStatsByRoll[m.roll] || { presentCount: 0, markedCount: 0, pct: null };
              const isExpanded = expandedRoll === m.roll;
              return (
                <AttendanceMobileRow
                  key={m.id}
                  m={m}
                  stats={stats}
                  effectiveMark={effectiveMark}
                  isExpanded={isExpanded}
                  rosterLocked={rosterLocked}
                  multiSection={multiSection}
                  activeSection={activeSection}
                  markColors={markColors}
                  markLabels={markLabels}
                  sessions={scopedSessions}
                  date={date}
                  togglePresentAbsent={togglePresentAbsent}
                  setMark={setMark}
                  setExpandedRoll={setExpandedRoll}
                  handleMoveSection={handleMoveSection}
                  draftMarks={draftMarks}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Save/Update button lives here, right after the roster — a
          teacher marking a full class scrolls all the way down through
          the student list, so the save action should be waiting right
          here instead of back up at the top of the tab. Disabled entirely
          while a locked date hasn't been explicitly unlocked for
          correction — the real enforcement is server-side in
          createOrUpdateSessionAttendance, this just avoids a wasted
          click+error round trip for the common case. */}
      <div className="faculty-summary-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
        <button
          className="accent-fill-glass"
          onClick={handleSave}
          disabled={saving || (!!existingSessionForDate?.locked && !unlockedForEdit)}
          style={{ width: '100%', padding: '11px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: (saving || (!!existingSessionForDate?.locked && !unlockedForEdit)) ? 0.5 : 1, transition: 'opacity 0.15s' }}
        >
          {saving ? 'Saving…' : existingSessionForDate?.locked ? (unlockedForEdit ? 'Save Correction' : 'Locked — Edit to Change') : existingSessionForDate ? 'Update Attendance' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}
/* [QB-DEPRECATED 2026-08-15] পুরো QuestionBankTab function আর কোথাও
   ব্যবহার হচ্ছে না (উপরে TABS/panel থেকে সরানো হয়েছে) -- delete না,
   দরকার হলে ফিরিয়ে আনা যাবে। দেখো PROGRESS_QB_WEBSITE_INTEGRATION.md
// QuestionBank page reads (useQuestionBankData/getR2FileUrl), scoped to
// THIS class's own department only: a teacher assigned to ESE shouldn't
// have to wade through 15 other departments to find their own course's
// past papers. Opens straight to this assignment's own course+term (if
// papers exist there) and lets the teacher switch to any other
// term/course within the SAME dept — never cross-department.
function QuestionBankTab({ assignment }) {
  const { tree, loading, error } = useQuestionBankData();
  const dept = assignment?.dept;
  const term = assignment?.term;
  const courseCode = assignment?.courseCode;
  const activeCourseKey = courseCode?.replace(/\s+/g, '');

  const papers = (dept && term && activeCourseKey) ? (tree?.[dept]?.[term]?.[activeCourseKey] || []) : [];

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
            <a
              key={p.key}
              href={getR2FileUrl(p.key)}
              target="_blank"
              rel="noreferrer"
              className="faculty-row"
              style={{ textDecoration: 'none' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                <FileText size={14} color="var(--accent)" /> {p.label}
              </span>
              <ExternalLink size={13} color="var(--muted)" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
*/

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
                {/* [QB-DEPRECATED 2026-08-15] tab নিজেই TABS থেকে সরানো, তাই এই লাইন আর পৌঁছানো যাবে না -- harmless, দেখো PROGRESS_QB_WEBSITE_INTEGRATION.md */}
                {/* {t.id === 'qbank' && <QuestionBankTab assignment={assignment} />} */}
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

