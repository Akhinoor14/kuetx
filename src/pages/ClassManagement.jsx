import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, Upload, Users } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey } from '../store/store';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import Schedule from './Schedule';
import {
  buildExportPayload,
  computeDefaultTotalClasses,
  computePerWeekTarget,
  createDefaultCoursePlan,
  getPlanCompletionCount,
  getPlanTeacherCounts,
  matchesTerm,
  normalizeTeacherList,
} from '../lib/plannerUtils';

const TERM_KEY_RE = /^Y\dT\d$/;

export default function ClassManagement() {
  const profile = getProfile();
  const allCourses = useMemo(() => getAllCourses(profile), [profile]);
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(
    () => allCourses.filter(course => matchesTerm(course, currentTermKey)),
    [allCourses, currentTermKey],
  );

  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [plannerState, setPlannerState] = useState(() => store.get('classManagementPlans') || {});
  const [activeTab, setActiveTab] = useState('routine');
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '', source: null });
  const backupInputRef = useRef(null);

  const isTermScopedPlanner = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).some(key => TERM_KEY_RE.test(key));
  };

  const getCurrentTermPlans = (state) => {
    if (!state || typeof state !== 'object') return {};
    if (isTermScopedPlanner(state)) return state[currentTermKey] || {};
    return state;
  };

  const currentTermPlans = useMemo(() => getCurrentTermPlans(plannerState), [plannerState, currentTermKey]);

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
    const handleStoreUpdate = () => refreshFromStore();
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  useEffect(() => {
    if (!currentTermKey) return;

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
        const logs = Array.isArray(existing?.logs) ? existing.logs : [];
        const completed = Number.isFinite(existing?.completed) ? existing.completed : logs.length;
        const completedByTeacher = existing?.completedByTeacher && typeof existing.completedByTeacher === 'object'
          ? existing.completedByTeacher
          : getPlanTeacherCounts({ logs });
        const plannedTotalClasses = existing?.plannedTotalClasses || defaultPlan.plannedTotalClasses;
        const perWeekTarget = existing?.perWeekTarget || computePerWeekTarget(plannedTotalClasses, 13);
        const teacherShares = Array.isArray(existing?.teacherShares) && existing.teacherShares.length ? existing.teacherShares : defaultPlan.teacherShares;
        const nextPlan = {
          ...defaultPlan,
          ...existing,
          termKey: currentTermKey,
          courseId: course.id,
          code: course.code,
          name: course.name,
          credits: course.credits,
          type: course.type || 'Theory',
          teachers: defaultTeachers,
          plannedTotalClasses,
          perWeekTarget,
          completed,
          completedByTeacher,
          teacherShares,
          logs,
          updatedAt: existing?.updatedAt || defaultPlan.updatedAt,
        };

        if (!existing || JSON.stringify(existing) !== JSON.stringify(nextPlan)) {
          currentPlans[course.id] = nextPlan;
          changed = true;
        }
      });

      if (!changed) return baseState;
      return { ...nextState, [currentTermKey]: currentPlans };
    });
  }, [currentTermCourses, currentTermKey, settings?.courseTeacherMap]);

  const plannerRows = useMemo(() => {
    return currentTermCourses.map(course => {
      const plan = currentTermPlans[course.id] || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[course.id] || [] });
      const teacherCounts = getPlanTeacherCounts(plan);
      return {
        course,
        plan,
        teacherCounts,
        completed: getPlanCompletionCount(plan),
        loggedCount: (schedule || []).filter(entry => entry.courseId === course.id).length,
      };
    });
  }, [currentTermCourses, currentTermPlans, currentTermKey, schedule, settings?.courseTeacherMap]);

  const updateCurrentTermPlan = (courseId, updater) => {
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

  const quickLogClass = (course, teacherName = '') => {
    if (!course?.id) return;
    const selectedTeacher = String(teacherName || '').trim();
    const entry = {
      id: uid(),
      day: 'Monday',
      slot: 'TBD',
      courseId: course.id,
      teacherName: selectedTeacher,
      displayName: `${course.code} ${course.name}`,
      type: course.type || 'Theory',
      room: '',
      note: '',
    };

    setSchedule(prev => [...(prev || []), entry]);

    updateCurrentTermPlan(course.id, (existing) => {
      const basePlan = existing || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[course.id] || [] });
      const logs = Array.isArray(basePlan.logs) ? [...basePlan.logs] : [];
      logs.push({
        id: entry.id,
        date: new Date().toISOString(),
        day: entry.day,
        slot: entry.slot,
        teacher: selectedTeacher,
        note: '',
        source: 'manual',
      });
      const completedByTeacher = { ...(basePlan.completedByTeacher || {}) };
      if (selectedTeacher) completedByTeacher[selectedTeacher] = (completedByTeacher[selectedTeacher] || 0) + 1;
      return {
        ...basePlan,
        logs,
        completed: logs.length,
        completedByTeacher,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const loadRoutineFromStore = () => {
    refreshFromStore();
    setActiveTab('routine');
  };

  const loadPlannerFromStore = () => {
    refreshFromStore();
    setActiveTab('planner');
  };

  const resetPlan = (course) => {
    if (!course?.id) return;
    updateCurrentTermPlan(course.id, () => createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[course.id] || [] }));
  };

  const openTeacherDialog = (courseId, source = 'planner') => setCourseTeacherDialogState({ open: true, courseId, source });
  const handleCourseTeacherDialogClose = () => setCourseTeacherDialogState({ open: false, courseId: '', source: null });
  const handleCourseTeacherDialogSave = (teachersList) => {
    const courseId = courseTeacherDialogState.courseId;
    if (!courseId) return;
    const normalizedTeachers = normalizeTeacherList(teachersList);
    const next = { ...(settings.courseTeacherMap || {}) };
    next[courseId] = normalizedTeachers;
    setSettings({ ...(settings || {}), courseTeacherMap: next });

    updateCurrentTermPlan(courseId, (existing) => {
      const course = currentTermCourses.find(item => item.id === courseId);
      if (!course && !existing) return null;
      const resolvedCourse = course || existing;
      const plannedTotalClasses = existing?.plannedTotalClasses || computeDefaultTotalClasses(resolvedCourse.credits, resolvedCourse.type);
      return {
        ...(existing || createDefaultCoursePlan({ course: resolvedCourse, termKey: currentTermKey, teachers: normalizedTeachers })),
        teachers: normalizedTeachers,
        plannedTotalClasses,
        perWeekTarget: existing?.perWeekTarget || computePerWeekTarget(plannedTotalClasses, 13),
        teacherShares: normalizedTeachers.length ? createDefaultCoursePlan({ course: resolvedCourse, termKey: currentTermKey, teachers: normalizedTeachers }).teacherShares : [],
        updatedAt: new Date().toISOString(),
      };
    });

    handleCourseTeacherDialogClose();
  };

  const handleExportPlannerBackup = () => {
    const payload = buildExportPayload({ termKey: currentTermKey, plannerState, settings, schedule });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class-planner-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlannerBackupClick = () => backupInputRef.current?.click();
  const handleImportPlannerBackup = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.schedule)) setSchedule(parsed.schedule);
        if (parsed.scheduleSettings) setSettings(parsed.scheduleSettings);
        else if (parsed.settings) setSettings(parsed.settings);

        const importedPlans = parsed.classManagementPlans || parsed.plannerState || parsed.classPlans || parsed.plans || {};
        if (importedPlans && typeof importedPlans === 'object') {
          if (Object.keys(importedPlans).some(key => TERM_KEY_RE.test(key))) {
            setPlannerState(importedPlans);
          } else {
            setPlannerState(prev => ({ ...(prev && typeof prev === 'object' ? prev : {}), [currentTermKey]: importedPlans }));
          }
        }
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="page-enter page-container" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Class Management</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Profile: {profile.name || '—'} {profile.isCR ? '· Class Rep' : ''} · Term: {currentTermKey || 'Unknown'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={loadRoutineFromStore} className={activeTab === 'routine' ? 'btn btn-primary' : 'btn btn-ghost'}>Routine</button>
          <button onClick={loadPlannerFromStore} className={activeTab === 'planner' ? 'btn btn-primary' : 'btn btn-ghost'}>Planner</button>
          <button onClick={handleExportPlannerBackup} className="btn btn-ghost"><Download size={16} /> Export</button>
          <button onClick={handleImportPlannerBackupClick} className="btn btn-ghost"><Upload size={16} /> Import</button>
          <input ref={backupInputRef} type="file" accept="application/json" onChange={handleImportPlannerBackup} style={{ display: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {activeTab === 'routine' && <Schedule />}

        {activeTab === 'planner' && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Course Planner</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Current term courses only. Log, teacher split, and progress stay term-scoped.</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{currentTermCourses.length} course{currentTermCourses.length === 1 ? '' : 's'}</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {currentTermCourses.length === 0 && (
                <div style={{ padding: 14, border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--muted)', fontSize: 13 }}>
                  No current-term courses found.
                </div>
              )}

              {plannerRows.map(({ course, plan, teacherCounts, loggedCount }) => {
                const percent = Math.min(100, Math.round(((plan.completed || 0) / Math.max(1, plan.plannedTotalClasses || 1)) * 100));
                return (
                  <div key={course.id} style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{course.code} · {course.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                          {course.credits || 0} credit · {course.type || 'Theory'} · default {computeDefaultTotalClasses(course.credits, course.type)} class{computeDefaultTotalClasses(course.credits, course.type) === 1 ? '' : 'es'}
                        </div>
                      </div>
                      <div style={{ minWidth: 180, textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{plan.completed || 0} / {plan.plannedTotalClasses || 0}</div>
                        <div style={{ marginTop: 6, width: 180, maxWidth: '100%', height: 8, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), #22c55e)' }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(plan.teachers || []).map((teacher, index) => (
                        <button
                          key={`${course.id}-${teacher}-${index}`}
                          onClick={() => quickLogClass(course, teacher)}
                          className="btn btn-ghost"
                          style={{ padding: '7px 10px', fontSize: 12 }}
                          title={`Log class for ${teacher}`}
                        >
                          {teacher}
                          <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 999, background: 'var(--bg-secondary)', fontSize: 11 }}>
                            {teacherCounts[teacher] || 0}
                          </span>
                        </button>
                      ))}
                      {(plan.teachers || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No teacher assigned yet.</div>}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Planned: {plan.plannedTotalClasses || 0} · Per week: {plan.perWeekTarget || 0} · Logged: {loggedCount}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => quickLogClass(course, (plan.teachers || [])[0] || '')} style={{ padding: '8px 10px' }}><Copy size={16} /> Log</button>
                      <button onClick={() => openTeacherDialog(course.id)} style={{ padding: '8px 10px' }}><Users size={16} /> Edit teachers</button>
                      <button onClick={() => resetPlan(course)} style={{ padding: '8px 10px' }}>Reset</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
            Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and mention "Class Management".
          </div>
        </div>
      </div>

      <CourseTeacherDialog
        isOpen={courseTeacherDialogState.open}
        onClose={handleCourseTeacherDialogClose}
        course={allCourses.find(course => course.id === courseTeacherDialogState.courseId)}
        currentTeachers={(settings.courseTeacherMap || {})[courseTeacherDialogState.courseId] || (currentTermPlans?.[courseTeacherDialogState.courseId]?.teachers || [])}
        onSave={handleCourseTeacherDialogSave}
        allTeachers={[]}
        requireTwoTeachers={false}
      />
    </div>
  );
}
