import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Play, Pause, Square, RotateCcw, Save, ChevronDown, ChevronRight, Edit2, Check, X, Copy, CheckCheck, MapPin, Cpu, List, Timer, Users, BarChart2, Volume2, VolumeX, Vibrate, Bell, BellOff, Github, Globe, Calendar, Settings, Search, BookOpen, AlertTriangle } from 'lucide-react';
import {
  store,
  uid,
  getProfile,
  getTermLabelFromKey,
  TIMER_MODES,
  PRODUCTIVE_TIME_CATEGORIES,
  DISTRACTION_TIME_CATEGORIES,
  appendTimerSession,
  getTimerSessions,
  hoursFromMs,
  formatDurationMs,
  msToHms,
  setTimerSessions,
} from '../store/store';
import { getAllCourses, getDeptSyllabus } from '../store/curriculumStore';
import useTimerEngine from '../hooks/useTimerEngine';
import Modal from '../components/Modal';
import { alertDialog } from '../lib/dialog';

// Local-date helpers (avoid toISOString(), which shifts to UTC and breaks date-keys at night in BD/UTC+6)
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const TIME_TRACKER_CATEGORIES = ['Study', 'Class', 'Self Study', 'Facebook/YouTube', 'Gaming', 'Sleep', 'Exercise', 'Tuition', 'Travel', 'Adda', 'Other'];

