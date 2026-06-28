import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Modal from '../components/Modal';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, TrendingUp, Users, BookOpen, Award, CalendarDays, X } from 'lucide-react';
import {
  store, getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT,
  getProfile, getRoutinePreviewDate, isRoutineHoliday, periodToTime
} from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import CourseTeacherDialog from '../components/CourseTeacherDialog';

// ── Utils ──────────────────────────────────────────────────────────────────
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const addDays = (d, n) => {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
};
const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long' });

// ── Slab System ────────────────────────────────────────────────────────────
const ATT_SLABS = [
  { minPct: 90, label: '≥90%',   perTeacher: 15,   fullCourse: 30 },
  { minPct: 85, label: '85–89%', perTeacher: 13.5, fullCourse: 27 },
  { minPct: 80, label: '80–84%', perTeacher: 12,   fullCourse: 24 },
  { minPct: 75, label: '75–79%', perTeacher: 10.5, fullCourse: 21 },
  { minPct: 70, label: '70–74%', perTeacher: 9,    fullCourse: 18 },
  { minPct: 65, label: '65–69%', perTeacher: 7.5,  fullCourse: 15 },
  { minPct: 60, label: '60–64%', perTeacher: 6,    fullCourse: 12 },
  { minPct: 0,  label: '<60%',   perTeacher: 0,    fullCourse: 0  },
];

function getPerTeacherMarks(pct) {
  if (pct === null || pct === undefined) return null;
  const base = getAttendanceMarks(pct);
  return Math.round((base / 10) * 15 * 10) / 10;
}
function getFullCourseMarks(pct) {
  const pt = getPerTeacherMarks(pct);
  return pt !== null ? Math.round(pt * 2 * 10) / 10 : null;
}
function getCurrentSlab(pct) {
  if (pct === null || pct === undefined) return null;
  return ATT_SLABS.find(s => pct >= s.minPct) || ATT_SLABS[ATT_SLABS.length - 1];
}
function classesUntilDrop(attended, held, pct) {
  const slab = getCurrentSlab(pct);
  if (!slab || slab.minPct === 0) return null;
  const max = Math.floor((attended * 100 / slab.minPct) - held);
  return Math.max(0, max);
}
function classesNeededForNextSlab(attended, held, pct) {
  const idx = ATT_SLABS.findIndex(s => pct >= s.minPct);
  if (idx <= 0) return null;
  const boundary = ATT_SLABS[idx - 1].minPct;
  const needed = Math.ceil((held * boundary - attended * 100) / (100 - boundary));
  return Math.max(0, needed);
}
function isAutoFull(courseType) {
  return courseType && (courseType.toLowerCase().includes('session') || courseType.toLowerCase().includes('lab'));
}
function getTeachersForCourse(settings, schedule, courseId) {
  const norm = v => String(v || '').trim().replace(/\s{2,}/g, ' ');
  const mapped = Array.isArray(settings?.courseTeacherMap?.[courseId])
    ? settings.courseTeacherMap[courseId].map(norm).filter(Boolean)
    : [];
  if (mapped.length > 0) return [...new Set(mapped)];
  return [...new Set(
    (schedule || [])
      .filter(s => s.courseId === courseId)
      .flatMap(s => Array.isArray(s.teacherNames) && s.teacherNames.length ? s.teacherNames : [s.teacherName])
      .map(norm)
      .filter(Boolean)
  )];
}
function getTeachersForCourseOnDate(schedule, courseId, date) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  return [...new Set(
    (schedule || [])
      .filter(s => s.courseId === courseId && s.day === dayName)
      .map(s => s.teacherName).filter(Boolean)
  )];
}
function getDisplayCourseName(course) {
  if (!course) return '';
  return (course.name || '')
    .replace(/^\s*[A-Z]{2,6}\s*\d{3,4}\s*[-—:]\s*/i, '')
    .replace(/\b[A-Z]{2,6}\s*\d{3,4}\b/g, '')
    .replace(/\s{2,}/g, ' ').trim() || course.name || '';
}
function getEffective(courseId, teacherName, logs) {
  const key = `${courseId}_${teacherName || ''}`;
  let held = 0, attended = 0;
  Object.values(logs).forEach(day => {
    const v = day[key];
    if (v === 'present' || v === 'absent') { held++; if (v === 'present') attended++; }
  });
  return { held, attended, percentage: held > 0 ? Math.round((attended / held) * 100) : null };
}
function attColor(pct) {
  if (pct === null || pct === undefined) return 'var(--muted)';
  if (pct < MIN_ATTENDANCE_PERCENT) return 'var(--danger)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return 'var(--warning)';
  return 'var(--success)';
}
function attBg(pct, dark) {
  if (pct === null) return dark ? 'rgba(255,255,255,0.03)' : 'var(--inputBg)';
  if (pct < MIN_ATTENDANCE_PERCENT) return dark ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.05)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return dark ? 'rgba(217,119,6,0.10)' : 'rgba(217,119,6,0.05)';
  return dark ? 'rgba(22,163,74,0.10)' : 'rgba(22,163,74,0.05)';
}
function attBorder(pct, dark) {
  if (pct === null) return 'var(--border)';
  if (pct < MIN_ATTENDANCE_PERCENT) return dark ? 'rgba(220,38,38,0.30)' : 'rgba(220,38,38,0.18)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return dark ? 'rgba(217,119,6,0.30)' : 'rgba(217,119,6,0.18)';
  return dark ? 'rgba(22,163,74,0.30)' : 'rgba(22,163,74,0.18)';
}
// Prefer recomputing the time from period + current model (so switching the
// 40min/50min model updates display instantly); fall back to the legacy slot string.
function getEntryTime(entry, modelId) {
  if (entry?.period !== undefined && entry.period !== 'unknown') {
    const time = periodToTime(entry.period, modelId);
    if (time) return time;
  }
  return entry?.slot || entry?._legacySlot || '';
}
const periodSortValue = (period) => {
  if (period === undefined || period === 'unknown') return 999;
  const s = String(period);
  return s.startsWith('L') ? 100 + Number(s.slice(1)) : Number(s);
};
function getScheduleCoursesForDate(schedule, date, modelId) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const byCourse = new Map();
  (schedule || []).filter(s => s.day === dayName).forEach(s => {
    if (!byCourse.has(s.courseId)) byCourse.set(s.courseId, []);
    byCourse.get(s.courseId).push(s);
  });
  return [...byCourse.entries()].map(([courseId, items]) => ({
    courseId, items: items.slice().sort((a, b) => periodSortValue(a.period) - periodSortValue(b.period)).map(item => ({ ...item, slot: getEntryTime(item, modelId) })),
  }));
}

