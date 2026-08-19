import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, TrendingUp, Users, BookOpen, Award, CalendarDays, X, PartyPopper, ClipboardX, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  store, getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT,
  getProfile, getRoutinePreviewDate, isRoutineHoliday, parseTimeToMinutes, getBDNow,
  isClassOff, classOverrideSlotKey
} from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { getGroupId } from '../lib/groupUtils';
import { subscribeCRStatus, subscribeRoutine, subscribePlannerSettings } from '../lib/groupSync';
import { resolveTeacherNames } from '../lib/teacherRegistry';
import { ALTERNATE_TEACHER } from './Schedule';
import { getEffectiveOccurrence } from '../lib/sessionalCadence';
import { useCanEditGroup } from '../hooks/useCanEditGroup';
// Phase B (student slice) of DEMO_MODE_FULL_PLAN_PROMPT.md — AttendanceHero
// moved to components/shared so LandingPage's student demo (Phase C) can
// reuse the exact same component with demo-data props.
import AttendanceHero from '../components/shared/AttendanceHero';
import AttendanceMarkModal from '../components/shared/AttendanceMarkModal';
import {
  slotKey, getTeachersForCourse, recordSlotTeacherSighting, getRotationOverride,
  setRotationOverride, resolveTeachersForDate, getDisplayCourseName,
  getScheduleCoursesForDate, markAttendance, moveAttendanceStatus,
} from '../lib/attendanceCore';