function TimeTrackerCategorySelect({ value, onChangeValue, className = '' }) {
  const [open, setOpen] = useState(false);
  const setCategory = (next) => {
    onChangeValue(next);
    setOpen(false);
  };

  return (
    <div className={`form-field time-tracker-select-field ${className}`.trim()}>
      <label>Category</label>
      <div className="time-tracker-select-shell time-tracker-select-desktop">
        <select className="time-tracker-select" value={value} onChange={(e) => setCategory(e.target.value)}>
          {TIME_TRACKER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <ChevronDown size={14} className="time-tracker-select-icon" aria-hidden="true" />
      </div>
      <div className="time-tracker-mobile-category-picker">
        <button type="button" className="time-tracker-category-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span>{value}</span>
          <ChevronDown size={14} className={`time-tracker-select-icon ${open ? 'is-open' : ''}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="time-tracker-category-panel">
            {TIME_TRACKER_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`time-tracker-category-option ${category === value ? 'active' : ''}`}
                onClick={() => setCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tours ────────────────────────────────────────────────────────────────────
const TOUR_TYPES = [
  { value: 'solo', label: 'Solo', color: 'tag-blue' },
  { value: 'with_friends', label: 'With Friends', color: 'tag-green' },
  { value: 'family', label: 'Family', color: 'tag-yellow' },
  { value: 'department', label: 'Dept. Tour', color: 'tag-purple' },
];

export function Tours() {
  const [tours, setTours] = useState(() => store.get('tours') || []);
  const [form, setForm] = useState({ name: '', date: '', companions: '', budget: '', spent: '', notes: '', type: 'with_friends', outline: [] });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const addOutlineSection = () => setForm(f => ({ ...f, outline: [...f.outline, { title: '', topics: [''] }] }));
  const updateOutlineTitle = (index, title) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === index ? { ...s, title } : s) }));
  const updateOutlineTopic = (si, ti, value) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === si ? { ...s, topics: s.topics.map((t, j) => j === ti ? value : t) } : s) }));
  const addOutlineTopic = (index) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === index ? { ...s, topics: [...s.topics, ''] } : s) }));
  const removeOutlineSection = (index) => setForm(f => ({ ...f, outline: f.outline.filter((_, i) => i !== index) }));
  const removeOutlineTopic = (si, ti) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === si ? { ...s, topics: s.topics.filter((_, j) => j !== ti) } : s) }));

  // Edit form outline handlers
  const editAddSection = () => setEditForm(f => ({ ...f, outline: [...(f.outline || []), { title: '', topics: [''] }] }));
  const editUpdateTitle = (index, title) => setEditForm(f => ({ ...f, outline: (f.outline || []).map((s, i) => i === index ? { ...s, title } : s) }));
  const editUpdateTopic = (si, ti, value) => setEditForm(f => ({ ...f, outline: (f.outline || []).map((s, i) => i === si ? { ...s, topics: s.topics.map((t, j) => j === ti ? value : t) } : s) }));
  const editAddTopic = (index) => setEditForm(f => ({ ...f, outline: (f.outline || []).map((s, i) => i === index ? { ...s, topics: [...s.topics, ''] } : s) }));
  const editRemoveSection = (index) => setEditForm(f => ({ ...f, outline: (f.outline || []).filter((_, i) => i !== index) }));
  const editRemoveTopic = (si, ti) => setEditForm(f => ({ ...f, outline: (f.outline || []).map((s, i) => i === si ? { ...s, topics: s.topics.filter((_, j) => j !== ti) } : s) }));

  const save = () => {
    if (!form.name.trim()) return;
    const u = [{ ...form, id: uid() }, ...tours];
    setTours(u); store.set('tours', u); setAdding(false);
    setForm({ name: '', date: '', companions: '', budget: '', spent: '', notes: '', type: 'with_friends', outline: [] });
    setOutlineOpen(false);
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const saveEdit = () => {
    const u = tours.map(t => t.id === editingId ? { ...editForm } : t);
    setTours(u); store.set('tours', u);
    setEditingId(null); setEditForm(null);
  };

  const deleteTour = (id) => {
    const u = tours.filter(x => x.id !== id); setTours(u); store.set('tours', u);
  };

  const totalSpent = tours.reduce((s, t) => s + (+t.spent || 0), 0);
  const totalBudget = tours.reduce((s, t) => s + (+t.budget || 0), 0);
  const overBudgetCount = tours.filter(t => t.budget && t.spent && +t.spent > +t.budget).length;

  const filteredTours = filterType === 'all' ? tours : tours.filter(t => t.type === filterType);

  const typeInfo = (type) => TOUR_TYPES.find(x => x.value === type) || { label: type, color: 'tag-gray' };

  return (
    <div className="page-enter page-container content-page-bg">
      {/* Hero */}
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <MapPin size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Tours</h1>
          </div>
          <p className="content-page-hero-subtitle">Plan, track and remember your trips</p>
        </div>
        <div className="content-page-hero-actions">
          <div className="content-page-hero-stats" style={{ marginRight: 4 }}>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{tours.length}</div>
              <div className="content-page-hero-stat-label">trips</div>
            </div>
            {overBudgetCount > 0 && (
              <div className="content-page-hero-stat">
                <div className="content-page-hero-stat-n" style={{ color: 'var(--danger)' }}>{overBudgetCount}</div>
                <div className="content-page-hero-stat-label">over budget</div>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => { setAdding(true); setEditingId(null); }}>
            <Plus size={13} /> Add Tour
          </button>
        </div>
      </div>

      {/* Spend summary — kept as its own row below the hero since ৳ amounts
          don't fit the compact stat-pill format used for simple counts. */}
      <div className="card" style={{ marginBottom: 14, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalSpent.toLocaleString()}</div>
            <div className="stat-mini-lbl">Total spent</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalBudget.toLocaleString()}</div>
            <div className="stat-mini-lbl">Total budget</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      {tours.length > 0 && (
        <div className="filter-tab-row" style={{ marginBottom: 12 }}>
          <button className={`filter-tab ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All ({tours.length})</button>
          {TOUR_TYPES.map(tt => {
            const count = tours.filter(t => t.type === tt.value).length;
            return count > 0 ? (
              <button key={tt.value} className={`filter-tab ${filterType === tt.value ? 'active' : ''}`} onClick={() => setFilterType(tt.value)}>
                {tt.label} ({count})
              </button>
            ) : null;
          })}
        </div>
      )}

      {/* Add Form */}
      {adding && (
        <Modal onClose={() => { setAdding(false); setOutlineOpen(false); }} overlayStyle={{ padding: '12px 8px' }} contentStyle={{ width: '100%', maxWidth: 680, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'min(90vh, calc(100vh - 24px))', display: 'flex' }}>
          <div className="card tours-form-card" style={{ marginBottom: 0, borderRadius: 20, display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden', padding: 0, width: '100%' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Add Tour</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Log a trip, plan the route, track spending</div>
              </div>
              <button onClick={() => { setAdding(false); setOutlineOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* Destination — full width prominent */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Destination / Tour Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Cox's Bazar trip, Rangamati 2-day tour..." style={{ width: '100%', fontSize: 15, fontWeight: 600, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Date + Type row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Date</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Type</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                    {TOUR_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Companions */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Companions</label>
                <input value={form.companions} onChange={e => set('companions', e.target.value)} placeholder="Rahim, Karim, Jamal..." style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              {/* Budget + Spent row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Budget (৳)</label>
                  <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="5000" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Actual Spent (৳)</label>
                  <input type="number" value={form.spent} onChange={e => set('spent', e.target.value)} placeholder="4800" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Notes / Highlights</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Best moments, tips, what to eat, hidden gems..." style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>

            {/* Trip Outline (collapsible) */}
            <div className="tours-outline-card">
              <button
                type="button"
                onClick={() => setOutlineOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: outlineOpen ? 8 : 0 }}
              >
                <ChevronRight size={13} style={{ color: 'var(--muted)', transform: outlineOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--muted)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Trip Outline {form.outline.length > 0 ? `· ${form.outline.length} section${form.outline.length > 1 ? 's' : ''}` : '(optional)'}
                </span>
              </button>
              {outlineOpen && (
                <>
                  {form.outline.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0 8px' }}>Add stops, activities or day-plans to structure the trip.</div>
                  )}
                  {form.outline.map((section, si) => (
                    <div key={si} className="tours-outline-section" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <input
                          value={section.title}
                          onChange={e => updateOutlineTitle(si, e.target.value)}
                          placeholder={`Day ${si + 1} / Stop title`}
                          className="tours-outline-section-title"
                          style={{ flex: 1 }}
                        />
                        <button
                          style={{ flexShrink: 0, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, lineHeight: 1 }}
                          onClick={() => removeOutlineSection(si)}
                          title="Remove section"
                        ><X size={12} /></button>
                      </div>
                      {section.topics.map((topic, ti) => (
                        <div key={ti} className="tours-outline-item-row" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                          <span className="tours-outline-item-index" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 24, flexShrink: 0 }}>{si + 1}.{ti + 1}</span>
                          <input
                            value={topic}
                            onChange={e => updateOutlineTopic(si, ti, e.target.value)}
                            placeholder="Activity / stop / note"
                            className="tours-outline-item-input"
                            style={{ flex: 1 }}
                          />
                          <button
                            style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, lineHeight: 1 }}
                            onClick={() => removeOutlineTopic(si, ti)}
                            title="Remove item"
                          >×</button>
                        </div>
                      ))}
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', marginTop: 2 }} onClick={() => addOutlineTopic(si)}>+ Add item</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={addOutlineSection}>+ Add section</button>
                </>
              )}
            </div>
            </div>

            <div className="tours-form-actions" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 }}>
              <button className="btn btn-primary tours-form-save" onClick={save}>Save Tour</button>
              <button className="btn btn-ghost tours-form-cancel" onClick={() => { setAdding(false); setOutlineOpen(false); }}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {filteredTours.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>{tours.length === 0 ? 'Log your tours and track travel expenses here.' : `No ${filterType.replace('_', ' ')} tours yet.`}</p>
        </div>
      )}

      {filteredTours.map(t => {
        const isEditing = editingId === t.id;
        const isOverBudget = t.budget && t.spent && +t.spent > +t.budget;
        const spentPct = t.budget && t.spent ? Math.min(100, Math.round((+t.spent / +t.budget) * 100)) : 0;
        const ti = typeInfo(t.type);

        if (isEditing && editForm) {
          return (
            <div key={t.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Edit Tour</div>
              <div className="tours-form-grid tours-form-grid-top">
                <div className="tours-form-field tours-form-wide">
                  <label>Tour / Destination</label>
                  <input value={editForm.name} onChange={e => setEdit('name', e.target.value)} />
                </div>
                <div className="tours-form-field">
                  <label>Date</label>
                  <input type="date" value={editForm.date} onChange={e => setEdit('date', e.target.value)} />
                </div>
                <div className="tours-form-field">
                  <label>Type</label>
                  <select value={editForm.type} onChange={e => setEdit('type', e.target.value)}>
                    {TOUR_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="tours-form-grid tours-form-grid-mid">
                <div className="tours-form-field">
                  <label>Companions</label>
                  <input value={editForm.companions || ''} onChange={e => setEdit('companions', e.target.value)} />
                </div>
                <div className="tours-form-field">
                  <label>Budget (৳)</label>
                  <input type="number" value={editForm.budget || ''} onChange={e => setEdit('budget', e.target.value)} />
                </div>
                <div className="tours-form-field">
                  <label>Actual Spent (৳)</label>
                  <input type="number" value={editForm.spent || ''} onChange={e => setEdit('spent', e.target.value)} />
                </div>
              </div>
              <div className="tours-form-field tours-form-wide" style={{ marginBottom: 10 }}>
                <label>Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEdit('notes', e.target.value)} rows={2} />
              </div>

              {/* Edit Tour Outline */}
              <div className="tours-outline-card" style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--muted)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Trip Outline {(editForm.outline || []).length > 0 ? `· ${editForm.outline.length} section${editForm.outline.length > 1 ? 's' : ''}` : ''}
                </div>
                {(editForm.outline || []).length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0 8px' }}>Add stops, activities or day-plans to structure the trip.</div>
                )}
                {(editForm.outline || []).map((section, si) => (
                  <div key={si} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input
                        value={section.title}
                        onChange={e => editUpdateTitle(si, e.target.value)}
                        placeholder={`Day ${si + 1} / Stop title`}
                        className="tours-outline-section-title"
                        style={{ flex: 1 }}
                      />
                      <button
                        style={{ flexShrink: 0, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, lineHeight: 1 }}
                        onClick={() => editRemoveSection(si)}
                        title="Remove section"
                      ><X size={12} /></button>
                    </div>
                    {section.topics.map((topic, ti) => (
                      <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 24, flexShrink: 0 }}>{si + 1}.{ti + 1}</span>
                        <input
                          value={topic}
                          onChange={e => editUpdateTopic(si, ti, e.target.value)}
                          placeholder="Activity / stop / note"
                          className="tours-outline-item-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, lineHeight: 1 }}
                          onClick={() => editRemoveTopic(si, ti)}
                          title="Remove item"
                        >×</button>
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', marginTop: 2 }} onClick={() => editAddTopic(si)}>+ Add item</button>
                  </div>
                ))}
                <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 4 }} onClick={editAddSection}>+ Add section</button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveEdit}><Check size={13} /> Save</button>
                <button className="btn btn-ghost" onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={t.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</span>
                  <span className={`tag ${ti.color}`}>{ti.label}</span>
                  {isOverBudget && <span className="tag tag-red">Over budget</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.date}</div>
                {t.companions && <div style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} color="var(--muted)" /> {t.companions}</div>}
                {t.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t.notes}</div>}

                {/* Budget progress bar */}
                {t.budget && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
                      <span>৳{(+t.spent || 0).toLocaleString()} spent</span>
                      <span>Budget: ৳{(+t.budget).toLocaleString()}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${spentPct}%`, background: isOverBudget ? 'var(--danger)' : 'var(--accent)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}

                {t.outline?.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Trip outline</div>
                    <div style={{ paddingLeft: 10 }}>
                      {t.outline.map((section, si) => (
                        <div key={si} style={{ marginBottom: 6 }}>
                          {section.title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{section.title}</div>}
                          <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)' }}>
                            {section.topics.filter(Boolean).map((topic, ti2) => <li key={ti2}>{topic}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                {t.spent && <div style={{ fontWeight: 700, color: isOverBudget ? 'var(--danger)' : 'var(--text)', fontSize: 14 }}>৳{(+t.spent).toLocaleString()}</div>}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => startEdit(t)}><Edit2 size={11} /></button>
                  <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => deleteTour(t.id)}><Trash2 size={11} color="var(--danger)" /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Projects ─────────────────────────────────────────────────────────────────
const PROJECT_TYPES = ['Academic', 'Personal', 'Club', 'Freelance', 'Research', 'Other'];
const TYPE_COLORS = {
  Academic:  { bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)',  text: '#7c3aed', tag: 'tag-purple' },
  Personal:  { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#2563eb', tag: 'tag-blue'   },
  Club:      { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#059669', tag: 'tag-green'  },
  Freelance: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  text: '#d97706', tag: 'tag-yellow' },
  Research:  { bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  text: '#db2777', tag: 'tag-pink'   },
  Other:     { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', text: '#475569', tag: 'tag-gray'   },
};
const STATUS_META = {
  active: { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.1)', emoji: '🟢' },
  done:   { label: 'Done',   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  emoji: '✅' },
  paused: { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  emoji: '⏸️' },
};
const PRIORITY_META = {
  high:   { label: 'High',   color: '#ef4444', emoji: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', emoji: '🟡' },
  low:    { label: 'Low',    color: '#10b981', emoji: '🟢' },
};
const PROJECT_EMOJIS = ['🚀','💡','🛠️','📱','🌐','🤖','📊','🎨','⚡','🔬','📚','🏗️','🎯','💻','🌱','🔧'];

function ProjectFormModal({ title, form, set, onSave, onClose }) {
  const tc = TYPE_COLORS[form.type] || TYPE_COLORS.Other;
  return (
    <Modal onClose={onClose} overlayStyle={{ padding: '12px 8px' }} contentStyle={{ width: '100%', maxWidth: 680, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'min(90vh, calc(100vh - 24px))', display: 'flex' }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Fill in the details — GitHub, stack, deadline</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Emoji picker + Name row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Icon</label>
              <select value={form.emoji || '🚀'} onChange={e => set('emoji', e.target.value)}
                style={{ fontSize: 22, width: 52, height: 42, borderRadius: 10, border: `1.5px solid ${tc.border}`, background: tc.bg, textAlign: 'center', cursor: 'pointer' }}>
                {PROJECT_EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Project Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Smart Campus App, Arduino Book..." style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Type + Status + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="active">🟢 Active</option>
                <option value="done">✅ Done</option>
                <option value="paused">⏸️ Paused</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Priority</label>
              <select value={form.priority || 'medium'} onChange={e => set('priority', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea value={form.desc || ''} onChange={e => set('desc', e.target.value)} rows={2} placeholder="What is this project about?" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          {/* Tech Stack */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Tech Stack <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma separated)</span></label>
            <input value={form.techStack || ''} onChange={e => set('techStack', e.target.value)} placeholder="React, Firebase, Arduino, Python..." style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {/* GitHub + Live URL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>GitHub Repo</label>
              <input value={form.github || ''} onChange={e => set('github', e.target.value)} placeholder="https://github.com/..." style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Live / Demo URL</label>
              <input value={form.liveUrl || ''} onChange={e => set('liveUrl', e.target.value)} placeholder="https://myproject.vercel.app" style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Deadline */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Deadline</label>
            <input type="date" value={form.deadline || ''} onChange={e => set('deadline', e.target.value)} style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onSave}>Save Project</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

export function Projects() {
  const EMPTY_FORM = { name: '', emoji: '🚀', type: 'Academic', status: 'active', priority: 'medium', desc: '', deadline: '', techStack: '', github: '', liveUrl: '' };
  const [projects, setProjects] = useState(() => store.get('projects') || []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const today = todayStr();
  const isOverdue = (p) => p.deadline && p.deadline < today && p.status === 'active';

  const saveProject = () => {
    if (!form.name.trim()) return;
    const u = [{ ...form, id: uid(), tasks: [] }, ...projects];
    setProjects(u); store.set('projects', u); setAdding(false);
    setForm(EMPTY_FORM);
  };
  const deleteProject = (id) => {
    const u = projects.filter(x => x.id !== id); setProjects(u); store.set('projects', u);
    if (expandedId === id) setExpandedId(null);
  };
  const startEdit = (p) => { setEditingId(p.id); setEditForm({ ...EMPTY_FORM, ...p }); setExpandedId(null); };
  const saveEdit = () => {
    const u = projects.map(p => p.id === editingId ? { ...editForm } : p);
    setProjects(u); store.set('projects', u); setEditingId(null); setEditForm(null);
  };
  const addTask = (projectId, text) => {
    if (!text.trim()) return;
    const u = projects.map(p => p.id === projectId ? { ...p, tasks: [...(p.tasks || []), { id: uid(), text, done: false }] } : p);
    setProjects(u); store.set('projects', u);
  };
  const toggleTask = (projectId, taskId) => {
    const u = projects.map(p => p.id === projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p);
    setProjects(u); store.set('projects', u);
  };
  const deleteTask = (projectId, taskId) => {
    const u = projects.map(p => p.id === projectId ? { ...p, tasks: (p.tasks || []).filter(t => t.id !== taskId) } : p);
    setProjects(u); store.set('projects', u);
  };

  const counts = { all: projects.length, active: projects.filter(p => p.status === 'active').length, done: projects.filter(p => p.status === 'done').length, paused: projects.filter(p => p.status === 'paused').length };
  const overdueCount = projects.filter(p => isOverdue(p)).length;

  let filtered = projects;
  if (filterStatus !== 'all') filtered = filtered.filter(p => p.status === filterStatus);
  if (filterType !== 'all') filtered = filtered.filter(p => p.type === filterType);

  // Group by type
  const grouped = {};
  filtered.forEach(p => {
    const key = p.type || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });
  const groupOrder = PROJECT_TYPES.filter(t => grouped[t]);

  return (
    <div className="page-enter page-container content-page-bg">
      {/* Hero */}
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Cpu size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Projects</h1>
          </div>
          <p className="content-page-hero-subtitle">Track your builds — academic, personal, club & beyond</p>
        </div>
        <div className="content-page-hero-actions">
          <div className="content-page-hero-stats" style={{ marginRight: 4 }}>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{counts.active}</div>
              <div className="content-page-hero-stat-label">active</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{counts.done}</div>
              <div className="content-page-hero-stat-label">done</div>
            </div>
            <div className="content-page-hero-stat">
              <div className="content-page-hero-stat-n">{counts.paused}</div>
              <div className="content-page-hero-stat-label">paused</div>
            </div>
            {overdueCount > 0 && (
              <div className="content-page-hero-stat">
                <div className="content-page-hero-stat-n" style={{ color: 'var(--danger)' }}>{overdueCount}</div>
                <div className="content-page-hero-stat-label">overdue</div>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setAdding(true); }}><Plus size={13} /> Add Project</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['all','All'], ['active','Active'], ['done','Done'], ['paused','Paused']].map(([k,l]) => (
          <button key={k} className={`filter-tab ${filterStatus === k ? 'active' : ''}`} onClick={() => setFilterStatus(k)}>{l} ({counts[k] || 0})</button>
        ))}
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <button className={`filter-tab ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All Types</button>
        {PROJECT_TYPES.filter(t => projects.some(p => p.type === t)).map(t => (
          <button key={t} className={`filter-tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>{t}</button>
        ))}
      </div>

      {/* Add Modal */}
      {adding && <ProjectFormModal title="New Project" form={form} set={set} onSave={saveProject} onClose={() => setAdding(false)} />}
      {editingId && editForm && <ProjectFormModal title="Edit Project" form={editForm} set={setEdit} onSave={saveEdit} onClose={() => { setEditingId(null); setEditForm(null); }} />}

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <Cpu size={28} color="var(--muted)" style={{ marginBottom: 8 }} />
          <p>{projects.length === 0 ? 'Add your first project — GitHub repo, Arduino build, research, anything.' : 'No projects match this filter.'}</p>
        </div>
      )}

      {/* Grouped cards */}
      {groupOrder.map(groupName => {
        const tc = TYPE_COLORS[groupName] || TYPE_COLORS.Other;
        return (
          <div key={groupName} style={{ marginBottom: 20 }}>
            {/* Group header — only when showing all types */}
            {filterType === 'all' && groupOrder.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{groupName}</span>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
              </div>
            )}

            {grouped[groupName].map(p => {
              const tasks = p.tasks || [];
              const doneTasks = tasks.filter(t => t.done).length;
              const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
              const overdue = isOverdue(p);
              const isExpanded = expandedId === p.id;
              const sm = STATUS_META[p.status] || STATUS_META.active;
              const pm = PRIORITY_META[p.priority] || PRIORITY_META.medium;
              const techTags = (p.techStack || '').split(',').map(s => s.trim()).filter(Boolean);

              return (
                <div key={p.id} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${tc.text}`, padding: 0, overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Emoji logo */}
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: tc.bg, border: `1.5px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {p.emoji || '🚀'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{p.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg, borderRadius: 20, padding: '2px 8px' }}>{sm.emoji} {sm.label}</span>
                          <span style={{ fontSize: 10, color: pm.color }}>{pm.emoji}</span>
                          {overdue && <span className="tag tag-red">Overdue</span>}
                        </div>
                        {p.desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, lineHeight: 1.4 }}>{p.desc}</div>}

                        {/* Tech stack tags */}
                        {techTags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            {techTags.map(t => (
                              <span key={t} style={{ fontSize: 10, fontWeight: 600, color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 4, padding: '2px 6px' }}>{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Links row */}
                        {(p.github || p.liveUrl) && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            {p.github && (
                              <a href={p.github} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#1f2937', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', textDecoration: 'none' }}>
                                <Github size={11} /> GitHub
                              </a>
                            )}
                            {p.liveUrl && (
                              <a href={p.liveUrl} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '3px 8px', textDecoration: 'none' }}>
                                <Globe size={11} /> Live
                              </a>
                            )}
                          </div>
                        )}

                        {/* Deadline + task progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {p.deadline && (
                            <span style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={11} /> {new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          {tasks.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCheck size={11} /> {doneTasks}/{tasks.length} tasks · {progress}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => startEdit(p)}><Edit2 size={11} /></button>
                        <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => deleteProject(p.id)}><Trash2 size={11} color="var(--danger)" /></button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {tasks.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : tc.text, borderRadius: 99, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded tasks */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'var(--bg)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tasks</div>
                      {tasks.map(task => (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 6px', border: `1px solid ${task.done ? '#10b981' : 'var(--border)'}`, borderRadius: 4, color: task.done ? '#10b981' : 'var(--muted)', minWidth: 24, fontSize: 12 }}
                            onClick={() => toggleTask(p.id, task.id)}
                          >{task.done ? '✓' : '○'}</button>
                          <span style={{ flex: 1, fontSize: 13, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--muted)' : 'var(--text)' }}>{task.text}</span>
                          <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={() => deleteTask(p.id, task.id)}><X size={10} color="var(--danger)" /></button>
                        </div>
                      ))}
                      <AddTaskInline onAdd={(text) => addTask(p.id, text)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function AddTaskInline({ onAdd }) {
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); } }}
        placeholder="Add a task... (Enter to save)"
        style={{ flex: 1, fontSize: 12 }}
      />
      <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }} onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }}>Add</button>
    </div>
  );
}

// ── Syllabus ──────────────────────────────────────────────────────────────────
export function Syllabus() {
  // IndexedDB preloads into an in-memory cache asynchronously on app boot.
  // Before that finishes, store.get() falls back to raw localStorage, which
  // can be stale (e.g. an incomplete course list right after login). This
  // forces a re-render once the DB finishes loading, so the page
  // self-corrects without needing a manual refresh.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const onStoreUpdate = () => forceRerender((n) => n + 1);
    window.addEventListener('kuetx:store-updated', onStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', onStoreUpdate);
  }, []);

  const profile = getProfile();
  const currentTermKey = profile.currentTermKey || '';
  const termMatch = currentTermKey.match(/Y(\d)T(\d)/);
  const termYear = termMatch ? Number(termMatch[1]) : null;
  const termNo = termMatch ? Number(termMatch[2]) : null;

  if (!profile.dept || !currentTermKey || termYear === null || termNo === null) {
    return (
      <div className="page-enter page-container content-page-bg">
        <div className="content-page-hero">
          <div className="content-page-hero-icon">
            <List size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Syllabus</h1>
            <p className="content-page-hero-subtitle">Course syllabus and topics</p>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Settings size={28} color="var(--muted)" /></div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Profile Incomplete</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Please set your department and term in Profile first.</p>
          <a href="/profile" className="btn btn-primary" style={{ display: 'inline-block' }}>Go to Profile</a>
        </div>
      </div>
    );
  }

  const allCourses = getAllCourses(profile);
  const deptSyllabus = getDeptSyllabus(profile.dept);
  const location = useLocation();
  const navigate = useNavigate();
  // "Jump to this course" comes in as route state (from Courses.jsx's
  // viewCourseSyllabus), not persistent store. Route state used to be
  // store.set('selectedSyllabusCourseid', id) + store.remove(...) here on
  // mount — but that remove raced against an async, fire-and-forget
  // IndexedDB delete, so a stale value could resurface after navigating
  // away and back (the "stuck on one course" bug). location.state has no
  // such race: it's tied to this exact history entry.
  const selectedCourseId = location.state?.selectedSyllabusCourseId || null;

  // Once we've used the incoming course id to render, strip it from this
  // history entry so a plain back/forward or a re-render doesn't keep
  // re-applying it, and a later direct nav to /syllabus (nav bar, etc.)
  // starts clean with no filter.
  useEffect(() => {
    if (selectedCourseId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  const selectedCourse = selectedCourseId ? allCourses.find(c => c.id === selectedCourseId) : null;
  const displayTermKey = selectedCourse ? `Y${selectedCourse.year}T${selectedCourse.term}` : currentTermKey;
  const courses = selectedCourse ? [selectedCourse] : allCourses.filter(c => c.year === termYear && c.term === termNo);

  const [expandedTopics, setExpandedTopics] = useState({});
  const [openCourses, setOpenCourses] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selfStudyData, setSelfStudyData] = useState(() => store.get('selfstudy_academic') || []);
  const [copiedCourseId, setCopiedCourseId] = useState(null);

  useEffect(() => {
    if (selectedCourse?.id) {
      setOpenCourses({ [selectedCourse.id]: true });
    }
  }, [selectedCourse?.id]);

  const syllabusCourseMap = deptSyllabus?.courses || {};
  const diaryData = store.get('diary') || store.get('diary_entries') || [];

  const getCourseData = (courseCode) => {
    const courseObj = courses.find(c => c.code === courseCode);
    const sylData = syllabusCourseMap[courseCode] || {};
    return { course: courseObj, sylData };
  };

  const toggleTopic = (courseCode, topicIndex) => {
    const key = `${courseCode}-${topicIndex}`;
    setExpandedTopics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCourse = (courseId) => {
    setOpenCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  const getTopicStudyInfo = (courseId, topic) => {
    return selfStudyData.filter(s => s.courseId === courseId && s.topic === topic);
  };

  const normalizeText = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const topicCoveredInDiary = (topic, diaryEntries) => {
    const t = normalizeText(topic);
    return diaryEntries.some(entry => {
      const covered = normalizeText(entry.topics || entry.topic || '');
      return covered && (covered.includes(t) || t.includes(covered));
    });
  };

  const markTopicDone = (courseId, topic) => {
    const today = todayStr();
    const openIndex = selfStudyData.findIndex(s => s.courseId === courseId && s.topic === topic && !s.endDate);
    let next = [];
    if (openIndex >= 0) {
      next = selfStudyData.map((s, i) => {
        if (i !== openIndex) return s;
        return { ...s, startDate: s.startDate || today, endDate: today, done: true };
      });
    } else {
      next = [{ id: uid(), courseId, topic, date: today, startDate: today, endDate: today, hours: null, source: 'syllabus', done: true }, ...selfStudyData];
    }
    setSelfStudyData(next);
    store.set('selfstudy_academic', next);
  };

  const goToStudy = (courseId, topic) => {
    store.set('syllabusStudyPrefill', { courseId, topic });
    window.location.href = '/self-study';
  };

  const copySyllabus = (course, sylData) => {
    const topics = sylData.topics || [];
    const references = sylData.references || [];
    let text = `${course.code} — ${course.name}\n${course.credits} credits\n\n`;
    text += `Topics (${topics.length}):\n`;
    topics.forEach((t, i) => { text += `${i + 1}. ${t}\n`; });
    if (references.length > 0) {
      text += `\nReferences:\n`;
      references.forEach((r) => { text += `- ${r}\n`; });
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopiedCourseId(course.id);
      setTimeout(() => setCopiedCourseId(null), 1800);
    });
  };

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <List size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">{getTermLabelFromKey(displayTermKey)} Syllabus</h1>
          <p className="content-page-hero-subtitle">
            {courses.length} courses • {courses.reduce((sum, c) => sum + (c.credits || 0), 0).toFixed(1)} credits
          </p>
        </div>
      </div>

      {!selectedCourse && (
        <div style={{ marginBottom: 16 }}>
          <input type="text" placeholder="Search courses or topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%' }} />
        </div>
      )}

      {(() => {
        const visibleCourses = courses.filter(c => {
          if (selectedCourse) return true;
          const q = searchQuery.toLowerCase();
          if (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) return true;
          const topics = syllabusCourseMap[c.code]?.topics || [];
          return topics.some(t => t.toLowerCase().includes(q));
        });

        const renderCourseCard = (course, accent) => {
          const { sylData } = getCourseData(course.code);
          const topics = sylData.topics || [];
          const references = sylData.references || [];
          const courseStudy = selfStudyData.filter(s => s.courseId === course.id);
          const courseDiary = diaryData.filter(d => d.courseId === course.id);
          const completedCount = courseStudy.filter(s => s.endDate).length;
          const progressPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
          const diaryCoveredCount = topics.filter(t => topicCoveredInDiary(t, courseDiary)).length;

          return (
            <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden', borderTop: `4px solid ${accent}`, background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px', background: `color-mix(in srgb, ${accent} 8%, transparent)`, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: accent, letterSpacing: '0.05em' }}>{course.code}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{course.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => copySyllabus(course, sylData)}
                      title="Copy course name + full syllabus"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`, borderRadius: 6, background: copiedCourseId === course.id ? 'rgba(16,185,129,0.15)' : 'transparent', cursor: 'pointer', color: copiedCourseId === course.id ? '#10b981' : accent }}
                    >
                      {copiedCourseId === course.id ? <CheckCheck size={13} /> : <Copy size={13} />}
                    </button>
                    <div style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', background: accent, color: 'white', borderRadius: 4 }}>{course.credits} cr</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>⏱ {course.contactHour || 'N/A'} • {topics.length} topics</div>
              </div>

              {topics.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.04)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>Progress: {completedCount}/{topics.length}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>{progressPercent}%</div>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPercent}%`, background: '#10b981', transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="card" style={{ margin: 0, padding: '8px', textAlign: 'center', border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)` }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Official</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{topics.length}</div>
                </div>
                <div className="card" style={{ margin: 0, padding: '8px', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Self Study</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{courseStudy.length}</div>
                </div>
                <div className="card" style={{ margin: 0, padding: '8px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Diary Covered</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{diaryCoveredCount}</div>
                </div>
              </div>

              {references.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.04)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={12} /> References</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {references.slice(0, 3).map((ref, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>• {ref}</div>
                    ))}
                    {references.length > 3 && <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>+{references.length - 3} more</div>}
                  </div>
                </div>
              )}

              {topics.length > 0 ? (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    <span>Topics ({topics.length})</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
                    {topics.map((topic, idx) => {
                      const topicKey = `${course.code}-${idx}`;
                      const isExpanded = expandedTopics[topicKey];
                      const topicStudy = getTopicStudyInfo(course.id, topic);
                      const isCompleted = topicStudy.some(s => s.endDate);
                      return (
                        <div key={idx} style={{ borderBottom: idx < topics.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <button
                            onClick={() => toggleTopic(course.code, idx)}
                            style={{ width: '100%', padding: '10px 14px', background: isCompleted ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 8, transition: 'background 0.2s' }}
                            onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = `color-mix(in srgb, ${accent} 6%, transparent)`)}
                            onMouseLeave={e => { e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.08)' : 'transparent'; }}
                          >
                            <div style={{ marginTop: 2, fontSize: 11, color: isCompleted ? '#10b981' : accent, fontWeight: 700 }}>{isExpanded ? '▼' : '▶'}</div>
                            {isCompleted && <div style={{ fontSize: 12, color: '#10b981' }}>✓</div>}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)' }}>{topic.substring(0, 100)}{topic.length > 100 ? '...' : ''}</div>
                              {topicStudy.length > 0 && <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 3 }}>{topicStudy.length} session(s)</div>}
                            </div>
                          </button>
                          {isExpanded && (
                            <div style={{ padding: '10px 14px', background: 'var(--card)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                              <div style={{ marginBottom: 8 }}>{topic}</div>
                              {topicStudy.length > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--muted)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Studied:</div>
                                  {topicStudy.map((s, j) => (
                                    <div key={j} style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} /> {s.date}{s.hours ? ` (${s.hours}h)` : ''}</div>
                                  ))}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Track progress from Self Study.</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><AlertTriangle size={12} /> No syllabus data available</div>
              )}
            </div>
          );
        };

        // Split into Theory vs Sessional sections. When a single course is selected
        // (via "View syllabus" from another page) we just show it alone, no split needed.
        if (selectedCourse) {
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
              {visibleCourses.map(course => renderCourseCard(course, course.type === 'Sessional' ? '#3b82f6' : '#8b5cf6'))}
            </div>
          );
        }

        const theoryCourses = visibleCourses.filter(c => c.type !== 'Sessional');
        const sessionalCourses = visibleCourses.filter(c => c.type === 'Sessional');

        return (
          <>
            {theoryCourses.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: '#8b5cf6' }} />
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Theory</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>({theoryCourses.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: theoryCourses.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
                  {theoryCourses.map(course => renderCourseCard(course, '#8b5cf6'))}
                </div>
              </div>
            )}

            {sessionalCourses.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: '#3b82f6' }} />
                  <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Sessional</h2>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>({sessionalCourses.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: sessionalCourses.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
                  {sessionalCourses.map(course => renderCourseCard(course, '#3b82f6'))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {courses.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><BookOpen size={28} color="var(--muted)" /></div>
          <p>No courses in {getTermLabelFromKey(displayTermKey)}. Check your Profile settings.</p>
        </div>
      )}

      {!selectedCourse && courses.length > 0 && courses.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
      ).length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
          No courses match "{searchQuery}"
        </div>
      )}
    </div>
  );
}

// ── Time Tracker ──────────────────────────────────────────────────────────────
export function TimeTracker() {
  const timer = useTimerEngine();
  const [logs, setLogs] = useState(() => store.get('timelogs') || []);
  const [sessions, setSessions] = useState(() => getTimerSessions());
  const [manualOpen, setManualOpen] = useState(false);
  const [mode, setMode] = useState(TIMER_MODES.UP);
  const [countdownInput, setCountdownInput] = useState({ hours: '0', minutes: '25', seconds: '0' });
  const [form, setForm] = useState({ date: todayStr(), category: 'Study', hours: '', note: '' });
  const [lastAutoSavedId, setLastAutoSavedId] = useState(null);
  const [timerPrefs, setTimerPrefsState] = useState(() => store.get('timer_prefs_v1') || { sound: true, vibrate: true, notify: true });
  const [pomodoro, setPomodoro] = useState(() => ({ enabled: false, isWork: true, workMs: 25 * 60000, breakMs: 5 * 60000, longBreakMs: 15 * 60000, cycles: 0 }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toInt = (value) => {
    const n = Number.parseInt(String(value || '0'), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  const countdownMs = useMemo(() => {
    const hours = toInt(countdownInput.hours);
    const minutes = Math.min(59, toInt(countdownInput.minutes));
    const seconds = Math.min(59, toInt(countdownInput.seconds));
    return (((hours * 60) + minutes) * 60 + seconds) * 1000;
  }, [countdownInput]);

  const persistCompatibilityLog = (entry) => {
    const list = [{ ...entry, id: uid() }, ...(store.get('timelogs') || [])];
    store.set('timelogs', list);
    setLogs(list);
  };

  const saveTimerSession = (state, stopReason) => {
    const actualMs = Math.max(0, Number(state.accumulatedMs) || 0);
    if (!actualMs) return;
    const session = {
      id: state.id || uid(),
      mode: state.mode,
      plannedMs: state.mode === TIMER_MODES.DOWN ? (state.targetMs || 0) : null,
      actualMs,
      startedAt: state.createdAt || Date.now(),
      endedAt: state.endedAt || Date.now(),
      stoppedReason: stopReason || 'manual',
      category: state.category || form.category,
      note: state.note || form.note || '',
      savedAt: Date.now(),
    };
    setSessions(appendTimerSession(session));
    const date = dateKey(new Date(session.endedAt));
    persistCompatibilityLog({
      date,
      category: session.category,
      hours: hoursFromMs(session.actualMs),
      note: session.note ? `${session.note} [Digital Timer]` : '[Digital Timer]',
      source: 'digital_timer',
      timerMode: session.mode,
    });
    if (session.category === 'Self Study' || session.category === 'Study') {
      store.set('selfstudy_timer_prefill', { topic: session.note || 'Focused study session', hours: hoursFromMs(session.actualMs), date });
    }
  };

  const saveManualLog = () => {
    const u = [{ ...form, hours: +form.hours, id: uid() }, ...logs];
    setLogs(u); store.set('timelogs', u); setManualOpen(false);
  };

  const handleStart = () => {
    if (timer.isRunning) return;
    if (mode === TIMER_MODES.UP) { timer.startUp({ category: form.category, note: form.note }); return; }
    const started = timer.startDown(countdownMs, { category: form.category, note: form.note });
    if (!started) alertDialog('Please set a valid countdown time.');
  };

  const handleStopAndSave = () => {
    if (timer.isIdle) return;
    const stopped = timer.stop('manual');
    setLastAutoSavedId(stopped.id);
    saveTimerSession(stopped, 'manual');
  };

  useEffect(() => {
    if (!timer.isCompleted || !timer.state?.id) return;
    if (timer.state.stoppedReason === 'manual') {
      if (lastAutoSavedId !== timer.state.id) setLastAutoSavedId(timer.state.id);
      return;
    }
    if (lastAutoSavedId === timer.state.id) return;
    const endedState = { ...timer.state, endedAt: timer.state.endedAt || Date.now(), accumulatedMs: timer.state.mode === TIMER_MODES.DOWN ? timer.state.targetMs : timer.elapsedMs };
    saveTimerSession(endedState, 'completed');
    setLastAutoSavedId(timer.state.id);
    try {
      if (pomodoro.enabled && timer.state.mode === TIMER_MODES.DOWN) {
        const wasWork = pomodoro.isWork;
        const nextIsWork = !wasWork;
        setPomodoro(p => ({ ...p, isWork: nextIsWork, cycles: nextIsWork ? p.cycles + 1 : p.cycles }));
        const nextMs = wasWork ? (pomodoro.breakMs || 5 * 60000) : (pomodoro.workMs || 25 * 60000);
        setTimeout(() => { try { timer.startDown(nextMs, { category: form.category, note: form.note }); } catch {} }, 400);
      }
    } catch (e) {}
  }, [timer.isCompleted, timer.state, timer.elapsedMs, lastAutoSavedId]);

  const today = todayStr();
  const todayLogs = logs.filter(l => l.date === today);
  const productive = todayLogs.filter(l => PRODUCTIVE_TIME_CATEGORIES.includes(l.category)).reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const waste = todayLogs.filter(l => DISTRACTION_TIME_CATEGORIES.includes(l.category)).reduce((s, l) => s + (Number(l.hours) || 0), 0);

  const targetPreview = formatDurationMs(countdownMs);
  const timerHms = msToHms(timer.displayMs);
  const timerStatusLabel = timer.isRunning ? 'Running' : timer.isPaused ? 'Paused' : timer.isCompleted ? 'Completed' : 'Idle';
  const timerModeLabel = mode === TIMER_MODES.DOWN ? 'Count Down' : 'Count Up';
  let countdownCircle = <circle cx="50" cy="50" r="36" stroke="rgba(59,130,246,0.16)" strokeWidth="8" fill="none" />;
  if (mode === TIMER_MODES.DOWN && timer.state?.targetMs) {
    const target = Number(timer.state.targetMs) || 0;
    const remaining = Number(timer.remainingMs) || 0;
    const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((1 - remaining / target) * 100))) : 0;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const dash = (pct / 100) * circumference;
    const offset = circumference - dash;
    countdownCircle = (
      <circle cx="50" cy="50" r="36" stroke="var(--accent)" strokeWidth="8" fill="none" strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset}
        transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 180ms linear' }} />
    );
  }
  const todayTotal = productive + waste;
  const focusRatio = todayTotal > 0 ? Math.round((productive / todayTotal) * 100) : 0;
  const latestSession = sessions[0] || null;

  return (
    <div className="page-container time-tracker-page content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Timer size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">Time Tracker</h1>
          <p className="content-page-hero-subtitle">Run a clean focus timer, log work fast, and review the day without visual clutter.</p>
        </div>
      </div>
      <div className="time-tracker-layout">
        <div className="time-tracker-main-column">
          <div className="card time-tracker-panel time-tracker-card">
            <div className="time-tracker-panel-body">
              <div className="time-tracker-header-section">
                <div className="time-tracker-mode-switch" role="tablist" aria-label="Timer mode">
                  <button className={`time-tracker-mode-btn ${mode === TIMER_MODES.UP ? 'active' : ''}`} onClick={() => setMode(TIMER_MODES.UP)} disabled={timer.isRunning} aria-pressed={mode === TIMER_MODES.UP}>Count Up</button>
                  <button className={`time-tracker-mode-btn ${mode === TIMER_MODES.DOWN ? 'active' : ''}`} onClick={() => setMode(TIMER_MODES.DOWN)} disabled={timer.isRunning} aria-pressed={mode === TIMER_MODES.DOWN}>Count Down</button>
                </div>
                <div className={`time-tracker-status-pill ${timer.isRunning ? 'is-running' : timer.isCompleted ? 'is-complete' : ''}`}>
                  <span>Status</span>
                  <strong>{timerStatusLabel}</strong>
                </div>
              </div>

              <div className="time-tracker-display-section">
                <div className="time-tracker-ring-row">
                  <div className="time-tracker-ring-text">
                    <div className="time-tracker-digits">{String(timerHms.hours).padStart(2, '0')}:{String(timerHms.minutes).padStart(2, '0')}:{String(timerHms.seconds).padStart(2, '0')}</div>
                    <div className="time-tracker-dial-caption">{mode === TIMER_MODES.DOWN ? `Target ${targetPreview}` : 'Open-ended focus session'}</div>
                  </div>
                  <div className={`time-tracker-ring ${mode === TIMER_MODES.DOWN ? 'is-countdown' : ''}`}>
                    <svg viewBox="0 0 100 100" aria-hidden className={timer.isRunning ? 'running' : ''}>
                      <circle cx="50" cy="50" r="36" stroke="var(--border)" strokeWidth="8" fill="none" />
                      {countdownCircle}
                    </svg>
                  </div>
                </div>
              </div>

              <div className={`time-tracker-controls-row ${timer.isRunning || timer.isPaused ? 'has-actions' : ''}`}>
                <div className="time-tracker-presets-group">
                  <div className="time-tracker-section-label">Quick start</div>
                  <div className="time-tracker-preset-row">
                    <button className="btn btn-ghost btn-sm" title="25 min" onClick={() => { setCountdownInput({ hours: '0', minutes: '25', seconds: '0' }); setMode(TIMER_MODES.DOWN); setPomodoro(p => ({ ...p, enabled: true, isWork: true, workMs: 25 * 60000, breakMs: 5 * 60000 })); }}>25m</button>
                    <button className="btn btn-ghost btn-sm" title="50 min" onClick={() => { setCountdownInput({ hours: '0', minutes: '50', seconds: '0' }); setMode(TIMER_MODES.DOWN); setPomodoro(p => ({ ...p, enabled: true, isWork: true, workMs: 50 * 60000, breakMs: 10 * 60000 })); }}>50m</button>
                    <button className="btn btn-ghost btn-sm" title="15 min" onClick={() => { setCountdownInput({ hours: '0', minutes: '15', seconds: '0' }); setMode(TIMER_MODES.DOWN); }}>15m</button>
                  </div>
                </div>
                <div className="time-tracker-prefs-group">
                  <div className="time-tracker-section-label">Preferences</div>
                  <div className="time-tracker-preferences-row">
                    <button className="time-tracker-pref-btn-compact" title="Toggle sound" onClick={() => { const next = { ...timerPrefs, sound: !timerPrefs.sound }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}>{timerPrefs.sound ? <Volume2 size={14} /> : <VolumeX size={14} />}</button>
                    <button className="time-tracker-pref-btn-compact" title="Toggle vibrate" onClick={() => { const next = { ...timerPrefs, vibrate: !timerPrefs.vibrate }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}><Vibrate size={14} style={{ opacity: timerPrefs.vibrate ? 1 : 0.4 }} /></button>
                    <button className="time-tracker-pref-btn-compact" title="Toggle notify" onClick={() => { const next = { ...timerPrefs, notify: !timerPrefs.notify }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}>{timerPrefs.notify ? <Bell size={14} /> : <BellOff size={14} />}</button>
                  </div>
                </div>
                {(timer.isRunning || timer.isPaused) && (
                  <div className="time-tracker-actions-inline">
                    <div className="time-tracker-section-label">Actions</div>
                    <div className="time-tracker-actions-row">
                      {timer.isRunning && <button className="btn btn-ghost time-tracker-action-btn" onClick={timer.pause}><Pause size={13} /> Pause</button>}
                      {timer.isPaused && <button className="btn btn-primary time-tracker-action-btn" onClick={timer.resume}><Play size={13} /> Resume</button>}
                      <button className="btn btn-primary time-tracker-action-btn" onClick={handleStopAndSave}><Square size={13} /> Stop</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="time-tracker-stats-section">
                <div className="time-tracker-stat-item"><div className="stat-label">Productive</div><div className="stat-value">{productive}h</div></div>
                <div className="time-tracker-stat-item"><div className="stat-label">Distracted</div><div className="stat-value">{waste}h</div></div>
                <div className="time-tracker-stat-item"><div className="stat-label">Focus ratio</div><div className="stat-value">{focusRatio}%</div></div>
              </div>

              {mode === TIMER_MODES.DOWN && (
                <div className="time-tracker-countdown-section">
                  <div className="time-tracker-section-label">Set countdown</div>
                  <div className="time-tracker-grid time-tracker-countdown-grid">
                    <div className="form-field"><label>H</label><input type="number" min={0} value={countdownInput.hours} onChange={(e) => setCountdownInput(v => ({ ...v, hours: e.target.value }))} disabled={timer.isRunning} /></div>
                    <div className="form-field"><label>M</label><input type="number" min={0} max={59} value={countdownInput.minutes} onChange={(e) => setCountdownInput(v => ({ ...v, minutes: e.target.value }))} disabled={timer.isRunning} /></div>
                    <div className="form-field"><label>S</label><input type="number" min={0} max={59} value={countdownInput.seconds} onChange={(e) => setCountdownInput(v => ({ ...v, seconds: e.target.value }))} disabled={timer.isRunning} /></div>
                  </div>
                </div>
              )}

              <div className="time-tracker-form-section">
                <div className="time-tracker-section-label">This session</div>
                <div className="time-tracker-grid time-tracker-info-grid">
                  <TimeTrackerCategorySelect value={form.category} onChangeValue={(next) => set('category', next)} />
                  <div className="form-field time-tracker-note-field"><label>Note</label><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="What are you doing?" /></div>
                </div>
              </div>

              {!(timer.isRunning || timer.isPaused) && (
                <div className="time-tracker-actions-section">
                  {!timer.isRunning && !timer.isPaused && !timer.isCompleted && (
                    <button className="btn btn-primary" onClick={handleStart}><Play size={13} /> Start</button>
                  )}
                  {(timer.isPaused || timer.isCompleted || timer.isIdle) && <button className="btn btn-ghost" onClick={timer.reset}><RotateCcw size={13} /> Reset</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="time-tracker-side-column">
          {manualOpen && (
            <div className="card time-tracker-panel time-tracker-log-form">
              <div className="time-tracker-panel-head">
                <div>
                  <div className="time-tracker-section-label">Manual entry</div>
                  <h2>Log a session</h2>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setManualOpen(false)}>Close</button>
              </div>
              <div className="time-tracker-grid time-tracker-manual-grid">
                <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
                <TimeTrackerCategorySelect value={form.category} onChangeValue={(next) => set('category', next)} />
                <div className="form-field"><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0} step={0.25} /></div>
              </div>
              <div className="form-field"><label>Note</label><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional detail" /></div>
              <div className="time-tracker-actions">
                <button className="btn btn-primary" onClick={saveManualLog}><Save size={13} /> Save</button>
                <button className="btn btn-ghost" onClick={() => setManualOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {logs.length === 0 && !manualOpen && (
            <div className="card time-tracker-empty-state">
              <p>Start logging your time to see where your day goes.</p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="card time-tracker-panel time-tracker-sessions-panel">
              <div className="time-tracker-panel-head">
                <div>
                  <div className="time-tracker-section-label">Digital history</div>
                  <h2>Recent sessions</h2>
                </div>
                <div className="time-tracker-panel-note">{sessions.length} total · Showing latest 8</div>
              </div>
              <div className="time-session-list">
                {sessions.slice(0, 8).map((s, idx) => (
                  <div key={s.id} className="time-session-item" data-index={idx}>
                    <div className="time-session-left">
                      <div className="time-session-badge-group">
                        <div className="time-session-category-badge">{s.category}</div>
                        <div className={`time-session-mode-badge ${s.mode === TIMER_MODES.DOWN ? 'countdown' : 'countup'}`}>
                          {s.mode === TIMER_MODES.DOWN ? '⏱' : '▶'}
                        </div>
                      </div>
                      <div className="time-session-meta-block">
                        <div className="time-session-datetime">{new Date(s.endedAt || s.savedAt).toLocaleDateString('en-BD')}</div>
                        <div className="time-session-time">{new Date(s.endedAt || s.savedAt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}</div>
                        {s.note && <div className="time-session-note">{s.note}</div>}
                      </div>
                    </div>
                    <div className="time-session-right">
                      <div className="time-session-duration-display">{formatDurationMs(s.actualMs || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tuition Tracker ───────────────────────────────────────────────────────────
export function Tuition() {
  const [sessions, setSessions] = useState(() => store.get('tuition') || []);
  const [form, setForm] = useState({ studentName: '', subject: '', date: todayStr(), hours: '', travelTime: '', travelCost: '', fee: '' });
  const [adding, setAdding] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [filterStudent, setFilterStudent] = useState('all');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.studentName.trim()) return;
    const u = [{ ...form, hours: +form.hours, travelTime: +form.travelTime, travelCost: +form.travelCost, fee: +form.fee, id: uid() }, ...sessions];
    setSessions(u); store.set('tuition', u); setAdding(false);
    setForm({ studentName: '', subject: '', date: todayStr(), hours: '', travelTime: '', travelCost: '', fee: '' });
  };

  const deleteSession = (id) => {
    const u = sessions.filter(x => x.id !== id); setSessions(u); store.set('tuition', u);
  };

  const totalFee = sessions.reduce((s, t) => s + (+t.fee || 0), 0);
  const totalTravel = sessions.reduce((s, t) => s + (+t.travelCost || 0), 0);
  const totalHours = sessions.reduce((s, t) => s + (+t.hours || 0), 0);
  const net = totalFee - totalTravel;
  const avgHourlyRate = totalHours > 0 ? Math.round(net / totalHours) : 0;

  // Per-student summary
  const studentMap = {};
  sessions.forEach(s => {
    if (!s.studentName) return;
    const key = s.studentName.trim();
    if (!studentMap[key]) studentMap[key] = { name: key, sessions: 0, hours: 0, fee: 0, travel: 0, subjects: new Set() };
    studentMap[key].sessions++;
    studentMap[key].hours += +s.hours || 0;
    studentMap[key].fee += +s.fee || 0;
    studentMap[key].travel += +s.travelCost || 0;
    if (s.subject) studentMap[key].subjects.add(s.subject);
  });
  const students = Object.values(studentMap).sort((a, b) => b.fee - a.fee);

  // Autocomplete for student name
  const studentNames = [...new Set(sessions.map(s => s.studentName).filter(Boolean))];

  // Monthly income for last 6 months
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthSessions = sessions.filter(s => s.date && s.date.startsWith(monthStr));
    const income = monthSessions.reduce((sum, s) => sum + ((+s.fee || 0) - (+s.travelCost || 0)), 0);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { label: monthNames[d.getMonth()], income };
  });
  const maxIncome = Math.max(...months.map(m => m.income), 1);

  const filteredSessions = filterStudent === 'all' ? sessions : sessions.filter(s => s.studentName === filterStudent);

  return (
    <div className="page-enter page-container content-page-bg">
      {/* Hero */}
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Users size={18} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Tuition Tracker</h1>
          </div>
          <p className="content-page-hero-subtitle">Track sessions, income and travel costs</p>
        </div>
        <div className="content-page-hero-actions">
          <button className="btn btn-primary" onClick={() => setAdding(v => !v)}><Plus size={13} /> <span className="btn-txt">Log Session</span></button>
        </div>
      </div>

      {/* Money stats — kept as a separate card since amounts (৳ + large numbers)
          don't fit the hero's narrow stat-cluster columns. */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
          <div className="stat-mini stat-mini-success">
            <div className="stat-mini-val">৳{net.toLocaleString()}</div>
            <div className="stat-mini-lbl">Net income</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalFee.toLocaleString()}</div>
            <div className="stat-mini-lbl">Total earned</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalTravel.toLocaleString()}</div>
            <div className="stat-mini-lbl">Travel cost</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{totalHours.toFixed(1)}h</div>
            <div className="stat-mini-lbl">Hours taught</div>
          </div>
          {avgHourlyRate > 0 && (
            <div className="stat-mini">
              <div className="stat-mini-val">৳{avgHourlyRate}</div>
              <div className="stat-mini-lbl">Net / hour</div>
            </div>
          )}
        </div>

        {/* Monthly income chart */}
        {sessions.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Monthly net income (last 6 months)</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 50 }}>
              {months.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', background: m.income > 0 ? 'var(--success)' : 'var(--border)', borderRadius: 3, height: `${Math.max(4, (m.income / maxIncome) * 36)}px`, transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-student summary */}
      {students.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Students</div>
          {students.map(st => (
            <div key={st.name} style={{ marginBottom: 6 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setExpandedStudent(expandedStudent === st.name ? null : st.name)}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{st.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{[...st.subjects].join(', ')}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)' }}>৳{(st.fee - st.travel).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{st.sessions} sessions · {st.hours.toFixed(1)}h</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {adding && (
        <Modal onClose={() => setAdding(false)} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 560, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card tuition-form" style={{ marginBottom: 0, borderRadius: 20, borderColor: 'var(--accent)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Log Tuition Session</div>
            <div className="tuition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div className="form-field">
                <label>Student Name</label>
                <input
                  value={form.studentName}
                  onChange={e => set('studentName', e.target.value)}
                  placeholder="Rahim"
                  list="student-names-list"
                />
                <datalist id="student-names-list">
                  {studentNames.map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div className="form-field"><label>Subject</label><input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Math" /></div>
              <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            </div>
            <div className="tuition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div className="form-field"><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0} step={0.5} /></div>
              <div className="form-field"><label>Travel time (min)</label><input type="number" value={form.travelTime} onChange={e => set('travelTime', e.target.value)} placeholder="30" /></div>
              <div className="form-field"><label>Travel cost (৳)</label><input type="number" value={form.travelCost} onChange={e => set('travelCost', e.target.value)} placeholder="40" /></div>
              <div className="form-field"><label>Fee received (৳)</label><input type="number" value={form.fee} onChange={e => set('fee', e.target.value)} placeholder="500" /></div>
            </div>
            {(form.fee || form.travelCost) && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                Net this session: <strong style={{ color: 'var(--success)' }}>৳{((+form.fee || 0) - (+form.travelCost || 0)).toLocaleString()}</strong>
                {form.hours && form.fee ? ` · ৳${Math.round(((+form.fee || 0) - (+form.travelCost || 0)) / +form.hours)}/hr` : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: '1 1 200px' }} onClick={save}>Save</button>
              <button className="btn btn-ghost" style={{ flex: '1 1 200px' }} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Filter by student */}
      {students.length > 1 && (
        <div className="filter-tab-row" style={{ marginBottom: 12 }}>
          <button className={`filter-tab ${filterStudent === 'all' ? 'active' : ''}`} onClick={() => setFilterStudent('all')}>All</button>
          {students.map(st => (
            <button key={st.name} className={`filter-tab ${filterStudent === st.name ? 'active' : ''}`} onClick={() => setFilterStudent(st.name)}>{st.name}</button>
          ))}
        </div>
      )}

      {filteredSessions.slice(0, 30).map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.studentName} — {s.subject}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.date} · {s.hours}h · Travel: {s.travelTime}min / ৳{s.travelCost}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 13 }}>+৳{s.fee}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Net: ৳{(+s.fee - +s.travelCost).toLocaleString()}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => deleteSession(s.id)}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}

      {sessions.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Track your private tuition sessions and earnings here.</p>
        </div>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function getDateRange(period) {
  const now = new Date();
  const today = dateKey(now);
  if (period === 'Daily') {
    return { start: today, end: today, label: today };
  }
  if (period === 'Weekly') {
    const start = new Date(now); start.setDate(now.getDate() - 6);
    return { start: dateKey(start), end: today, label: `Last 7 days` };
  }
  if (period === 'Monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: dateKey(start), end: today, label: `${start.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}` };
  }
  // Semester: last 6 months
  const start = new Date(now); start.setMonth(now.getMonth() - 5); start.setDate(1);
  return { start: dateKey(start), end: today, label: 'Current semester' };
}

function inRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}

export function Reports() {
  const [period, setPeriod] = useState('Weekly');
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const profile = getProfile();
  const courses = getAllCourses(profile);
  const expenses = store.get('money_entries') || [];
  const namaz = store.get('namaz') || {};
  const selfeval = store.get('selfeval') || {};
  const diary = store.get('diary') || [];
  const timerSessions = getTimerSessions();
  const timelogs = store.get('timelogs') || [];
  const social = store.get('social') || [];
  const foodlogs = store.get('foodlogs') || [];
  const tours = store.get('tours') || [];

  const { start, end, label } = getDateRange(period);

  // Filtered data by period
  const periodTimeSessions = timerSessions.filter(s => {
    if (!s.endedAt) return false;
    const d = dateKey(new Date(s.endedAt));
    return inRange(d, start, end);
  });
  const periodTimelogs = timelogs.filter(l => l.date && inRange(l.date, start, end));
  const periodExpenses = expenses.filter(e => e.type === 'expense' && e.date && inRange(e.date, start, end));
  const periodDiary = diary.filter(d => d.date && inRange(d.date, start, end));
  const periodSocial = social.filter(s => s.date && inRange(s.date, start, end));
  const periodFood = foodlogs.filter(f => f.date && inRange(f.date, start, end));
  const periodNamazDays = Object.entries(namaz).filter(([d]) => inRange(d, start, end));

  const periodTimerHours = periodTimeSessions.reduce((s, sess) => s + hoursFromMs(sess.actualMs || 0), 0);
  const periodExpenseTotal = periodExpenses.reduce((s, e) => s + (+e.amount || 0), 0);
  const periodSocialHours = periodSocial.reduce((s, l) => s + (+l.hours || 0), 0);
  const periodFoodCals = periodFood.reduce((s, f) => s + (+f.calories || 0), 0);

  // Productive vs distracted
  const PRODUCTIVE_CATS = ['Study', 'Class', 'Self Study', 'Exercise', 'Tuition'];
  const DISTRACTION_CATS = ['Facebook/YouTube', 'Gaming'];
  const prodHours = periodTimelogs.filter(l => PRODUCTIVE_CATS.includes(l.category)).reduce((s, l) => s + (+l.hours || 0), 0);
  const distHours = periodTimelogs.filter(l => DISTRACTION_CATS.includes(l.category)).reduce((s, l) => s + (+l.hours || 0), 0);
  const focusRatio = (prodHours + distHours) > 0 ? Math.round((prodHours / (prodHours + distHours)) * 100) : 0;

  // Expense breakdown
  const expCatMap = {};
  periodExpenses.forEach(e => { expCatMap[e.category || 'Other'] = (expCatMap[e.category || 'Other'] || 0) + (+e.amount || 0); });
  const topExpCat = Object.entries(expCatMap).sort((a, b) => b[1] - a[1])[0];

  // Namaz stats
  const namazTotal = periodNamazDays.reduce((s, [, v]) => s + (Object.values(v).filter(Boolean).length), 0);
  const namazMax = periodNamazDays.length * 5;

  const buildReportText = () => {
    const now = new Date();
    const line = (label, value) => `  ${label.padEnd(22, ' ')}: ${value}`;
    const sep = '─'.repeat(48);

    const lines = [
      '╔' + '═'.repeat(48) + '╗',
      `║  KUETx ${period} Report`.padEnd(49) + '║',
      `║  ${label}`.padEnd(49) + '║',
      '╚' + '═'.repeat(48) + '╝',
      '',
      '  ACADEMIC',
      sep,
      line('Courses enrolled', courses.length),
      line('Diary entries', periodDiary.length),
      '',
      '  TIME & FOCUS',
      sep,
      line('Productive hours', `${prodHours.toFixed(1)} h`),
      line('Distracted hours', `${distHours.toFixed(1)} h`),
      line('Focus ratio', `${focusRatio}%`),
      line('Timer sessions', periodTimeSessions.length),
      line('Timer hours', `${periodTimerHours.toFixed(1)} h`),
      '',
      '  EXPENSES',
      sep,
      line('Total spent', `৳${periodExpenseTotal.toLocaleString()}`),
      topExpCat ? line('Top category', `${topExpCat[0]} (৳${topExpCat[1].toLocaleString()})`) : '',
      '',
      '  SOCIAL',
      sep,
      line('Social hours', `${periodSocialHours.toFixed(1)} h`),
      line('Logs', periodSocial.length),
    ].filter(l => l !== undefined);

    if (namazMax > 0) {
      lines.push('', '  IBADAH', sep, line('Namaz logged', `${namazTotal} / ${namazMax} (${namazMax > 0 ? Math.round((namazTotal / namazMax) * 100) : 0}%)`));
    }

    lines.push(
      '',
      sep,
      `  Generated by KUETx · ${now.toLocaleDateString('en-BD')}`,
      '  www.kuetx.com',
    );

    return lines.join('\n');
  };

  const reportText = buildReportText();

  const downloadTxt = () => {
    const now = new Date();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuetx-${period.toLowerCase()}-report-${dateKey(now)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const now = new Date();
    const rows = [
      ['Metric', 'Value', 'Period'],
      ['Report period', period, label],
      ['Courses enrolled', courses.length, 'All time'],
      ['Diary entries', periodDiary.length, label],
      ['Productive hours', prodHours.toFixed(1), label],
      ['Distracted hours', distHours.toFixed(1), label],
      ['Focus ratio (%)', focusRatio, label],
      ['Timer sessions', periodTimeSessions.length, label],
      ['Timer hours', periodTimerHours.toFixed(1), label],
      ['Total expenses (BDT)', periodExpenseTotal, label],
      ['Social hours', periodSocialHours.toFixed(1), label],
      ['Namaz logged', namazTotal, label],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuetx-${period.toLowerCase()}-report-${dateKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const overviewData = [
    ['Courses enrolled', courses.length],
    ['Diary entries', periodDiary.length],
    ['Productive hours', `${prodHours.toFixed(1)}h`],
    ['Distracted hours', `${distHours.toFixed(1)}h`],
    ['Focus ratio', `${focusRatio}%`],
    ['Timer sessions', periodTimeSessions.length],
    ['Timer hours', `${periodTimerHours.toFixed(1)}h`],
    ['Total expenses', `৳${periodExpenseTotal.toLocaleString()}`],
    ['Social hours', `${periodSocialHours.toFixed(1)}h`],
    ['Namaz logged', `${namazTotal} / ${namazMax}`],
    ['Self-eval days', Object.keys(selfeval).filter(d => inRange(d, start, end)).length],
  ];

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <BarChart2 size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 className="content-page-hero-title">Reports</h1>
          <p className="content-page-hero-subtitle">Export your activity summaries · {label}</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="filter-tab-row" style={{ marginBottom: 14 }}>
        {['Daily', 'Weekly', 'Monthly', 'Semester'].map(p => (
          <button key={p} className={`filter-tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      {/* Hero stats for period */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 14 }}>
        <div className="stat-mini stat-mini-success">
          <div className="stat-mini-val">{prodHours.toFixed(1)}h</div>
          <div className="stat-mini-lbl">Productive</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">{focusRatio}%</div>
          <div className="stat-mini-lbl">Focus ratio</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">৳{periodExpenseTotal.toLocaleString()}</div>
          <div className="stat-mini-lbl">Spent</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-val">{periodDiary.length}</div>
          <div className="stat-mini-lbl">Diary entries</div>
        </div>
      </div>

      {/* Data overview table */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Data overview — {label}</div>
        {overviewData.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Report preview */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Report preview</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setPreviewOpen(v => !v)}>
            {previewOpen ? 'Hide' : 'Show'} preview
          </button>
        </div>
        {previewOpen && (
          <pre style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre' }}>
            {reportText}
          </pre>
        )}
      </div>

      {/* Export buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={downloadTxt}>
          ⬇ Download .txt
        </button>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={downloadCsv}>
          ⬇ Download .csv
        </button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={copyToClipboard}>
          {copied ? '✓ Copied!' : '⎘ Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}