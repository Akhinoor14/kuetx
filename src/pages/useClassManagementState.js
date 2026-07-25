import { useEffect, useMemo, useState } from 'react';
import { store, uid, getProfile, getCurrentTermKey } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { getGroupId } from '../lib/groupUtils';
import {
  subscribeRoutine,
  subscribePlannerLogs,
  addPlannerLogEntry,
  deletePlannerLogEntry,
  subscribePlannerSettings,
  updatePlannerSettings,
} from '../lib/groupSync';
import { subscribeGroupTermStartDate, setGroupTermStartDate } from '../lib/termStartDateSync';
import {
  createDefaultCoursePlan,
  buildExportPayload,
  getCourseTeacherCountsFromSchedule,
  matchesTerm,
  normalizeTeacherList,
} from '../lib/plannerUtils';

export const TERM_KEY_RE = /^Y\dT\d$/;
export const ROUTINE_DAY_DEFS = [
  { key: 'Sunday', label: 'Sun' },
  { key: 'Monday', label: 'Mon' },
  { key: 'Tuesday', label: 'Tue' },
  { key: 'Wednesday', label: 'Wed' },
  { key: 'Thursday', label: 'Thu' },
];
export const ROUTINE_DAY_KEYS = ROUTINE_DAY_DEFS.map(d => d.key);

/**
 * Shared state + handlers for the old ClassManagement.jsx (Routine +
 * Planner tabs). Extracted verbatim (no logic re-derived) so the new
 * independent Routine / Class Planner pages both stay backed by exactly
 * the same Firestore subscriptions and derived values as before the
 * split — only the JSX/tab-switch UI changed, not any underlying
 * behavior.
 */
