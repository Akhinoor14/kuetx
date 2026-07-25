import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Copy, Download, Users } from 'lucide-react';
import { useClassManagementState, ROUTINE_DAY_DEFS } from './useClassManagementState';

/**
 * Independent "Routine" page — split out of the old ClassManagement.jsx
 * (Routine/Class Planner tab-switch). Same behavior and data source as
 * before (see useClassManagementState.js), just without the tab switch:
 * this page IS the routine view, full time.
 */
export default function ClassRoutine() {
  const s = useClassManagementState();

  return (
    <div className="page-enter page-container class-management-page content-page-bg" style={{ width: '100%' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <CalendarDays size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Routine</h1>
          </div>
          <p className="content-page-hero-subtitle">
            Routine control for CR work · {s.profile.name || '—'} {s.profile.isCR ? '· Class Rep' : ''} · Term: {s.currentTermKey || 'Unknown'}
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 14, borderRadius: 16, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Term Start Date for your batch</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {s.groupTermStartDate
              ? `Currently set: ${new Date(s.groupTermStartDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Applies to every student in your class.`
              : 'Not set yet — students in your class will see this once you set it.'}
          </div>
        </div>
        <div>
          <input
            type="date"
            value={s.termDateDraft}
            onChange={(e) => { s.setTermDateDraft(e.target.value); s.setTermDateError(''); }}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          />
        </div>
        <button
          type="button"
          className="accent-fill-glass"
          onClick={s.handleSaveTermStartDate}
          disabled={!s.groupId || !s.termDateDraft || s.termDateSaving}
          style={{ padding: '10px 16px', borderRadius: 8, color: '#fff', fontWeight: 700, opacity: (!s.groupId || !s.termDateDraft || s.termDateSaving) ? 0.6 : 1, cursor: (!s.groupId || !s.termDateDraft || s.termDateSaving) ? 'not-allowed' : 'pointer' }}
        >
          {s.termDateSaving ? 'Saving…' : 'Save for class'}
        </button>
        {s.termDateError && <div style={{ width: '100%', fontSize: 12, color: '#dc2626' }}>{s.termDateError}</div>}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div className="card class-management-actions-card" style={{ padding: 14, borderRadius: 22, border: '1px solid var(--border)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, transparent), var(--card))', boxShadow: '0 18px 40px rgba(15,23,42,0.06)', marginBottom: 16 }}>
            <div className="class-management-actions-grid" style={{ display: 'flex', gap: 10, flexWrap: 'nowrap', overflowX: 'auto', width: '100%' }}>
              <button type="button" title="Copy WhatsApp routine" className="btn class-management-action-btn btn-whatsapp" onClick={s.copyRoutineForSelectedDay}>
                <Copy size={14} /> WhatsApp
              </button>
              <button type="button" title="Export routine backup" className="btn class-management-action-btn btn-export" onClick={s.exportRoutineBackup}>
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
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(4,174,124,0.96)' }}>{s.currentTermScheduleEntries.length}</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid rgba(124,58,237,0.18)', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))', boxShadow: '0 8px 16px rgba(124,58,237,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'rgba(109,40,217,0.84)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  <Users size={14} /> Teachers
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(109,40,217,0.96)' }}>{s.assignedTeacherCount}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Daily Routine</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{s.selectedRoutineLabel}</div>
              </div>

              <div className="class-management-day-grid single-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12, marginTop: 0 }}>
                {ROUTINE_DAY_DEFS.map(def => {
                  const count = s.routineEntriesByDay[def.key]?.length || 0;
                  const isActive = s.selectedRoutineDay === def.key;
                  return (
                    <button
                      key={def.key}
                      type="button"
                      onClick={() => s.setSelectedRoutineDay(def.key)}
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
                    <div style={{ fontSize: 15, fontWeight: 900 }}>{s.selectedRoutineLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.selectedRoutineEntries.length} class{s.selectedRoutineEntries.length === 1 ? '' : 'es'} shown for the day.</div>
                  </div>
                  <div className="class-management-meta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <div className="class-management-meta-chip">{s.currentTermScheduledCourseCount} courses</div>
                    <div className="class-management-meta-chip">CR view</div>
                  </div>
                </div>

                {s.selectedRoutineEntries.length === 0 ? (
                  <div style={{ padding: 18, borderRadius: 14, border: '1px dashed rgba(15,23,42,0.12)', background: 'rgba(248,250,252,0.9)', color: 'var(--muted)', fontSize: 13 }}>
                    No routine entries for {s.selectedRoutineLabel}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {s.selectedRoutineEntries.map(entry => {
                      const course = s.courseMap.get(entry.courseId);
                      return (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surface), var(--bg))' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 900 }}>{s.formatRoutineSlot(entry.slot)}</div>
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

        <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
            Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and mention "Class Management".
          </div>
        </div>
      </div>
    </div>
  );
}
