// lib/todayActions.js
//
// Data-resolution hook for the Dashboard's "Today's Actions" (right)
// column. See HANDOFF_dashboard_today_actions.md for the full spec.
//
// Unlike lib/todayItems.js (a pure synchronous function — the left
// column's data source), several sources here are Firestore
// subscriptions (CR status, errand requests), so this is a React hook
// that owns its own useEffect/subscription wiring, not a pure function.
// Dashboard.jsx (or a TodaysActions component it renders) calls this
// once and gets back everything the right column needs, already live.
//
// Attendance resolution here deliberately mirrors pages/Attendance.jsx's
// own schedule-source logic (group-mode CR check -> subscribeRoutine,
// else local store.get('schedule')) rather than the simpler
// schedule_group_cache fallback lib/todayItems.js uses — Dashboard's
// pending-attendance list must never disagree with what /attendance
// itself would show for today, since marking from the dashboard writes
// to the exact same attLogs the real page reads.

import { useEffect, useMemo, useState } from 'react';
import { store, getProfile, getBDNow } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { getGroupId } from '../lib/groupUtils';
import { subscribeCRStatus, subscribeRoutine, subscribePlannerSettings } from '../lib/groupSync';
import { useCanEditGroup } from '../hooks/useCanEditGroup';
import { subscribeMyErrandRequests, subscribeMyAcceptedErrandRequests } from './errandRequests';
import { useRequesterIdentity } from '../pages/ErrandFeed';
import { getScheduleCoursesForDate, resolveTeachersForDate, getDisplayCourseName, getTeachersForCourse } from './attendanceCore';
import { ALTERNATE_TEACHER } from '../pages/Schedule';

