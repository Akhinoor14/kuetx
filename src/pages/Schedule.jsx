import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { store, uid } from '../store/store';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const PERIODS = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export default function Schedule() {
  const courses = store.get('courses') || [];
  const [schedule, setSchedule] = useState(() => store.get('schedule') || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ day: 'Saturday', period: '8:00', courseId: '', room: '', type: 'Theory' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    if (!form.courseId) return;
    const updated = [...schedule, { ...form, id: uid() }];
    setSchedule(updated); store.set('schedule', updated); setAdding(false);
  };

  const remove = (id) => {
    const updated = schedule.filter(s => s.id !== id);
    setSchedule(updated); store.set('schedule', updated);
  };

  const getCourse = (id) => courses.find(c => c.id === id);

  // Build grid
  const grid = {};
  DAYS.forEach(d => { grid[d] = {}; PERIODS.forEach(p => { grid[d][p] = []; }); });
  schedule.forEach(s => {
    if (grid[s.day]?.[s.period]) grid[s.day][s.period].push(s);
  });

  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'Saturday';
  const todayClasses = schedule.filter(s => s.day === today);

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Class Schedule</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Weekly routine with today's classes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} /> Add Class
        </button>
      </div>

      {/* Today */}
      {todayClasses.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📅 Today ({today})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {todayClasses.sort((a, b) => a.period.localeCompare(b.period)).map(s => {
              const c = getCourse(s.courseId);
              return (
                <div key={s.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{s.period}</div>
                  <div>{c?.code} — {c?.name}</div>
                  {s.room && <div style={{ color: 'var(--muted)' }}>Room: {s.room}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Add Class Slot</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Day</label>
              <select value={form.day} onChange={e => set('day', e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label>Time</label>
              <select value={form.period} onChange={e => set('period', e.target.value)}>
                {PERIODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <label>Room</label>
              <input value={form.room} onChange={e => set('room', e.target.value)} placeholder="Room 301" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Add</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Timetable grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', border: '1px solid var(--border)', background: 'var(--surface)', minWidth: 60 }}>Time</th>
              {DAYS.map(d => (
                <th key={d} style={{
                  padding: '8px 10px', border: '1px solid var(--border)', background: 'var(--surface)',
                  fontWeight: d === today ? 700 : 500, color: d === today ? 'var(--accent)' : 'var(--text)',
                  minWidth: 100
                }}>{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(p => (
              <tr key={p}>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)', fontWeight: 500, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>{p}</td>
                {DAYS.map(d => (
                  <td key={d} style={{ padding: '4px 6px', border: '1px solid var(--border)', verticalAlign: 'top', minHeight: 36 }}>
                    {(grid[d]?.[p] || []).map(s => {
                      const c = getCourse(s.courseId);
                      return (
                        <div key={s.id} style={{
                          padding: '3px 6px', borderRadius: 4, fontSize: 10, marginBottom: 2,
                          background: 'var(--accent)', color: 'var(--accentFg)', position: 'relative',
                        }}>
                          <div style={{ fontWeight: 600 }}>{c?.code || '?'}</div>
                          {s.room && <div style={{ opacity: 0.85 }}>{s.room}</div>}
                          <button onClick={() => remove(s.id)} style={{
                            position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                            color: 'inherit', cursor: 'pointer', opacity: 0.7, padding: 0, lineHeight: 1,
                          }}>×</button>
                        </div>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
