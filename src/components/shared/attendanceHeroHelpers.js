// attendanceHeroHelpers.js — pure helper functions used by
// components/shared/AttendanceHero.jsx.
//
// Extracted from Attendance.jsx by DEMO_MODE_FULL_PLAN_PROMPT.md Phase B
// (student slice). Each function here was verified pure before the move —
// takes state as params, no store.get()/Firestore/subscription calls. See
// the plan-prompt's Phase B Findings for the verification notes (in
// particular: getScheduleCoursesForDate was NOT moved here because it
// calls store.get() directly and AttendanceHero doesn't need it).
import { getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT } from '../../store/store';
import { resolveTeacherNames } from '../../lib/teacherRegistry';

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

export function getPerTeacherMarks(pct) {
  if (pct === null || pct === undefined) return null;
  const base = getAttendanceMarks(pct);
  return Math.round((base / 10) * 15 * 10) / 10;
}
export function getFullCourseMarks(pct) {
  const pt = getPerTeacherMarks(pct);
  return pt !== null ? Math.round(pt * 2 * 10) / 10 : null;
}
export function getCurrentSlab(pct) {
  if (pct === null || pct === undefined) return null;
  return ATT_SLABS.find(s => pct >= s.minPct) || ATT_SLABS[ATT_SLABS.length - 1];
}
export function classesUntilDrop(attended, held, pct) {
  const slab = getCurrentSlab(pct);
  if (!slab || slab.minPct === 0) return null;
  const max = Math.floor((attended * 100 / slab.minPct) - held);
  return Math.max(0, max);
}
export function classesNeededForNextSlab(attended, held, pct) {
  const idx = ATT_SLABS.findIndex(s => pct >= s.minPct);
  if (idx <= 0) return null;
  const boundary = ATT_SLABS[idx - 1].minPct;
  const needed = Math.ceil((held * boundary - attended * 100) / (100 - boundary));
  return Math.max(0, needed);
}
export function isAutoFull(courseType) {
  return courseType && (courseType.toLowerCase().includes('session') || courseType.toLowerCase().includes('lab'));
}
export function getTeachersForCourse(settings, schedule, courseId, teacherRegistry) {
  const norm = v => String(v || '').trim().replace(/\s{2,}/g, ' ');
  const rawCourseMap = Array.isArray(settings?.courseTeacherMap?.[courseId])
    ? settings.courseTeacherMap[courseId]
    : [];
  const resolvedCourseMap = teacherRegistry
    ? resolveTeacherNames(teacherRegistry, rawCourseMap)
    : rawCourseMap;
  const mapped = resolvedCourseMap.map(norm).filter(Boolean);
  if (mapped.length > 0) return [...new Set(mapped)];
  return [...new Set(
    (schedule || [])
      .filter(s => s.courseId === courseId)
      .flatMap(s => Array.isArray(s.teacherNames) && s.teacherNames.length ? s.teacherNames : [s.teacherName])
      .map(norm)
      .filter(Boolean)
  )];
}
export function getDisplayCourseName(course) {
  if (!course) return '';
  return (course.name || '')
    .replace(/^\s*[A-Z]{2,6}\s*\d{3,4}\s*[-—:]\s*/i, '')
    .replace(/\b[A-Z]{2,6}\s*\d{3,4}\b/g, '')
    .replace(/\s{2,}/g, ' ').trim() || course.name || '';
}
export function getEffectiveForCourse(courseId, logs) {
  let held = 0, attended = 0;
  Object.values(logs).forEach(day => {
    Object.entries(day).forEach(([key, v]) => {
      if (key !== courseId && !key.startsWith(`${courseId}_`)) return;
      if (v === 'present' || v === 'absent') { held++; if (v === 'present') attended++; }
    });
  });
  return { held, attended, percentage: held > 0 ? Math.round((attended / held) * 100) : null };
}
export function attColor(pct) {
  if (pct === null || pct === undefined) return 'var(--muted)';
  if (pct < MIN_ATTENDANCE_PERCENT) return 'var(--danger)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return 'var(--warning)';
  return 'var(--success)';
}
export function attBg(pct, dark) {
  if (pct === null) return dark ? 'rgba(255,255,255,0.03)' : 'var(--inputBg)';
  if (pct < MIN_ATTENDANCE_PERCENT) return dark ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.05)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return dark ? 'rgba(217,119,6,0.10)' : 'rgba(217,119,6,0.05)';
  return dark ? 'rgba(22,163,74,0.10)' : 'rgba(22,163,74,0.05)';
}
export function attBorder(pct, dark) {
  if (pct === null) return 'var(--border)';
  if (pct < MIN_ATTENDANCE_PERCENT) return dark ? 'rgba(220,38,38,0.30)' : 'rgba(220,38,38,0.18)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return dark ? 'rgba(217,119,6,0.30)' : 'rgba(217,119,6,0.18)';
  return dark ? 'rgba(22,163,74,0.30)' : 'rgba(22,163,74,0.18)';
}
export function getHint(pct, canMiss, needNext) {
  if (pct === null) return null;
  if (pct < MIN_ATTENDANCE_PERCENT) return { type: 'danger', text: 'At risk — below 60%' };
  if (canMiss === 0) return { type: 'warn', text: 'No absences left' };
  if (canMiss !== null && canMiss <= 2) return { type: 'warn', text: `${canMiss} miss${canMiss !== 1 ? 'es' : ''} → drops` };
  if (needNext !== null && needNext > 0) return { type: 'info', text: `${needNext} more → ↑ grade` };
  if (pct >= 90) return { type: 'good', text: 'Top slab ✓' };
  if (canMiss !== null && canMiss > 2) return { type: 'muted', text: `Miss up to ${canMiss}` };
  return null;
}
