// components/shared/TodaysActions.jsx
//
// Dashboard's "Today's Actions" (right) column. Renders the data from
// lib/todayActions.js's useTodayActions() hook through the single
// shared TodayActionRow component, in the priority order fixed by
// HANDOFF_dashboard_today_actions.md decision #5:
//   1. Attendance — unmarked courses for today
//   2. Assignments due today, not yet done
//   3. CR-only: quick-post link + today's CT/Quiz reminder (link-outs)
//   4. Pick and Drop — active errand status strip
// Each block is fully conditional — hidden entirely when not
// applicable, no empty placeholders (decision #5).
import { useState } from 'react';
import { CalendarCheck, ClipboardCheck, Megaphone, ClipboardList, Bike, CheckCircle, ListChecks, Check, X as XIcon } from 'lucide-react';
import { store } from '../../store/store';
import { useTodayActions } from '../../lib/todayActions';
import { markAttendance, moveAttendanceStatus, setRotationOverride, getTeachersForCourse } from '../../lib/attendanceCore';
import { ALTERNATE_TEACHER } from '../../pages/Schedule';
import TodayActionRow from './TodayActionRow';
import AttendanceMarkModal from './AttendanceMarkModal';

function useDark() {
  const [dark] = useState(() => document.documentElement.classList.contains('dark'));
  return dark;
}