export function useClassManagementState() {
  const profile = getProfile();
  const allCourses = useMemo(() => getAllCourses(profile), [profile]);
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(
    () => allCourses.filter(course => matchesTerm(course, currentTermKey)),
    [allCourses, currentTermKey],
  );

  const groupId = useMemo(() => getGroupId(profile), [profile.dept, profile.batch]);

  const [groupTermStartDate, setGroupTermStartDateState] = useState(null);
  const [termDateDraft, setTermDateDraft] = useState('');
  const [termDateSaving, setTermDateSaving] = useState(false);
  const [termDateError, setTermDateError] = useState('');
  useEffect(() => {
    if (!groupId) { setGroupTermStartDateState(null); return; }
    return subscribeGroupTermStartDate(groupId, (date) => {
      setGroupTermStartDateState(date);
      setTermDateDraft((prev) => (prev ? prev : date || ''));
    });
  }, [groupId]);
  const handleSaveTermStartDate = async () => {
    if (!groupId || !termDateDraft) return;
    setTermDateSaving(true);
    setTermDateError('');
    try {
      await setGroupTermStartDate(groupId, termDateDraft);
    } catch (err) {
      setTermDateError(err?.message || 'Could not save. Try again.');
    } finally {
      setTermDateSaving(false);
    }
  };

  const [groupRoutine, setGroupRoutine] = useState([]);
  useEffect(() => {
    if (!groupId) { setGroupRoutine([]); return; }
    return subscribeRoutine(groupId, (entries) => {
      setGroupRoutine((entries || []).map((e) => ({
        id: e.id,
        day: e.day || 'Sunday',
        slot: e.slot || '',
        courseId: e.courseId || '',
        teacherName: e.teacherName || '',
        displayName: e.displayName || e.courseCode || e.courseName || '',
        room: e.room || '',
        note: e.note || '',
        type: e.type || 'Theory',
      })));
    });
  }, [groupId]);

  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [plannerState, setPlannerState] = useState(() => store.get('classManagementPlans') || {});

  const [groupPlannerLogs, setGroupPlannerLogs] = useState([]);
  useEffect(() => {
    if (!groupId) { setGroupPlannerLogs([]); return; }
    return subscribePlannerLogs(groupId, (entries) => setGroupPlannerLogs(entries || []));
  }, [groupId]);

  const [groupPlannerSettings, setGroupPlannerSettings] = useState(null);
  useEffect(() => {
    if (!groupId) { setGroupPlannerSettings(null); return; }
    return subscribePlannerSettings(groupId, (data) => setGroupPlannerSettings(data || {}));
  }, [groupId]);

  const effectiveCourseTeacherMap = groupId
    ? (groupPlannerSettings?.courseTeacherMap || {})
    : (settings?.courseTeacherMap || {});
  const effectivePlannerPlans = groupId
    ? (groupPlannerSettings?.plans || {})
    : null;

  const [selectedRoutineDay, setSelectedRoutineDay] = useState(() => {
    const todayKey = ROUTINE_DAY_KEYS[new Date().getDay()];
    return todayKey || 'Sunday';
  });
  const [viewMode, setViewMode] = useState('automatic');
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '' });
  const [detailState, setDetailState] = useState({ open: false, courseId: '' });
  const [resetState, setResetState] = useState({ open: false, course: null, count: 0 });

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };

  const isTermScopedPlanner = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).some(key => TERM_KEY_RE.test(key));
  };

  const getCurrentTermPlans = (state) => {
    if (!state || typeof state !== 'object') return {};
    if (isTermScopedPlanner(state)) return state[currentTermKey] || {};
    return state;
  };

  const localCurrentTermPlans = useMemo(() => getCurrentTermPlans(plannerState), [plannerState, currentTermKey]);
  const currentTermPlans = groupId ? effectivePlannerPlans : localCurrentTermPlans;
  const courseMap = useMemo(() => new Map(allCourses.map(course => [course.id, course])), [allCourses]);

  const currentTermScheduleEntries = useMemo(() => {
    const currentCourseIds = new Set(currentTermCourses.map(course => course.id));
    return (groupId ? groupRoutine : (schedule || [])).filter(entry => currentCourseIds.has(entry.courseId));
  }, [groupId, groupRoutine, schedule, currentTermCourses]);

  const routineEntriesByDay = useMemo(() => {
    const next = ROUTINE_DAY_KEYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
    currentTermScheduleEntries.forEach(entry => {
      if (!next[entry.day]) return;
      next[entry.day].push(entry);
    });
    ROUTINE_DAY_KEYS.forEach(day => {
      next[day] = next[day].slice().sort((a, b) => String(a.slot || '').localeCompare(String(b.slot || '')));
    });
    return next;
  }, [currentTermScheduleEntries]);

  const selectedRoutineEntries = routineEntriesByDay[selectedRoutineDay] || [];
  const selectedRoutineLabel = ROUTINE_DAY_DEFS.find(d => d.key === selectedRoutineDay)?.key || selectedRoutineDay;
  const assignedTeacherCount = useMemo(() => {
    const teacherNames = new Set();
    currentTermCourses.forEach(course => {
      const teachers = currentTermPlans?.[course.id]?.teachers || effectiveCourseTeacherMap?.[course.id] || [];
      (teachers || []).forEach(teacher => {
        if (teacher) teacherNames.add(teacher);
      });
    });
    return teacherNames.size;
  }, [currentTermCourses, currentTermPlans, effectiveCourseTeacherMap]);
  const currentTermScheduledCourseCount = useMemo(() => {
    return new Set(currentTermScheduleEntries.map(entry => entry.courseId)).size;
  }, [currentTermScheduleEntries]);

  useEffect(() => {
    if (selectedRoutineEntries.length > 0) return;
    const firstDayWithEntries = ROUTINE_DAY_KEYS.find(day => (routineEntriesByDay[day] || []).length > 0);
    if (firstDayWithEntries && firstDayWithEntries !== selectedRoutineDay) {
      setSelectedRoutineDay(firstDayWithEntries);
    }
  }, [routineEntriesByDay, selectedRoutineDay, selectedRoutineEntries.length]);

  const formatRoutineSlot = (value) => String(value || '').replace(/\s+break\s*$/i, '').trim();

  const buildRoutineCopyText = (day, entries) => {
    if (!entries.length) {
      return `Routine for ${day}\n\nNo classes added yet.`;
    }

    const lines = [`*_📅 Routine for ${day}_*`, ''];

    entries.forEach((entry, index) => {
      const course = courseMap.get(entry.courseId);
      const courseLabel = entry.displayName || course?.code || course?.name || 'Unknown Course';
      const teacherLabel = entry.teacherName || 'Teacher not set';
      lines.push(`${index + 1}. *${formatRoutineSlot(entry.slot)}* — _${courseLabel} · ${teacherLabel}_`);
    });

    return lines.join('\n');
  };

  const refreshFromStore = () => {
    setSchedule(store.get('schedule') || []);
    setSettings(store.get('scheduleSettings') || {});
    setPlannerState(store.get('classManagementPlans') || {});
  };

  useEffect(() => {
    store.set('schedule', schedule);
  }, [schedule]);

  useEffect(() => {
    store.set('scheduleSettings', settings);
  }, [settings]);

  useEffect(() => {
    store.set('classManagementPlans', plannerState);
  }, [plannerState]);

  useEffect(() => {
    store.set('classManagementPlannerMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handleStoreUpdate = () => refreshFromStore();
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  useEffect(() => {
    if (!currentTermKey || groupId) return;

    setPlannerState(prev => {
      const baseState = prev && typeof prev === 'object' ? prev : {};
      const nextState = isTermScopedPlanner(baseState) ? { ...baseState } : { [currentTermKey]: { ...baseState } };
      const currentPlans = { ...(nextState[currentTermKey] || {}) };
      const teacherMap = settings?.courseTeacherMap || {};
      let changed = false;

      currentTermCourses.forEach(course => {
        const existing = currentPlans[course.id];
        const defaultTeachers = normalizeTeacherList(existing?.teachers?.length ? existing.teachers : teacherMap[course.id] || []);
        const defaultPlan = createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: defaultTeachers });
        const nextPlan = {
          ...defaultPlan,
          ...existing,
          teachers: defaultTeachers,
          plannedTotalClasses: existing?.plannedTotalClasses || defaultPlan.plannedTotalClasses,
          perWeekTarget: existing?.perWeekTarget || defaultPlan.perWeekTarget,
        };

        if (!existing || JSON.stringify(existing) !== JSON.stringify(nextPlan)) {
          currentPlans[course.id] = nextPlan;
          changed = true;
        }
      });

      if (!changed) return baseState;
      return { ...nextState, [currentTermKey]: currentPlans };
    });
  }, [currentTermCourses, currentTermKey, settings?.courseTeacherMap, groupId]);

  useEffect(() => {
    if (!currentTermKey || !groupId || groupPlannerSettings === null) return;

    const existingPlans = groupPlannerSettings?.plans || {};
    const teacherMap = groupPlannerSettings?.courseTeacherMap || {};
    const nextPlans = { ...existingPlans };
    let changed = false;

    currentTermCourses.forEach(course => {
      const existing = existingPlans[course.id];
      const defaultTeachers = normalizeTeacherList(existing?.teachers?.length ? existing.teachers : teacherMap[course.id] || []);
      const defaultPlan = createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: defaultTeachers });
      const nextPlan = {
        ...defaultPlan,
        ...existing,
        teachers: defaultTeachers,
        plannedTotalClasses: existing?.plannedTotalClasses || defaultPlan.plannedTotalClasses,
        perWeekTarget: existing?.perWeekTarget || defaultPlan.perWeekTarget,
      };

      if (!existing || JSON.stringify(existing) !== JSON.stringify(nextPlan)) {
        nextPlans[course.id] = nextPlan;
        changed = true;
      }
    });

    if (!changed) return;
    updatePlannerSettings(groupId, profile, { plans: nextPlans }).catch((e) => console.error('[ClassManagement] plan default-fill failed:', e));
  }, [currentTermCourses, currentTermKey, groupId, groupPlannerSettings, profile]);

  const plannerRows = useMemo(() => {
    const manualLogs = groupId ? groupPlannerLogs : (schedule || []);
    return currentTermCourses.map(course => {
      const plan = currentTermPlans[course.id] || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: effectiveCourseTeacherMap?.[course.id] || [] });
      const fallbackTeachers = Array.from(new Set((groupId ? groupRoutine : (schedule || [])).filter(e => e.courseId === course.id).map(e => String(e.teacherName || '').trim()).filter(Boolean)));
      const planTeachers = (Array.isArray(plan?.teachers) && plan.teachers.length) ? plan.teachers : (effectiveCourseTeacherMap?.[course.id] || fallbackTeachers || []);
      const teacherCounts = viewMode === 'manual'
        ? getCourseTeacherCountsFromSchedule(manualLogs, course.id)
        : getCourseTeacherCountsFromSchedule(currentTermScheduleEntries, course.id);
      const totalLogged = viewMode === 'manual'
        ? manualLogs.filter(entry => entry.courseId === course.id).length
        : currentTermScheduleEntries.filter(entry => entry.courseId === course.id).length;
      return {
        course,
        plan: { ...plan, teachers: normalizeTeacherList(planTeachers) },
        teacherCounts,
        totalLogged,
      };
    });
  }, [currentTermCourses, currentTermPlans, currentTermKey, schedule, effectiveCourseTeacherMap, groupId, groupPlannerLogs, viewMode, currentTermScheduleEntries]);

  const updateCurrentTermPlan = (courseId, updater) => {
    if (groupId) {
      const existingPlans = groupPlannerSettings?.plans || {};
      const currentPlan = existingPlans[courseId] || null;
      const nextPlan = updater(currentPlan);
      if (!nextPlan) return;
      updatePlannerSettings(groupId, profile, { plans: { ...existingPlans, [courseId]: nextPlan } })
        .catch((e) => console.error('[ClassManagement] updateCurrentTermPlan failed:', e));
      return;
    }

    setPlannerState(prev => {
      const baseState = prev && typeof prev === 'object' ? prev : {};
      const nextState = isTermScopedPlanner(baseState) ? { ...baseState } : { [currentTermKey]: { ...baseState } };
      const currentPlans = { ...(nextState[currentTermKey] || {}) };
      const currentPlan = currentPlans[courseId] || null;
      const nextPlan = updater(currentPlan);
      if (!nextPlan) return baseState;
      currentPlans[courseId] = nextPlan;
      return { ...nextState, [currentTermKey]: currentPlans };
    });
  };

  const openCourseDetails = (courseId) => setDetailState({ open: true, courseId });
  const closeCourseDetails = () => setDetailState({ open: false, courseId: '' });

  const formatDateTime = (iso) => {
    if (!iso) return 'Unknown';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const removeLogEntry = (logId) => {
    if (groupId) {
      deletePlannerLogEntry(groupId, logId, profile).catch((e) => console.error('[ClassManagement] removeLogEntry failed:', e));
      return;
    }
    setSchedule(prev => (prev || []).filter(entry => entry.id !== logId));
  };

  const quickLogClass = (course, teacherName = '') => {
    if (!course?.id) return;

    const getTeachersFromSchedule = (courseId) => {
      return Array.from(new Set((groupId ? groupRoutine : (schedule || [])).filter(e => e.courseId === courseId).map(e => String(e.teacherName || '').trim()).filter(Boolean)));
    };

    const assignedTeachers = normalizeTeacherList((effectiveCourseTeacherMap || {})[course.id] || getTeachersFromSchedule(course.id) || []);
    const isTheory = String(course.type || 'Theory').toLowerCase() === 'theory';

    if (isTheory && assignedTeachers.length === 0) {
      openTeacherDialog(course.id);
      return;
    }

    const selectedTeacher = String(teacherName || assignedTeachers[0] || '').trim();
    const entry = {
      courseId: course.id,
      displayName: course.code,
      type: course.type || 'Theory',
      teacherName: selectedTeacher,
      loggedAt: new Date().toISOString(),
      day: 'Manual',
      slot: 'Manual',
      note: 'Logged manually',
    };

    if (groupId) {
      addPlannerLogEntry(groupId, profile, entry).catch((e) => console.error('[ClassManagement] quickLogClass failed:', e));
      return;
    }

    setSchedule(prev => [...(prev || []), { ...entry, id: uid() }]);
  };

  const copyRoutineForSelectedDay = async () => {
    const text = buildRoutineCopyText(selectedRoutineDay, selectedRoutineEntries);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  const exportRoutineBackup = () => {
    const payload = {
      type: 'kuetx-routine-backup',
      exportedAt: new Date().toISOString(),
      data: buildExportPayload({
        termKey: currentTermKey,
        plannerState: groupId ? { [currentTermKey]: currentTermPlans } : plannerState,
        settings: groupId ? { ...(settings || {}), courseTeacherMap: effectiveCourseTeacherMap } : settings,
        schedule: groupId ? groupPlannerLogs : schedule,
      }),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const _td = new Date();
    link.download = `kuetx-routine-backup-${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, '0')}-${String(_td.getDate()).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetPlan = (course) => {
    if (!course?.id) return;
    const manualLogs = groupId ? groupPlannerLogs : (schedule || []);
    const existingLogs = manualLogs.filter(entry => entry.courseId === course.id).length;
    const timer = setTimeout(() => setResetState(prev => ({ ...(prev || {}), open: false, timer: null })), 9000);
    setResetState({ open: true, course, count: existingLogs, timer });
  };

  const confirmResetPlan = (shouldRemoveLogs = true) => {
    const { course } = resetState;
    if (!course?.id) {
      if (resetState.timer) clearTimeout(resetState.timer);
      setResetState({ open: false, course: null, count: 0, timer: null });
      return;
    }

    if (shouldRemoveLogs) {
      if (groupId) {
        groupPlannerLogs
          .filter(entry => entry.courseId === course.id)
          .forEach(entry => deletePlannerLogEntry(groupId, entry.id, profile).catch((e) => console.error('[ClassManagement] resetPlan log delete failed:', e)));
      } else {
        setSchedule(prev => (prev || []).filter(entry => entry.courseId !== course.id));
      }
    }

    updateCurrentTermPlan(course.id, () => createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: effectiveCourseTeacherMap?.[course.id] || [] }));
    if (resetState.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const cancelResetPlan = () => {
    if (resetState?.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const openTeacherDialog = (courseId) => setCourseTeacherDialogState({ open: true, courseId });
  const openCourseTeacherDialog = openTeacherDialog;
  const handleCourseTeacherDialogClose = () => setCourseTeacherDialogState({ open: false, courseId: '' });
  const handleCourseTeacherDialogSave = (teachersList) => {
    const courseId = courseTeacherDialogState.courseId;
    if (!courseId) return;
    const normalizedTeachers = normalizeTeacherList(teachersList);

    if (groupId) {
      const next = { ...(groupPlannerSettings?.courseTeacherMap || {}) };
      next[courseId] = normalizedTeachers;
      updatePlannerSettings(groupId, profile, { courseTeacherMap: next })
        .catch((e) => console.error('[ClassManagement] courseTeacherMap save failed:', e));
    } else {
      const next = { ...(settings.courseTeacherMap || {}) };
      next[courseId] = normalizedTeachers;
      setSettings({ ...(settings || {}), courseTeacherMap: next });
    }

    updateCurrentTermPlan(courseId, (currentPlan) => ({
      ...currentPlan,
      teachers: normalizedTeachers,
    }));
    handleCourseTeacherDialogClose();
  };

  return {
    profile, allCourses, currentTermKey, currentTermCourses, groupId,
    groupTermStartDate, termDateDraft, setTermDateDraft, termDateSaving, termDateError, setTermDateError, handleSaveTermStartDate,
    groupRoutine, schedule, setSchedule, settings, setSettings, plannerState, setPlannerState,
    groupPlannerLogs, groupPlannerSettings, effectiveCourseTeacherMap, effectivePlannerPlans,
    selectedRoutineDay, setSelectedRoutineDay, viewMode, setViewMode,
    courseTeacherDialogState, setCourseTeacherDialogState, detailState, setDetailState, resetState, setResetState,
    getInitials, currentTermPlans, courseMap, currentTermScheduleEntries, routineEntriesByDay,
    selectedRoutineEntries, selectedRoutineLabel, assignedTeacherCount, currentTermScheduledCourseCount,
    formatRoutineSlot, buildRoutineCopyText, plannerRows, updateCurrentTermPlan,
    openCourseDetails, closeCourseDetails, formatDateTime, removeLogEntry, quickLogClass,
    copyRoutineForSelectedDay, exportRoutineBackup, resetPlan, confirmResetPlan, cancelResetPlan,
    openTeacherDialog, openCourseTeacherDialog, handleCourseTeacherDialogClose, handleCourseTeacherDialogSave,
  };
}
