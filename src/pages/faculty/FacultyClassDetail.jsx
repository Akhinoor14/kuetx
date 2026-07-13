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

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import ClassmatesList from '../../components/ClassmatesList';
import { getDeptSyllabus } from '../../store/curriculumStore';
import { subscribeFacultyAssignment } from '../../lib/facultyClassSync';
import { subscribeMembers, subscribePlannerLogs } from '../../lib/groupSync';
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
import { TIME_MODELS } from '../../lib/timeModels';

const TABS = [
  { id: 'students', label: 'Students & CR', icon: 'Users', enabled: true },
  { id: 'syllabus', label: 'Syllabus', icon: 'BookMarked', enabled: true },
  { id: 'schedule', label: 'Schedule', icon: 'Clock', enabled: true },
  { id: 'sessions', label: 'Sessions & Count', icon: 'ListChecks', enabled: true },
  { id: 'attendance', label: 'Attendance', icon: 'CheckSquare', enabled: true },
  { id: 'marks', label: 'Marks', icon: 'GraduationCap', enabled: true },
  { id: 'notices', label: 'Notices', icon: 'Bell', enabled: false },
];

function SyllabusTab({ assignment }) {
  if (!assignment) return null;
  const syllabus = getDeptSyllabus(assignment.dept);
  const course = syllabus?.courses?.[assignment.courseCode];

  if (!course) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
        No syllabus entry found for {assignment.courseCode} yet.
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{course.title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {course.credit} credit{course.credit === 1 ? '' : 's'} · {course.contactHour}
        </div>
      </div>
      {course.topics?.length > 0 && (
        <ol style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
          {course.topics.map((t, i) => (
            <li key={i} style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6 }}>{t}</li>
          ))}
        </ol>
      )}
      {(!course.topics || course.topics.length === 0) && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>No detailed topics listed for this course.</div>
      )}
    </div>
  );
}

function ScheduleTab({ assignment }) {
  const slots = assignment?.dayTimeSlots || [];
  if (!slots.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>No day/time slot set for this class yet.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {slots.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{s.day}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.slot}</div>
          {s.modelId && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{TIME_MODELS[s.modelId]?.name || s.modelId}</span>}
        </div>
      ))}
    </div>
  );
}

function SessionsTab({ assignment, groupId }) {
  const [logs, setLogs] = useState(null); // null = loading
  const [facultyName, setFacultyName] = useState('');
  const [logging, setLogging] = useState(false);

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

  if (logs === null) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>;
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 14,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>{logsForCourse.length}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            classes logged{plannedTotal ? ` of ${plannedTotal} planned` : ''}
          </div>
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
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12.5,
            }}>
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftMarks, setDraftMarks] = useState({}); // { studentUid: 'present'|'absent'|'late'|'excused' }
  const [saving, setSaving] = useState(false);

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : existingSessionForDate ? 'Update Attendance' : 'Save Attendance'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {members.map((m) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
          }}>
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

function MarksSetupForm({ assignment, groupId, teacherSlot, onSaved }) {
  const [attendanceWeight, setAttendanceWeight] = useState(15);
  const [components, setComponents] = useState([{ key: 'ct', label: 'CT', max: 30 }]);
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
        Set up your marks breakdown
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        You have 45 marks total for this course. Attendance is always its own component
        (scored as a percentage of the weight you set here) -- everything else is entirely
        up to you: name your own components (CT, Assignment, Presentation, Quiz, whatever
        fits) and set each one's maximum. Everything must add up to exactly 45.
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

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving...' : 'Save Breakdown'}
      </button>
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

  // Blue Tick gate (auto-approval policy): everything else on this page
  // (Syllabus/Schedule/Sessions/Attendance) is open to any faculty
  // account, but marks are graded/consequential data — this mirrors the
  // exact same isVerifiedFaculty hard gate firestore.rules enforces on
  // the actual write (saveStudentMarks -> studentRecords create/update),
  // it just also shows a clear message here instead of letting the
  // Firestore write silently fail.
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

  if (!markConfig) {
    return <MarksSetupForm assignment={assignment} groupId={groupId} teacherSlot={teacherSlot} onSaved={() => getTeacherMarkComponents(groupId, assignment.id, teacherSlot).then(setMarkConfig)} />;
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
      await exportStudentMarksPdf(assignment, student, recordsByUid[student.id] || {});
    } catch (e) {
      notify(e.message || 'Could not export PDF.', 'error');
    } finally {
      setExportingUid(null);
    }
  };

  const handleExportClass = async () => {
    setExportingClass(true);
    try {
      await exportClassSummaryPdf(assignment, members, recordsByUid);
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
        <button
          onClick={handleSendAllReviewed}
          disabled={sendingAll}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: sendingAll ? 0.6 : 1 }}
        >
          {sendingAll ? 'Sending...' : 'Send All Reviewed'}
        </button>
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

        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Icons.BookOpen size={20} color="var(--accent)" />
          </div>
          <div>
            <h1 className="hub-page-hero-title">
              {assignment ? `${assignment.courseCode}${assignment.courseTitle ? ' — ' + assignment.courseTitle : ''}` : 'Class Detail'}
            </h1>
            {assignment && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {assignment.batch?.toUpperCase()} {assignment.dept} · {assignment.term} · {assignment.courseType}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar — disabled tabs are visible but non-interactive, with a
            title tooltip explaining why, rather than hidden entirely. This
            keeps the tab-bar layout stable across phases instead of tabs
            appearing/shifting as later phases land. */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {TABS.map((t) => {
            const Icon = Icons[t.icon] || Icons.Circle;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => t.enabled && setTab(t.id)}
                disabled={!t.enabled}
                title={t.enabled ? undefined : 'Coming in a later phase'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', whiteSpace: 'nowrap',
                  border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'none', cursor: t.enabled ? 'pointer' : 'not-allowed',
                  color: !t.enabled ? 'var(--muted)' : active ? 'var(--accent)' : 'var(--text)',
                  opacity: t.enabled ? 1 : 0.45, fontSize: 12.5, fontWeight: active ? 700 : 500,
                }}
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

        {groupId && assignment && tab === 'students' && (
          <ClassmatesList groupId={groupId} showActions={false} viewerRole="faculty" />
        )}
        {groupId && assignment && tab === 'syllabus' && <SyllabusTab assignment={assignment} />}
        {groupId && assignment && tab === 'schedule' && <ScheduleTab assignment={assignment} />}
        {groupId && assignment && tab === 'sessions' && <SessionsTab assignment={assignment} groupId={groupId} />}
        {groupId && assignment && tab === 'attendance' && <AttendanceTab assignment={assignment} groupId={groupId} />}
        {groupId && assignment && tab === 'marks' && <MarksTab assignment={assignment} groupId={groupId} />}
      </div>
    </div>
  );
}

