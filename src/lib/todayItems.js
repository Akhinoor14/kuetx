// lib/todayItems.js
//
// Single source of truth for "what's on today" — used by both
// pages/Today.jsx (full timeline) and components/TodayCard.jsx (the
// short dashboard widget). Keeping the merge/sort logic here means the
// two views can never show different answers for the same day.
//
// Sources merged (all read-only except tuition/todo, which live only in
// today_plans — see store.js):
//   - schedule       -> today's classes, read-only (Schedule.jsx owns writes)
//   - today_plans    -> 'tuition' (weekly-recurring) and 'todo' (one-time)
//   - assignments    -> anything due today, read-only (Assignments.jsx owns writes)
//
// Friday/Saturday (or a marked holiday) simply means the class list is
// empty for that source — every other source is still evaluated normally,
// so a holiday never means an empty page.

import { store, getWeekdayName, getLocalDateKey, parseTimeToMinutes, isRoutineHoliday, getTodayPlans, getCurrentTermKey, getBDNow, isClassOff, classOverrideSlotKey } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { getEffectiveOccurrence } from './sessionalCadence';

// Resolves a schedule entry's course code for display. Prefers the
// entry's own displayName (Schedule.jsx already fills this with the
// course code for most entries — see normalizeScheduleEntries), and
// falls back to a courses-list lookup by courseId.
function resolveCourseCode(entry, courseById) {
  const dn = String(entry.displayName || '').trim();
  if (dn) return dn;
  const course = courseById.get(entry.courseId);
  return course?.code || course?.baseCode || 'Class';
}

// BUGFIX (major logic gap — see groupSync.js's clearRoutineForTermChange
// for the primary fix and full writeup). This is a fallback-only filter
// for the rare local/no-group schedule path (see Schedule.jsx's matching
// comment) — group-mode routine is already term-clean at the source once
// a CR changes terms, since clearRoutineForTermChange wipes the shared
// Firestore routineEntries directly.
const TERM_KEY_IN_COURSE_ID = /^[^:]+:(Y\dT\d):/;
function isCurrentTermEntry(entry, currentTermKey) {
  if (!currentTermKey) return true;
  const match = TERM_KEY_IN_COURSE_ID.exec(entry.courseId || '');
  if (!match) return true; // not a curriculum-linked id — leave as-is
  return match[1] === currentTermKey;
}

