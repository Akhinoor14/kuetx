import { useState, useMemo } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey } from '../store/store';

export default function Assignments() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  
  // Filter courses to show only current term courses
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(() => {
    if (!currentTermKey) return courses;
    // Extract year and term from key (e.g., 'Y1T1' => year=1, term=1)
    const match = currentTermKey.match(/Y(\d)T(\d)/);
    if (!match) return courses;
    const [, year, term] = match.map(Number);
    return courses.filter(c => c.year === year && c.term === term);
  }, [courses, currentTermKey]);
  
  const [items, setItems] = useState(() => store.get('assignments') || []);
  const [adding, setAdding] = useState(false);
  const [multipleMode, setMultipleMode] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ courseId: '', title: '', desc: '', due: '', status: 'pending', priority: 'medium' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const add = () => {
    const updated = [{ ...form, id: uid() }, ...items];
    setItems(updated); 
    store.set('assignments', updated); 
    
    // In multiple mode, keep the form and only clear title/desc; otherwise close
    if (!multipleMode) {
      setAdding(false);
    }
    
    setForm({ 
      courseId: multipleMode ? form.courseId : '', 
      title: '', 
      desc: '', 
      due: multipleMode ? form.due : '', 
      status: 'pending', 
      priority: multipleMode ? form.priority : 'medium' 
    });
  };

  const toggle = (id) => {
    const updated = items.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'pending' : 'done' } : a);
    setItems(updated); store.set('assignments', updated);
  };

  const del = (id) => { const u = items.filter(a => a.id !== id); setItems(u); store.set('assignments', u); };

  const getCourse = (id) => courses.find(c => c.id === id);

  // Color scheme for course badges
  const getCourseColor = (courseId) => {
    const colors = [
      { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', text: 'var(--accent)' },
      { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', text: 'rgb(34,197,94)' },
      { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.35)', text: 'rgb(168,85,247)' },
      { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', text: 'rgb(249,115,22)' },
      { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.35)', text: 'rgb(236,72,153)' },
    ];
    const index = (currentTermCourses.findIndex(c => c.id === courseId) % colors.length);
    return colors[Math.max(0, index)];
  };

  // Calculate days left until due date
  const getDaysLeft = (due) => {
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(`${due}T00:00:00`);
    const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Add Assignment{multipleMode ? 's (Multiple Mode)' : ''}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={multipleMode}
                  onChange={e => setMultipleMode(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Keep form open
              </label>
              <button className="btn btn-ghost" onClick={() => { setAdding(false); setMultipleMode(false); setForm({ courseId: '', title: '', desc: '', due: '', status: 'pending', priority: 'medium' }); }} style={{ padding: '4px 8px' }}>Close</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
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
            <button className="btn btn-primary" onClick={add}>Add</button>
            {multipleMode && <button className="btn btn-ghost" onClick={() => { setAdding(false); setMultipleMode(false); setForm({ courseId: '', title: '', desc: '', due: '', status: 'pending', priority: 'medium' }); }}>Done</button>}
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
        const daysLeft = getDaysLeft(a.due);
        const courseColor = getCourseColor(a.courseId);
        const priorityBg = a.priority === 'high' ? 'rgba(239,68,68,0.1)' : a.priority === 'medium' ? 'rgba(249,115,22,0.1)' : 'rgba(107,114,128,0.1)';
        const priorityColor = a.priority === 'high' ? 'rgb(239,68,68)' : a.priority === 'medium' ? 'rgb(249,115,22)' : 'rgb(107,114,128)';
        
        return (
          <div key={a.id} className="card" style={{
            marginBottom: 8, 
            opacity: a.status === 'done' ? 0.6 : 1,
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }}>
                  {/* Course Badge */}
                  {c && (
                    <div
                      style={{
                        padding: '3px 10px',
                        borderRadius: 5,
                        background: courseColor.bg,
                        border: `1px solid ${courseColor.border}`,
                        color: courseColor.text,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.code}
                    </div>
                  )}
                  
                  {/* Title */}
                  <span style={{ 
                    fontWeight: 600, 
                    fontSize: 13, 
                    textDecoration: a.status === 'done' ? 'line-through' : 'none',
                    color: 'var(--text)',
                    flex: 1,
                  }}>
                    {a.title}
                  </span>
                </div>
                
                {/* Meta Info: Days Left, Priority, Due Date */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  {a.due && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                      <span style={{ 
                        color: overdue ? 'var(--danger)' : daysLeft === 0 ? 'rgb(239,68,68)' : 'var(--muted)',
                        fontWeight: daysLeft <= 1 ? 700 : 500
                      }}>
                        📅 {overdue ? 'Overdue' : daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                      </span>
                    </div>
                  )}
                  
                  {/* Priority Tag */}
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: priorityBg,
                      color: priorityColor,
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.priority.toUpperCase()}
                  </span>
                </div>
                
                {/* Description */}
                {a.desc && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.4 }}>{a.desc}</div>}
                
                {/* Due Date */}
                {a.due && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Due: {a.due}</div>}
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
