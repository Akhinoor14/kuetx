import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { store, getAttendanceMarks, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT } from '../store/store';

const todayStr = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; };
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long' });

// Compute attendance from daily logs + manual fallback
function getEffective(courseId, logs, manual) {
  let held = 0, attended = 0;
  Object.values(logs).forEach(day => {
    const v = day[courseId];
    if (v === 'present' || v === 'absent') { held++; if (v === 'present') attended++; }
  });
  if (held > 0) return { held, attended, source: 'log' };
  const m = manual[courseId];
  if (m?.held) return { held: +m.held, attended: +(m.attended||0), source: 'manual' };
  return { held: 0, attended: 0, source: 'none' };
}

// Attendance status color
function attColor(pct) {
  if (pct < MIN_ATTENDANCE_PERCENT) return 'var(--danger)';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return 'var(--warning)';
  return 'var(--success)';
}

// ── Daily Log ─────────────────────────────────────────────────────────────
function DailyLog({ courses, logs, setLogs }) {
  const [date, setDate] = useState(todayStr());
  const dayLog = logs[date] || {};
  const isToday = date === todayStr();
  const dayName = new Date(date + 'T00:00:00').getDay();
  const isFriday = dayName === 5;

  const mark = (courseId, val) => {
    const cur = dayLog[courseId];
    const next = cur === val ? undefined : val; // toggle off
    const updated = { ...logs, [date]: { ...dayLog, [courseId]: next } };
    // clean undefined
    if (next === undefined) delete updated[date][courseId];
    setLogs(updated);
    store.set('attLogs', updated);
  };

  const markedCount = courses.filter(c => dayLog[c.id]).length;

  return (
    <div>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(d => addDays(d, -1))}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            max={todayStr()}
            style={{ fontWeight: 700, fontSize: 15, textAlign: 'center' }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(d => addDays(d, 1))} disabled={isToday}>
          <ChevronRight size={16} />
        </button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayStr())}>Today</button>}
      </div>

      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(date)}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{markedCount}/{courses.length} marked</div>
      </div>

      {isFriday && (
        <div className="alert-warning mb-3" style={{ fontSize: 13 }}>
          🕌 Friday — Jumu'ah day. Remember to check which classes are held.
        </div>
      )}

      {courses.length === 0 && (
        <div className="empty-state"><div className="icon">📚</div><p>Add courses first.</p></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courses.map(c => {
          const status = dayLog[c.id];
          return (
            <div key={c.id} className="card" style={{
              padding: '14px 18px',
              borderLeft: `4px solid ${status === 'present' ? 'var(--success)' : status === 'absent' ? 'var(--danger)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { val: 'present', label: '✓ Present', on: '#dcfce7', off: 'var(--inputBg)', textOn: '#166534', textOff: 'var(--muted)', border: '#86efac' },
                  { val: 'absent',  label: '✗ Absent',  on: '#fee2e2', off: 'var(--inputBg)', textOn: '#991b1b', textOff: 'var(--muted)', border: '#fca5a5' },
                  { val: 'holiday', label: '⛔ No Class', on: '#fef9c3', off: 'var(--inputBg)', textOn: '#854d0e', textOff: 'var(--muted)', border: '#fde68a' },
                ].map(opt => {
                  const active = status === opt.val;
                  return (
                    <button key={opt.val} onClick={() => mark(c.id, opt.val)} style={{
                      padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontWeight: 700,
                      fontSize: 13, fontFamily: 'Sora, sans-serif',
                      background: active ? opt.on : opt.off,
                      color: active ? opt.textOn : opt.textOff,
                      border: `2px solid ${active ? opt.border : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}>{opt.label}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 10, fontSize: 13, color: 'var(--muted)' }}>
        💡 Tip: You can go back to any past date and fill in missed entries. All changes auto-save.
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
function Summary({ courses, logs, manual, setManual }) {
  const updateManual = (id, field, val) => {
    const updated = { ...manual, [id]: { ...(manual[id]||{}), [field]: Math.max(0, +val||0) } };
    setManual(updated);
    store.set('attendance', updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {courses.map(c => {
        const { held, attended, source } = getEffective(c.id, logs, manual);
        const pct = held ? Math.round((attended / held) * 100) : null;
        const attMarks = pct !== null ? getAttendanceMarks(pct) : null;
        const need75   = held ? Math.max(0, Math.ceil(held * 0.75) - attended) : null;
        const canMiss  = held && pct >= 60 ? Math.max(0, attended - Math.ceil(held * 0.60)) : null;

        return (
          <div key={c.id} className="card" style={{ padding: 18 }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.code} — {c.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Y{c.year} T{c.term} · {c.credits}cr
                  {source === 'log' && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>● from daily log</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {attMarks !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Marks</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{attMarks}/10</div>
                  </div>
                )}
                {pct !== null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Attendance</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: attColor(pct), letterSpacing: '-0.03em' }}>{pct}%</div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {pct !== null && (
              <div style={{ marginBottom: 10 }}>
                <div className="progress-bar" style={{ height: 10 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(100,pct)}%`, background: attColor(pct) }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                  <span>{attended}/{held} classes</span>
                  {pct < 75 && need75 > 0 && <span style={{ color: 'var(--warning)' }}>Need {need75} more for 75%</span>}
                  {pct >= 75 && canMiss !== null && <span style={{ color: 'var(--success)' }}>Can miss {canMiss} more (stay ≥60%)</span>}
                </div>
              </div>
            )}

            {/* Status badge */}
            {pct !== null && (
              <div style={{ marginBottom: 12 }}>
                {pct < MIN_ATTENDANCE_PERCENT
                  ? <div className="alert-critical" style={{ padding: '8px 12px', fontSize: 13 }}>🔴 Below 60% — Course will be CANCELLED (Art. 11.3)</div>
                  : pct < SCHOLARSHIP_ATTENDANCE_PCT
                  ? <div className="alert-warning" style={{ padding: '8px 12px', fontSize: 13 }}>⚠ Below 75% — Not eligible for scholarship (Art. 14.2)</div>
                  : <div className="alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>✓ Good attendance</div>
                }
              </div>
            )}

            {/* Manual entry (only if no log data) */}
            {source !== 'log' && (
              <div className="form-row form-row-2">
                <div>
                  <label>Total Classes Held</label>
                  <input type="number" min={0} value={manual[c.id]?.held || ''} onChange={e => updateManual(c.id, 'held', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label>Classes Attended</label>
                  <input type="number" min={0} max={manual[c.id]?.held || 999} value={manual[c.id]?.attended || ''} onChange={e => updateManual(c.id, 'attended', e.target.value)} placeholder="0" />
                </div>
              </div>
            )}
            {source === 'log' && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Auto-counted from daily log. Switch to Summary tab to override manually.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Attendance() {
  const courses = (store.get('courses') || []).filter(c => c.status === 'active' || c.status === 'backlog');
  const [logs,   setLogs]   = useState(() => store.get('attLogs')   || {});
  const [manual, setManual] = useState(() => store.get('attendance') || {});
  const [tab, setTab] = useState('daily');

  return (
    <div className="page-enter" style={{ padding: 20, maxWidth: 820 }}>
      <div style={{ marginBottom: 20 }}>
        <h1>Attendance</h1>
        <p className="text-muted" style={{ marginTop: 4 }}>
          Mark daily classes or enter totals manually — past dates always editable
        </p>
      </div>

      <div className="tabs">
        {[['daily','📅 Daily Log'], ['summary','📊 Summary & Stats']].map(([id,label]) => (
          <button key={id} className={`tab-btn ${tab===id?'active':''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'daily'
        ? <DailyLog courses={courses} logs={logs} setLogs={setLogs} />
        : <Summary  courses={courses} logs={logs} manual={manual} setManual={setManual} />
      }

      {/* Slab reference */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Attendance → Marks Slab (Art. 14.2)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['≥90%','10/10','var(--success)'],['85–90%','9/10',''],['80–85%','8/10',''],['75–80%','7/10',''],
            ['70–75%','6/10',''],['65–70%','5/10',''],['60–65%','4/10','var(--warning)'],['<60%','CANCELLED','var(--danger)']
          ].map(([range, marks, col]) => (
            <div key={range} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--inputBg)', borderRadius: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: col || 'var(--text)' }}>{marks}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{range}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          * The 10% covers class participation, attendance & assignments (Art. 14.1.i)
        </div>
      </div>
    </div>
  );
}
