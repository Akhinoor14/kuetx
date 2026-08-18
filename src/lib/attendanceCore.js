// lib/attendanceCore.js
//
// Pure, store-backed attendance-marking logic shared between the full
// Attendance page (pages/Attendance.jsx, DailyLog) and the Dashboard's
// "Today's Actions" column. Extracted verbatim (no behavior change) so
// both call sites resolve teacher-for-date/rotation/mark the exact same
// way — a dashboard mark and an Attendance-page mark for the same course
// on the same date must always agree.
//
// Nothing here is React — safe to import from any component.

import { store, isClassOff, classOverrideSlotKey } from '../store/store';
import { resolveTeacherNames } from './teacherRegistry';
import { getEffectiveOccurrence } from './sessionalCadence';
import { ALTERNATE_TEACHER } from '../pages/Schedule';

export const slotKey = (s) => `${s.courseId}::${s.day}::${s.slot}`;

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

// See Attendance.jsx's original comment (BUGFIX: rotating/alternate
// teacher slots) for the full history — kept here verbatim since the
// reasoning still applies unchanged.
export function recordSlotTeacherSighting(courseId, day, slot, teacherName) {
  const name = String(teacherName || '').trim();
  if (!name || name === ALTERNATE_TEACHER) return;
  const key = `${courseId}::${day}::${slot}`;
  const pool = store.get('attSlotTeacherPool') || {};
  const existing = Array.isArray(pool[key]) ? pool[key] : [];
  if (!existing.includes(name)) {
    store.set('attSlotTeacherPool', { ...pool, [key]: [...existing, name] });
  }
}

export function getRotationOverride(courseId, day, slot, date) {
  const log = store.get('attRotationLog') || {};
  return log[date]?.[`${courseId}::${day}::${slot}`] || '';
}

export function setRotationOverride(courseId, day, slot, date, teacherName) {
  const log = store.get('attRotationLog') || {};
  const dayLog = { ...(log[date] || {}), [`${courseId}::${day}::${slot}`]: teacherName };
  store.set('attRotationLog', { ...log, [date]: dayLog });
}

export function resolveTeachersForDate(schedule, courseId, date, settings, teacherRegistry) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const slotEntries = (schedule || []).filter(s => s.courseId === courseId && s.day === dayName);
  const pool = store.get('attSlotTeacherPool') || {};
  return slotEntries.map(s => {
    const key = slotKey(s);
    const seenTeachers = Array.isArray(pool[key]) ? pool[key] : [];
    const isAlternate = s.teacherName === ALTERNATE_TEACHER;
    const currentTeacher = isAlternate ? '' : String(s.teacherName || '').trim();
    const alternatePool = isAlternate ? getTeachersForCourse(settings, schedule, courseId, teacherRegistry) : [];
    const knownPool = [...new Set([...seenTeachers, currentTeacher, ...alternatePool].filter(Boolean))];
    const isRotating = isAlternate || knownPool.length > 1;
    const override = getRotationOverride(courseId, s.day, s.slot, date);
    return {
      slot: s.slot, day: s.day, key,
      isRotating,
      pool: knownPool,
      resolvedTeacher: override || currentTeacher,
      needsPick: isRotating && !override,
    };
  });
}

export function getDisplayCourseName(course) {
  if (!course) return '';
  return (course.name || '')
    .replace(/^\s*[A-Z]{2,6}\s*\d{3,4}\s*[-—:]\s*/i, '')
    .replace(/\b[A-Z]{2,6}\s*\d{3,4}\b/g, '')
    .replace(/\s{2,}/g, ' ').trim() || course.name || '';
}

export function getScheduleCoursesForDate(schedule, date, groupOverrides = null) {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const sessionalCadence = (store.get('scheduleSettings') || {}).sessionalCadence || {};
  const byCourse = new Map();
  (schedule || [])
    .filter(s => s.day === dayName)
    .filter(s => !isClassOff(date, classOverrideSlotKey(s.courseId, s.day, s.slot), groupOverrides))
    .filter(s => getEffectiveOccurrence(sessionalCadence[classOverrideSlotKey(s.courseId, s.day, s.slot)], date) !== 'off')
    .forEach(s => {
      if (!byCourse.has(s.courseId)) byCourse.set(s.courseId, []);
      byCourse.get(s.courseId).push(s);
    });
  return [...byCourse.entries()].map(([courseId, items]) => ({
    courseId, items: items.slice().sort((a, b) => a.slot.localeCompare(b.slot)),
  }));
}

// Writes a Present/Absent mark for (date, courseId, teacher) into the
// shared attLogs store — identical semantics to DailyLog's local `mark`
// (same value = toggle off). Takes the current logs object and returns
// the updated one; caller is responsible for both setLogs(...) (if it
// keeps local state, as DailyLog does) and store.set('attLogs', ...).
export function markAttendance(logs, date, courseId, teacher, val) {
  const dayLog = logs[date] || {};
  const key = `${courseId}_${teacher || ''}`;
  const cur = dayLog[key];
  const next = cur === val ? undefined : val;
  const updated = { ...logs, [date]: { ...dayLog, [key]: next } };
  if (next === undefined) delete updated[date][key];
  if (!Object.keys(updated[date] || {}).length) delete updated[date];
  store.set('attLogs', updated);
  return updated;
}

// Moves a marked status from oldTeacher's key to newTeacher's key for a
// given date, so a Switch never orphans an already-marked Present/Absent.
export function moveAttendanceStatus(logs, date, courseId, oldTeacher, newTeacher) {
  if (oldTeacher === newTeacher) return logs;
  const dayLog = logs[date] || {};
  const oldKey = `${courseId}_${oldTeacher || ''}`;
  const newKey = `${courseId}_${newTeacher || ''}`;
  const cur = dayLog[oldKey];
  if (cur === undefined) return logs;
  const nextDayLog = { ...dayLog, [newKey]: cur };
  delete nextDayLog[oldKey];
  const updated = { ...logs, [date]: nextDayLog };
  store.set('attLogs', updated);
  return updated;
}
