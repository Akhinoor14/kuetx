import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Copy, Download, Users, X } from 'lucide-react';
import { store, uid, getProfile, getCurrentTermKey, periodToTime } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import {
  createDefaultCoursePlan,
  buildExportPayload,
  getCourseTeacherCountsFromSchedule,
  matchesTerm,
  normalizeTeacherList,
} from '../lib/plannerUtils';

const TERM_KEY_RE = /^Y\dT\d$/;
const ROUTINE_DAY_DEFS = [
  { key: 'Sunday', label: 'Sun' },
  { key: 'Monday', label: 'Mon' },
  { key: 'Tuesday', label: 'Tue' },
  { key: 'Wednesday', label: 'Wed' },
  { key: 'Thursday', label: 'Thu' },
];
const ROUTINE_DAY_KEYS = ROUTINE_DAY_DEFS.map(d => d.key);

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
  const [selectedRoutineDay, setSelectedRoutineDay] = useState(() => {
    const todayKey = ROUTINE_DAY_KEYS[new Date().getDay()];
    return todayKey || 'Sunday';
  });
  const [viewMode, setViewMode] = useState(() => store.get('classManagementPlannerMode') || 'automatic');
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
  const courseMap = useMemo(() => new Map(allCourses.map(course => [course.id, course])), [allCourses]);

  const currentTermScheduleEntries = useMemo(() => {
    const currentCourseIds = new Set(currentTermCourses.map(course => course.id));
    return (schedule || []).filter(entry => currentCourseIds.has(entry.courseId));
  }, [schedule, currentTermCourses]);

  const routineEntriesByDay = useMemo(() => {
    const next = ROUTINE_DAY_KEYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {});
    currentTermScheduleEntries.forEach(entry => {
      if (!next[entry.day]) return;
      next[entry.day].push(entry);
    });
    ROUTINE_DAY_KEYS.forEach(day => {
      next[day] = next[day].slice().sort((a, b) => {
        const pa = a.period !== undefined && a.period !== 'unknown' ? a.period : null;
        const pb = b.period !== undefined && b.period !== 'unknown' ? b.period : null;
        if (pa !== null && pb !== null) {
          const sa = String(pa).startsWith('L') ? 100 + Number(String(pa).slice(1)) : Number(pa);
          const sb = String(pb).startsWith('L') ? 100 + Number(String(pb).slice(1)) : Number(pb);
          return sa - sb;
        }
        return String(a.slot || '').localeCompare(String(b.slot || ''));
      });
    });
    return next;
  }, [currentTermScheduleEntries]);

  const selectedRoutineEntries = routineEntriesByDay[selectedRoutineDay] || [];
  const selectedRoutineLabel = ROUTINE_DAY_DEFS.find(d => d.key === selectedRoutineDay)?.key || selectedRoutineDay;
  const assignedTeacherCount = useMemo(() => {
    const teacherNames = new Set();
    currentTermCourses.forEach(course => {
      const teachers = currentTermPlans?.[course.id]?.teachers || settings?.courseTeacherMap?.[course.id] || [];
      (teachers || []).forEach(teacher => {
        if (teacher) teacherNames.add(teacher);
      });
    });
    return teacherNames.size;
  }, [currentTermCourses, currentTermPlans, settings?.courseTeacherMap]);
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
  // Prefer recomputing the time from period + current model (so switching the
  // 40min/50min model updates display instantly); fall back to the legacy slot string.
  const getEntryTime = (entry) => {
    if (entry?.period !== undefined && entry.period !== 'unknown') {
      const time = periodToTime(entry.period, settings?.modelId);
      if (time) return time;
    }
    return entry?.slot || entry?._legacySlot || '';
  };

  const buildRoutineCopyText = (day, entries) => {
    if (!entries.length) {
      return `Routine for ${day}\n\nNo classes added yet.`;
    }

    const lines = [`*_📅 Routine for ${day}_*`, ''];

    entries.forEach((entry, index) => {
      const course = courseMap.get(entry.courseId);
      const courseLabel = entry.displayName || course?.code || course?.name || 'Unknown Course';
      const teacherLabel = entry.teacherName || 'Teacher not set';
      lines.push(`${index + 1}. *${formatRoutineSlot(getEntryTime(entry))}* — _${courseLabel} · ${teacherLabel}_`);
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

  // (removed) holiday sync via ctQuizStore — no-op

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
        plannerState,
        settings,
        schedule,
      }),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const _td = new Date();
    link.download = `kuetx-routine-backup-${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
  const openCourseTeacherDialog = openTeacherDialog; // Alias for planner code
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
    <div className="page-enter page-container class-management-page" style={{ width: '100%' }}>
      <div className="class-management-hero">
        <div className="class-management-hero-copy">
          <div className="class-management-kicker">Class Management</div>
          <h2>Routine control for CR work</h2>
          <div className="class-management-subtitle">
            Profile: {profile.name || '—'} {profile.isCR ? '· Class Rep' : ''} · Term: {currentTermKey || 'Unknown'}
          </div>
          <div className="class-management-meta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <div className="class-management-meta-chip">Routine</div>
            <div className="class-management-meta-chip">Planner</div>
            <div className="class-management-meta-chip">Export / Copy</div>
          </div>
        </div>
        <div className="class-management-hero-actions">
          <div className="class-management-mode-switch" role="tablist" aria-label="Class management views">
            <button
              type="button"
              onClick={loadRoutineFromStore}
              className={activeTab === 'routine' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
              aria-pressed={activeTab === 'routine'}
            >
              Routine
            </button>
            <button
              type="button"
              onClick={loadPlannerFromStore}
              className={activeTab === 'planner' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
              aria-pressed={activeTab === 'planner'}
            >
              Class Planner
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {activeTab === 'routine' && (
          <div>
            <div className="card class-management-actions-card" style={{ padding: 14, borderRadius: 22, border: '1px solid rgba(15,23,42,0.08)', background: 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.96))', boxShadow: '0 18px 40px rgba(15,23,42,0.06)', marginBottom: 16 }}>
              <div className="class-management-actions-grid" style={{ display: 'flex', gap: 10, flexWrap: 'nowrap', overflowX: 'auto', width: '100%' }}>
                <button type="button" title="Copy WhatsApp routine" className="btn class-management-action-btn btn-whatsapp" onClick={copyRoutineForSelectedDay}>
                  <Copy size={14} /> WhatsApp
                </button>
                <button type="button" title="Export routine backup" className="btn class-management-action-btn btn-export" onClick={exportRoutineBackup}>
                  <Download size={14} /> Export
                </button>
                <Link to="/schedule" title="Open full schedule" className="btn class-management-action-btn btn-schedule">
                  Open Schedule
                </Link>
              </div>
            </div>

            <div className="card class-management-routine-card" style={{ padding: 24, display: 'grid', gap: 24, borderRadius: 22, border: '1px solid rgba(59,130,246,0.12)', background: 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(129,140,248,0.04))', boxShadow: '0 20px 48px rgba(15,23,42,0.04)' }}>
              <div className="class-management-routine-top" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="class-management-section-label" style={{ letterSpacing: '0.12em', marginBottom: 4 }}>Routine Snapshot</div>
                  <div className="class-management-section-title" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 8 }}>Professional Class Routine Management</div>
                  <div className="class-management-section-copy" style={{ maxWidth: 620, fontSize: 13 }}>Effortlessly manage and share your class routine. Export backups, communicate schedules, and maintain complete control over all CR responsibilities.</div>
                </div>
              </div>

              <div className="class-management-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(59,130,246,0.18)', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.04))', boxShadow: '0 8px 16px rgba(59,130,246,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(37,99,235,0.84)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    <Clock3 size={14} /> Days
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(37,99,235,0.96)' }}>{ROUTINE_DAY_DEFS.length}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(16,185,129,0.18)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))', boxShadow: '0 8px 16px rgba(16,185,129,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(4,174,124,0.84)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    <CalendarDays size={14} /> Classes
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(4,174,124,0.96)' }}>{currentTermScheduleEntries.length}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(124,58,237,0.18)', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))', boxShadow: '0 8px 16px rgba(124,58,237,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(109,40,217,0.84)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    <Users size={14} /> Teachers
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(109,40,217,0.96)' }}>{assignedTeacherCount}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Daily Routine</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{selectedRoutineLabel}</div>
                </div>

                <div className="class-management-day-grid single-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12, marginTop: 0 }}>
                  {ROUTINE_DAY_DEFS.map(def => {
                    const count = routineEntriesByDay[def.key]?.length || 0;
                    const isActive = selectedRoutineDay === def.key;
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => setSelectedRoutineDay(def.key)}
                        className={`btn class-management-day-button ${isActive ? 'active' : 'btn-ghost'}`}
                        style={{ width: '100%', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, height: 48, whiteSpace: 'nowrap' }}
                      >
                        <span>{def.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.85, minWidth: 18, textAlign: 'right' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{selectedRoutineLabel}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{selectedRoutineEntries.length} class{selectedRoutineEntries.length === 1 ? '' : 'es'} shown for the day.</div>
                    </div>
                    <div className="class-management-meta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <div className="class-management-meta-chip">{currentTermScheduledCourseCount} courses</div>
                      <div className="class-management-meta-chip">CR view</div>
                    </div>
                  </div>

                  {selectedRoutineEntries.length === 0 ? (
                    <div style={{ padding: 18, borderRadius: 14, border: '1px dashed rgba(15,23,42,0.12)', background: 'rgba(248,250,252,0.9)', color: 'var(--muted)', fontSize: 13 }}>
                      No routine entries for {selectedRoutineLabel}.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {selectedRoutineEntries.map(entry => {
                        const course = courseMap.get(entry.courseId);
                        return (
                          <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surface), var(--bg))' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 900 }}>{formatRoutineSlot(getEntryTime(entry))}</div>
                                <span className="tag tag-blue">{course?.code || 'Unknown course'}</span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{entry.displayName || course?.name || course?.code || 'Unknown Course'}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                {entry.teacherName || 'Teacher not set'}{entry.room ? ` · Room ${entry.room}` : ''}{entry.type ? ` · ${entry.type}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="card class-management-planner-card">
            <div className="class-management-planner-header">
              <div>
                <div className="class-management-section-label">Class Planner</div>
                <div className="class-management-section-title">Current term overview</div>
                <div className="class-management-section-copy">
                  Auto counts from schedule. Manual mode enables +1 logging.
                </div>
              </div>
              <div className="class-management-mode-switch" role="tablist" aria-label="Planner mode">
                <button
                  type="button"
                  onClick={() => setViewMode('automatic')}
                  className={viewMode === 'automatic' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
                  aria-pressed={viewMode === 'automatic'}
                >
                  Automatic
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('manual')}
                  className={viewMode === 'manual' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
                  aria-pressed={viewMode === 'manual'}
                >
                  Manual
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 420 }}>
                Automatic uses live schedule counts. Manual keeps the same stored plans and only changes the quick +1 logging flow.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14, padding: 12, marginTop: 12 }}>
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
                        <div key={course.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 12, boxShadow: '0 6px 18px rgba(2,6,23,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{course.code}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{course.credits || 0} credit · {plannedTotal} planned</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{totalLogged} / {plannedTotal}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{percent}% completed</div>
                            </div>
                          </div>

                          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), rgba(100,150,255,0.6))' }} />
                          </div>

                          {hasTeachers ? (
                            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                              {assignedTeachers.map((teacher, index) => (
                                <div key={`${course.id}-teacher-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                                  <div style={{ flex: 1 }} title={teacher}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{teacher}</div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', minWidth: 35, textAlign: 'right' }}>
                                      {teacherCounts[teacher] || 0}
                                    </div>
                                    {viewMode === 'manual' && (
                                      <button onClick={() => quickLogClass(course, teacher)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700 }}>
                                        +1
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: 10 }}>
                              <button onClick={() => openTeacherDialog(course.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
                                📝 Assign Teachers
                              </button>
                            </div>
                          )}

                          {hasTeachers && (
                            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                        <div key={course.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 12, boxShadow: '0 6px 18px rgba(2,6,23,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{course.code}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{course.credits || 0} credit · {plannedTotal} planned</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{totalLogged} / {plannedTotal}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{percent}% completed</div>
                            </div>
                          </div>

                          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), rgba(100,150,255,0.6))' }} />
                          </div>

                          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              {viewMode === 'manual' && (
                                <button onClick={() => quickLogClass(course, '')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 800, borderRadius: 10 }}>+1</button>
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
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2200, maxWidth: 'calc(100vw - 24px)' }}>
          <div className="card" style={{ width: 'min(360px, 100vw - 24px)', maxWidth: '92vw', padding: 12, borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.12)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{resetState.course.code}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Restore defaults{resetState.count ? ` · will remove ${resetState.count} logged entr${resetState.count === 1 ? 'y' : 'ies'}` : ''}.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2100,
              background: 'rgba(12, 18, 28, 0.64)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 18,
              pointerEvents: 'auto',
            }}
            onClick={closeCourseDetails}
          >
          <div className="card" style={{ width: 'min(720px, 100vw - 24px)', maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 20, boxShadow: '0 10px 30px rgba(2,6,23,0.32)', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{entry.day} · {getEntryTime(entry)}</div>
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