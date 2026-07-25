import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, Users, Phone, Mail, Building2 } from 'lucide-react';
import { store, uid } from '../store/store';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Teachers() {
  const [teachers, setTeachers] = useState(() => store.get('teachers') || []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', initial: '', title: '', dept: '', phone: '', email: '', courses: '', officeRoom: '', rating: '', notes: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name) return;
    if (editing) {
      const updated = teachers.map(t => t.id === editing ? { ...form, id: editing } : t);
      setTeachers(updated); store.set('teachers', updated); setEditing(null);
    } else {
      const updated = [...teachers, { ...form, id: uid() }];
      setTeachers(updated); store.set('teachers', updated); setAdding(false);
    }
    setForm({ name: '', initial: '', title: '', dept: '', phone: '', email: '', courses: '', officeRoom: '', rating: '', notes: '' });
  };

  const startEdit = (t) => { setForm(t); setEditing(t.id); setAdding(false); };
  const del = (id) => setDeleteTarget(id);
  const confirmDelete = () => {
    const u = teachers.filter(t => t.id !== deleteTarget);
    setTeachers(u);
    store.set('teachers', u);
    setDeleteTarget(null);
  };

  return (
    <div className="page-enter page-container content-page-bg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="content-page-hero">
          <div className="content-page-hero-icon">
            <Users size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Teachers</h1>
            <p className="content-page-hero-subtitle">Contact info, courses, and notes</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>
          <Plus size={13} /> Add Teacher
        </button>
      </div>

      {(adding || editing) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{editing ? 'Edit' : 'Add'} Teacher</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Full Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Kamal Hossain" /></div>
            <div><label>Initial</label><input value={form.initial} onChange={e => set('initial', e.target.value)} placeholder="KH" /></div>
            <div><label>Title / Position</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Professor" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="017XXXXXXXX" /></div>
            <div><label>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} placeholder="kamal@kuet.ac.bd" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Courses (codes)</label><input value={form.courses} onChange={e => set('courses', e.target.value)} placeholder="CSE 2201, CSE 2202" /></div>
            <div><label>Office Room</label><input value={form.officeRoom} onChange={e => set('officeRoom', e.target.value)} placeholder="Acad. Bldg 302" /></div>
            <div><label>My Rating (1-5)</label><input type="number" min={1} max={5} value={form.rating} onChange={e => set('rating', e.target.value)} placeholder="4" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Teaching style, tips..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save}><Check size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setEditing(null); }}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {teachers.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>No teachers added yet.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teachers.map(t => (
          <div key={t.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                  {t.initial && <span className="tag tag-gray">{t.initial}</span>}
                  {t.title && <span className="tag tag-blue">{t.title}</span>}
                  {t.rating && (
                    <span style={{ fontSize: 11, color: 'var(--warning)' }}>
                      {'★'.repeat(+t.rating)}{'☆'.repeat(5 - +t.rating)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                  {t.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{t.phone}</span>}
                  {t.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{t.email}</span>}
                  {t.officeRoom && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />{t.officeRoom}</span>}
                </div>
                {t.courses && <div style={{ fontSize: 12, marginTop: 4 }}>Courses: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>{t.courses}</span></div>}
                {t.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => startEdit(t)}><Edit2 size={12} /></button>
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(t.id)}><Trash2 size={12} color="var(--danger)" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete teacher?"
        message="This will remove the teacher from your local data."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
