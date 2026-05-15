import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { store, getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, getAllCourses, getProfile } from '../store/store';

const todayStr = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => { 
  const dt = new Date(d + 'T00:00:00Z');  // Add 'Z' for UTC
  dt.setUTCDate(dt.getUTCDate() + n);     // Use setUTCDate instead of setDate
  return dt.toISOString().split('T')[0]; 
};
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long' });

// Check if course is session/lab (auto 100%)
function isAutoFull(courseType) {
  return courseType && (courseType.toLowerCase().includes('session') || courseType.toLowerCase().includes('lab'));
}

// Get all unique teachers for a course on a specific date
function getTeachersForCourseOnDate(schedule, courseId, date) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const items = (schedule || []).filter(s => s.courseId === courseId && s.day === dayName);
  const teachers = [...new Set(items.map(s => s.teacherName).filter(Boolean))];
  return teachers;
}

// Compute attendance from daily logs for a specific (course, teacher) pair
function getEffective(courseId, teacherName, logs, courseType) {
  const key = `${courseId}_${teacherName || ''}`;
  let held = 0, attended = 0;
  
  // If session/lab, auto-full
  if (isAutoFull(courseType)) {
    return { held: 1, attended: 1, source: 'auto', percentage: 100 };
  }
  
  // Count from daily logs
  Object.values(logs).forEach(day => {
    const v = day[key];
    if (v === 'present' || v === 'absent') { 
      held++; 
      if (v === 'present') attended++; 
    }
  });
  
  const percentage = held > 0 ? Math.round((attended / held) * 100) : null;
  if (held > 0) return { held, attended, source: 'log', percentage };
  return { held: 0, attended: 0, source: 'none', percentage: null };
}


// Attendance status color
function attColor(pct) {
  if (pct === null) return 'var(--muted)';
  if (pct < MIN_ATTENDANCE_PERCENT) return 'var(--danger)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return 'var(--warning)';
  return 'var(--success)';
}

function getScheduleCoursesForDate(schedule, date) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const byCourse = new Map();

  (schedule || [])
    .filter(item => item.day === dayName)
    .forEach(item => {
      if (!byCourse.has(item.courseId)) byCourse.set(item.courseId, []);
      byCourse.get(item.courseId).push(item);
    });

  return [...byCourse.entries()].map(([courseId, items]) => ({
    courseId,
    items: items.slice().sort((a, b) => a.slot.localeCompare(b.slot)),
  }));
}

