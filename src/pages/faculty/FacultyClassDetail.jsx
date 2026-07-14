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
import * as Icons from 'lucide-react';
import ClassmatesList from '../../components/ClassmatesList';

// Local calendar date as 'YYYY-MM-DD' — NOT toISOString(), which converts to
// UTC first and can silently roll back to yesterday's date for anyone west
// of UTC or, for KUET's UTC+6, roll forward past midnight-local a few hours
// early depending on when the clock ticks over relative to render. Same
// pattern used app-wide (Attendance.jsx, Diary.jsx, Extras.jsx, Money.jsx).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

import { getDeptSyllabus } from '../../store/curriculumStore';
import { subscribeFacultyAssignment, setPlannedTotalClasses, updateAssignmentDayTimeSlots, findConflictingAssignment } from '../../lib/facultyClassSync';
import { subscribeMembers, subscribePlannerLogs, subscribeRoutine } from '../../lib/groupSync';
import {
  createOrUpdateSessionAttendance, subscribeSessionAttendance,
  computeStudentAttendancePercent, computeAttendanceComponentScore,
  setTeacherMarkComponents, getTeacherMarkComponents,
  saveStudentMarks, subscribeStudentRecords, sendAllReviewed,
} from '../../lib/facultyMarksSync';
import { exportStudentMarksPdf, exportClassSummaryPdf } from '../../lib/facultyPdfExport';
import { logFacultySession } from '../../lib/facultySessionSync';
import { getFacultyDoc } from '../../lib/facultySync';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import { auth } from '../../lib/firebase';
import { notify } from '../../lib/notify';
import * as noticeApi from '../../lib/noticeUtils';
import { postFacultyNotice } from '../../lib/facultyNoticeSync';
import {
  TIME_MODELS, DAYS, isSessionalType, getPresetSessionalSlots, isSlotOverlap,
} from '../../lib/timeModels';
import { useQuestionBankData, getR2FileUrl } from '../../hooks/useQuestionBankData';

