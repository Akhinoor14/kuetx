import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, BookOpen, Pencil, Settings, X } from 'lucide-react';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import { createDefaultCoursePlan, getCourseTeacherCountsFromSchedule } from '../lib/plannerUtils';
import { useClassManagementState } from './useClassManagementState';

/**
 * Independent "Class Planner" page — split out of the old
 * ClassManagement.jsx (Routine/Class Planner tab-switch). Same data
 * source and behavior as before (see useClassManagementState.js), minus
 * the tab switch: this page IS the planner view, full time.
 */
export default function ClassPlanner() {
  const s = useClassManagementState();

  return (
    <div className="page-enter page-container class-management-page content-page-bg" style={{ width: '100%' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <CalendarCheck size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Class Planner</h1>
          </div>
          <p className="content-page-hero-subtitle">
            Current term overview · {s.profile.name || '—'} {s.profile.isCR ? '· Class Rep' : ''} · Term: {s.currentTermKey || 'Unknown'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card class-management-planner-card">
          <div className="class-management-planner-header">
            <div>
              <div className="class-management-section-label">Class Planner</div>
              <div className="class-management-section-title">Current term overview</div>
              <div className="class-management-section-copy">
                Automatic counts from schedule by default. Manual mode enables +1 logging.
              </div>
            </div>
            <div className="class-management-mode-switch" role="tablist" aria-label="Planner mode">
              <button
                type="button"
                onClick={() => s.setViewMode('automatic')}
                className={s.viewMode === 'automatic' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
                aria-pressed={s.viewMode === 'automatic'}
              >
                Automatic
              </button>
              <button
                type="button"
                onClick={() => s.setViewMode('manual')}
                className={s.viewMode === 'manual' ? 'class-management-mode-button is-active' : 'class-management-mode-button'}
                aria-pressed={s.viewMode === 'manual'}
              >
                Manual
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 420 }}>
              Automatic is the default and uses live schedule counts. Manual keeps the same stored plans and only changes the quick +1 logging flow.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 14, padding: 12, marginTop: 12 }}>
            {s.currentTermCourses.length === 0 && (
              <div style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 14, color: 'var(--muted)', fontSize: 13 }}>
                No current-term courses found.
              </div>
            )}

            {s.plannerRows.filter(r => String(r.course.type || 'Theory').toLowerCase() === 'theory').length > 0 && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={14} color="var(--accent)" /> Theory Courses</div>
                {s.plannerRows
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
                                  {s.viewMode === 'manual' && (
                                    <button onClick={() => s.quickLogClass(course, teacher)} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700 }}>
                                      +1
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ marginTop: 10 }}>
                            <button onClick={() => s.openTeacherDialog(course.id)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Pencil size={12} /> Assign Teachers
                            </button>
                          </div>
                        )}

                        {hasTeachers && (
                          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => s.openCourseDetails(course.id)} className="btn btn-ghost btn-sm" style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Details</button>
                            <button onClick={() => s.resetPlan(course)} className="btn btn-ghost btn-sm" style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Reset</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {s.plannerRows.filter(r => String(r.course.type || 'Theory').toLowerCase() === 'sessional').length > 0 && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={14} color="var(--accent)" /> Sessional Courses</div>
                {s.plannerRows
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
                            {s.viewMode === 'manual' && (
                              <button onClick={() => s.quickLogClass(course, '')} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12, fontWeight: 800, borderRadius: 10 }}>+1</button>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={() => s.openCourseDetails(course.id)} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12 }}>Details</button>
                            <button onClick={() => s.resetPlan(course)} className="btn btn-ghost" style={{ padding: '8px 10px', fontSize: 12 }}>Reset</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
            Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and mention "Class Management".
          </div>
        </div>
      </div>

      <CourseTeacherDialog
        isOpen={s.courseTeacherDialogState.open}
        onClose={s.handleCourseTeacherDialogClose}
        course={s.allCourses.find(course => course.id === s.courseTeacherDialogState.courseId)}
        currentTeachers={(s.effectiveCourseTeacherMap || {})[s.courseTeacherDialogState.courseId] || (s.currentTermPlans?.[s.courseTeacherDialogState.courseId]?.teachers || [])}
        onSave={s.handleCourseTeacherDialogSave}
        allTeachers={[...new Set(Object.values(s.effectiveCourseTeacherMap || {}).flat().filter(Boolean))]}
        requireTwoTeachers={true}
      />

      {s.resetState.open && s.resetState.course && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 2200, maxWidth: 'calc(100vw - 24px)' }}>
          <div className="card" style={{ width: 'min(360px, 100vw - 24px)', maxWidth: '92vw', padding: 12, borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.12)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{s.resetState.course.code}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Restore defaults{s.resetState.count ? ` · will remove ${s.resetState.count} logged entr${s.resetState.count === 1 ? 'y' : 'ies'}` : ''}.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { if (s.resetState.timer) clearTimeout(s.resetState.timer); s.confirmResetPlan(true); }} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>Reset & Remove</button>
                <button onClick={() => { if (s.resetState.timer) clearTimeout(s.resetState.timer); s.confirmResetPlan(false); }} className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }}>Reset only</button>
                <button onClick={s.cancelResetPlan} className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} aria-label="Dismiss">×</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {s.detailState.open && (() => {
        const course = s.currentTermCourses.find(item => item.id === s.detailState.courseId) || s.allCourses.find(item => item.id === s.detailState.courseId);
        const plan = s.currentTermPlans?.[s.detailState.courseId] || createDefaultCoursePlan({ course, termKey: s.currentTermKey, teachers: s.effectiveCourseTeacherMap?.[s.detailState.courseId] || [] });
        const detailSourceEntries = s.viewMode === 'manual'
          ? (s.groupId ? s.groupPlannerLogs : (s.schedule || []))
          : s.currentTermScheduleEntries;
        const teacherCounts = getCourseTeacherCountsFromSchedule(detailSourceEntries, s.detailState.courseId);
        const logs = detailSourceEntries
          .filter(entry => entry && entry.courseId === s.detailState.courseId)
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
            onClick={s.closeCourseDetails}
          >
          <div className="card" style={{ width: 'min(720px, 100vw - 24px)', maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', padding: 20, boxShadow: '0 10px 30px rgba(2,6,23,0.32)', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{course.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {course.credits || 0} credit · {course.type || 'Theory'} · {s.currentTermKey || 'Unknown'}
                  </div>
                </div>
                <button onClick={s.closeCourseDetails} className="btn btn-ghost" style={{ padding: 8 }} aria-label="Close details"><X size={18} /></button>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Planned</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{plan.plannedTotalClasses || 0}</div>
                  </div>
                  <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Completed</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{logs.length}</div>
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
                      <button key={`${teacher}-${index}`} onClick={() => s.quickLogClass(course, teacher)} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }} title={teacher}>
                        <div style={{ fontWeight: 700 }}>{s.getInitials(teacher)}</div>
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
                        <button onClick={() => s.quickLogClass(course, '')} className="btn btn-primary btn-sm">+1 (log sessional)</button>
                      </div>
                    )}
                    <button onClick={() => s.openTeacherDialog(s.detailState.courseId)} className="btn btn-secondary btn-sm" style={{ padding: '8px 12px', fontSize: 12 }}>
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
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{s.formatDateTime(entry.loggedAt)}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{entry.day} · {entry.slot}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => s.removeLogEntry(entry.id)} className="btn btn-ghost btn-xs" style={{ padding: '8px 10px', height: 'fit-content' }}>Undo</button>
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
