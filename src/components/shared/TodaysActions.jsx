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
import { CalendarCheck, ClipboardCheck, Megaphone, ClipboardList, Bike, Users, CheckCircle, ListChecks } from 'lucide-react';
import { store } from '../../store/store';
import { useTodayActions } from '../../lib/todayActions';
import { markAttendance, moveAttendanceStatus, setRotationOverride, getTeachersForCourse } from '../../lib/attendanceCore';
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

  const pickRotationTeacher = (courseId, day, slot, teacherName) => {
    setRotationOverride(courseId, day, slot, date, teacherName);
  };

  const hasAnything =
    attendance.rows.length > 0 ||
    assignments.length > 0 ||
    cr.isCR ||
    errands.activeCount > 0;

  if (!hasAnything) return null; // whole card hides — handoff decision #5

  // Live-resolved openCard target — mirrors Attendance.jsx's own
  // re-derive-on-every-render approach so a background schedule/mark
  // change while the modal is open can never leave it stale.
  const openRow = openCard ? attendance.rows.find((r) => r.course.id === openCard.courseId) : null;
  const openTeacherRow = openRow ? openRow.teacherRows.find((r) => r.teacher === openCard.teacher) : null;

  return (
    <>
      <div className="card" style={{ padding: '14px 16px', borderRadius: 14, margin: 0, height: '100%', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListChecks size={13} /> Today's Actions
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>

        {/* 1. Attendance — unmarked courses for today */}
        {attendance.rows.map((row) => {
          if (row.anyNeedsPick) {
            // Mirrors Attendance.jsx's DailyLog exactly: a rotating slot
            // with no override yet shows inline teacher-pick buttons
            // FIRST — row-click-to-modal only becomes available once a
            // teacher is picked (see that file's cardData/teacherRows
            // gating). Do not special-case this into a single always-
            // modal click target; the real page doesn't do that either.
            const pickEntries = row.resolved.filter((r) => r.needsPick);
            return (
              <div key={row.id} style={{ padding: '9px 10px', borderRadius: 10, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Users size={13} color="var(--accent)" />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{row.courseName}</span>
                </div>
                {pickEntries.map((r) => (
                  <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>{r.slot}:</span>
                    {r.pool.map((name) => (
                      <button
                        key={name}
                        onClick={() => pickRotationTeacher(row.course.id, r.day, r.slot, name)}
                        style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const custom = window.prompt('Teacher name for this date:');
                        if (custom && custom.trim()) pickRotationTeacher(row.course.id, r.day, r.slot, custom.trim());
                      }}
                      style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, border: '1.5px dashed var(--muted)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                    >
                      Other…
                    </button>
                  </div>
                ))}
              </div>
            );
          }
          // Normal case: one row per unmarked course-teacher, with the
          // same inline ✓ Present / ✗ Absent split buttons as the real
          // /attendance Daily Log — marks straight from here, no modal
          // needed for the common single-tap case. Switching teachers
          // for a non-rotating slot is rare enough to still go through
          // the row-click -> AttendanceMarkModal path.
          return row.teacherRows.map((tr) => (
            <div key={`${row.id}-${tr.teacher}`} style={{ padding: '9px 10px', borderRadius: 10, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)' }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenCard({ courseId: row.course.id, teacher: tr.teacher })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenCard({ courseId: row.course.id, teacher: tr.teacher }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                <CalendarCheck size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.courseName}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{tr.teacher || 'Unknown teacher'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', borderRadius: 9, overflow: 'hidden', border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); mark(row.course.id, tr.teacher, 'present'); }}
                  style={{ flex: 1, minWidth: 0, padding: '12px 6px', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)', color: '#10b981', border: 'none', borderRight: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, WebkitTapHighlightColor: 'transparent' }}
                >
                  ✓ Present
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); mark(row.course.id, tr.teacher, 'absent'); }}
                  style={{ flex: 1, minWidth: 0, padding: '12px 6px', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, WebkitTapHighlightColor: 'transparent' }}
                >
                  ✗ Absent
                </button>
              </div>
            </div>
          ));
        })}

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
        const slotEntry = openRow.resolved.find((r) => r.resolvedTeacher === openTeacherRow.teacher);
        const defaultTeachers = getTeachersForCourse(attendance.settings, attendance.schedule, openRow.course.id, attendance.teacherRegistry);
        const switchOptions = slotEntry ? defaultTeachers.filter((t) => t !== openTeacherRow.teacher) : [];
        return (
          <AttendanceMarkModal
            course={openRow.course}
            teacher={openTeacherRow.teacher}
            status={openTeacherRow.status}
            dateLabel="Today"
            switchOptions={switchOptions}
            dark={dark}
            onClose={() => setOpenCard(null)}
            onMark={(val) => { mark(openRow.course.id, openTeacherRow.teacher, val); setOpenCard(null); }}
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