// ── Priority hint — ONE per card ───────────────────────────────────────────
function getHint(pct, canMiss, needNext) {
  if (pct === null) return null;
  if (pct < MIN_ATTENDANCE_PERCENT) return { type: 'danger', text: 'At risk — below 60%' };
  if (canMiss === 0) return { type: 'warn', text: 'No absences left' };
  if (canMiss !== null && canMiss <= 2) return { type: 'warn', text: `${canMiss} miss${canMiss !== 1 ? 'es' : ''} → drops` };
  if (needNext !== null && needNext > 0) return { type: 'info', text: `${needNext} more → ↑ grade` };
  if (pct >= 90) return { type: 'good', text: 'Top slab ✓' };
  if (canMiss !== null && canMiss > 2) return { type: 'muted', text: `Miss up to ${canMiss}` };
  return null;
}

const PALETTE_L = [
  { bg: '#eef6ee', bd: '#b8dab8' }, { bg: '#eef3fb', bd: '#b5cff5' },
  { bg: '#f5eefb', bd: '#d4b5f5' }, { bg: '#fef6ee', bd: '#f5ceaa' },
  { bg: '#eefbf8', bd: '#a8e0d4' }, { bg: '#fceef3', bd: '#f0b5cb' },
  { bg: '#f7fbee', bd: '#c8dfaa' }, { bg: '#eef0fb', bd: '#b0b8f0' },
];
const PALETTE_D = [
  { bg: 'rgba(34,197,94,0.09)',   bd: 'rgba(34,197,94,0.25)'  },
  { bg: 'rgba(59,130,246,0.09)',  bd: 'rgba(59,130,246,0.25)' },
  { bg: 'rgba(168,85,247,0.09)', bd: 'rgba(168,85,247,0.25)' },
  { bg: 'rgba(251,146,60,0.09)', bd: 'rgba(251,146,60,0.25)' },
  { bg: 'rgba(20,184,166,0.09)', bd: 'rgba(20,184,166,0.25)' },
  { bg: 'rgba(244,114,182,0.09)',bd: 'rgba(244,114,182,0.25)'},
  { bg: 'rgba(163,230,53,0.09)', bd: 'rgba(163,230,53,0.25)' },
  { bg: 'rgba(99,102,241,0.09)', bd: 'rgba(99,102,241,0.25)' },
];

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Holiday Setup Modal ────────────────────────────────────────────────────
function HolidayModal({ isOpen, onClose, scheduleSettings, onSave }) {
  const [mode, setMode] = useState('calendar');
  const [singleDate, setSingleDate] = useState('');
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selected, setSelected] = useState(new Set());
  const dark = useDark();

  const holidayDates = useMemo(() => scheduleSettings?.holidayDates || [], [scheduleSettings]);

  const save = (dates) => {
    const next = [...new Set(dates)].filter(Boolean).sort();
    onSave({ ...scheduleSettings, holidayDates: next });
  };
  const addSingle = () => {
    if (!singleDate) return;
    save([...holidayDates, singleDate]);
    setSingleDate('');
  };
  const removeSingle = (d) => save(holidayDates.filter(x => x !== d));
  const toggleCal = (d) => {
    const s = new Set(selected);
    s.has(d) ? s.delete(d) : s.add(d);
    setSelected(s);
  };
  const addSelected = () => {
    if (!selected.size) return;
    save([...holidayDates, ...Array.from(selected)]);
    setSelected(new Set());
  };

  const monthName = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  const prevMonth = () => {
    const [y, mo] = calMonth.split('-').map(Number);
    const p = mo === 1 ? { y: y - 1, m: 12 } : { y, m: mo - 1 };
    setCalMonth(`${p.y}-${String(p.m).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, mo] = calMonth.split('-').map(Number);
    const n = mo === 12 ? { y: y + 1, m: 1 } : { y, m: mo + 1 };
    setCalMonth(`${n.y}-${String(n.m).padStart(2, '0')}`);
  };
  const renderCal = (m) => {
    const [y, mo] = m.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const last = new Date(y, mo, 0);
    const weeks = [];
    let week = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) {
      week.push({ day: d, dateStr: `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
    return weeks;
  };

  if (!isOpen) return null;
  return (
    <Modal onClose={onClose} contentStyle={{ width: 'min(calc(100vw - 24px), 480px)', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(16px, 4vw, 20px)', background: 'var(--bg)', pointerEvents: 'auto' }}>
      <div className="card" style={{ width: '100%', maxHeight: '100%', overflowY: 'auto', background: 'transparent', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'clamp(12px, 3vw, 14px)', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'clamp(14px, 4vw, 15px)' }}>Holiday Calendar</div>
            <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', color: 'var(--muted)', marginTop: 2 }}>Fri & Sat always off. Click dates to add extras.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.6, display: 'flex', alignItems: 'center', minWidth: 32, minHeight: 32, justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 'clamp(12px, 3vw, 14px)', borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
          {[['calendar', '📅 Calendar'], ['single', '📆 Single Date']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 'clamp(11px, 2vw, 12px)', fontWeight: mode === id ? 800 : 500,
              background: mode === id ? 'var(--accent)' : 'transparent', color: mode === id ? 'white' : 'var(--muted)',
            }}>{label}</button>
          ))}
        </div>
        {mode === 'calendar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(10px, 2vw, 12px)', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ fontSize: 'clamp(11px, 2vw, 12px)', padding: 'clamp(6px, 1.5vw, 8px) 10px' }}>← Prev</button>
              <div style={{ fontWeight: 700, fontSize: 'clamp(12px, 2.5vw, 13px)' }}>{monthName(calMonth)}</div>
              <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ fontSize: 'clamp(11px, 2vw, 12px)', padding: 'clamp(6px, 1.5vw, 8px) 10px' }}>Next →</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'clamp(10px, 2vw, 12px)', fontSize: 'clamp(11px, 2vw, 12px)' }}>
              <thead>
                <tr>{['S','M','T','W','T','F','S'].map((d,i) => (
                  <th key={i} style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: i === 5 || i === 6 ? 'var(--danger)' : 'var(--muted)', padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{d}</th>
                ))}</tr>
              </thead>
              <tbody>
                {renderCal(calMonth).map((week, wi) => (
                  <tr key={wi}>
                    {week.map((cell, di) => {
                      if (!cell) return <td key={di} style={{ height: 36 }} />;
                      const isFriSat = [5, 6].includes(new Date(cell.dateStr + 'T00:00:00').getDay());
                      const isAdded = holidayDates.includes(cell.dateStr);
                      const isSel = selected.has(cell.dateStr);
                      return (
                        <td key={di} style={{ padding: '2px', textAlign: 'center' }}>
                          <button onClick={() => !isFriSat && toggleCal(cell.dateStr)} style={{
                            width: 'clamp(32px, 12vw, 34px)', height: 'clamp(32px, 12vw, 34px)', borderRadius: 8, border: isSel ? '2px solid var(--accent)' : isAdded ? '2px solid var(--success)' : '1px solid transparent',
                            background: isSel ? 'rgba(59,130,246,0.15)' : isAdded ? 'rgba(34,197,94,0.12)' : isFriSat ? 'rgba(239,68,68,0.08)' : 'transparent',
                            cursor: isFriSat ? 'default' : 'pointer', fontSize: 'clamp(11px, 2vw, 12px)', fontWeight: isSel || isAdded ? 700 : 400,
                            color: isFriSat ? 'rgba(239,68,68,0.7)' : 'var(--text)',
                          }}>{cell.day}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(12px, 3vw, 14px)', padding: 'clamp(8px, 2vw, 12px)', background: dark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)', borderRadius: 9, border: '1px solid rgba(59,130,246,0.15)', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(11px, 2vw, 12px)', color: 'var(--muted)' }}><strong style={{ color: 'var(--text)' }}>{selected.size}</strong> selected</span>
              <button className="btn btn-primary btn-sm" onClick={addSelected} disabled={!selected.size} style={{ fontSize: 'clamp(11px, 2vw, 12px)' }}>
                <CalendarDays size={12} /> Add to Holidays
              </button>
            </div>
          </div>
        )}
        {mode === 'single' && (
          <div style={{ marginBottom: 'clamp(12px, 3vw, 14px)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)}
              style={{ flex: 1, minWidth: 150, padding: 'clamp(8px, 2vw, 9px) clamp(10px, 2vw, 12px)', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 'clamp(12px, 2vw, 13px)' }} />
            <button className="btn btn-primary" onClick={addSingle} disabled={!singleDate} style={{ fontSize: 'clamp(12px, 2vw, 13px)', whiteSpace: 'nowrap' }}>
              <CalendarDays size={13} /> Add
            </button>
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'clamp(10px, 2vw, 12px)' }}>
          <div style={{ fontSize: 'clamp(11px, 2vw, 12px)', fontWeight: 700, marginBottom: 8 }}>Saved Holidays ({holidayDates.length})</div>
          {holidayDates.length === 0 ? (
            <div style={{ fontSize: 'clamp(11px, 2vw, 12px)', color: 'var(--muted)' }}>No extra holidays added yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {holidayDates.map(d => (
                <span key={d} className="tag tag-gray" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 'clamp(10px, 2vw, 11px)', padding: 'clamp(4px, 1vw, 6px) clamp(6px, 1.5vw, 8px)' }}>
                  {d}
                  <button onClick={() => removeSingle(d)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex', alignItems: 'center' }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Compact Hero Card ──────────────────────────────────────────────────────
function AttendanceHero({ courses, logs, schedule, settings, combinedMode, combinedData }) {
  const dark = useDark();
  const theory = (courses || []).filter(c => !isAutoFull(c.type));

  // Stable initial order — computed once, never re-sorted on data change
  const stableOrder = useRef(null);

  const stats = useMemo(() => {
    const computed = theory.map(c => {
      const teachers = getTeachersForCourse(settings, schedule, c.id);
      const ts = teachers.length ? teachers : [''];
      let totalHeld = 0, totalAttended = 0;
      ts.forEach(t => {
        let s;
        if (combinedMode) {
          const key = `${c.id}_${t || ''}`;
          s = { held: Number(combinedData[key]?.held || 0), attended: Number(combinedData[key]?.attended || 0) };
        } else {
          s = getEffective(c.id, t, logs);
        }
        totalHeld += s.held; totalAttended += s.attended;
      });
      const pct = totalHeld > 0 ? Math.round((totalAttended / totalHeld) * 100) : null;
      const canMiss = pct !== null ? classesUntilDrop(totalAttended, totalHeld, pct) : null;
      const needNext = pct !== null && pct < 90 ? classesNeededForNextSlab(totalAttended, totalHeld, pct) : null;
      return {
        c, pct, totalHeld, totalAttended,
        fullMarks: getFullCourseMarks(pct),
        canMiss, needNext,
        slab: getCurrentSlab(pct),
        hint: getHint(pct, canMiss, needNext),
      };
    });

    // Sort only on first render
    if (!stableOrder.current) {
      const sorted = computed.slice().sort((a, b) => {
        const r = p => p === null ? 3 : p < 60 ? 0 : p < 75 ? 1 : 2;
        return r(a.pct) - r(b.pct);
      });
      stableOrder.current = sorted.map(s => s.c.id);
      return sorted;
    }

    // Subsequent renders: preserve stable order
    const map = new Map(computed.map(s => [s.c.id, s]));
    return stableOrder.current.map(id => map.get(id)).filter(Boolean);
  }, [theory, combinedMode, combinedData, logs, schedule, settings]);

  if (!theory.length) return (
    <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', marginBottom: 14 }}>
      <BookOpen size={24} strokeWidth={1.5} style={{ margin: '0 auto 6px', opacity: 0.35 }} />
      <div style={{ fontWeight: 700, fontSize: 13 }}>No active theory courses</div>
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Attendance</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{combinedMode ? 'Combined' : 'Daily log'} · {theory.length} courses</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4 }}>
        {stats.map(({ c, pct, totalHeld, totalAttended, slab, hint }) => {
          const col = attColor(pct);
          const hasData = totalHeld > 0;
          const hintCol = hint?.type === 'danger' ? 'var(--danger)' : hint?.type === 'warn' ? 'var(--warning)' : hint?.type === 'good' ? 'var(--success)' : hint?.type === 'info' ? 'var(--accent)' : 'var(--muted)';

          return (
            <div key={c.id} style={{
              background: attBg(pct, dark),
              border: `1.5px solid ${attBorder(pct, dark)}`,
              borderRadius: 10,
              padding: '7px 9px 6px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {/* Top row: course name + % badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                  {getDisplayCourseName(c)}
                </div>
                {hasData ? (
                  <div style={{
                    flexShrink: 0, minWidth: 36, height: 22, borderRadius: 6,
                    background: col, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 12, lineHeight: 1, paddingInline: 4,
                  }}>
                    {pct}<span style={{ fontSize: 8, fontWeight: 600 }}>%</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>—</div>
                )}
              </div>

              {/* Meta row: code · count · slab */}
              <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 3px' }}>
                <span style={{ opacity: 0.7 }}>{c.code}</span>
                {hasData && <>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span>{totalAttended}/{totalHeld}</span>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span style={{ color: col, fontWeight: 700 }}>{slab?.label}</span>
                </>}
              </div>

              {/* Hint */}
              {hint && (
                <div style={{ fontSize: 10, color: hintCol, fontWeight: 600, lineHeight: 1.2 }}>{hint.text}</div>
              )}

              {/* Progress bar */}
              {hasData && (
                <div style={{ height: 2, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, pct)}%`, background: col, transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Daily Log ──────────────────────────────────────────────────────────────
function DailyLog({ courses, logs, setLogs, schedule, settings, onEditTeachers }) {
  const [date, setDate] = useState(todayStr());
  const [showGive, setShowGive] = useState(false);
  const dark = useDark();
  const dayLog = logs[date] || {};
  const isToday = date === todayStr();
  const isHoliday = isRoutineHoliday(date, settings?.holidayDates || []);
  const scheduledCourses = getScheduleCoursesForDate(schedule, date, settings?.modelId);
  const schIds = scheduledCourses.map(s => s.courseId);

  const pastDates = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 180; i++) {
      const d = addDays(todayStr(), -i);
      const dow = new Date(d + 'T00:00:00').getDay();
      if (dow !== 5 && dow !== 6) out.push(d);
    }
    return out;
  }, []);

  const goPrev = () => {
    const idx = pastDates.indexOf(date);
    if (idx === -1) { setDate(pastDates[0]); return; }
    if (idx < pastDates.length - 1) setDate(pastDates[idx + 1]);
  };

  const mark = useCallback((courseId, teacher, val) => {
    const key = `${courseId}_${teacher || ''}`;
    const cur = dayLog[key];
    const next = cur === val ? undefined : val;
    const updated = { ...logs, [date]: { ...dayLog, [key]: next } };
    if (next === undefined) delete updated[date][key];
    if (!Object.keys(updated[date] || {}).length) delete updated[date];
    setLogs(updated);
    store.set('attLogs', updated);
  }, [dayLog, logs, date, setLogs]);

  const holidayLabel = (d) => {
    const labels = settings?.holidayLabels || {};
    const types = settings?.holidayTypes || {};
    if (labels[d]) return labels[d];
    if (types[d] === 'eid') return 'Eid Mubarak';
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow === 5) return "Jumu'ah Holiday";
    if (dow === 6) return 'Weekend';
    return 'Holiday';
  };

  const cardData = useMemo(() => {
    if (isHoliday) return [];
    let toShow = [];
    if (schIds.length > 0) {
      toShow = courses.filter(c => schIds.includes(c.id) && !isAutoFull(c.type));
    } else if (showGive && !isToday) {
      toShow = courses.filter(c => !isAutoFull(c.type));
    }
    return toShow.map((course, idx) => {
      const onDate = getTeachersForCourseOnDate(schedule, course.id, date);
      const teachers = onDate.length ? onDate : getTeachersForCourse(settings, schedule, course.id);
      const displayTeachers = teachers.length ? teachers : [''];
      const hasTeachers = displayTeachers.some(t => !!t);
      const slots = (scheduledCourses.find(s => s.courseId === course.id)?.items || []);
      const pal = dark ? PALETTE_D[idx % PALETTE_D.length] : PALETTE_L[idx % PALETTE_L.length];
      const teacherRows = displayTeachers.map(t => ({
        teacher: t, key: `${course.id}_${t || ''}`,
        status: dayLog[`${course.id}_${t || ''}`] || null,
      }));
      const allDone = teacherRows.every(r => r.status === 'present' || r.status === 'absent');
      return { course, displayTeachers, hasTeachers, slots, pal, teacherRows, allDone };
    });
  }, [isHoliday, schIds, courses, showGive, isToday, schedule, settings, dayLog, scheduledCourses, date, dark]);

  const markedCount = cardData.filter(c => c.allDone).length;
  const totalCount = cardData.length;

  return (
    <div>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={goPrev} disabled={!pastDates.length || date === pastDates[pastDates.length - 1]} style={{ flexShrink: 0, padding: '6px 8px' }}>
          <ChevronLeft size={16} />
        </button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()}
          style={{ flex: 1, fontWeight: 700, fontSize: 14, textAlign: 'center', padding: '7px 10px' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(d => addDays(d, 1))} disabled={isToday} style={{ flexShrink: 0, padding: '6px 8px' }}>
          <ChevronRight size={16} />
        </button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayStr())} style={{ flexShrink: 0, fontSize: 11, padding: '6px 8px' }}>Now</button>}
      </div>

      {/* Date + progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtDate(date)}</div>
        {!isHoliday && totalCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
            <div style={{ height: 4, width: 70, borderRadius: 99, background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${totalCount ? (markedCount / totalCount) * 100 : 0}%`, background: markedCount === totalCount ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {markedCount}/{totalCount} marked
              {markedCount === totalCount && totalCount > 0 && <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 4 }}>· Done ✓</span>}
            </span>
          </div>
        )}
      </div>

      {/* Holiday */}
      {isHoliday && (
        <div className="card" style={{ padding: '16px 14px', textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 24, marginBottom: 5 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{holidayLabel(date)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>No classes today</div>
        </div>
      )}

      {/* No schedule notice */}
      {!isHoliday && schIds.length === 0 && !isToday && (
        <div style={{ marginBottom: 10, padding: '9px 12px', background: dark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.07)', border: dark ? '1px solid rgba(251,191,36,0.15)' : '1px solid rgba(251,191,36,0.18)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>📅 No scheduled classes</span>
          <button onClick={() => setShowGive(s => !s)} style={{ padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11, background: 'var(--accent)', color: 'white', border: 'none' }}>
            {showGive ? 'Hide' : 'Give Attendance'}
          </button>
        </div>
      )}
      {!isHoliday && schIds.length === 0 && isToday && (
        <div className="card" style={{ padding: '11px 14px', fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          No classes scheduled for today.
        </div>
      )}

      {/* Teacher warning */}
      {!isHoliday && cardData.some(c => !c.hasTeachers) && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: dark ? 'rgba(217,119,6,0.08)' : 'rgba(255,251,235,1)', border: dark ? '1px solid rgba(217,119,6,0.22)' : '1px solid rgba(217,119,6,0.22)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--warning)' }}>
          <Users size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Some courses have no teachers assigned. Assign both teachers via Schedule page.</span>
        </div>
      )}

      {/* Course cards */}
      {!isHoliday && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cardData.length === 0 && (
            <div className="card" style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.4 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No classes to mark</div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                {isToday ? 'No scheduled classes today.' : 'Use Give Attendance for unscheduled days.'}
              </div>
            </div>
          )}

          {cardData.map(({ course, hasTeachers, slots, pal, teacherRows, allDone }) => (
            <div key={course.id} style={{ background: pal.bg, border: `1.5px solid ${pal.bd}`, borderRadius: 13, padding: '10px 12px' }}>
              {/* Course header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayCourseName(course)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    {course.code}
                    {slots.length > 0 && <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: 5 }}>{slots.map(s => s.slot).join(', ')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                  {allDone && <div style={{ padding: '2px 7px', borderRadius: 20, background: 'var(--success)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}><CheckCircle size={9} /> Done</div>}
                  <button onClick={() => onEditTeachers(course.id)} style={{ padding: '3px 7px', borderRadius: 7, border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : pal.bd}`, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: hasTeachers ? 'var(--accent)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Users size={9} /> {hasTeachers ? 'Teachers' : 'Assign'}
                  </button>
                </div>
              </div>

              {/* Teacher rows */}
              {!hasTeachers ? (
                <div style={{ fontSize: 12, color: 'var(--warning)', padding: '7px 10px', background: dark ? 'rgba(217,119,6,0.10)' : 'rgba(255,251,235,1)', borderRadius: 9, border: '1px solid rgba(217,119,6,0.20)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={11} />
                  <span>Assign teachers first.</span>
                  <button onClick={() => onEditTeachers(course.id)} style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warning)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Assign</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teacherRows.map(({ teacher, key, status }) => (
                    <div key={key} style={{ background: dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)', borderRadius: 9, padding: '8px 10px', border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.80)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Users size={9} /> {teacher || 'Unknown teacher'}
                        </div>
                        {status && (
                          <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: status === 'present' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: status === 'present' ? '#10b981' : '#ef4444' }}>
                            {status === 'present' ? '✓ Present' : '✗ Absent'}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { val: 'present', label: 'Present', icon: '✓', col: '#10b981' },
                          { val: 'absent',  label: 'Absent',  icon: '✗', col: '#ef4444' },
                        ].map(opt => {
                          const active = status === opt.val;
                          return (
                            <button key={opt.val} onClick={() => mark(course.id, teacher, opt.val)} style={{
                              padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                              background: active ? opt.col : dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.80)',
                              color: active ? 'white' : 'var(--muted)',
                              border: `2px solid ${active ? opt.col : dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}`,
                              transition: 'all 0.14s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              WebkitTapHighlightColor: 'transparent',
                            }}>
                              {opt.icon} {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Combined Attendance ────────────────────────────────────────────────────
function CombinedAtt({ courses, logs, schedule, settings, combinedMode, combinedData, toggleCombined, updateCombined, onEditTeachers }) {
  const dark = useDark();
  const theory = (courses || []).filter(c => !isAutoFull(c.type));

  // Stable order for combined tab — lock on first render
  const stableOrder = useRef(null);

  const cards = useMemo(() => {
    const computed = theory.map(c => {
      const teachers = getTeachersForCourse(settings, schedule, c.id);
      const ts = teachers.length ? teachers : [''];
      const stats = {};
      ts.forEach(t => {
        if (combinedMode) {
          const key = `${c.id}_${t || ''}`;
          const h = Number(combinedData[key]?.held || 0);
          const a = Number(combinedData[key]?.attended || 0);
          stats[t || ''] = { held: h, attended: a, pct: h > 0 ? Math.round((a / h) * 100) : null };
        } else {
          const s = getEffective(c.id, t, logs);
          stats[t || ''] = { ...s, pct: s.percentage };
        }
      });
      let th = 0, ta = 0;
      Object.values(stats).forEach(s => { th += s.held; ta += s.attended; });
      const pct = th > 0 ? Math.round((ta / th) * 100) : null;
      const canMiss = pct !== null ? classesUntilDrop(ta, th, pct) : null;
      const needNext = pct !== null && pct < 90 ? classesNeededForNextSlab(ta, th, pct) : null;
      return {
        c, ts, stats, th, ta, pct,
        fullMarks: getFullCourseMarks(pct),
        canMiss, needNext,
        slab: getCurrentSlab(pct),
        hint: getHint(pct, canMiss, needNext),
        assigned: getTeachersForCourse(settings, schedule, c.id).length >= 2,
      };
    });

    // Lock order on first render
    if (!stableOrder.current) {
      const sorted = computed.slice().sort((a, b) => {
        const r = p => p === null ? 3 : p < 60 ? 0 : p < 75 ? 1 : 2;
        return r(a.pct) - r(b.pct);
      });
      stableOrder.current = sorted.map(s => s.c.id);
      return sorted;
    }
    const map = new Map(computed.map(s => [s.c.id, s]));
    return stableOrder.current.map(id => map.get(id)).filter(Boolean);
  }, [theory, combinedMode, combinedData, logs, schedule, settings]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {/* Mode toggle */}
      <div className="card" style={{ padding: '11px 13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Input Mode</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {combinedMode
                ? 'Manual — enter Held & Attended per teacher'
                : 'Auto — calculated from Daily Log entries'}
            </div>
          </div>
          <button className={`btn ${combinedMode ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleCombined} style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {combinedMode ? '⚡ Manual ON' : 'Switch to Manual'}
          </button>
        </div>
      </div>

      {cards.map(({ c, ts, stats, th, ta, pct, fullMarks, canMiss, needNext, slab, hint, assigned }) => {
        const col = attColor(pct);
        const hintCol = hint?.type === 'danger' ? 'var(--danger)' : hint?.type === 'warn' ? 'var(--warning)' : hint?.type === 'good' ? 'var(--success)' : hint?.type === 'info' ? 'var(--accent)' : 'var(--muted)';

        return (
          <div key={c.id} className="card" style={{ padding: '12px 13px', border: pct !== null ? `1.5px solid ${attBorder(pct, dark)}` : undefined, background: pct !== null ? attBg(pct, dark) : undefined }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.code} — {c.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span>Y{c.year} T{c.term} · {c.credits}cr</span>
                  {pct !== null && <span style={{ color: col, fontWeight: 700 }}>{slab?.label}</span>}
                  {hint && <span style={{ color: hintCol, fontWeight: 700 }}>· {hint.text}</span>}
                </div>
              </div>
              {pct !== null && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>marks</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: col }}>{fullMarks ?? '—'}<span style={{ fontSize: 8, opacity: 0.7 }}>/30</span></div>
                  </div>
                  <div style={{ padding: '4px 8px', borderRadius: 8, background: col, color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1, minWidth: 44, textAlign: 'center' }}>
                    {pct}<span style={{ fontSize: 9 }}>%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Unassigned warning */}
            {!assigned && (
              <div style={{ marginBottom: 9, padding: '7px 10px', background: dark ? 'rgba(217,119,6,0.10)' : 'rgba(255,251,235,1)', border: '1px solid rgba(217,119,6,0.22)', borderRadius: 8, fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Users size={11} style={{ flexShrink: 0 }} />
                <span>Both teachers must be assigned first.</span>
                <button onClick={() => onEditTeachers(c.id)} style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warning)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Assign</button>
              </div>
            )}

            {/* Per-teacher inputs — always side by side */}
            <div style={{ marginBottom: pct !== null ? 8 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per Teacher</div>
                <button onClick={() => onEditTeachers(c.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 7px', color: 'var(--accent)' }}>
                  <Users size={9} /> Edit
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(ts.length, 2)}, 1fr)`, gap: 6 }}>
                {ts.map(t => {
                  const s = stats[t || ''];
                  const tp = s.pct;
                  return (
                    <div key={t || 'x'} style={{ padding: '8px 10px', background: dark ? 'rgba(255,255,255,0.04)' : 'var(--inputBg)', borderRadius: 9, border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                        {t || 'Unassigned'}
                      </div>
                      {combinedMode ? (
                        <>
                          {/* Labeled inputs */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Held</div>
                              <input type="number" min="0" value={s.held} onChange={e => updateCombined(c.id, t, 'held', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '5px 6px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Attended</div>
                              <input type="number" min="0" max={s.held} value={s.attended} onChange={e => updateCombined(c.id, t, 'attended', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '5px 6px', boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          {tp !== null && <div style={{ fontSize: 10, color: attColor(tp), fontWeight: 700 }}>{tp}% · {getPerTeacherMarks(tp) ?? '—'}/15</div>}
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.attended}/{s.held}</div>
                          {tp !== null ? <div style={{ fontSize: 10, color: attColor(tp), fontWeight: 700, marginTop: 1 }}>{tp}% · {getPerTeacherMarks(tp) ?? '—'}/15</div> : <div style={{ fontSize: 10, color: 'var(--muted)' }}>No data</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress + status */}
            {pct !== null && (
              <>
                <div style={{ height: 2, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 99, marginBottom: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, pct)}%`, background: col, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {ta}/{th} classes
                  {canMiss !== null && canMiss > 2 && <span> · Miss up to <span style={{ fontWeight: 700, color: 'var(--text)' }}>{canMiss}</span></span>}
                </div>
              </>
            )}
            {th === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{combinedMode ? 'Enter held/attended counts above.' : 'No daily log entries yet.'}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Attendance() {
  const profile = getProfile();
  const courses = getAllCourses(profile).filter(c => c.status === 'active' || c.status === 'backlog');
  const [logs, setLogs] = useState(() => store.get('attLogs') || {});
  const [tab, setTab] = useState(() => store.get('attAttendanceSource') === 'combined' ? 'combined' : 'daily');
  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [combinedMode, setCombinedMode] = useState(() => !!store.get('attCombinedMode'));
  const [combinedData, setCombinedData] = useState(() => store.get('attCombinedData') || {});
  const [teacherDlg, setTeacherDlg] = useState({ open: false, courseId: '' });
  const [holidayOpen, setHolidayOpen] = useState(false);
  const dark = useDark();

  useEffect(() => {
    const refresh = () => {
      setLogs(store.get('attLogs') || {});
      setSchedule(store.get('schedule') || []);
      setSettings(store.get('scheduleSettings') || {});
      setCombinedMode(!!store.get('attCombinedMode'));
      setCombinedData(store.get('attCombinedData') || {});
    };
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);

  const toggleCombined = () => {
    const next = !combinedMode;
    setCombinedMode(next);
    store.set('attCombinedMode', next);
  };

  useEffect(() => {
    const source = tab === 'daily' ? 'daily' : (combinedMode ? 'combined' : 'daily');
    store.set('attAttendanceSource', source);
  }, [tab, combinedMode]);

  const updateCombined = (courseId, teacher, field, value) => {
    const key = `${courseId}_${teacher || ''}`;
    const safe = Math.max(0, Number(value) || 0);
    const prev = combinedData[key] || { held: 0, attended: 0 };
    const next = { ...combinedData, [key]: { ...prev, [field]: safe } };
    if (next[key].attended > next[key].held) next[key].attended = next[key].held;
    setCombinedData(next);
    store.set('attCombinedData', next);
  };
  const openTeachers = (courseId) => setTeacherDlg({ open: true, courseId });
  const closeTeachers = () => setTeacherDlg({ open: false, courseId: '' });
  const saveTeachers = (list) => {
    const courseId = teacherDlg.courseId;
    const next = { ...settings, courseTeacherMap: { ...(settings.courseTeacherMap || {}), [courseId]: list } };
    setSettings(next);
    store.set('scheduleSettings', next);
    closeTeachers();
  };
  const saveHolidaySettings = (next) => {
    setSettings(next);
    store.set('scheduleSettings', next);
  };

  const todayDate = todayStr();
  const isTodayHoliday = isRoutineHoliday(todayDate, settings.holidayDates || []);
  const previewDate = getRoutinePreviewDate(settings.holidayDates || []);
  const previewDayName = new Date(previewDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const todaySchedule = (schedule || []).filter(s => s.day === previewDayName && courses.some(c => c.id === s.courseId))
    .slice().sort((a, b) => periodSortValue(a.period) - periodSortValue(b.period));

  const allTeachers = [...new Set(
    (schedule || [])
      .flatMap(s => Array.isArray(s.teacherNames) && s.teacherNames.length ? s.teacherNames : [s.teacherName])
      .filter(Boolean)
  )];
  const selectedCourse = courses.find(c => c.id === teacherDlg.courseId);
  const currentTeachers = selectedCourse ? getTeachersForCourse(settings, schedule, teacherDlg.courseId) : [];

  return (
    <div className="page-enter page-container">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div>
          <h1>Attendance</h1>
          <p className="text-muted" style={{ marginTop: 2, fontSize: 13 }}>Mark · Track · Improve</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setHolidayOpen(true)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <CalendarDays size={12} /> Holidays
        </button>
      </div>

      {/* Hero */}
      <AttendanceHero courses={courses} logs={logs} schedule={schedule} settings={settings} combinedMode={combinedMode} combinedData={combinedData} />

      {/* Today schedule strip */}
      {todaySchedule.length > 0 && (
        <div className="card" style={{ marginBottom: 13, padding: '10px 13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Today's Classes</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {new Date().toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {todaySchedule.map((item, idx) => {
              const c = courses.find(x => x.id === item.courseId);
              const pal = dark ? PALETTE_D[idx % PALETTE_D.length] : PALETTE_L[idx % PALETTE_L.length];
              return (
                <div key={item.id || idx} style={{ display: 'flex', gap: 9, padding: '7px 10px', background: pal.bg, border: `1px solid ${pal.bd}`, borderRadius: 9, alignItems: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: 11, color: 'var(--accent)', minWidth: 30, flexShrink: 0 }}>{getEntryTime(item, settings?.modelId)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.displayName || getDisplayCourseName(c)}</div>
                    {item.teacherName && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}><Users size={8} /> {item.teacherName}</div>}
                  </div>
                  {item.room && <div style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>R.{item.room}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {todaySchedule.length === 0 && (
        <div className="card" style={{ marginBottom: 13, padding: '10px 13px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          {isTodayHoliday ? '🎉 Holiday today — enjoy!' : 'No scheduled classes today'}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        {[['daily', '📅 Daily Log'], ['combined', '📊 Combined']].map(([id, label]) => (
          <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'daily' ? (
        <DailyLog
          courses={courses} logs={logs} setLogs={setLogs}
          schedule={schedule} settings={settings}
          onEditTeachers={openTeachers}
        />
      ) : (
        <CombinedAtt
          courses={courses} logs={logs} schedule={schedule} settings={settings}
          combinedMode={combinedMode} combinedData={combinedData}
          toggleCombined={toggleCombined} updateCombined={updateCombined}
          onEditTeachers={openTeachers}
        />
      )}

      {/* Marks slab reference */}
      <div className="card" style={{ marginTop: 20, padding: '12px 13px' }}>
        <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Marks Reference (Art. 14.2)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {ATT_SLABS.map(slab => {
            const isG = slab.minPct >= 75, isB = slab.minPct < 60;
            return (
              <div key={slab.label} style={{ textAlign: 'center', padding: '6px 3px', borderRadius: 8, background: isG ? (dark ? 'rgba(34,197,94,0.10)' : 'rgba(22,163,74,0.07)') : isB ? (dark ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.07)') : (dark ? 'rgba(217,119,6,0.10)' : 'rgba(217,119,6,0.06)'), border: `1px solid ${isG ? 'rgba(22,163,74,0.15)' : isB ? 'rgba(220,38,38,0.15)' : 'rgba(217,119,6,0.15)'}` }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: isG ? 'var(--success)' : isB ? 'var(--danger)' : 'var(--warning)', lineHeight: 1 }}>{isB ? '0' : slab.fullCourse}</div>
                <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 1 }}>/30</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, fontWeight: 600 }}>{slab.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Per teacher: /15 · Full course: /30</div>
      </div>

      {/* Holiday Modal */}
      <HolidayModal isOpen={holidayOpen} onClose={() => setHolidayOpen(false)} scheduleSettings={settings} onSave={saveHolidaySettings} />

      {/* Teacher Dialog */}
      <CourseTeacherDialog
        isOpen={teacherDlg.open} onClose={closeTeachers}
        course={selectedCourse} currentTeachers={currentTeachers}
        onSave={saveTeachers} allTeachers={allTeachers}
        requireTwoTeachers
      />
    </div>
  );
}