export default function TodaysActions() {
  const { attendance, assignments, cr, errands, date } = useTodayActions();
  const dark = useDark();

  // Which (courseId, teacher) row has its Present/Absent modal open —
  // same shape/behavior as DailyLog's openCard in Attendance.jsx, so
  // marking from here is byte-for-byte the same write path as the real
  // /attendance page (see lib/attendanceCore.js's markAttendance).
  const [openCard, setOpenCard] = useState(null);

  const mark = (courseId, teacher, val) => {
    const logs = store.get('attLogs') || {};
    markAttendance(logs, date, courseId, teacher, val);
  };

  // Mirrors Attendance.jsx's switchTeacher: overrides only this date,
  // moves any already-marked status to the new teacher's key so nothing
  // is orphaned, and keeps the modal open re-targeted at the new teacher
  // (matching the real page's onSwitch behavior at its openCard call site).
  const switchTeacher = (courseId, day, slot, oldTeacher, newTeacherName) => {
    const logs = store.get('attLogs') || {};
    moveAttendanceStatus(logs, date, courseId, oldTeacher, newTeacherName);
    setRotationOverride(courseId, day, slot, date, newTeacherName);
    setOpenCard({ courseId, teacher: newTeacherName });
  };

  const hasAnything =
    attendance.rows.length > 0 ||
    assignments.length > 0 ||
    cr.isCR ||
    errands.activeCount > 0;

  // Live-resolved openCard target — mirrors Attendance.jsx's own
  // re-derive-on-every-render approach so a background schedule/mark
  // change while the modal is open can never leave it stale.
  const openRow = openCard ? attendance.rows.find((r) => r.course.id === openCard.courseId) : null;
  const openTeacherRow = openRow ? openRow.teacherRows.find((r) => r.teacher === openCard.teacher) : null;

  // Bug fix: marking the very last remaining row used to make the whole
  // card (hasAnything -> false) disappear INSTANTLY, mid-click, before
  // the modal itself ever got to close — no confirmation, no closing
  // animation, just a hard yank from under the user's thumb. Keep the
  // card mounted while a modal is still open (openCard truthy) even if
  // the underlying list just emptied out, and show a brief "all done"
  // state instead of nothing.
  if (!hasAnything && !openCard) return null; // whole card hides — handoff decision #5

  return (
    <>
      <div className="card" style={{ padding: '14px 16px', borderRadius: 14, margin: 0, height: '100%', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListChecks size={13} /> Today's Actions
          </div>
        </div>
        {/* Fixed-height, internally-scrolling list — this card no longer
            grows taller as more attendance rows pile up (5+ rows used to
            push the card's own height way past the "Today" card next to
            it). maxHeight caps at roughly 5 compact rows; anything beyond
            that scrolls inside this div instead of the page. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0, maxHeight: 300, overflowY: 'auto' }}>

        {/* Empty-state after the last row just got marked (see hasAnything
            fix above) — the card stays mounted for the modal's own close,
            but there's nothing left to list, so say so instead of showing
            a bare blank area under the closing modal. */}
        {!hasAnything && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '20px 8px', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600 }}>
            <CheckCircle size={14} color="#10b981" /> All caught up for today
          </div>
        )}

        {/* 1. Attendance — unmarked courses for today. Compact single-line
            row: icon + course/teacher on the left, Present/Absent buttons
            on the right. Every row — fixed teacher or Alternative — opens
            the confirm modal on click; nothing marks directly from here,
            same as the /attendance page. */}
        {attendance.rows.map((row) => row.teacherRows.map((tr) => {
          const isAlt = tr.teacher === ALTERNATE_TEACHER;
          return (
            <div
              key={`${row.id}-${tr.teacher}`}
              role="button"
              tabIndex={0}
              onClick={() => setOpenCard({ courseId: row.course.id, teacher: tr.teacher })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenCard({ courseId: row.course.id, teacher: tr.teacher }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 8px', borderRadius: 9,
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
              }}
            >
              <CalendarCheck size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.course.code || row.course.baseCode || row.courseName}</div>
                <div style={{ fontSize: 9.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isAlt ? 'Alternative' : (tr.teacher || 'Unknown teacher')}</div>
              </div>
              {/* Preview-only pills — the whole row is the tap target
                  (see onClick above) and always opens the confirm modal,
                  never marks directly from here. */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 7, fontWeight: 700, fontSize: 12, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.35)' }}>
                  <Check size={14} strokeWidth={3} /> Present
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 11px', borderRadius: 7, fontWeight: 700, fontSize: 12, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1.5px solid rgba(239,68,68,0.30)' }}>
                  <XIcon size={14} strokeWidth={3} /> Absent
                </div>
              </div>
            </div>
          );
        }))}

        {/* 2. Assignments due today, not yet done */}
        {assignments.map((a) => (
          <TodayActionRow
            key={a.id}
            icon={ClipboardCheck}
            title={a.title || 'Assignment due'}
            subtitle="Due today"
            action={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const items = store.get('assignments') || [];
                  const updated = items.map((x) => x.id === a.id ? { ...x, status: x.status === 'done' ? 'pending' : 'done' } : x);
                  store.set('assignments', updated);
                }}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <CheckCircle size={11} /> Done
              </button>
            }
            dark={dark}
          />
        ))}

        {/* 3. CR-only: quick-post link-out + today's CT/Quiz reminder */}
        {cr.isCR && (
          <>
            <TodayActionRow
              icon={Megaphone}
              title="Post a class announcement"
              href="/class-notices"
              dark={dark}
            />
            {cr.todaysCTQuiz.map((ev) => (
              <TodayActionRow
                key={ev.id}
                icon={ClipboardList}
                title={`${ev.eventType}${ev.title ? ` — ${ev.title}` : ''}`}
                subtitle={ev.startTime ? `Today · ${ev.startTime}` : 'Today'}
                href="/ct-quiz-planning"
                dark={dark}
              />
            ))}
          </>
        )}

        {/* 4. Pick and Drop — compact status strip, only if active */}
        {errands.activeCount > 0 && (
          <TodayActionRow
            icon={Bike}
            title="Pick and Drop"
            subtitle={`${errands.activeCount} active request${errands.activeCount > 1 ? 's' : ''}`}
            href="/services/errands/mine"
            dark={dark}
          />
        )}
      </div>
      </div>

      {openRow && openTeacherRow && (() => {
        const isAlt = openTeacherRow.teacher === ALTERNATE_TEACHER;
        const slotEntry = openRow.resolved.find((r) =>
          isAlt ? r.needsPick : r.resolvedTeacher === openTeacherRow.teacher
        );
        const defaultTeachers = getTeachersForCourse(attendance.settings, attendance.schedule, openRow.course.id, attendance.teacherRegistry);
        // Same default-to-first-teacher fix as Attendance.jsx's DailyLog:
        // an ALTERNATE_TEACHER row shows a real name (first of the max-2
        // course teachers), not the literal "Alternative" placeholder.
        const displayTeacher = isAlt ? (defaultTeachers[0] || 'Alternative') : openTeacherRow.teacher;
        const switchOptions = slotEntry ? defaultTeachers.filter((t) => t !== displayTeacher) : [];
        return (
          <AttendanceMarkModal
            course={openRow.course}
            teacher={displayTeacher}
            status={openTeacherRow.status}
            dateLabel="Today"
            switchOptions={switchOptions}
            dark={dark}
            onClose={() => setOpenCard(null)}
            onMark={(val) => { mark(openRow.course.id, displayTeacher, val); setOpenCard(null); }}
            onSwitch={(name) => {
              if (!slotEntry) return;
              switchTeacher(openRow.course.id, slotEntry.day, slotEntry.slot, openTeacherRow.teacher, name);
            }}
          />
        );
      })()}
    </>
  );
}
