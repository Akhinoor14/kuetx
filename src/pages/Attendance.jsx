import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { store, getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, getAllCourses, getProfile, getRoutinePreviewDate, isRoutineHoliday } from '../store/store';
import CourseTeacherDialog from '../components/CourseTeacherDialog';

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

const normalizeTeacherName = (value) => {
  return String(value || '').trim().replace(/\s{2,}/g, ' ');
};

function getTeachersForCourse(settings, schedule, courseId) {
  const mapped = Array.isArray(settings?.courseTeacherMap?.[courseId])
    ? settings.courseTeacherMap[courseId].map(normalizeTeacherName).filter(Boolean)
    : [];
  if (mapped.length > 0) return [...new Set(mapped)];

  const teachers = [...new Set((schedule || [])
    .filter(s => s.courseId === courseId)
    .flatMap(s => Array.isArray(s.teacherNames) && s.teacherNames.length > 0 ? s.teacherNames : [s.teacherName])
    .map(normalizeTeacherName)
    .filter(Boolean))];
  return teachers;
}

function getDisplayCourseName(course) {
  const raw = course?.name || '';
  const cleaned = raw
    .replace(/^\s*[A-Z]{2,6}\s*\d{3,4}\s*[-—:]\s*/i, '')
    .replace(/\b[A-Z]{2,6}\s*\d{3,4}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || raw;
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
function DailyLog({ courses, logs, setLogs, schedule, scheduleSettings, combinedMode }) {
  const [date, setDate] = useState(todayStr());
  const [showGiveAttendance, setShowGiveAttendance] = useState(false);
  const [isCompact, setIsCompact] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const dayLog = logs[date] || {};
  const isToday = date === todayStr();
  const dayName = new Date(date + 'T00:00:00').getDay();
  const isFriday = dayName === 5;
  const isHolidayDate = isRoutineHoliday(date, scheduleSettings?.holidayDates || []);
  const isTodayHoliday = isToday && isHolidayDate;

  // Responsiveness: compact labels on small screens
  useEffect(() => {
    function onResize() { setIsCompact(window.innerWidth < 640); }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-mark 'no-class' for dates with no scheduled courses (simple, persistent)
  useEffect(() => {
    if (!date) return;
    if (isToday) return; // don't auto-mark today
    if (isTodayHoliday) return;
    if (showGiveAttendance) return;
    if ((scheduledCourses || []).length > 0) return;

    const updated = { ...logs };
    if (!updated[date]) updated[date] = {};
    let changed = false;
    courses.filter(c => !isAutoFull(c.type)).forEach(c => {
      const teachers = getTeachersForCourse(scheduleSettings, schedule, c.id);
      const displayTeachers = teachers.length > 0 ? teachers : [''];
      displayTeachers.forEach(t => {
        const key = `${c.id}_${t || ''}`;
        if (!updated[date][key]) {
          updated[date][key] = 'no-class';
          changed = true;
        }
      });
    });
    if (changed) {
      setLogs(updated);
      store.set('attLogs', updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, schedule, scheduleSettings, showGiveAttendance, isToday, isTodayHoliday]);

  function holidayLabel(d) {
    const labels = scheduleSettings?.holidayLabels || {};
    const types = scheduleSettings?.holidayTypes || {};
    if (labels[d]) return labels[d];
    if (types[d] === 'eid') return "Eid Mubarak";
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow === 5) return "Jumu'ah Mubarak";
    return 'Happy Holiday';
  }
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
    // Jump to the previous eligible date, skipping Friday/Saturday.
    if (allPastDates.length === 0) return;

    const idx = allPastDates.indexOf(date);
    if (idx === -1) {
      setDate(allPastDates[0]);
      return;
    }

    if (idx < allPastDates.length - 1) {
      setDate(allPastDates[idx + 1]);
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

  const handleTeacherSave = (teachers) => {
    if (!selectedCard) return;
    const { courseId } = selectedCard;
    const updated = { ...scheduleSettings };
    if (!updated.courseTeacherMap) updated.courseTeacherMap = {};
    updated.courseTeacherMap[courseId] = teachers;
    store.set('scheduleSettings', updated);
    window.dispatchEvent(new Event('kuetx:store-updated'));
    setTeacherDialogOpen(false);
    setSelectedCard(null);
  };

  const markedTeachers = useMemo(() => {
    let total = 0, marked = 0;
    let coursesToCount = visibleCourses.length > 0 ? visibleCourses.filter(c => !isAutoFull(c.type)) : [];
    if (showGiveAttendance && !isToday && scheduledCourses.length === 0) {
      coursesToCount = courses.filter(c => !isAutoFull(c.type));
    }
    if (isTodayHoliday) return { marked: 0, total: 0 };
    coursesToCount.forEach(c => {
      // Use date-specific teachers for scheduled dates, all teachers for manual marking
      const teachers = scheduledCourses.length > 0 
        ? getTeachersForCourseOnDate(scheduleSettings, schedule, c.id, date)
        : getTeachersForCourse(scheduleSettings, schedule, c.id);
      const displayTeachers = teachers.length > 0 ? teachers : [''];
      displayTeachers.forEach(t => {
        total++;
        const key = `${c.id}_${t || ''}`;
        if (dayLog[key] === 'present' || dayLog[key] === 'absent') marked++;
      });
    });
    return { marked, total };
  }, [visibleCourses, dayLog, date, schedule, courses, showGiveAttendance, scheduledCourses.length, isTodayHoliday, scheduleSettings]);

  const cardsToShow = useMemo(() => {
    let coursesToShow = visibleCourses.length > 0 ? visibleCourses.filter(c => !isAutoFull(c.type)) : [];
    if (showGiveAttendance && !isToday && scheduledCourses.length === 0) {
      coursesToShow = courses.filter(c => !isAutoFull(c.type));
    }
    if (isTodayHoliday) return [];

    const cards = [];
    coursesToShow.forEach(course => {
      // Use date-specific teachers if there are scheduled entries for this date
      // Otherwise use all teachers for the course (for manual attendance marking)
      const teachers = scheduledCourses.length > 0 
        ? getTeachersForCourseOnDate(scheduleSettings, schedule, course.id, date)
        : getTeachersForCourse(scheduleSettings, schedule, course.id);
      const displayTeachers = teachers.length > 0 ? teachers : [''];
      displayTeachers.forEach(teacher => {
        const key = `${course.id}_${teacher || ''}`;
        const status = dayLog[key];
        cards.push({ course, teacher, key, status });
      });
    });

    return cards.sort((a, b) => {
      const aDone = (a.status === 'present' || a.status === 'absent');
      const bDone = (b.status === 'present' || b.status === 'absent');
      if (aDone !== bDone) return aDone ? 1 : -1;
      const byCourse = (a.course.name || '').localeCompare(b.course.name || '');
      if (byCourse !== 0) return byCourse;
      return (a.teacher || '').localeCompare(b.teacher || '');
    });
  }, [visibleCourses, courses, schedule, dayLog, showGiveAttendance, scheduledCourses.length, isTodayHoliday, date]);

  if (combinedMode) {
    return (
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Daily Log disabled</div>
        <div style={{ color: 'var(--muted)', marginTop: 6 }}>Combined Input is ON — use Summary to enter attendance.</div>
      </div>
    );
  }

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
      </div>

      {isFriday && !isTodayHoliday && (
        <div className="alert-warning mb-3" style={{ fontSize: 13 }}>
          🕌 Friday — Jumu'ah day. Remember to check which classes are held.
        </div>
      )}

      {courses.length === 0 && (
        <div className="empty-state"><div className="icon">📚</div><p>Add courses first.</p></div>
      )}

      {isTodayHoliday && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 16px', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
          🎉 {holidayLabel(date)}
        </div>
      )}

      {courses.length > 0 && scheduledCourses.length === 0 && !isToday && !isTodayHoliday && (
        <div style={{ marginBottom: 16, padding: '12px 14px', backgroundColor: 'rgba(251, 191, 36, 0.08)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>📅 No scheduled classes on this date</span>
          <button onClick={() => setShowGiveAttendance(!showGiveAttendance)} style={{
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
            fontSize: 12, background: 'var(--accent)', color: 'white', border: 'none', whiteSpace: 'nowrap'
          }}>
            {showGiveAttendance ? 'Hide' : 'Give Attendance'}
          </button>
        </div>
      )}
      {courses.length > 0 && scheduledCourses.length === 0 && isToday && !isTodayHoliday && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: 'rgba(147,197,253,0.14)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
          Today has no scheduled classes, so manual attendance is disabled for the current day.
        </div>
      )}

      {scheduledCourses.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>📋 Scheduled for this date ({scheduledCourses.length} course{scheduledCourses.length > 1 ? 's' : ''})</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {scheduledCourses.sort((a, b) => {
              const slotA = a.items?.[0]?.slot || '';
              const slotB = b.items?.[0]?.slot || '';
              return slotA.localeCompare(slotB);
            }).map(item => {
              const course = courses.find(c => c.id === item.courseId);
              const slots = item.items.map(i => i.slot).join(', ');
              const teachers = [...new Set(item.items.map(i => i.teacherName).filter(Boolean))].join(', ');
              return (
                <div key={item.courseId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: 'var(--inputBg)', borderRadius: 6, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{getDisplayCourseName(course)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{slots}{teachers && ` • ${teachers}`}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>✓ Mark</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {cardsToShow.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontWeight: 700, color: '#10b981' }}>P</span> = Present</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontWeight: 700, color: '#ef4444' }}>A</span> = Absent</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontWeight: 700, color: 'var(--muted)' }}>—</span> = Not marked</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', width: '100%', textAlign: 'center' }}>
            Holiday days are managed separately in the holiday calendar, not per course.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cardsToShow.length === 0 ? (
          <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>📋 No classes to mark</div>
            <div style={{ fontSize: 12 }}>Select a date with scheduled classes or enable "Give Attendance"</div>
          </div>
        ) : (() => {
          // Soft background colors - subtle pastel palette using only purple, green, blue
          const softColors = [
            'rgba(168, 85, 247, 0.08)',  // light purple
            'rgba(34, 197, 94, 0.08)',   // light green
            'rgba(59, 130, 246, 0.08)',  // light blue
          ];
          const courseColorMap = {};
          let colorIndex = 0;
          cardsToShow.forEach(card => {
            if (!courseColorMap[card.course.id]) {
              courseColorMap[card.course.id] = softColors[colorIndex % softColors.length];
              colorIndex++;
            }
          });

          return cardsToShow.map(card => {
            const todayItems = scheduledCourses.find(item => item.courseId === card.course.id)?.items || [];
            const statusColors = { present: '#10b981', absent: '#ef4444' };
            const statusLabels = { present: 'Present', absent: 'Absent' };
            const bgColor = courseColorMap[card.course.id];
            
            // Check if teacher is assigned
            const assignedTeachers = getTeachersForCourse(scheduleSettings, schedule, card.course.id);
            const hasTeacher = assignedTeachers && assignedTeachers.length > 0;
            const isMarked = card.status === 'present' || card.status === 'absent';
            const canMark = hasTeacher || isMarked;

            return (
              <div key={card.key || card.course.id} style={{
                padding: '14px 16px',
                borderRadius: 8,
                background: !canMark ? 'rgba(239, 68, 68, 0.08)' : bgColor,
                border: !canMark ? '2px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(15, 23, 42, 0.08)',
                transition: 'all 0.2s ease',
              }}>
                {/* Course Info */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {getDisplayCourseName(card.course)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {card.teacher && (
                      <div style={{ fontSize: 12, color: hasTeacher ? 'var(--muted)' : '#ef4444', fontWeight: 500 }}>
                        {card.teacher}
                      </div>
                    )}
                    {!hasTeacher && !card.teacher && (
                      <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                        ⚠ No teacher assigned
                      </div>
                    )}
                    {card.course.type && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.7 }}>
                        {card.course.type}
                      </div>
                    )}
                    {todayItems.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, padding: '1px 6px', background: 'rgba(var(--accentRGB), 0.12)', borderRadius: 3 }}>
                        {todayItems.map(item => item.slot).join(' → ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Display */}
                {card.status && (
                  <div style={{ marginBottom: 10, padding: '6px 10px', background: `${statusColors[card.status] || 'var(--inputBg)'}20`, borderRadius: 5, fontSize: 11, fontWeight: 600, color: statusColors[card.status] || 'var(--muted)' }}>
                    ✓ {statusLabels[card.status] || 'Marked'}
                  </div>
                )}

                {/* Teacher Required Warning */}
                {!canMark && (
                  <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: 6, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                    ⚠ Teacher assignment required before marking attendance
                  </div>
                )}

                {/* Action Buttons - Responsive */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {canMark ? (
                    [
                      { val: 'present', shortLabel: 'P', fullLabel: 'Present', emoji: '✓', color: '#10b981' },
                      { val: 'absent',  shortLabel: 'A', fullLabel: 'Absent',  emoji: '✗', color: '#ef4444' },
                    ].map(opt => {
                      const active = card.status === opt.val;
                      const btnLabel = isCompact ? opt.shortLabel : opt.fullLabel;
                      return (
                        <button 
                          key={opt.val} 
                          onClick={() => mark(card.course.id, card.teacher, opt.val)}
                          title={`Mark as ${opt.fullLabel}`}
                          style={{
                            padding: isCompact ? '8px 6px' : '8px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: isCompact ? 11 : 12,
                            background: active ? opt.color : 'var(--inputBg)',
                            color: active ? 'white' : 'var(--muted)',
                            border: active ? `2px solid ${opt.color}` : '1px solid var(--border)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: isCompact ? 0 : 4,
                            minHeight: 32,
                          }}>
                          {isCompact ? btnLabel : `${opt.emoji} ${btnLabel}`}
                        </button>
                      );
                    })
                  ) : (
                    <button 
                      onClick={() => {
                        setSelectedCard({ courseId: card.course.id, course: card.course });
                        setTeacherDialogOpen(true);
                      }}
                      style={{
                        gridColumn: '1 / -1',
                        padding: '10px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 12,
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        minHeight: 40,
                      }}>
                        + Add Teacher
                    </button>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 10, fontSize: 13, color: 'var(--muted)' }}>
        💡 Tip: Back button jumps to previous class dates. All changes auto-save.
      </div>

      {/* Teacher Assignment Dialog */}
      {selectedCard && (
        <CourseTeacherDialog
          isOpen={teacherDialogOpen}
          onClose={() => {
            setTeacherDialogOpen(false);
            setSelectedCard(null);
          }}
          course={selectedCard.course}
          currentTeachers={getTeachersForCourse(scheduleSettings, schedule, selectedCard.courseId)}
          onSave={handleTeacherSave}
        />
      )}
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
function Summary({ courses, logs, schedule, scheduleSettings, combinedMode, combinedData, toggleCombinedMode, updateCombined }) {
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const theoryCourses = (courses || []).filter(c => !isAutoFull(c.type));

  const courseCards = theoryCourses.map(c => {
    const teachers = getTeachersForCourse(scheduleSettings, schedule, c.id);
    const displayTeachers = teachers.length > 0 ? teachers : [''];

    const stats = {};
    displayTeachers.forEach(teacher => {
      if (combinedMode) {
        const key = `${c.id}_${teacher || ''}`;
        const held = Number(combinedData[key]?.held || 0);
        const attended = Number(combinedData[key]?.attended || 0);
        const pct = held > 0 ? Math.round((attended / held) * 100) : null;
        stats[teacher || ''] = { held, attended, percentage: pct, source: 'combined' };
      } else {
        stats[teacher || ''] = getEffective(c.id, teacher, logs, c.type);
      }
    });

    let totalHeld = 0, totalAttended = 0;
    Object.values(stats).forEach(s => {
      totalHeld += s.held;
      totalAttended += s.attended;
    });

    const pct = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
    const attMarks = pct !== null ? getAttendanceMarks(pct) : null;
    const need75 = totalHeld ? Math.max(0, Math.ceil(totalHeld * 0.75) - totalAttended) : null;
    const canMiss = totalHeld && pct >= 60 ? Math.max(0, totalAttended - Math.ceil(totalHeld * 0.60)) : null;
    const completed = displayTeachers.every(teacher => {
      const s = stats[teacher || ''];
      return s.held > 0 || s.attended > 0;
    });

    return { course: c, stats, displayTeachers, totalHeld, totalAttended, pct, attMarks, need75, canMiss, completed };
  }).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.course.name || '').localeCompare(b.course.name || '');
  });

  const handleTeacherSave = (teachers) => {
    if (!selectedCourse) return;
    const updated = { ...scheduleSettings };
    if (!updated.courseTeacherMap) updated.courseTeacherMap = {};
    updated.courseTeacherMap[selectedCourse.id] = teachers;
    store.set('scheduleSettings', updated);
    window.dispatchEvent(new Event('kuetx:store-updated'));
    setTeacherDialogOpen(false);
    setSelectedCourse(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Sessional/Lab cards are hidden here (always 100% auto). Use this for theory attendance overview and manual totals.
        </div>
        <button className="btn btn-ghost" onClick={toggleCombinedMode}>
          {combinedMode ? 'Combined Input: ON' : 'Combined Input: OFF'}
        </button>
      </div>
      {combinedMode && (
        <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>
          Enter per-teacher totals for each course. "Held" = total classes taken, "Attended" = your attended classes. Leave empty when no class was held; holidays are managed in the holiday setup.
        </div>
      )}

      {(() => {
        // Soft background colors - subtle pastel shades
        const softColors = [
          'rgba(168, 85, 247, 0.08)',  // light purple
          'rgba(34, 197, 94, 0.08)',   // light green
          'rgba(59, 130, 246, 0.08)',  // light blue
          'rgba(249, 115, 22, 0.08)',  // light orange
          'rgba(236, 72, 153, 0.08)',  // light pink
          'rgba(20, 184, 166, 0.08)',  // light teal
        ];
        const courseColorMap = {};
        let colorIndex = 0;
        courseCards.forEach(card => {
          if (!courseColorMap[card.course.id]) {
            courseColorMap[card.course.id] = softColors[colorIndex % softColors.length];
            colorIndex++;
          }
        });
        return courseCards.map(({ course: c, stats, displayTeachers, totalHeld, totalAttended, pct, attMarks, need75, canMiss }) => (
        <div key={c.id} className="card" style={{ padding: 18, background: courseColorMap[c.id], border: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code} — {c.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Y{c.year} T{c.term} · {c.credits}cr
                {totalHeld > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>● {combinedMode ? 'from combined input' : 'from daily log'}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {attMarks !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Attendance Marks</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{Math.round(attMarks * 3)}/30</div>
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

          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Per Teacher:</div>
            {displayTeachers.length === 1 && displayTeachers[0] === '' ? (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '2px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 10 }}>
                  ⚠ No teachers assigned to this course
                </div>
                <button 
                  onClick={() => {
                    setSelectedCourse(c);
                    setTeacherDialogOpen(true);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    transition: 'all 0.2s ease',
                  }}>
                  + Add Teacher
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayTeachers.length, 2)}, 1fr)`, gap: 8 }}>
                {displayTeachers.map(teacher => {
                  const s = stats[teacher || ''];
                  const tp = s.held > 0 ? Math.round((s.attended / s.held) * 100) : 0;
                  return (
                    <div key={teacher || 'unknown'} style={{ padding: '8px', background: 'var(--inputBg)', borderRadius: 6, fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{teacher || 'Unassigned'}</div>
                      {combinedMode ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Held</span>
                            <input
                              type="number"
                              min="0"
                              value={s.held}
                              onChange={e => updateCombined(c.id, teacher, 'held', e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Attended</span>
                            <input
                              type="number"
                              min="0"
                              max={s.held}
                              value={s.attended}
                              onChange={e => updateCombined(c.id, teacher, 'attended', e.target.value)}
                              placeholder="0"
                              style={{ fontSize: 12 }}
                            />
                          </label>
                        </div>
                      ) : null}
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: combinedMode ? 8 : 0, padding: combinedMode ? '8px' : 0, background: combinedMode ? 'rgba(0,0,0,0.02)' : 'transparent', borderRadius: 4 }}>
                        <div style={{ fontWeight: 600 }}>{s.attended}/{s.held}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{tp}% attended</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
              {combinedMode
                ? 'No combined input yet. Fill held/attended for each teacher above.'
                : 'No daily log entries yet. Start marking attendance in the Daily Log tab.'}
            </div>
          )}
        </div>
        ));
      })()}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Attendance() {
  const profile = getProfile();
  const courses = getAllCourses(profile).filter(c => c.status === 'active' || c.status === 'backlog');
  const [logs, setLogs] = useState(() => store.get('attLogs') || {});
  const [tab, setTab] = useState('daily');
  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [scheduleSettings, setScheduleSettings] = useState(() => store.get('scheduleSettings') || {});
  const todayDate = todayStr();
  const todayDayName = new Date(`${todayDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const isTodayHoliday = isRoutineHoliday(todayDate, scheduleSettings.holidayDates || []);

  const [combinedMode, setCombinedMode] = useState(() => store.get('attCombinedMode') || false);
  const [combinedData, setCombinedData] = useState(() => store.get('attCombinedData') || {});

  const [holidaySetupOpen, setHolidaySetupOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayMode, setHolidayMode] = useState('calendar');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarSelectedDates, setCalendarSelectedDates] = useState(new Set());

  useEffect(() => {
    const refresh = () => {
      setLogs(store.get('attLogs') || {});
      setSchedule(store.get('schedule') || []);
      setScheduleSettings(store.get('scheduleSettings') || {});
      setCombinedMode(!!store.get('attCombinedMode'));
      setCombinedData(store.get('attCombinedData') || {});
    };

    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);

  const toggleCombinedMode = () => {
    const next = !combinedMode;
    setCombinedMode(next);
    store.set('attCombinedMode', next);
  };

  const updateCombined = (courseId, teacher, field, value) => {
    const key = `${courseId}_${teacher || ''}`;
    const safe = Math.max(0, Number(value) || 0);
    const next = {
      ...combinedData,
      [key]: {
        held: Number(combinedData[key]?.held || 0),
        attended: Number(combinedData[key]?.attended || 0),
        [field]: safe,
      },
    };
    if (next[key].attended > next[key].held) next[key].attended = next[key].held;
    setCombinedData(next);
    store.set('attCombinedData', next);
  };

  const holidayDates = scheduleSettings?.holidayDates || [];

  const theoryCourses = courses.filter(c => !isAutoFull(c.type));
  const heroCourseStats = theoryCourses.map(c => {
    const teachers = getTeachersForCourse(scheduleSettings, schedule, c.id);
    const displayTeachers = teachers.length > 0 ? teachers : [''];
    const stats = displayTeachers.map(teacher => getEffective(c.id, teacher, logs, c.type));
    const totalHeld = stats.reduce((sum, s) => sum + s.held, 0);
    const totalAttended = stats.reduce((sum, s) => sum + s.attended, 0);
    const pct = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
    const status = pct === null ? 'neutral' : pct >= 75 ? 'safe' : pct >= 60 ? 'warning' : 'danger';
    return { course: c, totalHeld, totalAttended, pct, status };
  });

  const closeHolidaySetup = () => {
    setHolidaySetupOpen(false);
    setHolidayDate('');
    setHolidayMode('calendar');
    setCalendarSelectedDates(new Set());
  };

  const openHolidaySetup = () => {
    setHolidaySetupOpen(true);
  };

  const saveHolidayDates = (nextDates) => {
    store.set('scheduleSettings', { ...scheduleSettings, holidayDates: [...new Set(nextDates)].sort() });
    setScheduleSettings(prev => ({ ...prev, holidayDates: [...new Set(nextDates)].sort() }));
  };

  const addHolidayDate = () => {
    if (!holidayDate) return;
    saveHolidayDates([...holidayDates, holidayDate]);
    setHolidayDate('');
  };

  const removeHolidayDate = (value) => {
    saveHolidayDates(holidayDates.filter(date => date !== value));
  };

  const toggleCalendarDate = (dateStr) => {
    const newSet = new Set(calendarSelectedDates);
    if (newSet.has(dateStr)) {
      newSet.delete(dateStr);
    } else {
      newSet.add(dateStr);
    }
    setCalendarSelectedDates(newSet);
  };

  const addCalendarSelectedDates = () => {
    if (calendarSelectedDates.size === 0) {
      alert('Please select at least one date from the calendar.');
      return;
    }
    saveHolidayDates([...holidayDates, ...Array.from(calendarSelectedDates)]);
    setCalendarSelectedDates(new Set());
  };

  const monthName = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const nextMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    setCalendarMonth(`${nextYear}-${String(next).padStart(2, '0')}`);
  };

  const prevMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const prev = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    setCalendarMonth(`${prevYear}-${String(prev).padStart(2, '0')}`);
  };

  const renderCalendar = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const weeks = [];
    let week = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      week.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      week.push({ day, dateStr });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    return weeks;
  };

  const previewDate = getRoutinePreviewDate(scheduleSettings.holidayDates || []);
  const previewDay = new Date(`${previewDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const todaySchedule = schedule.filter(s => s.day === previewDay && courses.some(c => c.id === s.courseId));

  function holidayLabelMain(d) {
    const labels = scheduleSettings?.holidayLabels || {};
    const types = scheduleSettings?.holidayTypes || {};
    if (labels[d]) return labels[d];
    if (types[d] === 'eid') return 'Eid Mubarak';
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow === 5) return "Jumu'ah Mubarak";
    return 'Happy Holiday';
  }

  return (
    <div className="attendance-page page-enter page-container">
      <div className="attendance-hero">
        <div className="attendance-hero-header">
          <div>
            <div className="attendance-hero-kicker">OVERVIEW</div>
            <h1 className="attendance-hero-heading">Attendance Summary</h1>
            <p className="attendance-hero-subtext">THEORY COURSES ONLY</p>
          </div>
          <button className="btn btn-primary attendance-holiday-btn" onClick={openHolidaySetup}>
            <CalendarDays size={14} /> Add Holiday
          </button>
        </div>

        <div className="attendance-summary-grid">
        {heroCourseStats.map(({ course, totalHeld, totalAttended, pct, status }) => (
          <div key={course.id} className={`attendance-summary-card attendance-summary-card--${status}`}>
            <div className="card-course">{course.code || getDisplayCourseName(course)}</div>
            <div className="card-percentage" style={{ color: attColor(pct) }}>{pct !== null ? `${pct}%` : '--'}</div>
            <div className="card-meta">{totalAttended}/{totalHeld || 0}</div>
            {pct !== null && (() => {
              const canMiss = totalHeld > 0
                ? Math.floor((totalAttended - MIN_ATTENDANCE_PERCENT / 100 * (totalHeld)) / (1 - MIN_ATTENDANCE_PERCENT / 100))
                : 0;
              if (pct < MIN_ATTENDANCE_PERCENT) {
                return <div className="card-status card-status-danger">≤60%<br />❌ &#199;&#195;&#162 cancelled</div>;
              }
              if (canMiss <= 0) {
                return <div className="card-status card-status-warning">⚠ No misses left</div>;
              }
              return <div className="card-status card-status-safe">✓ Can miss {canMiss}</div>;
            })()}
            {pct === null && <div className="card-status card-status-neutral">No classes yet</div>}
          </div>
        ))}
      </div>
      </div>
      {todaySchedule.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Routine Preview</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Today · {new Date().toLocaleDateString('en-US', { weekday: 'long' })} · Effective · {previewDay}</div>
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
          {isTodayHoliday ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'center', fontWeight: 700 }}>
              🎉 {holidayLabelMain(todayDate)}
            </div>
          ) : (
            'No class today.'
          )}
        </div>
      )}

      <div className="tabs">
        {[['daily', '📅 Daily Log'], ['summary', '📊 Attendance Overview']].map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'daily'
        ? <DailyLog courses={courses} logs={logs} setLogs={setLogs} schedule={schedule} scheduleSettings={scheduleSettings} combinedMode={combinedMode} />
        : <Summary courses={courses} logs={logs} schedule={schedule} scheduleSettings={scheduleSettings} combinedMode={combinedMode} combinedData={combinedData} toggleCombinedMode={toggleCombinedMode} updateCombined={updateCombined} />
      }

      {/* Slab reference */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Attendance → Marks Slab (Art. 14.2)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
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

      {/* Holiday Setup Modal */}
      {holidaySetupOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 12,
          }}
          onClick={closeHolidaySetup}
        >
          <div
            className="card"
            style={{ width: 650, maxWidth: '100%', padding: 16, background: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Holiday Calendar</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Friday and Saturday are always holidays. Click dates to add.</div>
              </div>
              <button className="btn btn-ghost" onClick={closeHolidaySetup}>Close</button>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <button
                onClick={() => setHolidayMode('calendar')}
                style={{
                  padding: '8px 12px',
                  borderBottom: holidayMode === 'calendar' ? '2px solid var(--accent)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: holidayMode === 'calendar' ? 700 : 400,
                  color: holidayMode === 'calendar' ? 'var(--accent)' : 'var(--text)',
                  fontSize: 13,
                }}
              >
                📅 Calendar Picker
              </button>
              <button
                onClick={() => setHolidayMode('single')}
                style={{
                  padding: '8px 12px',
                  borderBottom: holidayMode === 'single' ? '2px solid var(--accent)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: holidayMode === 'single' ? 700 : 400,
                  color: holidayMode === 'single' ? 'var(--accent)' : 'var(--text)',
                  fontSize: 13,
                }}
              >
                📆 Single Date
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {/* Calendar Mode */}
              {holidayMode === 'calendar' && (
                <div>
                  {/* Month Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button
                      onClick={prevMonth}
                      className="btn btn-ghost"
                      style={{ padding: '8px 12px' }}
                    >
                      ← Previous
                    </button>
                    <div style={{ fontWeight: 700, fontSize: 14, minWidth: 180, textAlign: 'center' }}>
                      {monthName(calendarMonth)}
                    </div>
                    <button
                      onClick={nextMonth}
                      className="btn btn-ghost"
                      style={{ padding: '8px 12px' }}
                    >
                      Next →
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div style={{ marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <th
                              key={day}
                              style={{
                                padding: '8px 4px',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                color: 'var(--muted)',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {renderCalendar(calendarMonth).map((week, weekIdx) => (
                          <tr key={weekIdx}>
                            {week.map((dayData, dayIdx) => {
                              const isSelected = dayData && calendarSelectedDates.has(dayData.dateStr);
                              const isInHolidays = dayData && holidayDates.includes(dayData.dateStr);
                              const isFridayOrSaturday = [5, 6].includes(dayData?.dateStr ? new Date(`${dayData.dateStr}T00:00:00`).getDay() : -1);

                              return (
                                <td
                                  key={dayIdx}
                                  style={{
                                    padding: '6px 4px',
                                    textAlign: 'center',
                                    height: 50,
                                    borderBottom: '1px solid var(--border)',
                                    borderRight: dayIdx < 6 ? '1px solid var(--border)' : 'none',
                                  }}
                                >
                                  {dayData ? (
                                    <button
                                      onClick={() => toggleCalendarDate(dayData.dateStr)}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        border: isSelected ? '2px solid var(--accent)' : isInHolidays ? '2px solid rgba(34,197,94,0.5)' : '1px solid transparent',
                                        background: isSelected
                                          ? 'rgba(59,130,246,0.15)'
                                          : isInHolidays
                                          ? 'rgba(34,197,94,0.1)'
                                          : isFridayOrSaturday
                                          ? 'rgba(239,68,68,0.08)'
                                          : 'transparent',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        fontWeight: isSelected || isInHolidays ? 700 : 400,
                                        fontSize: 13,
                                        color: isFridayOrSaturday ? 'rgba(239,68,68,0.8)' : 'var(--text)',
                                        transition: 'all 0.15s ease',
                                      }}
                                      title={isFridayOrSaturday ? 'Always holiday' : isInHolidays ? 'Already added' : 'Click to select'}
                                    >
                                      {dayData.day}
                                    </button>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected Count and Add Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(59,130,246,0.05)', marginBottom: 12 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>{calendarSelectedDates.size}</span>
                      <span style={{ color: 'var(--muted)' }}> date{calendarSelectedDates.size !== 1 ? 's' : ''} selected</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={addCalendarSelectedDates}
                      disabled={calendarSelectedDates.size === 0}
                    >
                      <CalendarDays size={13} /> Add to Holidays
                    </button>
                  </div>

                  {/* Legend */}
                  <div style={{ fontSize: 11, color: 'var(--muted)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(59,130,246,0.15)', border: '2px solid var(--accent)' }} />
                      <span>Selected</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.5)' }} />
                      <span>Already added</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.8)' }}>F</div>
                      <span>Fri/Sat</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Single Date Mode */}
              {holidayMode === 'single' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Add one holiday date at a time:</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={e => setHolidayDate(e.target.value)}
                      style={{ minWidth: 170, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button className="btn btn-primary" onClick={addHolidayDate} disabled={!holidayDate}>
                      <CalendarDays size={13} /> Add Holiday
                    </button>
                  </div>
                </div>
              )}

              {/* Holiday List */}
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  Saved Holidays ({holidayDates.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {holidayDates.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>No extra holidays added yet.</div>
                  ) : (
                    holidayDates.map(date => (
                      <span key={date} className="tag tag-gray" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {date}
                        <button onClick={() => removeHolidayDate(date)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
