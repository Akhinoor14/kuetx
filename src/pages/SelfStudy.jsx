import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store, uid } from '../store/store';

export default function SelfStudy() {
  const courses = store.get('courses') || [];
  const [sessions, setSessions] = useState(() => store.get('selfstudy') || []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    courseId: '', topic: '', hours: '', notes: '', productive: true
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    if (!form.topic || !form.hours) return;
    const u = [{ ...form, hours: +form.hours, id: uid() }, ...sessions];
    setSessions(u); store.set('selfstudy', u); setAdding(false);
    setForm({ date: new Date().toISOString().split('T')[0], courseId: '', topic: '', hours: '', notes: '', productive: true });
  };

  const del = (id) => { const u = sessions.filter(s => s.id !== id); setSessions(u); store.set('selfstudy', u); };

  const getCourse = (id) => courses.find(c => c.id === id);

  // Last 7 days chart
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayHours = sessions.filter(s => s.date === dateStr).reduce((sum, s) => sum + (s.hours || 0), 0);
      return { day: d.toLocaleDateString('en', { weekday: 'short' }), hours: dayHours };
    });
  }, [sessions]);

  const totalHours = sessions.reduce((s, x) => s + (x.hours || 0), 0);
  const last7Hours = chartData.reduce((s, d) => s + d.hours, 0);

  // Group by date
  const byDate = {};
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Self Study</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{totalHours.toFixed(1)} total hours logged</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Log Session</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Last 7 Days</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{last7Hours.toFixed(1)}h</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Daily Average</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{sessions.length ? (totalHours / Math.max(Object.keys(byDate).length, 1)).toFixed(1) : '0'}h</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total Sessions</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{sessions.length}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Hours per Day (Last 7)</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <Tooltip contentStyle={{ fontSize: 12, background: 'var(--card)', border: '1px solid var(--border)' }} />
            <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div>
              <label>Course (optional)</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">General</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0.25} step={0.25} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label>Topic / What you studied</label><input value={form.topic} onChange={e => set('topic', e.target.value)} placeholder="Binary Search Trees — Chapter 5" /></div>
          <div style={{ marginBottom: 10 }}><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Key learnings..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 7).map(date => (
        <div key={date} style={{ marginBottom: 10 }}>
          <div className="section-title">
            {new Date(date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
            {byDate[date].reduce((s, x) => s + (x.hours || 0), 0).toFixed(1)}h
          </div>
          {byDate[date].map(s => {
            const c = getCourse(s.courseId);
            return (
              <div key={s.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.topic}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c ? c.code : 'General'}{s.notes ? ` · ${s.notes.slice(0, 60)}` : ''}</div>
                </div>
                <span className="tag tag-blue">{s.hours}h</span>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(s.id)}><Trash2 size={11} color="var(--danger)" /></button>
              </div>
            );
          })}
        </div>
      ))}

      {sessions.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Log your self-study sessions to track independent learning.</p>
        </div>
      )}
    </div>
  );
}
