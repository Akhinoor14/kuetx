import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, X } from 'lucide-react';
import { store, uid, getProfile, getCurrentTermKey } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import Schedule from './Schedule';
import {
  createDefaultCoursePlan,
  getCourseTeacherCountsFromSchedule,
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
  const [viewMode, setViewMode] = useState('automatic');
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '' });
  const [detailState, setDetailState] = useState({ open: false, courseId: '' });
  const [resetState, setResetState] = useState({ open: false, course: null, count: 0 });

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
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
  }, [currentTermCourses, currentTermKey, settings?.courseTeacherMap]);

  const plannerRows = useMemo(() => {
    return currentTermCourses.map(course => {
      const plan = currentTermPlans[course.id] || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[course.id] || [] });
      const teacherCounts = getCourseTeacherCountsFromSchedule(schedule, course.id);
      const totalLogged = (schedule || []).filter(entry => entry.courseId === course.id).length;
      return {
        course,
        plan,
        teacherCounts,
        totalLogged,
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
    setSchedule(prev => (prev || []).filter(entry => entry.id !== logId));
  };

  const quickLogClass = (course, teacherName = '') => {
    if (!course?.id) return;

    const assignedTeachers = normalizeTeacherList((settings?.courseTeacherMap || {})[course.id] || []);
    const isTheory = String(course.type || 'Theory').toLowerCase() === 'theory';

    if (isTheory && assignedTeachers.length === 0) {
      openTeacherDialog(course.id);
      return;
    }

    const selectedTeacher = String(teacherName || assignedTeachers[0] || '').trim();
    const entry = {
      id: uid(),
      courseId: course.id,
      displayName: course.code,
      type: course.type || 'Theory',
      teacherName: selectedTeacher,
      loggedAt: new Date().toISOString(),
      day: 'Manual',
      slot: 'Manual',
      note: 'Logged manually',
    };

    setSchedule(prev => [...(prev || []), entry]);
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
    const existingLogs = (schedule || []).filter(entry => entry.courseId === course.id).length;
    // open a non-blocking toast/inline confirm
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
      setSchedule(prev => (prev || []).filter(entry => entry.courseId !== course.id));
    }

    updateCurrentTermPlan(course.id, () => createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[course.id] || [] }));
    if (resetState.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const cancelResetPlan = () => {
    if (resetState?.timer) clearTimeout(resetState.timer);
    setResetState({ open: false, course: null, count: 0, timer: null });
  };

  const openTeacherDialog = (courseId) => setCourseTeacherDialogState({ open: true, courseId });
  const handleCourseTeacherDialogClose = () => setCourseTeacherDialogState({ open: false, courseId: '' });
  const handleCourseTeacherDialogSave = (teachersList) => {
    const courseId = courseTeacherDialogState.courseId;
    if (!courseId) return;
    const normalizedTeachers = normalizeTeacherList(teachersList);
    const next = { ...(settings.courseTeacherMap || {}) };
    next[courseId] = normalizedTeachers;
    setSettings({ ...(settings || {}), courseTeacherMap: next });
    updateCurrentTermPlan(courseId, (currentPlan) => ({
      ...currentPlan,
      teachers: normalizedTeachers,
    }));
    handleCourseTeacherDialogClose();
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
          <Link to="/settings" className="btn btn-ghost">Settings Backup</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {activeTab === 'routine' && <Schedule />}

        {activeTab === 'planner' && (
          <div className="card" style={{ padding: 20, boxShadow: '0 8px 30px rgba(2,6,23,0.06)', background: 'var(--surface-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Current term planner</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Count progress from schedule by default. Manual logging is available in details.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setViewMode('automatic')} className={viewMode === 'automatic' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ minWidth: 110 }}>Automatic</button>
                <button onClick={() => setViewMode('manual')} className={viewMode === 'manual' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ minWidth: 110 }}>Manual</button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {currentTermCourses.length === 0 && (
                <div style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 14, color: 'var(--muted)', fontSize: 13 }}>
                  No current-term courses found.
                </div>
              )}

              {/* Theory Courses Section */}
              {plannerRows.filter(r => String(r.course.type || 'Theory').toLowerCase() === 'theory').length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '0 4px' }}>📚 Theory Courses</div>
                  {plannerRows
                    .filter(r => String(r.course.type || 'Theory').toLowerCase() === 'theory')
                    .map(({ course, plan, teacherCounts, totalLogged }) => {
                      const assignedTeachers = plan.teachers || [];
                      const hasTeachers = assignedTeachers.length > 0;
                      const plannedTotal = plan.plannedTotalClasses || 0;
                      const percent = plannedTotal ? Math.min(100, Math.round((totalLogged / plannedTotal) * 100)) : 0;

                      return (
                        <div key={course.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', boxShadow: '0 6px 18px rgba(2,6,23,0.04)', transition: 'transform 150ms ease' }}>
                          <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{course.code}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{course.credits || 0} credit · {plannedTotal} planned</div>
                            </div>
                            <div style={{ textAlign: 'right', paddingLeft: 16 }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{totalLogged}</div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{percent}% · {plannedTotal}</div>
                            </div>
                          </div>

                          {/* Teachers Section */}
                          {hasTeachers ? (
                            <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                              {assignedTeachers.map((teacher, index) => (
                                <div key={`${course.id}-teacher-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                                  <div style={{ flex: 1 }} title={teacher}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{getInitials(teacher)}</div>
                                  </div>
                                  {viewMode === 'automatic' ? (
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 40, textAlign: 'right' }}>
                                      {teacherCounts[teacher] || 0}
                                    </div>
                                  ) : (
                                    <button onClick={() => quickLogClass(course, teacher)} className="btn btn-primary btn-sm" style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}>
                                      +1
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: 12, textAlign: 'center' }}>
                              <button onClick={() => openTeacherDialog(course.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
                                📝 Assign Teachers
                              </button>
                            </div>
                          )}

                          {hasTeachers && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
                              <button onClick={() => openCourseDetails(course.id)} className="btn btn-ghost btn-sm" style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Details</button>
                              <button onClick={() => resetPlan(course)} className="btn btn-ghost btn-sm" style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Reset</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Sessional Courses Section (restyled) */}
              {plannerRows.filter(r => String(r.course.type || 'Theory').toLowerCase() === 'sessional').length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '0 4px' }}>⚙️ Sessional Courses</div>
                  {plannerRows
                    .filter(r => String(r.course.type || 'Theory').toLowerCase() === 'sessional')
                    .map(({ course, plan, totalLogged }) => {
                      const plannedTotal = plan.plannedTotalClasses || 0;
                      const percent = plannedTotal ? Math.min(100, Math.round((totalLogged / plannedTotal) * 100)) : 0;

                      return (
                        <div key={course.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)', padding: 12, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{course.code}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{course.credits || 0} credit · {plannedTotal} planned</div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{totalLogged}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{percent}% · {plannedTotal}</div>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              {viewMode === 'manual' && (
                                <button onClick={() => quickLogClass(course, '')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 13, fontWeight: 800, borderRadius: 10 }}>+1</button>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button onClick={() => openCourseDetails(course.id)} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12 }}>Details</button>
                              <button onClick={() => resetPlan(course)} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12 }}>Reset</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {viewMode === 'automatic' ? (
                  <>📊 <strong>Automatic mode:</strong> Shows counts from schedule automatically. Open Details for manual logging.</>
                ) : (
                  <>✏️ <strong>Manual mode:</strong> Click "+1" to manually log classes. Counts still track schedule automatically.</>
                )}
              </div>
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
        requireTwoTeachers={true}
      />

      {/* Non-blocking reset toast */}
      {resetState.open && resetState.course && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2200 }}>
          <div className="card" style={{ width: 360, maxWidth: '92vw', padding: 12, borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.12)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{resetState.course.code}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Restore defaults{resetState.count ? ` · will remove ${resetState.count} logged entr${resetState.count === 1 ? 'y' : 'ies'}` : ''}.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => { if (resetState.timer) clearTimeout(resetState.timer); confirmResetPlan(true); }} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>Reset & Remove</button>
                <button onClick={() => { if (resetState.timer) clearTimeout(resetState.timer); confirmResetPlan(false); }} className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }}>Reset only</button>
                <button onClick={cancelResetPlan} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} aria-label="Dismiss">×</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailState.open && (() => {
        const course = currentTermCourses.find(item => item.id === detailState.courseId) || allCourses.find(item => item.id === detailState.courseId);
        const plan = currentTermPlans?.[detailState.courseId] || createDefaultCoursePlan({ course, termKey: currentTermKey, teachers: settings?.courseTeacherMap?.[detailState.courseId] || [] });
        const teacherCounts = getCourseTeacherCountsFromSchedule(schedule, detailState.courseId);
        const logs = (schedule || [])
          .filter(entry => entry && entry.courseId === detailState.courseId)
          .slice()
          .sort((a, b) => new Date(b.loggedAt || 0) - new Date(a.loggedAt || 0));

        if (!course) return null;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2100,
              background: 'rgba(12, 18, 28, 0.64)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 18,
            }}
            onClick={closeCourseDetails}
          >
            <div className="card" style={{ width: 720, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 20, boxShadow: '0 10px 30px rgba(2,6,23,0.32)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{course.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {course.credits || 0} credit · {course.type || 'Theory'} · {currentTermKey || 'Unknown'}
                  </div>
                </div>
                <button onClick={closeCourseDetails} className="btn btn-ghost" style={{ padding: 8 }} aria-label="Close details"><X size={18} /></button>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Planned</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{plan.plannedTotalClasses || 0}</div>
                  </div>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Completed</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{(schedule || []).filter(entry => entry.courseId === detailState.courseId).length}</div>
                  </div>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Weekly target</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{plan.perWeekTarget || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Teachers</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {(plan.teachers || []).map((teacher, index) => (
                      <button key={`${teacher}-${index}`} onClick={() => quickLogClass(course, teacher)} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }} title={teacher}>
                        <div style={{ fontWeight: 700 }}>{getInitials(teacher)}</div>
                        <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 800 }}>{teacherCounts[teacher] || 0}</div>
                      </button>
                    ))}
                    {plan.teachers?.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {String(course.type || 'Theory').toLowerCase() === 'sessional' ? (
                          <>No teacher assigned. For sessional you can still log classes using the <strong>+1</strong> button on the planner (Manual mode) or use the button below.</>
                        ) : (
                          <>No teacher assigned. Assign one to log theory classes.</>
                        )}
                      </div>
                    )}
                    {String(course.type || 'Theory').toLowerCase() === 'sessional' && plan.teachers?.length === 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => quickLogClass(course, '')} className="btn btn-primary btn-sm">+1 (log sessional)</button>
                      </div>
                    )}
                    <button onClick={() => openTeacherDialog(detailState.courseId)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: 12 }}>
                      Assign / edit
                    </button>
                  </div>
                </div>

                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14, display: 'grid', gap: 12, background: 'var(--bg)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Logged entries</div>
                  {logs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>No log entries yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {logs.map(entry => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.teacherName || (course.type?.toLowerCase() === 'sessional' ? 'Sessional' : 'Teacher not set')}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{formatDateTime(entry.loggedAt)}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{entry.day} · {entry.slot}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => removeLogEntry(entry.id)} className="btn btn-ghost btn-xs" style={{ padding: '8px 10px', height: 'fit-content' }}>Undo</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
