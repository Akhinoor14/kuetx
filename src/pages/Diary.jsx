import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { store, uid } from '../store/store';

export default function Diary() {
  const courses = store.get('courses') || [];
  const [entries, setEntries] = useState(() => store.get('diary') || []);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    courseId: '', topics: '', notes: '', selfRating: 4, missed: false
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    const updated = [{ ...form, id: uid() }, ...entries];
    setEntries(updated); store.set('diary', updated); setAdding(false);
  };

  const del = (id) => { const u = entries.filter(e => e.id !== id); setEntries(u); store.set('diary', u); };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const getCourse = (id) => courses.find(c => c.id === id);

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Class Diary</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>What was covered in each class</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} /> Log Class
        </button>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Log Today's Class</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Topics Covered</label>
            <textarea value={form.topics} onChange={e => set('topics', e.target.value)} rows={2} placeholder="Linked lists, doubly linked lists..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Notes / Key Points</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Important formula, teacher's tips..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Class Quality (1-5)</label>
              <select value={form.selfRating} onChange={e => set('selfRating', +e.target.value)}>
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} — {'★'.repeat(v)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                <input type="checkbox" checked={form.missed} onChange={e => set('missed', e.target.checked)} style={{ width: 'auto' }} />
                Class was missed
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Save Entry</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div className="section-title">{new Date(date).toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          {byDate[date].map(e => {
            const c = getCourse(e.courseId);
            return (
              <div key={e.id} className="card" style={{ marginBottom: 6, borderLeft: `3px solid ${e.missed ? 'var(--danger)' : 'var(--accent)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{c?.code || '?'}</span>
                    <span style={{ fontSize: 13 }}>{c?.name}</span>
                    {e.missed && <span className="tag tag-red">Missed</span>}
                    {e.selfRating && <span style={{ fontSize: 12, color: 'var(--warning)' }}>{'★'.repeat(e.selfRating)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggle(e.id)}>
                      {expanded[e.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(e.id)}><Trash2 size={12} color="var(--danger)" /></button>
                  </div>
                </div>
                {expanded[e.id] && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {e.topics && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--muted)', fontWeight: 500 }}>Topics: </span>{e.topics}</div>}
                    {e.notes && <div><span style={{ color: 'var(--muted)', fontWeight: 500 }}>Notes: </span>{e.notes}</div>}
                  </div>
                )}
                {!expanded[e.id] && e.topics && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{e.topics.slice(0, 80)}{e.topics.length > 80 ? '...' : ''}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {entries.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Start logging your classes to track what's been covered.</p>
        </div>
      )}
    </div>
  );
}
