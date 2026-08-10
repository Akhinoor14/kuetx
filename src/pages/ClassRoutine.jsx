import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Copy, Download, Users, PowerOff, Power } from 'lucide-react';
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
                              {entry.teacherName || 'Teacher not set'}{entry.room ? ` · Room ${entry.room}` : ''}{entry.type ? ` · ${entry.type}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                            {s.groupId && !s.isSelectedDayOff && (
                              <button
                                type="button"
                                title={recurring ? 'প্রতি সপ্তাহের বন্ধ অবস্থা থেকে আবার চালু করুন' : 'এই স্লট বন্ধ/চালু করুন'}
                                onClick={() => s.openSlotOverrideDraft(entry)}
                                disabled={isBusy}
                                style={{
                                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 36, height: 36, borderRadius: 10, cursor: isBusy ? 'not-allowed' : 'pointer',
                                  border: off ? '1px solid rgba(22,163,74,0.35)' : '1px solid rgba(220,38,38,0.25)',
                                  background: off ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.06)',
                                  color: off ? '#16a34a' : '#dc2626',
                                  opacity: isBusy ? 0.6 : 1,
                                }}
                              >
                                {off ? <Power size={16} /> : <PowerOff size={16} />}
                              </button>
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

        <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
            Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and mention "Class Management".
          </div>
        </div>
      </div>
    </div>
  );
}

// Confirm panel shown when the CR opens a slot or day toggle — nothing is
// written to Firestore until "Confirm" is pressed here. This is the fix
// for the earlier design gap where a single click auto-guessed a date and
// committed immediately: now the CR always sees (and can edit) the exact
// date, and for a slot-level toggle explicitly chooses between a one-off
// cancellation and an ongoing weekly suspension.
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
    <div style={{ padding: 18, borderRadius: 16, border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.03)', display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 900 }}>{heading}</div>

      {!d.turningOffRecurring && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>তারিখ</div>
          <input
            type="date"
            value={d.date}
            onChange={(e) => s.updateOverrideDraft({ date: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>নিজে থেকে বেছে নাও — এটা শুধু একটা সুপারিশ, তুমি বদলে দিতে পারো।</div>
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
              শুধু এই তারিখে বন্ধ
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
              এখন থেকে প্রতি সপ্তাহে বন্ধ (পরবর্তী নির্দেশ না দেওয়া পর্যন্ত)
            </button>
          </div>
        </div>
      )}

      {!d.turningOffRecurring && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>কারণ (ঐচ্ছিক)</div>
          <input
            type="text"
            value={d.reason}
            onChange={(e) => s.updateOverrideDraft({ reason: e.target.value })}
            placeholder="যেমনঃ শিক্ষক অসুস্থ, ছুটির দিন..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
          />
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        {dateLabel} — এই সিদ্ধান্তের সাথে সাথে ক্লাসের গ্রুপ নোটিশ ফিডে (এবং Telegram কানেক্টেড থাকলে সেখানেও) একটা নোটিশ যাবে।
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={s.confirmOverrideDraft}
          disabled={isBusy}
          className="accent-fill-glass"
          style={{ padding: '10px 18px', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.7 : 1 }}
        >
          {isBusy ? 'সেভ হচ্ছে…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={s.cancelOverrideDraft}
          disabled={isBusy}
          className="btn btn-ghost"
          style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: isBusy ? 'not-allowed' : 'pointer' }}
        >
          বাতিল
        </button>
      </div>
    </div>
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
function CadenceConfirmPanel({ s }) {
  const d = s.cadenceDraft;
  const isBusy = s.cadenceBusyKey === d.slotKey || !!s.cadenceBusyKey;
  const [pickDate, setPickDate] = React.useState(d.entry.anchorDate || '');
  const pickedOccurrence = pickDate ? s.getCadenceOccurrence(d.entry, pickDate) : null;

  const modeLabel = { alternating: 'এক সপ্তাহ পর পর (Alternating)', weekly: 'প্রতি সপ্তাহে', manual: 'সম্পূর্ণ ম্যানুয়াল' };

  return (
    <div style={{ padding: 18, borderRadius: 16, border: '1px solid rgba(37,99,235,0.25)', background: 'rgba(37,99,235,0.03)', display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 900 }}>{d.label} — Sessional Cadence</div>

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
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}
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
  );
}
