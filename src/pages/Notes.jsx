// Notes page
import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, FileText, Pin } from 'lucide-react';
import { store, uid } from '../store/store';

export function Notes() {
  const [notes, setNotes] = useState(() => store.get('notes') || []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', tag: 'general', pinned: false });

  const TAGS = ['general', 'important', 'idea', 'todo', 'course'];
  const tagColor = { general: 'tag-gray', important: 'tag-red', idea: 'tag-blue', todo: 'tag-yellow', course: 'tag-green' };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.title && !form.body) return;
    if (editing) {
      const u = notes.map(n => n.id === editing ? { ...form, id: editing, updatedAt: Date.now() } : n);
      setNotes(u); store.set('notes', u); setEditing(null);
    } else {
      const u = [{ ...form, id: uid(), createdAt: Date.now() }, ...notes];
      setNotes(u); store.set('notes', u); setAdding(false);
    }
    setForm({ title: '', body: '', tag: 'general', pinned: false });
  };

  const del = (id) => { const u = notes.filter(n => n.id !== id); setNotes(u); store.set('notes', u); };
  const startEdit = (n) => { setForm(n); setEditing(n.id); setAdding(false); };
  const togglePin = (id) => {
    const u = notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    setNotes(u); store.set('notes', u);
  };

  const sorted = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <FileText size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Notes</h1>
          </div>
        </div>
        <div className="content-page-hero-actions">
          <button className="btn btn-primary" onClick={() => { setAdding(true); setEditing(null); }}><Plus size={13} /> <span className="btn-txt">New Note</span></button>
        </div>
      </div>

      {(adding || editing) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ marginBottom: 8 }}>
            <label>Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Note title..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Content</label>
            <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={4} placeholder="Write anything..." />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label>Tag</label>
              <select value={form.tag} onChange={e => set('tag', e.target.value)}>
                {TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, cursor: 'pointer', fontSize: 13, color: 'var(--text)', alignSelf: 'flex-end', paddingBottom: 2 }}>
              <input type="checkbox" checked={form.pinned} onChange={e => set('pinned', e.target.checked)} style={{ width: 'auto' }} />
              Pin
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save}><Check size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setEditing(null); }}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {sorted.map(n => (
          <div key={n.id} className="card" style={{ borderTop: n.pinned ? '3px solid var(--accent)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
                {n.pinned && <Pin size={12} color="var(--accent)" fill="var(--accent)" />}
                <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</span>
                <span className={`tag ${tagColor[n.tag] || 'tag-gray'}`}>{n.tag}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ padding: '3px 6px' }} onClick={() => togglePin(n.id)}>
                  <Pin size={11} color={n.pinned ? 'var(--accent)' : 'currentColor'} fill={n.pinned ? 'var(--accent)' : 'none'} />
                </button>
                <button className="btn btn-ghost" style={{ padding: '3px 6px' }} onClick={() => startEdit(n)}><Edit2 size={11} /></button>
                <button className="btn btn-ghost" style={{ padding: '3px 6px' }} onClick={() => del(n.id)}><Trash2 size={11} color="var(--danger)" /></button>
              </div>
            </div>
            {n.body && <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{n.body.slice(0, 200)}{n.body.length > 200 ? '…' : ''}</div>}
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
              {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-BD') : ''}
            </div>
          </div>
        ))}
      </div>

      {notes.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Start capturing your thoughts, ideas, and course notes here.</p>
        </div>
      )}
    </div>
  );
}