const TABS = [
  { id: 'students', label: 'Students & CR', icon: 'Users', enabled: true },
  { id: 'syllabus', label: 'Syllabus', icon: 'BookMarked', enabled: true },
  { id: 'schedule', label: 'Schedule', icon: 'Clock', enabled: true },
  { id: 'sessions', label: 'Sessions & Count', icon: 'ListChecks', enabled: true },
  { id: 'attendance', label: 'Attendance', icon: 'CheckSquare', enabled: true },
  { id: 'marks', label: 'Marks', icon: 'GraduationCap', enabled: true },
  { id: 'qbank', label: 'Question Bank', icon: 'FileText', enabled: true },
  { id: 'notices', label: 'Notices', icon: 'Bell', enabled: true },
];

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
            <Icons.X size={18} />
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
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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
function NoticesTab({ groupId, isVerified }) {
  const [facultyDoc, setFacultyDoc] = useState(null);
  const [notices, setNotices] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('broadcast');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyDoc);
  }, []);

  useEffect(() => {
    if (!groupId) { setNotices([]); return; }
    return noticeApi.subscribeAllNotices({}, groupId, setNotices, 'faculty');
  }, [groupId]);

  const handleSend = async () => {
    if (!isVerified) {
      notify('Blue Tick verification is required before you can send notices.', 'error');
      return;
    }
    if (!title.trim() || !body.trim()) {
      notify('Please enter both a title and a message.', 'error');
      return;
    }
    setSending(true);
    try {
      await postFacultyNotice(groupId, facultyDoc, auth.currentUser.uid, {
        title: title.trim(), body: body.trim(), targetType,
      });
      setTitle('');
      setBody('');
      notify('Notice sent.', 'success');
    } catch (e) {
      notify(e.message || 'Could not send this notice.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 16, display: 'grid', gap: 10 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5 }}
        />
        <textarea
          placeholder="Message"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={targetType === 'broadcast'} onChange={() => setTargetType('broadcast')} />
            Class only (all students)
          </label>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={targetType === 'cr_only'} onChange={() => setTargetType('cr_only')} />
            CR only
          </label>
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !isVerified}
          title={!isVerified ? 'Blue Tick verification needed before you can send notices' : undefined}
          style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (sending || !isVerified) ? 'not-allowed' : 'pointer', opacity: (sending || !isVerified) ? 0.5 : 1 }}
        >
          {sending ? 'Sending…' : 'Send Notice'}
        </button>
        {!isVerified && (
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            🔒 Needs Blue Tick verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {notices.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notices sent to this class yet.</div>
        )}
        {notices.map((n) => (
          <div key={n.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{n.title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {n.targetType === 'cr_only' ? 'CR only' : 'Class only'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyllabusTab({ assignment }) {
  const [expandedTopics, setExpandedTopics] = useState({});
  if (!assignment) return null;
  const syllabus = getDeptSyllabus(assignment.dept);
  const course = syllabus?.courses?.[assignment.courseCode];
  const accent = 'var(--accent)';

  const toggleTopic = (idx) => {
    setExpandedTopics((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

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
            {topics.map((topic, i) => {
              const isExpanded = expandedTopics[i];
              return (
                <div key={i} style={{ borderBottom: i < topics.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <button
                    onClick={() => toggleTopic(i)}
                    style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${accent} 6%, transparent)`)}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>{isExpanded ? '▼' : i + 1 + '.'}</span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--text)' }}>
                      {isExpanded ? topic : `${topic.substring(0, 100)}${topic.length > 100 ? '...' : ''}`}
                    </span>
                  </button>
                </div>
              );
            })}
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
            onClick={onEditDayTime}
            disabled={!isVerified}
            title={!isVerified ? 'Blue Tick verification needed before you can set a class schedule' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5,
              cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.5,
            }}
          >
            <Icons.Clock size={13} /> Set day &amp; time
          </button>
          {!isVerified && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              🔒 Needs Blue Tick verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
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
            title={!isVerified ? 'Blue Tick verification needed before you can edit the class schedule' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5,
              cursor: isVerified ? 'pointer' : 'not-allowed', opacity: isVerified ? 1 : 0.5,
            }}
          >
            <Icons.Pencil size={13} /> Edit day &amp; time
          </button>
          {!isVerified && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
              🔒 Needs Blue Tick verification. Visit <Link to="/faculty/contact">Contact</Link> if you need help getting verified.
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
          <Icons.CalendarClock size={13} /> Full Batch Routine (Read-only)
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

function SessionsTab({ assignment, groupId }) {
  const [logs, setLogs] = useState(null); // null = loading
  const [facultyName, setFacultyName] = useState('');
  const [logging, setLogging] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planInput, setPlanInput] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!groupId) { setLogs([]); return; }
    return subscribePlannerLogs(groupId, setLogs);
  }, [groupId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then((fdoc) => setFacultyName(fdoc?.preferredName || fdoc?.name || 'Faculty'));
  }, []);

  const courseId = assignment?.courseId;
  const logsForCourse = (logs || []).filter((l) => l.courseId === courseId);
  const plannedTotal = assignment?.plannedTotalClasses;

  const handleLog = async () => {
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

  if (logs === null) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>;
  }

  return (
    <div>
      <div className="faculty-summary-card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        marginBottom: 14, flexWrap: 'wrap',
      }}>
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
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
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
                onClick={handleSavePlan}
                disabled={savingPlan || !planInput}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: savingPlan ? 'wait' : 'pointer', opacity: savingPlan || !planInput ? 0.6 : 1 }}
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
        <button
          onClick={handleLog}
          disabled={logging}
          style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: logging ? 0.6 : 1,
          }}
        >
          {logging ? 'Logging…' : '+1 Log Class'}
        </button>
      </div>

      {logsForCourse.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No sessions logged yet for this course.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {[...logsForCourse].reverse().map((l) => (
            <div key={l.id} className="faculty-row" style={{ fontSize: 12.5 }}>
              <span style={{ color: 'var(--text)' }}>
                Class {l.sequenceNumber || '—'} · {l.teacherName || 'Unknown'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                {l.loggedBy?.role === 'faculty' ? '👨‍🏫 Faculty' : l.loggedBy?.role === 'cr' ? 'CR' : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ assignment, groupId }) {
  const [members, setMembers] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [facultyName, setFacultyName] = useState('');
  const [date, setDate] = useState(() => todayStr());
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

  useEffect(() => {
    const resyncIfAuto = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isAutoDate.current) return;
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
  }, []);

  useEffect(() => {
    if (!groupId) { setMembers([]); return; }
    return subscribeMembers(groupId, setMembers);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !assignment) { setSessions([]); return; }
    return subscribeSessionAttendance(groupId, assignment.id, setSessions);
  }, [groupId, assignment]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then((fdoc) => setFacultyName(fdoc?.preferredName || fdoc?.name || 'Faculty'));
  }, []);

  // Pre-fill draftMarks from an existing session for the selected date, if
  // one was already taken (so re-opening today's attendance doesn't blank
  // out what was already marked — §8.9's "manual override possible" note
  // implies edits should start from the existing state, not from scratch).
  useEffect(() => {
    const existing = (sessions || []).find((s) => s.date === date);
    setDraftMarks(existing?.attendance || {});
  }, [date, sessions]);

  const existingSessionForDate = (sessions || []).find((s) => s.date === date);

  const setMark = (studentUid, mark) => {
    setDraftMarks((prev) => ({ ...prev, [studentUid]: prev[studentUid] === mark ? undefined : mark }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createOrUpdateSessionAttendance(groupId, assignment.id, {
        sessionId: existingSessionForDate?.id || null,
        date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        slot: assignment.dayTimeSlots?.[0]?.slot || '',
        attendance: draftMarks,
        loggedBy: { uid: auth.currentUser.uid, role: 'faculty', name: facultyName },
      });
      notify('Attendance saved.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save attendance.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (members === null || sessions === null) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>;
  }

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
  const totalClasses = sessions.length;
  const attendanceSummary = totalClasses > 0
    ? members.map((m) => {
        const presentCount = sessions.filter((s) => {
          const mark = s.attendance?.[m.id];
          return mark === 'present' || mark === 'late';
        }).length;
        const markedCount = sessions.filter((s) => s.attendance?.[m.id]).length;
        const pct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;
        return { id: m.id, name: m.name || 'Unnamed', roll: m.roll || '—', pct, markedCount };
      }).filter((s) => s.pct !== null).sort((a, b) => b.pct - a.pct)
    : [];
  const mostRegular = attendanceSummary.slice(0, 3);
  const mostAbsent = attendanceSummary.slice().sort((a, b) => a.pct - b.pct).slice(0, 3);

  return (
    <div>
      {totalClasses > 0 && (
        <div className="faculty-summary-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Attendance Summary</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{totalClasses} class{totalClasses === 1 ? '' : 'es'} held</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>✓ Most Regular</div>
              {mostRegular.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data yet.</div>}
              {mostRegular.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)' }}>{s.roll}</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>{s.pct}%</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>⚠ Most Absent</div>
              {mostAbsent.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>No data yet.</div>}
              {mostAbsent.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)' }}>{s.roll}</span>
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s' }}
        >
          {saving ? 'Saving…' : existingSessionForDate ? 'Update Attendance' : 'Save Attendance'}
        </button>
        {existingSessionForDate && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Already recorded for this date — editing will update it.</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {members.map((m) => (
          <div key={m.id} className="faculty-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{m.name || 'Unnamed'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{m.roll || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {marks.map((mark) => (
                <button
                  key={mark}
                  onClick={() => setMark(m.id, mark)}
                  style={{
                    width: 30, height: 30, borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    border: draftMarks[m.id] === mark ? `1px solid ${markColors[mark]}` : '1px solid var(--border)',
                    background: draftMarks[m.id] === mark ? `${markColors[mark]}22` : 'var(--bg)',
                    color: draftMarks[m.id] === mark ? markColors[mark] : 'var(--muted)',
                  }}
                >
                  {markLabels[mark]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// QuestionBankTab — reuses the same live R2 tree the student-facing
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
                <Icons.FileText size={14} color="var(--accent)" /> {p.label}
              </span>
              <Icons.ExternalLink size={13} color="var(--muted)" />
            </a>
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
            <Icons.X size={15} />
          </button>
        </div>
      ))}

      <button
        onClick={addComponent}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}
      >
        <Icons.Plus size={13} /> Add component
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
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
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
        teacher1: t1doc?.preferredName || t1doc?.name || '',
        teacher2: t2doc?.preferredName || t2doc?.name || '',
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
        🔒 Marks entry needs Blue Tick verification first. Your request is already in the
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
  const attendancePctFor = (studentUid) => computeStudentAttendancePercent(sessions, studentUid);

  const getFieldValue = (studentUid, key) => {
    if (draft[studentUid]?.[key] !== undefined) return draft[studentUid][key];
    return recordsByUid[studentUid]?.[`${teacherSlot}Marks`]?.[key] ?? '';
  };

  const setField = (studentUid, key, value) => {
    setDraft((prev) => ({ ...prev, [studentUid]: { ...prev[studentUid], [key]: value === '' ? '' : Number(value) } }));
  };

  const buildFieldsForSave = (studentUid) => {
    const d = draft[studentUid] || {};
    const existing = recordsByUid[studentUid]?.[`${teacherSlot}Marks`] || {};
    const pct = attendancePctFor(studentUid);
    const fields = { attendance: computeAttendanceComponentScore(pct, markConfig.attendanceWeight) };
    markConfig.components.forEach((c) => {
      fields[c.key] = d[c.key] !== undefined ? d[c.key] : (existing[c.key] ?? 0);
    });
    return fields;
  };

  const handleSave = async (studentUid, status) => {
    setSavingUid(studentUid);
    try {
      const fields = buildFieldsForSave(studentUid);
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
      onChange={(e) => setField(studentUid, key, e.target.value)}
      style={{ width: 52, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12 }}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          You are <strong style={{ color: 'var(--text)' }}>{teacherSlot === 'teacher1' ? 'Teacher 1' : 'Teacher 2'}</strong> -- your own 45-mark quota (attendance {markConfig.attendanceWeight} + {markConfig.components.map((c) => `${c.label} ${c.max}`).join(' + ')})
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setEditingBreakdown(true)}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Edit Breakdown
          </button>
          <button
            onClick={handleSendAllReviewed}
            disabled={sendingAll}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: sendingAll ? 0.6 : 1 }}
          >
            {sendingAll ? 'Sending...' : 'Send All Reviewed'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={handleExportClass}
          disabled={exportingClass}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 11.5, cursor: 'pointer' }}
        >
          {exportingClass ? 'Exporting...' : 'Export Class Summary PDF'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {members.map((m) => {
          const rec = recordsByUid[m.id];
          const pct = attendancePctFor(m.id);
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <div style={{ minWidth: 100 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>
                  {statusDot(rec?.status)} {m.name || 'Unnamed'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {m.roll || '--'} -- Attendance: {pct === null ? '--' : `${pct}%`} -&gt; {computeAttendanceComponentScore(pct, markConfig.attendanceWeight)}/{markConfig.attendanceWeight}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {markConfig.components.map((c) => (
                  <label key={c.key} style={{ fontSize: 10.5, color: 'var(--muted)' }}>{c.label} {numInput(m.id, c.key, c.max)}</label>
                ))}
                <button
                  onClick={() => handleSave(m.id, 'reviewed')}
                  disabled={savingUid === m.id}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(m.id, 'sent')}
                  disabled={savingUid === m.id}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  Send
                </button>
                <button
                  onClick={() => handleExportStudent(m)}
                  disabled={exportingUid === m.id}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}
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
  const [tab, setTab] = useState('students');
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
  const [mountedTabs, setMountedTabs] = useState(() => new Set(['students']));

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
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        <Link to="/faculty/classes" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none', marginBottom: 10 }}>
          <Icons.ChevronLeft size={14} /> My Classes
        </Link>

        <div className="faculty-class-hero">
          <div className="faculty-class-hero-icon">
            <Icons.BookOpen size={19} color="var(--accent)" />
          </div>
          <div>
            {assignment && (
              <div className="faculty-class-hero-meta">
                {assignment.batch?.toUpperCase()} {assignment.dept}
              </div>
            )}
            <h1 className="faculty-class-hero-title">
              {assignment ? `${assignment.courseCode}${assignment.courseTitle ? ' — ' + assignment.courseTitle : ''}` : 'Class Detail'}
            </h1>
            {assignment && (
              <div className="faculty-class-hero-sub">
                {assignment.term} · {assignment.courseType}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar — disabled tabs are visible but non-interactive, with a
            title tooltip explaining why, rather than hidden entirely. This
            keeps the tab-bar layout stable across phases instead of tabs
            appearing/shifting as later phases land. */}
        <div className="faculty-tabs">
          {TABS.map((t) => {
            const Icon = Icons[t.icon] || Icons.Circle;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => t.enabled && selectTab(t.id)}
                disabled={!t.enabled}
                title={t.enabled ? undefined : 'Coming in a later phase'}
                className={`faculty-tab-btn${active ? ' active' : ''}`}
              >
                <Icon size={14} /> {t.label}
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
              {t.id === 'students' && <ClassmatesList groupId={groupId} showActions={false} viewerRole="faculty" />}
              {t.id === 'syllabus' && <SyllabusTab assignment={assignment} />}
              {t.id === 'schedule' && (
                <ScheduleTab assignment={assignment} groupId={groupId} isVerified={isVerified} onEditDayTime={() => setEditingDayTime(true)} />
              )}
              {t.id === 'sessions' && <SessionsTab assignment={assignment} groupId={groupId} />}
              {t.id === 'attendance' && <AttendanceTab assignment={assignment} groupId={groupId} />}
              {t.id === 'marks' && <MarksTab assignment={assignment} groupId={groupId} />}
              {t.id === 'qbank' && <QuestionBankTab assignment={assignment} />}
              {t.id === 'notices' && <NoticesTab groupId={groupId} isVerified={isVerified} />}
            </div>
          );
        })}
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