// ── Utils ──────────────────────────────────────────────────────────────────
// BUGFIX: was `new Date()` (device timezone) — "today" for the Daily Log
// must always be Bangladesh time, or the Daily Log can silently resolve to
// the wrong weekday, showing the wrong classes / making a Present mark look
// like it "didn't save" because it was read back against a different date.
// See getBDNow() in store.js for the full writeup.
const todayStr = () => { const d = getBDNow(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
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
function getTeachersForCourseOnDate(schedule, courseId, date) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  return [...new Set(
    (schedule || [])
      .filter(s => s.courseId === courseId && s.day === dayName)
      .map(s => s.teacherName).filter(Boolean)
  )];
}
// NOTE: slotKey / recordSlotTeacherSighting / getRotationOverride /
// setRotationOverride / resolveTeachersForDate / getDisplayCourseName
// moved to lib/attendanceCore.js (imported above) so Dashboard's Today's
// Actions can share the exact same rotation-resolution logic. See that
// file for the original BUGFIX comments — unchanged, just relocated.
function getEffective(courseId, teacherName, logs) {
  const key = `${courseId}_${teacherName || ''}`;
  let held = 0, attended = 0;
  Object.values(logs).forEach(day => {
    const v = day[key];
    if (v === 'present' || v === 'absent') { held++; if (v === 'present') attended++; }
  });
  return { held, attended, percentage: held > 0 ? Math.round((attended / held) * 100) : null };
}
// BUGFIX (teacher-name edit orphans old attendance from the Live
// Attendance card): the hero cards used to loop the COURSE'S CURRENT
// teacher list and call getEffective(courseId, teacherName, logs) per
// name — so the moment a teacher's name is edited in Class Setup/Schedule
// (e.g. "Munni Sir" -> "Munni Ma'am", or any retyped name), every
// present/absent already marked under the OLD name stops being counted:
// held/attended silently drops for days that were, in fact, marked. The
// data was never lost (it's still sitting in attLogs under the old key) —
// it just stopped being read. This sums every log key that belongs to the
// course AT ALL (courseId_<any teacher, old or new>), the same
// whole-course aggregation already used by computeEffectiveAttendance in
// store.js, so a rename never zeroes out prior history.
function getEffectiveForCourse(courseId, logs) {
  let held = 0, attended = 0;
  Object.values(logs).forEach(day => {
    Object.entries(day).forEach(([key, v]) => {
      if (key !== courseId && !key.startsWith(`${courseId}_`)) return;
      if (v === 'present' || v === 'absent') { held++; if (v === 'present') attended++; }
    });
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
// NOTE: getScheduleCoursesForDate moved to lib/attendanceCore.js too —
// same reasoning as above.

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
          {[['calendar', 'Calendar'], ['single', 'Single Date']].map(([id, label]) => (
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
// AttendanceHero moved to components/shared/AttendanceHero.jsx by
// DEMO_MODE_FULL_PLAN_PROMPT.md Phase B (student slice) — imported below,
// used identically to before. The helper functions above (isAutoFull,
// getTeachersForCourse, getEffectiveForCourse, attColor/attBg/attBorder,
// getDisplayCourseName, getCurrentSlab, classesUntilDrop,
// classesNeededForNextSlab, getHint) are DELIBERATELY still defined in
// this file too — DailyLog and CombinedAtt below still call them directly,
// so removing them here would break those. components/shared/
// attendanceHeroHelpers.js holds its own copy for AttendanceHero's use;
// see that file's header comment for why duplication (not a shared
// import back into this file) was the lower-risk choice for this slice.

// ── Daily Log ──────────────────────────────────────────────────────────────
function DailyLog({ courses, logs, setLogs, schedule, settings, onEditTeachers, canEditTeachers, teacherRegistry, groupClassOverrides }) {
  const [date, setDate] = useState(todayStr());
  const [showGive, setShowGive] = useState(false);
  const dark = useDark();
  const dayLog = logs[date] || {};
  const isToday = date === todayStr();
  const isHoliday = isRoutineHoliday(date, settings?.holidayDates || []);
  // BUGFIX: groupClassOverrides was fetched (subscribePlannerSettings) and
  // stored in state, but never actually threaded into this call — so a
  // CR's class-off toggle still had zero effect here despite the fix above
  // looking complete. Passing it through now closes the loop end-to-end.
  const scheduledCourses = getScheduleCoursesForDate(schedule, date, groupClassOverrides);
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

  // mark/moveAttendanceStatus now live in lib/attendanceCore.js (shared
  // with Dashboard's Today's Actions) — these wrappers just also sync
  // DailyLog's own local `logs` state, which the core functions don't
  // know about.
  const mark = useCallback((courseId, teacher, val) => {
    setLogs(markAttendance(logs, date, courseId, teacher, val));
  }, [logs, date, setLogs]);

  const moveStatus = useCallback((courseId, oldTeacher, newTeacher) => {
    setLogs(moveAttendanceStatus(logs, date, courseId, oldTeacher, newTeacher));
  }, [logs, date, setLogs]);

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

  // Keep the slot→teacher "ever seen" pool up to date whenever routine data
  // loads/changes, so rotation can be detected even before any override has
  // been picked for a given date (see resolveTeachersForDate above).
  useEffect(() => {
    (schedule || []).forEach(s => {
      if (s.courseId && s.day && s.slot) recordSlotTeacherSighting(s.courseId, s.day, s.slot, s.teacherName);
    });
  }, [schedule]);

  const [rotationTick, setRotationTick] = useState(0); // bump to re-derive cardData after a pick
  const pickRotationTeacher = useCallback((courseId, day, slot, teacherName) => {
    setRotationOverride(courseId, day, slot, date, teacherName);
    setRotationTick(t => t + 1);
  }, [date]);

  // Switch-teacher: generalizes the rotation-override mechanism to every
  // course (not just rotating slots). Overrides only this specific date —
  // the routine's default teacher for the slot is never touched. If the
  // old teacher already had a status marked for this date, it's moved to
  // the new teacher's key so nothing is orphaned.
  const switchTeacher = useCallback((courseId, day, slot, oldTeacher, newTeacherName) => {
    moveStatus(courseId, oldTeacher, newTeacherName);
    setRotationOverride(courseId, day, slot, date, newTeacherName);
    setRotationTick(t => t + 1);
  }, [date, moveStatus]);

  // Which teacher-row card has its modal open: { courseId, teacher }.
  // Always re-derived from live cardData below (never a stale snapshot),
  // so background schedule/override recalculation while the modal is open
  // can't leave it showing outdated teacher/status info.
  const [openCard, setOpenCard] = useState(null);

  const cardData = useMemo(() => {
    if (isHoliday) return [];
    let toShow = [];
    if (schIds.length > 0) {
      toShow = courses.filter(c => schIds.includes(c.id) && !isAutoFull(c.type));
    } else if (showGive && !isToday) {
      toShow = courses.filter(c => !isAutoFull(c.type));
    }
    return toShow.map((course, idx) => {
      const resolved = resolveTeachersForDate(schedule, course.id, date, settings, teacherRegistry);
      const anyRotating = resolved.some(r => r.isRotating);
      const anyNeedsPick = resolved.some(r => r.needsPick);
      const onDate = [...new Set(resolved.map(r => r.resolvedTeacher).filter(Boolean))];
      const teachers = onDate.length ? onDate : getTeachersForCourse(settings, schedule, course.id, teacherRegistry);
      const displayTeachers = teachers.length ? teachers : [''];
      const hasTeachers = displayTeachers.some(t => !!t);
      const slots = (scheduledCourses.find(s => s.courseId === course.id)?.items || []);
      const pal = dark ? PALETTE_D[idx % PALETTE_D.length] : PALETTE_L[idx % PALETTE_L.length];
      const teacherRows = displayTeachers.map(t => ({
        teacher: t, key: `${course.id}_${t || ''}`,
        status: dayLog[`${course.id}_${t || ''}`] || null,
      }));
      const allDone = !anyNeedsPick && teacherRows.every(r => r.status === 'present' || r.status === 'absent');
      return { course, displayTeachers, hasTeachers, slots, pal, teacherRows, allDone, resolved, anyRotating, anyNeedsPick };
    });
  }, [isHoliday, schIds, courses, showGive, isToday, schedule, settings, dayLog, scheduledCourses, date, dark, rotationTick]);

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
          <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'center' }}><PartyPopper size={24} color="var(--accent)" /></div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{holidayLabel(date)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>No classes today</div>
        </div>
      )}

      {/* No schedule notice */}
      {!isHoliday && schIds.length === 0 && !isToday && (
        <div style={{ marginBottom: 10, padding: '9px 12px', background: dark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.07)', border: dark ? '1px solid rgba(251,191,36,0.15)' : '1px solid rgba(251,191,36,0.18)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>No scheduled classes</span>
          <button className="accent-fill-glass" onClick={() => setShowGive(s => !s)} style={{ padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11, color: 'white' }}>
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
              <div style={{ marginBottom: 6, opacity: 0.4, display: 'flex', justifyContent: 'center' }}><ClipboardX size={20} /></div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No classes to mark</div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                {isToday ? 'No scheduled classes today.' : 'Use Give Attendance for unscheduled days.'}
              </div>
            </div>
          )}

          {cardData.map(({ course, hasTeachers, slots, pal, teacherRows, allDone, resolved, anyRotating, anyNeedsPick }) => (
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

              {/* Rotating-slot notice — this course has a slot where more than
                  one teacher has shown up historically with no fixed pattern,
                  so we don't guess; the user confirms who taught THIS date. */}
              {anyRotating && (
                <div style={{ fontSize: 10.5, color: 'var(--accent)', padding: '6px 9px', marginBottom: 7, background: dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={10} />
                  <span>Alternative</span>
                </div>
              )}
              {resolved.filter(r => r.needsPick).map(r => (
                <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700 }}>{r.slot}:</span>
                  {r.pool.map(name => (
                    <button key={name} onClick={() => pickRotationTeacher(course.id, r.day, r.slot, name)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>
                      {name}
                    </button>
                  ))}
                  <button onClick={() => {
                    const custom = window.prompt('Teacher name for this date:');
                    if (custom && custom.trim()) pickRotationTeacher(course.id, r.day, r.slot, custom.trim());
                  }} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, border: '1.5px dashed var(--muted)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                    Other…
                  </button>
                </div>
              ))}

              {/* Teacher rows */}
              {!hasTeachers ? (
                <div style={{ fontSize: 12, color: 'var(--warning)', padding: '7px 10px', background: dark ? 'rgba(217,119,6,0.10)' : 'rgba(255,251,235,1)', borderRadius: 9, border: '1px solid rgba(217,119,6,0.20)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={11} />
                  <span>{canEditTeachers ? 'Assign teachers first.' : 'Your CR hasn\'t assigned a teacher yet.'}</span>
                  {canEditTeachers && (
                    <button onClick={() => onEditTeachers(course.id)} style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warning)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Assign</button>
                  )}
                </div>
              ) : !anyNeedsPick && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teacherRows.map(({ teacher, key, status }) => (
                    <div
                      key={key}
                      onClick={() => setOpenCard({ courseId: course.id, teacher })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenCard({ courseId: course.id, teacher }); }}
                      style={{ background: dark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)', borderRadius: 9, padding: '8px 10px', border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.80)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Users size={9} /> {teacher === ALTERNATE_TEACHER ? 'Alternative' : (teacher || 'Unknown teacher')}
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
                            <div key={opt.val} style={{
                              padding: '8px 6px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                              background: active ? opt.col : dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.80)',
                              color: active ? 'white' : 'var(--muted)',
                              border: `2px solid ${active ? opt.col : dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}>
                              {opt.icon} {opt.label}
                            </div>
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

      {/* Present/Absent + Switch-teacher modal — reads live cardData by
          (courseId, teacher) on every render rather than a snapshot taken
          when opened, so background schedule/override recalculation while
          it's open can never leave it (or the card behind it) stale. */}
      {openCard && (() => {
        const cd = cardData.find(c => c.course.id === openCard.courseId);
        if (!cd) { setOpenCard(null); return null; }
        const row = cd.teacherRows.find(r => r.teacher === openCard.teacher);
        if (!row) { setOpenCard(null); return null; }
        const slotEntry = cd.resolved.find(r => r.resolvedTeacher === row.teacher);
        const defaultTeachers = getTeachersForCourse(settings, schedule, cd.course.id, teacherRegistry);
        const switchOptions = slotEntry ? defaultTeachers.filter(t => t !== row.teacher) : [];
        return (
          <AttendanceMarkModal
            course={cd.course}
            teacher={row.teacher === ALTERNATE_TEACHER ? 'Alternative' : row.teacher}
            status={row.status}
            dateLabel={fmtDate(date)}
            switchOptions={switchOptions}
            dark={dark}
            onClose={() => setOpenCard(null)}
            onMark={(val) => { mark(cd.course.id, row.teacher, val); setOpenCard(null); }}
            onSwitch={(name) => {
              switchTeacher(cd.course.id, slotEntry.day, slotEntry.slot, row.teacher, name);
              setOpenCard({ courseId: cd.course.id, teacher: name });
            }}
          />
        );
      })()}
    </div>
  );
}

// ── Combined Attendance ────────────────────────────────────────────────────
function CombinedAtt({ courses, logs, schedule, settings, combinedMode, combinedData, toggleCombined, updateCombined, onEditTeachers, canEditTeachers, teacherRegistry }) {
  const dark = useDark();
  const theory = (courses || []).filter(c => !isAutoFull(c.type));

  // Stable order for combined tab — lock on first render
  const stableOrder = useRef(null);

  const cards = useMemo(() => {
    const computed = theory.map(c => {
      const teachers = getTeachersForCourse(settings, schedule, c.id, teacherRegistry);
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
        assigned: getTeachersForCourse(settings, schedule, c.id, teacherRegistry).length >= 2,
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
                ? 'Manual — type in Held & Attended per teacher yourself'
                : 'Auto — mirrors your Daily Log entries, not a separate source'}
            </div>
          </div>
          <button className={`btn ${combinedMode ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleCombined} style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {combinedMode ? 'Manual ON' : 'Switch to Manual'}
          </button>
        </div>
        {!combinedMode && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
            You're viewing Daily Log numbers split by teacher. To enter counts directly instead, switch to Manual above.
          </div>
        )}
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
                <span>{canEditTeachers ? 'Both teachers must be assigned first.' : 'Your CR hasn\'t assigned both teachers yet.'}</span>
                {canEditTeachers && (
                  <button onClick={() => onEditTeachers(c.id)} style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warning)', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Assign</button>
                )}
              </div>
            )}

            {/* Per-teacher inputs — always side by side */}
            <div style={{ marginBottom: pct !== null ? 8 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Per Teacher</div>
                {canEditTeachers && (
                  <button onClick={() => onEditTeachers(c.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 7px', color: 'var(--accent)' }}>
                    <Users size={9} /> Edit
                  </button>
                )}
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
  const navigate = useNavigate();
  const profile = getProfile();
  const courses = getAllCourses(profile).filter(c => c.status === 'active' || c.status === 'backlog');
  // logs (present/absent marks) are ALWAYS personal — each student's own
  // record, stored locally, never shared with classmates regardless of
  // whether the schedule below is personal or group-shared.
  const [logs, setLogs] = useState(() => store.get('attLogs') || {});
  const [tab, setTab] = useState(() => store.get('attAttendanceSource') === 'combined' ? 'combined' : 'daily');

  // Schedule/classlist source: mirrors Schedule.jsx's group-mode logic.
  // If this student's batch+dept group currently has an active CR, the
  // shared group routine is what attendance is tracked against — NOT this
  // student's personal routine. This only affects which classes show up
  // to mark attendance for; the attendance data itself (logs above) is
  // still saved per-student and never shared.
  // BUGFIX: deps missing profile.section — see useClassManagementState.js's
  // matching fix / ProfileSetupModal.jsx's comment for the full write-up.
  const groupId = useMemo(() => getGroupId(profile), [profile.dept, profile.batch, profile.section]);
  const [groupHasCR, setGroupHasCR] = useState(null); // null = unknown yet
  useEffect(() => {
    if (!groupId) { setGroupHasCR(false); return; }
    return subscribeCRStatus(groupId, (status) => setGroupHasCR(!!status?.hasCR));
  }, [groupId]);
  const isGroupMode = !!groupId && groupHasCR === true;
  const { canEdit: canEditTeachers } = useCanEditGroup(groupId);

  const [schedule, setSchedule] = useState(() => (isGroupMode ? [] : (store.get('schedule') || [])));
  // PERF FIX (slow first appearance — same root cause as Schedule.jsx,
  // see its matching comment for the full writeup): subscribeRoutine now
  // starts immediately whenever a groupId exists, in parallel with the
  // subscribeCRStatus check above, instead of waiting for groupHasCR to
  // resolve first — so both round-trips overlap instead of running back
  // to back on a cold load.
  //
  // CORRECTNESS (kept separate from the fix above on purpose): the fetched
  // group routine is held in its OWN state (groupRoutineEntries) rather
  // than written straight into `schedule`. Unlike Schedule.jsx, this page
  // has no groupModeLoading full-page gate — `schedule` here is read
  // directly by DailyLog/AttendanceHero etc. the instant it changes, with
  // nothing blocking a render in between. If the fetched group entries
  // were written directly into `schedule` before isGroupMode had actually
  // resolved to true, a personal-mode student mid-resolution could
  // briefly see group-shaped class data rendered as if it were their own
  // personal schedule. The effect below only ever commits
  // groupRoutineEntries into the real `schedule` state once isGroupMode
  // is confirmed — so the fetch itself is no longer serialized behind the
  // CR check, but what's DISPLAYED still is, exactly as before.
  const [groupRoutineEntries, setGroupRoutineEntries] = useState(null);
  useEffect(() => {
    if (!groupId) { setGroupRoutineEntries(null); return; }
    return subscribeRoutine(groupId, (entries) => {
      const mapped = (entries || []).map((e) => ({
        id: e.id,
        day: e.day || 'Sunday',
        slot: e.slot || '',
        courseId: e.courseId || '',
        teacherName: e.teacherName || '',
        displayName: e.displayName || e.courseCode || e.courseName || '',
        room: e.room || '',
        note: e.note || '',
        type: e.type || 'Theory',
      }));
      setGroupRoutineEntries(mapped);
    });
  }, [groupId]);
  useEffect(() => {
    if (!isGroupMode) {
      setSchedule(store.get('schedule') || []);
      return;
    }
    // isGroupMode just became true. If subscribeRoutine's parallel fetch
    // above has already delivered a result by this point (likely, since
    // it started at the same time as the CR check that just resolved),
    // commit it immediately — no extra wait. If not yet delivered,
    // schedule stays whatever it was until groupRoutineEntries itself
    // updates (the effect right above this one still re-runs and, via
    // this same isGroupMode-gated effect's dependency on
    // groupRoutineEntries, will commit it the moment it lands).
    if (groupRoutineEntries !== null) setSchedule(groupRoutineEntries);
  }, [isGroupMode, groupRoutineEntries]);

  const [localSettings, setLocalSettings] = useState(() => store.get('scheduleSettings') || {});
  const [combinedMode, setCombinedMode] = useState(() => !!store.get('attCombinedMode'));
  const [combinedData, setCombinedData] = useState(() => store.get('attCombinedData') || {});
  const [holidayOpen, setHolidayOpen] = useState(false);
  const dark = useDark();

  useEffect(() => {
    const refresh = () => {
      setLogs(store.get('attLogs') || {});
      if (!isGroupMode) setSchedule(store.get('schedule') || []);
      setLocalSettings(store.get('scheduleSettings') || {});
      setCombinedMode(!!store.get('attCombinedMode'));
      setCombinedData(store.get('attCombinedData') || {});
    };
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, [isGroupMode]);

  // Teacher assignment is CR/ACR-only and lives in one place — Class Setup
  // (groups/{groupId}/meta/plannerSettings.courseTeacherMap). This page only
  // ever reads it now; the old per-student local override
  // (scheduleSettings.courseTeacherMap, edited via a dialog right on this
  // page) has been removed so every student sees the same teacher for the
  // same course. Holiday dates stay purely local/per-device, so
  // localSettings is still kept around for that.
  const [groupTeacherMap, setGroupTeacherMap] = useState(null);
  const [groupTeacherRegistry, setGroupTeacherRegistry] = useState(null);
  // BUGFIX (group-mode CR on/off toggles were invisible on Attendance —
  // see isClassOff's doc comment in store.js): classOverrides/recurringOff
  // are the exact same scheduleFields the Routine page's
  // useClassManagementState.js already reads from this same subscription;
  // Attendance was subscribed to plannerSettings already (for
  // courseTeacherMap below) but was simply never extracting these two
  // fields from it.
  const [groupClassOverrides, setGroupClassOverrides] = useState(null);
  useEffect(() => {
    if (!groupId) { setGroupTeacherMap(null); setGroupTeacherRegistry(null); setGroupClassOverrides(null); return; }
    return subscribePlannerSettings(groupId, (data) => {
      setGroupTeacherMap(data?.courseTeacherMap || {});
      setGroupTeacherRegistry(data?.teacherRegistry || {});
      setGroupClassOverrides({
        ...(data?.scheduleFields?.classOverrides || {}),
        recurringOff: data?.scheduleFields?.recurringOff || {},
      });
    });
  }, [groupId]);
  const settings = useMemo(
    () => ({ ...localSettings, courseTeacherMap: groupTeacherMap ?? (localSettings.courseTeacherMap || {}) }),
    [localSettings, groupTeacherMap],
  );
  // Passed into getTeachersForCourse's fallback path — undefined in local
  // mode (no group), which makes that function skip id resolution and use
  // the raw (already name-based) local courseTeacherMap unchanged.
  const teacherRegistry = groupId ? (groupTeacherRegistry || {}) : undefined;

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
  // Teacher assignment now happens only in Class Setup (CR/ACR-only). This
  // page just sends whoever taps "Assign"/"Teachers" there instead of
  // opening a local edit dialog — see groupTeacherMap above for the read side.
  // Only CR/ACR (canEditTeachers) get a live button; regular students see
  // a plain read-only label instead (wired at the two render sites below).
  const openTeachers = () => navigate('/class-setup');
  const saveHolidaySettings = (next) => {
    setLocalSettings(next);
    store.set('scheduleSettings', next);
  };

  return (
    <div className="page-enter page-container content-page-bg">
      {/* Page header */}
      <div className="content-page-hero" style={{ marginBottom: 14 }}>
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <CalendarDays size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Attendance</h1>
          </div>
          <p className="content-page-hero-subtitle">Mark · Track · Improve</p>
        </div>
        <div className="content-page-hero-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setHolidayOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <CalendarDays size={12} /> <span className="btn-txt">Holidays</span>
          </button>
        </div>
      </div>

      {/* Hero */}
      <AttendanceHero courses={courses} logs={logs} schedule={schedule} settings={settings} combinedMode={combinedMode} combinedData={combinedData} teacherRegistry={teacherRegistry} />

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 6 }}>
        {[['daily', 'Daily Log'], ['combined', 'Manual Entry']].map(([id, label]) => (
          <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {/* Active-source indicator — clarifies which data feeds Marks/Dashboard %,
          since "Manual Entry" tab can itself still be showing Auto (= Daily Log) data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12, fontSize: 10, color: 'var(--muted)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
        <span>
          Attendance % app-wide is currently from{' '}
          <strong style={{ color: 'var(--text)' }}>
            {(tab === 'daily' || !combinedMode) ? 'Daily Log' : 'Manual Entry'}
          </strong>
        </span>
      </div>

      {tab === 'daily' ? (
        <DailyLog
          courses={courses} logs={logs} setLogs={setLogs}
          schedule={schedule} settings={settings}
          onEditTeachers={openTeachers}
          canEditTeachers={canEditTeachers}
          teacherRegistry={teacherRegistry}
          groupClassOverrides={groupClassOverrides}
        />
      ) : (
        <CombinedAtt
          courses={courses} logs={logs} schedule={schedule} settings={settings}
          combinedMode={combinedMode} combinedData={combinedData}
          toggleCombined={toggleCombined} updateCombined={updateCombined}
          onEditTeachers={openTeachers}
          canEditTeachers={canEditTeachers}
          teacherRegistry={teacherRegistry}
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
    </div>
  );
}