import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { store, uid } from '../store/store';

export default function Assignments() {
  const courses = store.get('courses') || [];
  const [items, setItems] = useState(() => store.get('assignments') || []);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ courseId: '', title: '', desc: '', due: '', status: 'pending', priority: 'medium' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    const updated = [{ ...form, id: uid() }, ...items];
    setItems(updated); store.set('assignments', updated); setAdding(false);
    setForm({ courseId: '', title: '', desc: '', due: '', status: 'pending', priority: 'medium' });
  };

  const toggle = (id) => {
    const updated = items.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'pending' : 'done' } : a);
    setItems(updated); store.set('assignments', updated);
  };

  const del = (id) => { const u = items.filter(a => a.id !== id); setItems(u); store.set('assignments', u); };

  const getCourse = (id) => courses.find(c => c.id === id);

  const filtered = items.filter(a => filter === 'all' ? true : filter === 'pending' ? a.status !== 'done' : a.status === 'done');

  const isOverdue = (due) => due && new Date(due) < new Date() && true;

  const priorityColor = { high: 'tag-red', medium: 'tag-yellow', low: 'tag-gray' };

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Assignments</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{items.filter(a => a.status !== 'done').length} pending</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Add</button>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Assignment Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Lab Report #3 — Linked List" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Due Date</label><input type="date" value={form.due} onChange={e => set('due', e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Details</label>
            <textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} placeholder="Topics, requirements..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {['all', 'pending', 'done'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
            background: filter === f ? 'var(--accent)' : 'transparent',
            color: filter === f ? 'var(--accentFg)' : 'var(--muted)',
            cursor: 'pointer', fontSize: 12, fontFamily: 'Sora, sans-serif', fontWeight: 500,
          }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {filtered.map(a => {
        const c = getCourse(a.courseId);
        const overdue = a.status !== 'done' && isOverdue(a.due);
        return (
          <div key={a.id} className="card" style={{
            marginBottom: 6, opacity: a.status === 'done' ? 0.6 : 1,
            borderLeft: `3px solid ${overdue ? 'var(--danger)' : a.status === 'done' ? 'var(--border)' : 'var(--accent)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <button onClick={() => toggle(a.id)} style={{
                width: 18, height: 18, borderRadius: 4, border: `2px solid ${a.status === 'done' ? 'var(--accent)' : 'var(--border)'}`,
                background: a.status === 'done' ? 'var(--accent)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
              }}>
                {a.status === 'done' && <Check size={11} color="var(--accentFg)" />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, textDecoration: a.status === 'done' ? 'line-through' : 'none' }}>{a.title}</span>
                  {c && <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{c.code}</span>}
                  <span className={`tag ${priorityColor[a.priority]}`}>{a.priority}</span>
                  {overdue && <span className="tag tag-red">Overdue</span>}
                </div>
                {a.due && <div style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--muted)', marginTop: 2 }}>Due: {a.due}</div>}
                {a.desc && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.desc}</div>}
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(a.id)}><Trash2 size={12} color="var(--danger)" /></button>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>No assignments here.</p>
        </div>
      )}
    </div>
  );
}