const todayStr = () => {
  const d = getBDNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Same "active" convention as pages/ErrandMyRequests.jsx's bucketFor —
// an errand request counts as active/visible on the dashboard while
// it's still open (posted, no one confirmed yet) or confirmed
// (accepted, in progress). finished/cancelled are done, not pending.
const ACTIVE_ERRAND_STATUSES = ['open', 'confirmed'];

function isAutoFull(courseType) {
  return courseType && (courseType.toLowerCase().includes('session') || courseType.toLowerCase().includes('lab'));
}

export function useTodayActions() {
  const profile = getProfile();
  const date = todayStr();

  // ── Attendance: unmarked courses for today ──────────────────────────
  // Mirrors Attendance.jsx's own group-mode schedule resolution exactly
  // (see that file's matching comments) so this list and the real
  // /attendance page can never disagree about what's scheduled today.
  const groupId = useMemo(() => getGroupId(profile), [profile.dept, profile.batch, profile.section]);
  const [groupHasCR, setGroupHasCR] = useState(null);
  useEffect(() => {
    if (!groupId) { setGroupHasCR(false); return; }
    return subscribeCRStatus(groupId, (status) => setGroupHasCR(!!status?.hasCR));
  }, [groupId]);
  const isGroupMode = !!groupId && groupHasCR === true;
  // Same hook Assignments.jsx/Schedule.jsx use for both "can edit
  // teachers" (canEdit) and "is this student the CR/ACR" (myRole) — one
  // subscription instead of a second, separate CR check.
  const { canEdit: canEditTeachers, myRole } = useCanEditGroup(groupId);

  const [schedule, setSchedule] = useState(() => (isGroupMode ? [] : (store.get('schedule') || [])));
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
    if (!isGroupMode) { setSchedule(store.get('schedule') || []); return; }
    if (groupRoutineEntries !== null) setSchedule(groupRoutineEntries);
  }, [isGroupMode, groupRoutineEntries]);

  const [groupTeacherMap, setGroupTeacherMap] = useState(null);
  const [groupTeacherRegistry, setGroupTeacherRegistry] = useState(null);
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
  const [localSettings, setLocalSettings] = useState(() => store.get('scheduleSettings') || {});
  useEffect(() => {
    const refresh = () => setLocalSettings(store.get('scheduleSettings') || {});
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);
  const settings = useMemo(
    () => ({ ...localSettings, courseTeacherMap: groupTeacherMap ?? (localSettings.courseTeacherMap || {}) }),
    [localSettings, groupTeacherMap],
  );
  const teacherRegistry = groupId ? (groupTeacherRegistry || {}) : undefined;

  const [attLogs, setAttLogs] = useState(() => store.get('attLogs') || {});
  useEffect(() => {
    const refresh = () => setAttLogs(store.get('attLogs') || {});
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);

  const courses = useMemo(
    () => getAllCourses(profile).filter((c) => c.status === 'active' || c.status === 'backlog'),
    [profile],
  );

  const attendanceRows = useMemo(() => {
    const scheduledCourses = getScheduleCoursesForDate(schedule, date, groupClassOverrides);
    const schIds = scheduledCourses.map((s) => s.courseId);
    const dayLog = attLogs[date] || {};
    const rows = [];
    courses
      .filter((c) => schIds.includes(c.id) && !isAutoFull(c.type))
      .forEach((course) => {
        const resolved = resolveTeachersForDate(schedule, course.id, date, settings, teacherRegistry);
        const anyNeedsPick = resolved.some((r) => r.needsPick);
        const onDate = [...new Set(resolved.map((r) => r.resolvedTeacher).filter(Boolean))];
        // Slots still needing a pick (rotating/alternate, no override yet
        // for today) collapse into ONE ALTERNATE_TEACHER row instead of
        // spelling out every possible teacher as a separate row — mirrors
        // Attendance.jsx's DailyLog cardData (see its onDate computation),
        // so the dashboard shows the same single "Alternative" card that
        // the /attendance page shows for the same slot.
        const teachers = anyNeedsPick ? [...onDate, ALTERNATE_TEACHER] : (onDate.length ? onDate : getTeachersForCourse(settings, schedule, course.id, teacherRegistry));
        const teacherRows = (teachers.length ? teachers : ['']).map((t) => ({
          teacher: t,
          status: t === ALTERNATE_TEACHER ? null : (dayLog[`${course.id}_${t || ''}`] || null),
        }));
        const allDone = !anyNeedsPick && teacherRows.every((r) => r.status === 'present' || r.status === 'absent');
        if (allDone) return; // marked -> disappears immediately, per handoff decision #3
        rows.push({
          id: `att-${course.id}`,
          course,
          courseName: getDisplayCourseName(course),
          resolved,
          anyNeedsPick,
          teacherRows: teacherRows.filter((r) => !(r.status === 'present' || r.status === 'absent')),
        });
      });
    return rows;
  }, [schedule, date, groupClassOverrides, attLogs, courses, settings, teacherRegistry]);

  // ── Assignments due today, not yet done ──────────────────────────────
  const [assignments, setAssignments] = useState(() => store.get('assignments') || []);
  useEffect(() => {
    const refresh = () => setAssignments(store.get('assignments') || []);
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);
  const assignmentRows = useMemo(
    () => assignments.filter((a) => a.status !== 'done' && a.due === date),
    [assignments, date],
  );

  // ── CR-only: quick-post link + today's CT/Quiz reminder ─────────────
  // "CR-only" here matches ClassNotices.jsx's own gate (myRole === 'cr'
  // || 'acr') — narrower than canEditTeachers above, which also allows
  // campus leads/admins/unclaimed-group verified members.
  const isCR = myRole === 'cr' || myRole === 'acr';
  // CT/Quiz entries live inside the PERSONAL 'schedule' store key itself
  // (entry.eventType === 'CT'|'Quiz', entry.date === 'YYYY-MM-DD') — see
  // pages/CTQuizPlanning.jsx's `events` useMemo, which reads/writes
  // store.get('schedule')/store.set('schedule', ...) directly and never
  // touches the group-shared routine. CTQuizPlanning has no group-mode
  // path at all, so this must read the raw local store key — NOT the
  // `schedule` var above, which in group mode holds mapped class-slot
  // routine entries (no eventType field) instead of the personal list.
  const [personalSchedule, setPersonalSchedule] = useState(() => store.get('schedule') || []);
  useEffect(() => {
    const refresh = () => setPersonalSchedule(store.get('schedule') || []);
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);
  const todaysCTQuiz = useMemo(
    () => (personalSchedule || []).filter((e) => e && (e.eventType === 'CT' || e.eventType === 'Quiz') && (e.date || '').slice(0, 10) === date),
    [personalSchedule, date],
  );

  // ── Pick and Drop: active errand requests (posted or accepted) ──────
  // Real uid comes from auth.currentUser, not the student `profile`
  // object (which has no uid field) — same identity hook ErrandFeed.jsx/
  // ErrandMyRequests.jsx use for every errand-related subscription.
  const { uid } = useRequesterIdentity();
  const [postedErrands, setPostedErrands] = useState(null);
  const [acceptedErrands, setAcceptedErrands] = useState(null);
  useEffect(() => subscribeMyErrandRequests(uid, setPostedErrands), [uid]);
  useEffect(() => subscribeMyAcceptedErrandRequests(uid, setAcceptedErrands), [uid]);
  const activeErrandCount = useMemo(() => {
    const posted = (postedErrands || []).filter((r) => ACTIVE_ERRAND_STATUSES.includes(r.status));
    const accepted = (acceptedErrands || [])
      .filter((a) => a.request && ACTIVE_ERRAND_STATUSES.includes(a.request.status));
    return posted.length + accepted.length;
  }, [postedErrands, acceptedErrands]);

  const isLoading = groupHasCR === null && !!groupId;

  return {
    date,
    isLoading,
    attendance: { rows: attendanceRows, schedule, settings, teacherRegistry, canEditTeachers },
    assignments: assignmentRows,
    cr: { isCR, todaysCTQuiz },
    errands: { activeCount: activeErrandCount },
  };
}
