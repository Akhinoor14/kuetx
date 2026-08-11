import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Copy, Download, Users, PowerOff, Power, X } from 'lucide-react';
import Modal from '../components/Modal';
import { getBDNow } from '../store/store';
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

                {s.groupId && s.selectedRoutineEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={s.openDayOverrideDraft}
                    disabled={!!s.overrideBusyKey}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                      padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 800,
                      cursor: s.overrideBusyKey ? 'not-allowed' : 'pointer',
                      border: s.isSelectedDayOff ? '1px solid rgba(220,38,38,0.35)' : '1px solid var(--border)',
                      background: s.isSelectedDayOff ? 'rgba(220,38,38,0.08)' : 'var(--surface)',
                      color: s.isSelectedDayOff ? '#dc2626' : 'var(--text)',
                      opacity: s.overrideBusyKey ? 0.7 : 1,
                    }}
                  >
                    {s.isSelectedDayOff ? <Power size={14} /> : <PowerOff size={14} />}
                    {s.isSelectedDayOff
                      ? `${s.selectedRoutineLabel}-এর সব ক্লাস আবার চালু করুন`
                      : `${s.selectedRoutineLabel}-এর সব ক্লাস বন্ধ মার্ক করুন`}
                  </button>
                )}

                {s.selectedRoutineEntries.length === 0 ? (
                  <div style={{ padding: 18, borderRadius: 14, border: '1px dashed rgba(15,23,42,0.12)', background: 'rgba(248,250,252,0.9)', color: 'var(--muted)', fontSize: 13 }}>
                    No routine entries for {s.selectedRoutineLabel}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {s.selectedRoutineEntries.map(entry => {
                      const course = s.courseMap.get(entry.courseId);
                      const off = s.groupId ? (s.isSelectedDayOff || s.isSlotOff(entry)) : false;
                      const recurring = s.groupId ? s.isSlotRecurringOff(entry) : false;
                      const slotBusyId = `slot:${entry.courseId}::${entry.day}::${entry.slot}`;
                      const isBusy = s.overrideBusyKey === slotBusyId || !!s.overrideBusyKey;
                      return (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
                            padding: 16, borderRadius: 14, border: off ? '1px solid rgba(220,38,38,0.25)' : '1px solid var(--border)',
                            background: off ? 'rgba(220,38,38,0.04)' : 'linear-gradient(180deg, var(--surface), var(--bg))',
                            opacity: off ? 0.72 : 1,
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 900, textDecoration: off ? 'line-through' : 'none' }}>{s.formatRoutineSlot(entry.slot)}</div>
                              <span className="tag tag-blue">{course?.code || 'Unknown course'}</span>
                              {recurring && <span className="tag" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', fontWeight: 800 }}>প্রতি সপ্তাহে বন্ধ</span>}
                              {!recurring && off && <span className="tag" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', fontWeight: 800 }}>বন্ধ</span>}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', textDecoration: off ? 'line-through' : 'none' }}>{entry.displayName || course?.name || course?.code || 'Unknown Course'}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                              {/* Live teacher name from the course-level registry rather than
                                  entry.teacherName — that field is a snapshot taken when this
                                  routine slot was created, so it goes stale after a rename in
                                  Class Setup until this slot is individually re-saved. Falling
                                  back to entry.teacherName keeps old/local-mode entries that
                                  predate this working the same as before. */}
                              {(s.effectiveCourseTeacherMap?.[entry.courseId] || []).join(', ') || entry.teacherName || 'Teacher not set'}{entry.room ? ` · Room ${entry.room}` : ''}{entry.type ? ` · ${entry.type}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                            {s.groupId && !s.isSelectedDayOff && (
                              off ? (
                                <button
                                  type="button"
                                  title="আবার চালু করুন"
                                  onClick={() => s.quickMarkSlotOn(entry)}
                                  disabled={isBusy}
                                  style={{
                                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 36, height: 36, borderRadius: 10, cursor: isBusy ? 'not-allowed' : 'pointer',
                                    border: '1px solid rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.08)',
                                    color: '#16a34a', opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  <Power size={16} />
                                </button>
                              ) : (
                                <SlotOffMenu entry={entry} s={s} isBusy={isBusy} />
                              )
                            )}
                            {s.groupId && s.isSessionalType(entry.type) && (
                              <button
                                type="button"
                                title={s.hasCadenceConfigured(entry) ? 'Sessional cadence এডিট করুন' : 'Sessional cadence সেট করুন (alternating week)'}
                                onClick={() => s.openCadenceDraft(entry)}
                                disabled={s.cadenceBusyKey === (`${entry.courseId}::${entry.day}::${entry.slot}`) || !!s.cadenceBusyKey}
                                style={{
                                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                                  border: s.hasCadenceConfigured(entry) ? '1px solid rgba(37,99,235,0.35)' : '1px solid var(--border)',
                                  background: s.hasCadenceConfigured(entry) ? 'rgba(37,99,235,0.08)' : 'var(--surface)',
                                  color: s.hasCadenceConfigured(entry) ? '#2563eb' : 'var(--muted)',
                                  opacity: s.cadenceBusyKey ? 0.6 : 1,
                                  fontSize: 14,
                                }}
                              >
                                📆
                              </button>
                            )}
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

        {s.overrideDraft && (
          <OverrideConfirmPanel s={s} />
        )}

        {s.cadenceDraft && (
          <CadenceConfirmPanel s={s} />
        )}

        {s.datePickerDraft && (
          <DatePickerOffModal s={s} />
        )}

        <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
            Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and mention "Class Management".
          </div>
        </div>
      </div>
    </div>
  );
}

// Small popover with the two everyday actions for turning a class off —
// "আজকের ক্লাস বন্ধ" (one tap, acts on the next occurrence) and "অন্য
// তারিখ বাছাই করুন" (opens the multi-select calendar below). Replaces
// what used to be a single icon that opened a full form.
function SlotOffMenu({ entry, s, isBusy }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        title="ক্লাস বন্ধ করুন"
        onClick={() => setOpen((v) => !v)}
        disabled={isBusy}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, cursor: isBusy ? 'not-allowed' : 'pointer',
          border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)',
          color: '#dc2626', opacity: isBusy ? 0.6 : 1,
        }}
      >
        <PowerOff size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 42, zIndex: 20, width: 200,
          borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          <button
            type="button"
            onClick={() => { setOpen(false); s.quickMarkSlotOff(entry); }}
            style={{
              width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, fontWeight: 700,
              border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
            }}
          >
            আজকের ক্লাস বন্ধ
          </button>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <button
            type="button"
            onClick={() => { setOpen(false); s.openDatePickerDraft(entry); }}
            style={{
              width: '100%', textAlign: 'left', padding: '11px 14px', fontSize: 13, fontWeight: 700,
              border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
            }}
          >
            অন্য তারিখ বাছাই করুন
          </button>
        </div>
      )}
    </div>
  );
}

// Multi-select calendar for "অন্য তারিখ বাছাই করুন" — tap any number of
// dates, they all get marked off together on Confirm. Deliberately just a
// simple month grid with no other options (no reason field, no duration
// choice) — see s.confirmDatePickerOff in useClassManagementState.js.
function DatePickerOffModal({ s }) {
  const d = s.datePickerDraft;
  const isBusy = !!s.overrideBusyKey;
  const course = s.courseMap.get(d.entry.courseId);
  const label = d.entry.displayName || course?.code || course?.name || 'Class';
  const [viewMonth, setViewMonth] = React.useState(() => {
    // BUGFIX (timezone correctness — "Bangladesh time table thi ache to?"):
    // this used to be `new Date()`, which reads the VISITOR'S OWN DEVICE
    // clock/timezone. Every other "today" in this app (getNextDateForWeekday,
    // getRoutinePreviewDate, the Today page, attendance logging) goes
    // through getBDNow() specifically so "today" always means Bangladesh
    // wall-clock time regardless of the device's own timezone (see
    // getBDNow's doc comment in store.js — a device set to a different
    // timezone would otherwise silently disagree with the rest of the app
    // about which date is "today"). This calendar's month/today
    // highlighting now reads the same getBDNow() everything else uses, so
    // it can't drift a day off from what the routine/attendance pages
    // consider today.
    const today = getBDNow();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const toDateKey = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // BUGFIX (same timezone issue as viewMonth above): was plain `new
  // Date()` — now getBDNow(), matching every other "today" cutoff in the
  // app, so the past-date lock (isPast below) can't disagree with what
  // the rest of KUETx considers today on a device set to a non-Bangladesh
  // timezone.
  const bdToday = getBDNow();
  const todayKey = `${bdToday.getFullYear()}-${String(bdToday.getMonth() + 1).padStart(2, '0')}-${String(bdToday.getDate()).padStart(2, '0')}`;
  const monthLabel = viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <Modal closeOnOverlayClick={!isBusy} onClose={isBusy ? () => {} : s.cancelDatePickerDraft} contentStyle={{ width: 'min(94vw, 360px)' }}>
      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>{label} — তারিখ বাছাই করুন</div>
          <button
            type="button" onClick={s.cancelDatePickerDraft} disabled={isBusy} aria-label="বাতিল"
            style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--muted)', cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{monthLabel}</div>
          <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'].map((w) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: 'var(--muted)' }}>{w}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateKey = toDateKey(day);
            const selected = d.dates.includes(dateKey);
            const isPast = dateKey < todayKey;
            return (
              <button
                key={dateKey}
                type="button"
                disabled={isPast}
                onClick={() => s.toggleDatePickerDate(dateKey)}
                style={{
                  aspectRatio: '1', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: isPast ? 'not-allowed' : 'pointer',
                  border: selected ? '1px solid #dc2626' : '1px solid var(--border)',
                  background: selected ? '#dc2626' : (isPast ? 'var(--bg-secondary)' : 'var(--surface)'),
                  color: selected ? '#fff' : (isPast ? 'var(--muted)' : 'var(--text)'),
                  opacity: isPast ? 0.4 : 1,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {d.dates.length > 0 ? `${d.dates.length} টি তারিখ বাছাই করা হয়েছে` : 'একটা বা একাধিক তারিখ ট্যাপ করো'}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={s.confirmDatePickerOff}
            disabled={isBusy || d.dates.length === 0}
            className="accent-fill-glass"
            style={{ flex: 1, padding: '11px 18px', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: (isBusy || d.dates.length === 0) ? 'not-allowed' : 'pointer', opacity: (isBusy || d.dates.length === 0) ? 0.6 : 1 }}
          >
            {isBusy ? 'সেভ হচ্ছে…' : 'বন্ধ মার্ক করুন'}
          </button>
          <button
            type="button"
            onClick={s.cancelDatePickerDraft}
            disabled={isBusy}
            className="btn btn-ghost"
            style={{ padding: '11px 18px', borderRadius: 8, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer' }}
          >
            বাতিল
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Confirm panel shown when the CR opens a slot or day toggle — nothing is
// written to Firestore until "Confirm" is pressed here.
//
// REDESIGN (compact modal instead of a big inline block pushing the page
// down): this used to render directly in the page flow — tapping one
// small 36×36 toggle icon injected a tall form (date picker, duration
// radio buttons, reason text box, explanation paragraph) right into the
// middle of the routine list, shoving every entry below it down. On
// mobile especially, that's a jarring, disorienting amount of motion for
// what's usually a one-tap decision ("this class is off today"). Now
// rendered as a focused modal overlay instead: the everyday case (single
// date, no reason) needs one glance and one tap on Confirm — the date
// picker still defaults to the sensible next occurrence and can be
// changed, and "প্রতি সপ্তাহে বন্ধ" / reason stay one tap away, just not
// forced into view for someone who doesn't need them. Nothing about
// WHAT this collects or WHEN it writes changed — same draft state, same
// confirmOverrideDraft() write path — only how it's presented.
function OverrideConfirmPanel({ s }) {
  const d = s.overrideDraft;
  const isBusy = !!s.overrideBusyKey;
  const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  let heading;
  if (d.kind === 'day') {
    heading = d.turningOn ? `${s.selectedRoutineLabel}-এর সব ক্লাস আবার চালু করুন` : `${s.selectedRoutineLabel}-এর সব ক্লাস বন্ধ করুন`;
  } else if (d.turningOffRecurring) {
    heading = 'প্রতি সপ্তাহের বন্ধ অবস্থা থেকে আবার চালু করুন';
  } else {
    const course = s.courseMap.get(d.entry.courseId);
    const label = d.entry.displayName || course?.code || course?.name || 'Class';
    heading = s.isSlotOff(d.entry, d.date) ? `${label} — আবার চালু করুন` : `${label} — বন্ধ মার্ক করুন`;
  }

  return (
    <Modal closeOnOverlayClick={!isBusy} onClose={isBusy ? () => {} : s.cancelOverrideDraft} contentStyle={{ width: 'min(94vw, 420px)', maxHeight: '88vh', overflowY: 'auto' }}>
      <div className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>{heading}</div>
          <button
            type="button"
            onClick={s.cancelOverrideDraft}
            disabled={isBusy}
            aria-label="বাতিল"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--muted)', cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

      {!d.turningOffRecurring && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>তারিখ</div>
          <input
            type="date"
            value={d.date}
            onChange={(e) => s.updateOverrideDraft({ date: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {d.kind === 'slot' && !d.turningOffRecurring && !s.isSlotOff(d.entry, d.date) && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>কতদিনের জন্য বন্ধ?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => s.updateOverrideDraft({ mode: 'single' })}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: d.mode === 'single' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: d.mode === 'single' ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
              }}
            >
              শুধু এই তারিখে
            </button>
            <button
              type="button"
              onClick={() => s.updateOverrideDraft({ mode: 'recurring' })}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: d.mode === 'recurring' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: d.mode === 'recurring' ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
              }}
            >
              প্রতি সপ্তাহে (পরে বন্ধ না করা পর্যন্ত)
            </button>
          </div>
        </div>
      )}

      {!d.turningOffRecurring && (
        <details style={{ fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--muted)', listStyle: 'none' }}>কারণ যোগ করুন (ঐচ্ছিক)</summary>
          <input
            type="text"
            value={d.reason}
            onChange={(e) => s.updateOverrideDraft({ reason: e.target.value })}
            placeholder="যেমনঃ শিক্ষক অসুস্থ, ছুটির দিন..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box', marginTop: 8 }}
          />
        </details>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        {dateLabel} — নোটিশ ফিডে জানানো হবে।
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={s.confirmOverrideDraft}
          disabled={isBusy}
          className="accent-fill-glass"
          style={{ flex: 1, padding: '11px 18px', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
        >
          {isBusy ? 'সেভ হচ্ছে…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={s.cancelOverrideDraft}
          disabled={isBusy}
          className="btn btn-ghost"
          style={{ padding: '11px 18px', borderRadius: 8, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer' }}
        >
          বাতিল
        </button>
      </div>
      </div>
    </Modal>
  );
}

// Sessional/Lab alternating-week cadence panel — opened via the 📆 button
// next to a Sessional/Lab entry's on/off toggle. Covers all four
// acceptance criteria from the design prompt in one small UI:
//   1. Mode + anchor date (defaults to alternating, zero-config common case)
//   2. Per-date on/off toggle (one-off cancellation / make-up), scoped to
//      whatever date is currently in the date picker below
//   3. "Shift cadence from here" — re-anchors future dates without
//      touching past overrides (see shiftCadenceFrom's own doc comment)
//
// REDESIGN (modal instead of inline block): same reasoning as
// OverrideConfirmPanel just above — this is genuinely a multi-section
// settings panel (mode, anchor date, per-date override, cadence-shift),
// so its content stays as-is, but it no longer gets injected directly
// into the routine list pushing every entry below it down the page.
// Wrapped in the same Modal component for a consistent, contained
// experience across both panels, on both desktop and mobile.
function CadenceConfirmPanel({ s }) {
  const d = s.cadenceDraft;
  const isBusy = s.cadenceBusyKey === d.slotKey || !!s.cadenceBusyKey;
  const [pickDate, setPickDate] = React.useState(d.entry.anchorDate || '');
  const pickedOccurrence = pickDate ? s.getCadenceOccurrence(d.entry, pickDate) : null;

  const modeLabel = { alternating: 'এক সপ্তাহ পর পর (Alternating)', weekly: 'প্রতি সপ্তাহে', manual: 'সম্পূর্ণ ম্যানুয়াল' };

  return (
    <Modal closeOnOverlayClick={!isBusy} onClose={isBusy ? () => {} : s.cancelCadenceDraft} contentStyle={{ width: 'min(94vw, 480px)', maxHeight: '88vh', overflowY: 'auto' }}>
      <div className="card" style={{ padding: 18, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>{d.label} — Sessional Cadence</div>
          <button
            type="button"
            onClick={s.cancelCadenceDraft}
            disabled={isBusy}
            aria-label="বাতিল"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--muted)', cursor: isBusy ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mode</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['alternating', 'weekly', 'manual'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => s.updateCadenceDraft({ mode: m })}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: d.entry.mode === m ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: d.entry.mode === m ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
              }}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          {d.entry.mode === 'alternating' && 'Anchor তারিখ থেকে শুরু করে প্রতি ২ সপ্তাহে একবার চলবে (এক সপ্তাহ চলবে, পরের সপ্তাহ বন্ধ)।'}
          {d.entry.mode === 'weekly' && 'একটা সাধারণ থিওরি ক্লাসের মতো প্রতি সপ্তাহে চলবে।'}
          {d.entry.mode === 'manual' && 'কোনো ডিফল্ট প্যাটার্ন নেই — নিচের তারিখ-ভিত্তিক টগল দিয়ে প্রতিটা তারিখ আলাদাভাবে অন/অফ করতে হবে।'}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anchor তারিখ (প্রথম যেদিন থেকে এই সাইকেল চলবে)</div>
        <input
          type="date"
          value={d.entry.anchorDate || ''}
          onChange={(e) => s.updateCadenceDraft({ anchorDate: e.target.value })}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={s.confirmCadenceDraft}
          disabled={isBusy || !d.entry.anchorDate}
          className="accent-fill-glass"
          style={{ padding: '10px 18px', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: (isBusy || !d.entry.anchorDate) ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
        >
          {isBusy ? 'সেভ হচ্ছে…' : 'Save cadence'}
        </button>
        {s.hasCadenceConfigured(d.entry) && (
          <button
            type="button"
            onClick={() => s.removeCadence(d.entry)}
            disabled={isBusy}
            className="btn btn-ghost"
            style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer', color: '#dc2626' }}
          >
            Cadence মুছে দিন (প্রতি সপ্তাহে ফিরে যান)
          </button>
        )}
        <button
          type="button"
          onClick={s.cancelCadenceDraft}
          disabled={isBusy}
          className="btn btn-ghost"
          style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer' }}
        >
          বাতিল
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 14, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>নির্দিষ্ট একটা তারিখ অন/অফ করুন (cancellation বা make-up)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="date"
            value={pickDate}
            onChange={(e) => setPickDate(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          />
          {pickDate && (
            <span style={{ fontSize: 12, fontWeight: 700, color: pickedOccurrence === 'on' ? '#16a34a' : '#dc2626' }}>
              এখন: {pickedOccurrence === 'on' ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => s.toggleCadenceDate(d.entry, pickDate, 'off')}
            disabled={isBusy || !pickDate}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: (isBusy || !pickDate) ? 'not-allowed' : 'pointer', color: '#dc2626' }}
          >
            এই তারিখ বন্ধ মার্ক করুন
          </button>
          <button
            type="button"
            onClick={() => s.toggleCadenceDate(d.entry, pickDate, 'on')}
            disabled={isBusy || !pickDate}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: (isBusy || !pickDate) ? 'not-allowed' : 'pointer', color: '#16a34a' }}
          >
            এই তারিখ Make-up/চালু মার্ক করুন
          </button>
          <button
            type="button"
            onClick={() => s.toggleCadenceDate(d.entry, pickDate, 'clear')}
            disabled={isBusy || !pickDate}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: (isBusy || !pickDate) ? 'not-allowed' : 'pointer' }}
          >
            ওভাররাইড মুছুন (ডিফল্টে ফিরুন)
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cadence শিফট করুন (drift ঠিক করার জন্য)</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          পুরো টার্মের বাকি অংশ যদি এক সপ্তাহ শিফট হয়ে যায় (যেমন লম্বা ছুটির কারণে), এখানে নতুন anchor তারিখ দিয়ে ভবিষ্যতের সাইকেল রিসেট করুন — আগের তারিখগুলো অপরিবর্তিত থাকবে।
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            id="cadence-shift-date"
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('cadence-shift-date');
              if (el && el.value) s.shiftCadence(d.entry, el.value);
            }}
            disabled={isBusy}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: isBusy ? 'not-allowed' : 'pointer' }}
          >
            এখান থেকে শিফট করুন
          </button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