// ── Daily Log ─────────────────────────────────────────────────────────────
function DailyLog({ courses, logs, setLogs, schedule }) {
  const [date, setDate] = useState(todayStr());
  const [showGiveAttendance, setShowGiveAttendance] = useState(false);
  const dayLog = logs[date] || {};
  const isToday = date === todayStr();
  const dayName = new Date(date + 'T00:00:00').getDay();
  const isFriday = dayName === 5;
  const scheduledCourses = getScheduleCoursesForDate(schedule, date);
  const scheduledCourseIds = scheduledCourses.map(item => item.courseId);
  const visibleCourses = scheduledCourseIds.length
    ? courses.filter(course => scheduledCourseIds.includes(course.id))
    : [];

  // Get all past dates for back button navigation (excluding Fri-Sat)
  const allPastDates = useMemo(() => {
    const dates = [];
    const fridaySaturdayOnly = [5, 6]; // Friday=5, Saturday=6
    for (let i = 1; i <= 180; i++) { // Look back up to 6 months
      const d = addDays(todayStr(), -i);
      const dayOfWeek = new Date(d + 'T00:00:00').getDay();
      // Skip Friday (5) and Saturday (6)
      if (!fridaySaturdayOnly.includes(dayOfWeek)) {
        dates.push(d);
      }
    }
    return dates;
  }, []);

  const goToPrevClass = () => {
    // Find next past date from current date (excluding Fri-Sat)
    const idx = allPastDates.indexOf(date);
    if (idx >= 0 && idx < allPastDates.length - 1) {
      setDate(allPastDates[idx + 1]);
    } else if (idx === -1 && date < todayStr()) {
      // Current date is in past but not in list (might be Fri-Sat), go to first available past date
      setDate(allPastDates[0]);
    }
  };

  const mark = (courseId, teacherName, val) => {
    const key = `${courseId}_${teacherName || ''}`;
    const cur = dayLog[key];
    const next = cur === val ? undefined : val; // toggle off
    const updated = { ...logs, [date]: { ...dayLog, [key]: next } };
    // clean undefined
    if (next === undefined) delete updated[date][key];
    if (Object.keys(updated[date] || {}).length === 0) delete updated[date];
    setLogs(updated);
    store.set('attLogs', updated);
  };

  const markedTeachers = useMemo(() => {
    let total = 0, marked = 0;
    let coursesToCount = visibleCourses.length > 0 ? visibleCourses : courses;
    if (showGiveAttendance && scheduledCourses.length === 0) {
      coursesToCount = courses.filter(c => !isAutoFull(c.type));
    }
    coursesToCount.forEach(c => {
      const teachers = getTeachersForCourseOnDate(schedule, c.id, date);
      const displayTeachers = teachers.length > 0 ? teachers : [''];
      if (!isAutoFull(c.type)) {
        displayTeachers.forEach(t => {
          total++;
          const key = `${c.id}_${t || ''}`;
          if (dayLog[key]) marked++;
        });
      } else {
        total++;
        marked++;
      }
    });
    return { marked, total };
  }, [visibleCourses, dayLog, date, schedule, courses, showGiveAttendance, scheduledCourses.length]);

  return (
    <div>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={goToPrevClass} disabled={allPastDates.length === 0 || date === allPastDates[allPastDates.length - 1]}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            max={todayStr()}
            style={{ fontWeight: 700, fontSize: 15, textAlign: 'center' }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(d => addDays(d, 1))} disabled={isToday}>
          <ChevronRight size={16} />
        </button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayStr())}>Today</button>}
      </div>

      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(date)}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{markedTeachers.marked}/{markedTeachers.total || 0} marked</div>
        </div>
        {scheduledCourses.length > 0 && !isToday && (
          <button onClick={() => {
            const coursesToMark = (visibleCourses.length > 0 ? visibleCourses : courses);
            const updated = { ...logs };
            if (!updated[date]) updated[date] = {};
            coursesToMark.forEach(c => {
              const teachers = getTeachersForCourseOnDate(schedule, c.id, date);
              const displayTeachers = teachers.length > 0 ? teachers : [''];
              if (!isAutoFull(c.type)) {
                displayTeachers.forEach(t => {
                  updated[date][`${c.id}_${t || ''}`] = 'holiday';
                });
              }
            });
            setLogs(updated);
            store.set('attLogs', updated);
          }} style={{
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
            fontSize: 12, background: 'rgba(251, 146, 60, 0.1)', color: 'var(--warning)', border: '1px solid var(--warning)'
          }}>📅 Mark All as Holiday</button>
        )}
      </div>

      {isFriday && (
        <div className="alert-warning mb-3" style={{ fontSize: 13 }}>
          🕌 Friday — Jumu'ah day. Remember to check which classes are held.
        </div>
      )}

      {courses.length === 0 && (
        <div className="empty-state"><div className="icon">📚</div><p>Add courses first.</p></div>
      )}

      {courses.length > 0 && scheduledCourses.length === 0 && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: 'rgba(251, 191, 36, 0.08)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📅 No scheduled classes today, but you can mark attendance manually.</span>
          <button onClick={() => setShowGiveAttendance(!showGiveAttendance)} style={{
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
            fontSize: 12, background: 'var(--accent)', color: 'white', border: 'none'
          }}>
            {showGiveAttendance ? 'Hide' : 'Give Attendance'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {((() => {
          let coursesToShow = visibleCourses.length > 0 ? visibleCourses : courses;
          // If showing manual attendance and no scheduled classes, show only theory courses
          if (showGiveAttendance && scheduledCourses.length === 0) {
            coursesToShow = courses.filter(c => !isAutoFull(c.type));
          }
          return coursesToShow;
        })()).map(c => {
          const todayItems = scheduledCourses.find(item => item.courseId === c.id)?.items || [];
          const teachers = getTeachersForCourseOnDate(schedule, c.id, date);
          // If no teachers scheduled, still allow marking with empty teacher (for manual entry)
          const displayTeachers = teachers.length > 0 ? teachers : [''];
          const isAuto = isAutoFull(c.type);

          return (
            <div key={c.id} className="card" style={{
              padding: '14px 18px',
              borderLeft: `4px solid var(--border)`,
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code} — {c.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.type || 'Theory'}</div>
                {todayItems.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {todayItems.map(item => `${item.slot}${item.displayName ? ` — ${item.displayName}` : ''}`).join(' · ')}
                  </div>
                )}
              </div>

              {isAuto ? (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--success)',
                  fontWeight: 600,
                }}>
                  ✓ {c.type} — 100% Attendance (Auto)
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayTeachers.length, 2)}, 1fr)`, gap: 10 }}>
                  {displayTeachers.map(teacher => {
                    const key = `${c.id}_${teacher || ''}`;
                    const status = dayLog[key];
                    return (
                      <div key={teacher || 'unknown'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                          {teacher ? teacher : (todayItems.length === 0 ? '📝 Attendance' : 'Unassigned')}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            { val: 'present', label: '✓ Present', on: '#dcfce7', off: 'var(--inputBg)', textOn: '#166534', textOff: 'var(--muted)', border: '#86efac' },
                            { val: 'absent',  label: '✗ Absent',  on: '#fee2e2', off: 'var(--inputBg)', textOn: '#991b1b', textOff: 'var(--muted)', border: '#fca5a5' },
                            { val: 'holiday', label: '⛔ No Class', on: '#fef9c3', off: 'var(--inputBg)', textOn: '#854d0e', textOff: 'var(--muted)', border: '#fde68a' },
                          ].map(opt => {
                            const active = status === opt.val;
                            return (
                              <button key={opt.val} onClick={() => mark(c.id, teacher, opt.val)} style={{
                                padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 700,
                                fontSize: 12, fontFamily: 'Sora, sans-serif',
                                background: active ? opt.on : opt.off,
                                color: active ? opt.textOn : opt.textOff,
                                border: `2px solid ${active ? opt.border : 'var(--border)'}`,
                                transition: 'all 0.15s',
                                flex: 1,
                                minWidth: 0,
                              }}>{opt.label}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 10, fontSize: 13, color: 'var(--muted)' }}>
        💡 Tip: Back button jumps to previous class dates. All changes auto-save.
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
function Summary({ courses, logs, schedule }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {courses.map(c => {
        const isAuto = isAutoFull(c.type);

        // If session/lab, show 100%
        if (isAuto) {
          return (
            <div key={c.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code} — {c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Y{c.year} T{c.term} · {c.credits}cr · {c.type}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Marks</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>10/10</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Attendance</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--success)', letterSpacing: '-0.03em' }}>100%</div>
                  </div>
                </div>
              </div>
              <div className="alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>
                ✓ {c.type} — 100% Attendance (Automatic)
              </div>
            </div>
          );
        }

        // Theory: calculate per-teacher attendance
        const teachers = useMemo(() => {
          const set = new Set();
          (schedule || []).forEach(item => {
            if (item.courseId === c.id && item.teacherName) set.add(item.teacherName);
          });
          return [...set];
        }, [c.id, schedule]);

        const stats = {};
        teachers.forEach(teacher => {
          stats[teacher] = getEffective(c.id, teacher, logs, c.type);
        });

        // Aggregate: total held, total attended across all teachers
        let totalHeld = 0, totalAttended = 0;
        Object.values(stats).forEach(s => {
          totalHeld += s.held;
          totalAttended += s.attended;
        });

        const pct = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
        const attMarks = pct !== null ? getAttendanceMarks(pct) : null;
        const need75 = totalHeld ? Math.max(0, Math.ceil(totalHeld * 0.75) - totalAttended) : null;
        const canMiss = totalHeld && pct >= 60 ? Math.max(0, totalAttended - Math.ceil(totalHeld * 0.60)) : null;

        return (
          <div key={c.id} className="card" style={{ padding: 18 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code} — {c.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Y{c.year} T{c.term} · {c.credits}cr
                  {totalHeld > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>● from daily log</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {attMarks !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Marks</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{attMarks}/10</div>
                  </div>
                )}
                {pct !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Attendance</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: attColor(pct), letterSpacing: '-0.03em' }}>{pct}%</div>
                  </div>
                )}
              </div>
            </div>

            {/* Teachers breakdown */}
            {teachers.length > 0 && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Per Teacher:</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(teachers.length, 2)}, 1fr)`, gap: 8 }}>
                  {teachers.map(teacher => {
                    const s = stats[teacher];
                    const tp = s.held > 0 ? Math.round((s.attended / s.held) * 100) : 0;
                    return (
                      <div key={teacher} style={{ padding: '8px', background: 'var(--inputBg)', borderRadius: 6, fontSize: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{teacher}</div>
                        <div style={{ color: 'var(--muted)' }}>{s.attended}/{s.held} ({tp}%)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {pct !== null && (
              <div style={{ marginBottom: 10 }}>
                <div className="progress-bar" style={{ height: 10 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: attColor(pct) }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                  <span>{totalAttended}/{totalHeld} classes</span>
                  {pct < 75 && need75 > 0 && <span style={{ color: 'var(--warning)' }}>Need {need75} more for 75%</span>}
                  {pct >= 75 && canMiss !== null && <span style={{ color: 'var(--success)' }}>Can miss {canMiss} more (stay ≥60%)</span>}
                </div>
              </div>
            )}

            {/* Status badge */}
            {pct !== null && (
              <div>
                {pct < MIN_ATTENDANCE_PERCENT
                  ? <div className="alert-critical" style={{ padding: '8px 12px', fontSize: 13 }}>🔴 Below 60% — Course will be CANCELLED (Art. 11.3)</div>
                  : pct < SCHOLARSHIP_ATTENDANCE_PCT
                  ? <div className="alert-warning" style={{ padding: '8px 12px', fontSize: 13 }}>⚠ Below 75% — Not eligible for scholarship (Art. 14.2)</div>
                  : <div className="alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>✓ Good attendance</div>
                }
              </div>
            )}

            {totalHeld === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px' }}>
                No daily log entries yet. Start marking attendance in the Daily Log tab.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Attendance() {
  const profile = getProfile();
  const courses = getAllCourses(profile).filter(c => c.status === 'active' || c.status === 'backlog');
  const [logs, setLogs] = useState(() => store.get('attLogs') || {});
  const [tab, setTab] = useState('daily');
  const schedule = useMemo(() => store.get('schedule') || [], []);

  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaySchedule = schedule.filter(s => s.day === todayDayName && courses.some(c => c.id === s.courseId));

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 20 }}>
        <h1>Attendance</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Mark only the classes scheduled for that date — past dates always editable
        </p>
      </div>

      {todaySchedule.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Today from Schedule</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {todaySchedule.slice().sort((a, b) => a.slot.localeCompare(b.slot)).map(item => {
              const course = courses.find(c => c.id === item.courseId);
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.slot}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.displayName || `${course?.code} — ${course?.name}`}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
                    {item.teacherName && <div>{item.teacherName}</div>}
                    {item.room && <div>Room {item.room}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {todaySchedule.length === 0 && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
          No class today.
        </div>
      )}

      <div className="tabs">
        {[['daily', '📅 Daily Log'], ['summary', '📊 Summary & Stats']].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'daily'
        ? <DailyLog courses={courses} logs={logs} setLogs={setLogs} schedule={schedule} />
        : <Summary courses={courses} logs={logs} schedule={schedule} />
      }

      {/* Slab reference */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Attendance → Marks Slab (Art. 14.2)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['≥90%', '10/10', 'var(--success)'], ['85–90%', '9/10', ''], ['80–85%', '8/10', ''], ['75–80%', '7/10', ''],
            ['70–75%', '6/10', ''], ['65–70%', '5/10', ''], ['60–65%', '4/10', 'var(--warning)'], ['<60%', 'CANCELLED', 'var(--danger)']
          ].map(([range, marks, col]) => (
            <div key={range} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--inputBg)', borderRadius: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: col || 'var(--text)' }}>{marks}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{range}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          * The 10% covers class participation, attendance & assignments (Art. 14.1.i)
        </div>
      </div>
    </div>
  );
}