export function buildTodayItems(profile, now = getBDNow()) {
  const todayKey = getLocalDateKey(now);
  const todayWeekday = getWeekdayName(now);
  const holidayDates = (store.get('scheduleSettings') || {}).holidayDates || [];
  const isHoliday = isRoutineHoliday(todayKey, holidayDates);

  const items = [];

  // ── Classes (read-only, from Schedule.jsx's own storage) ──────────────
  if (!isHoliday) {
    // Group-mode classes live in their own cache key (schedule_group_cache),
    // separate from the personal 'schedule' key — see the BUGFIX comment in
    // Schedule.jsx's subscribeRoutine handler for why they must stay apart.
    // A student in group mode has classes only in the group cache; a
    // student not in group mode has classes only in 'schedule'. Prefer the
    // group cache when it actually has something for today, otherwise fall
    // back to the personal schedule.
    const personalSchedule = Array.isArray(store.get('schedule')) ? store.get('schedule') : [];
    const groupSchedule = Array.isArray(store.get('schedule_group_cache')) ? store.get('schedule_group_cache') : [];
    const groupHasToday = groupSchedule.some((e) => e.day === todayWeekday);
    const schedule = groupHasToday ? groupSchedule : personalSchedule;

    let courseById = new Map();
    try {
      courseById = new Map(getAllCourses(profile || {}).map((c) => [c.id, c]));
    } catch { /* profile not ready yet — codes fall back to displayName only */ }

    // Sessional/Lab alternating-week cadence (Phase 3, see
    // sessionalCadence.js) — a slot with no sessionalCadence entry runs
    // every week same as today's existing behavior; only slots the CR
    // explicitly configured with mode !== 'weekly' skip a "this week is
    // off" occurrence here.
    const sessionalCadence = (store.get('scheduleSettings') || {}).sessionalCadence || {};

    schedule
      .filter((e) => e.day === todayWeekday && isCurrentTermEntry(e, getCurrentTermKey(profile)))
      // CR-triggered on/off toggle (Class Routine page) — separate from the
      // app-wide holiday check above. A slot/day the CR marked off for
      // TODAY specifically shouldn't appear here, even though it's a
      // normal (non-holiday) weekday. See store.js's isClassOff().
      .filter((e) => !isClassOff(todayKey, classOverrideSlotKey(e.courseId, e.day, e.slot)))
      // Sessional/Lab alternating-week cadence — skip a slot whose
      // effective occurrence for TODAY is 'off' (an alternating "off"
      // week, or an ad-hoc cancellation). Independent of isClassOff()
      // above: that's a CR-triggered on/off toggle, this is the slot's
      // own recurring cadence. Both can apply to the same slot.
      .filter((e) => getEffectiveOccurrence(sessionalCadence[classOverrideSlotKey(e.courseId, e.day, e.slot)], todayKey) !== 'off')
      .forEach((e) => {
        items.push({
          id: `class-${e.id}`,
          kind: 'class',
          title: resolveCourseCode(e, courseById),
          sub: e.teacherName || '',
          time: e.slot || '',
          minutes: parseTimeToMinutes(e.slot),
          link: '/schedule',
        });
      });
  }

  // ── Tuition + one-time to-dos (this page's own data) ──────────────────
  const plans = getTodayPlans();
  plans.forEach((p) => {
    if (p.type === 'tuition') {
      if (!Array.isArray(p.days) || !p.days.includes(todayWeekday)) return;
      items.push({
        id: `tuition-${p.id}`,
        kind: 'tuition',
        title: p.title || 'Tuition',
        sub: p.subject || '',
        time: p.time || '',
        minutes: parseTimeToMinutes(p.time),
        planId: p.id,
        editable: true,
      });
    } else if (p.type === 'todo') {
      if (p.date !== todayKey) return;
      items.push({
        id: `todo-${p.id}`,
        kind: 'todo',
        title: p.title || 'To-do',
        sub: p.note || '',
        time: p.time || '',
        minutes: parseTimeToMinutes(p.time),
        planId: p.id,
        editable: true,
      });
    }
  });

  // ── Assignments due today (read-only, from Assignments.jsx's storage) ─
  const assignments = Array.isArray(store.get('assignments')) ? store.get('assignments') : [];
  assignments
    .filter((a) => a.status !== 'done' && a.due === todayKey)
    .forEach((a) => {
      items.push({
        id: `assignment-${a.id}`,
        kind: 'assignment',
        title: a.title || 'Assignment due',
        sub: 'Due today',
        time: '',
        minutes: null, // no fixed time — assignments sort to the top of their group
        link: '/assignments',
      });
    });

  // Sort: timed items by time, then untimed items (assignments etc.) first
  // within their bucket so "due today" doesn't get buried by class times.
  items.sort((a, b) => {
    if (a.minutes === null && b.minutes === null) return 0;
    if (a.minutes === null) return -1;
    if (b.minutes === null) return 1;
    return a.minutes - b.minutes;
  });

  return { items, isHoliday, todayWeekday, todayKey };
}

// Splits the merged, time-sorted list into Morning / Afternoon / Evening
// buckets for the full Today page. Untimed items (minutes === null) go
// into whichever bucket the current clock is in, so "due today" always
// shows near the top of the current section instead of a separate list.
export function groupByPartOfDay(items, now = getBDNow()) {
  const bucketFor = (mins) => {
    if (mins === null) return null;
    if (mins < 12 * 60) return 'Morning';
    if (mins < 17 * 60) return 'Afternoon';
    return 'Evening';
  };
  const currentBucket = bucketFor(now.getHours() * 60 + now.getMinutes()) || 'Morning';

  const groups = { Morning: [], Afternoon: [], Evening: [] };
  items.forEach((item) => {
    const b = bucketFor(item.minutes) || currentBucket;
    groups[b].push(item);
  });
  return groups;
}

// Given the sorted item list, returns { next, following, doneForToday }
// for the compact dashboard card: the very next upcoming item, one more
// after it, and whether every timed item has already passed.
export function getUpcomingPair(items, now = getBDNow()) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = items.filter((it) => it.minutes === null || it.minutes >= nowMinutes);
  const hadAnyTimed = items.some((it) => it.minutes !== null);
  return {
    next: upcoming[0] || null,
    following: upcoming[1] || null,
    doneForToday: items.length > 0 && upcoming.length === 0,
    isEmpty: items.length === 0,
    hadAnyTimed,
  };
}
