import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play, Pause, Square, RotateCcw, Save, ChevronDown, Edit2, Check, X } from 'lucide-react';
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
    <div className="page-enter page-container">
      {/* Hero Card */}
      <div className="card" style={{ marginBottom: 14, background: 'var(--card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tours</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Plan, track and remember your trips</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setAdding(true); setEditingId(null); }}>
            <Plus size={13} /> Add Tour
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginTop: 14 }}>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalSpent.toLocaleString()}</div>
            <div className="stat-mini-lbl">Total spent</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">৳{totalBudget.toLocaleString()}</div>
            <div className="stat-mini-lbl">Total budget</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{tours.length}</div>
            <div className="stat-mini-lbl">Trips logged</div>
          </div>
          {overBudgetCount > 0 && (
            <div className="stat-mini stat-mini-danger">
              <div className="stat-mini-val">{overBudgetCount}</div>
              <div className="stat-mini-lbl">Over budget</div>
            </div>
          )}
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
        <Modal onClose={() => { setAdding(false); setOutlineOpen(false); }} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 560, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card tours-form-card" style={{ marginBottom: 0, borderRadius: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add Tour</div>
            <div className="tours-form-grid tours-form-grid-top">
              <div className="tours-form-field tours-form-wide">
                <label>Tour / Destination</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Cox's Bazar trip" />
              </div>
              <div className="tours-form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="tours-form-field">
                <label>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  {TOUR_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </div>
            </div>
            <div className="tours-form-grid tours-form-grid-mid">
              <div className="tours-form-field">
                <label>Companions</label>
                <input value={form.companions} onChange={e => set('companions', e.target.value)} placeholder="Rahim, Karim..." />
              </div>
              <div className="tours-form-field">
                <label>Budget (৳)</label>
                <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="5000" />
              </div>
              <div className="tours-form-field">
                <label>Actual Spent (৳)</label>
                <input type="number" value={form.spent} onChange={e => set('spent', e.target.value)} placeholder="4800" />
              </div>
            </div>
            <div className="tours-form-field tours-form-wide" style={{ marginBottom: 10 }}>
              <label>Notes / Highlights</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Best moments, tips, highlights..." />
            </div>

            {/* Trip Outline */}
            <div className="tours-outline-card">
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--muted)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Trip Outline {form.outline.length > 0 ? `· ${form.outline.length} section${form.outline.length > 1 ? 's' : ''}` : ''}
              </div>
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
                    >✕</button>
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
            </div>

            <div className="tours-form-actions">
              <button className="btn btn-primary tours-form-save" onClick={save}>Save</button>
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
                      >✕</button>
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
                {t.companions && <div style={{ fontSize: 12, marginTop: 4 }}>👥 {t.companions}</div>}
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

// ── Social Time ───────────────────────────────────────────────────────────────
const QUICK_ACTIVITIES = ['Adda', 'Gaming', 'Walk', 'Movie', 'Food', 'Study together'];

export function Social() {
  const [logs, setLogs] = useState(() => store.get('social') || []);
  const [form, setForm] = useState({ date: todayStr(), activity: '', persons: '', hours: '' });
  const [adding, setAdding] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('week');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.activity.trim() || !form.hours) return;
    const u = [{ ...form, hours: +form.hours, id: uid() }, ...logs];
    setLogs(u); store.set('social', u); setAdding(false);
    setForm({ date: todayStr(), activity: '', persons: '', hours: '' });
  };

  const deleteLog = (id) => {
    const u = logs.filter(x => x.id !== id); setLogs(u); store.set('social', u);
  };

  const now = new Date();
  const total7 = logs.filter(l => (now - new Date(l.date)) < 7 * 86400000).reduce((s, l) => s + (+l.hours || 0), 0);
  const total30 = logs.filter(l => (now - new Date(l.date)) < 30 * 86400000).reduce((s, l) => s + (+l.hours || 0), 0);
  const avg7 = total7 > 0 ? (total7 / 7).toFixed(1) : '0';

  // Top companions
  const companionMap = {};
  logs.forEach(l => {
    if (!l.persons) return;
    l.persons.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
      companionMap[p] = (companionMap[p] || 0) + (+l.hours || 0);
    });
  });
  const topCompanion = Object.entries(companionMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Activity breakdown
  const activityMap = {};
  logs.forEach(l => {
    if (!l.activity) return;
    activityMap[l.activity] = (activityMap[l.activity] || 0) + (+l.hours || 0);
  });
  const topActivity = Object.entries(activityMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const totalHoursAll = Object.values(activityMap).reduce((s, v) => s + v, 0);

  // 7-day chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = dateKey(d);
    const dayLogs = logs.filter(l => l.date === dateStr);
    const total = dayLogs.reduce((s, l) => s + (+l.hours || 0), 0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { label: dayNames[d.getDay()], hours: total };
  });
  const maxHours = Math.max(...last7Days.map(d => d.hours), 1);

  return (
    <div className="page-enter page-container">
      {/* Hero Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Social Time</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Track time spent with people that matter</p>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(v => !v)}><Plus size={13} /> Log</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 14 }}>
          <div className="stat-mini">
            <div className="stat-mini-val">{total7.toFixed(1)}h</div>
            <div className="stat-mini-lbl">This week</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{avg7}h</div>
            <div className="stat-mini-lbl">Avg / day</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val" style={{ fontSize: 13 }}>{topCompanion}</div>
            <div className="stat-mini-lbl">Top companion</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val" style={{ fontSize: 13 }}>{topActivity}</div>
            <div className="stat-mini-lbl">Top activity</div>
          </div>
        </div>

        {/* 7-day bar chart */}
        {logs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Last 7 days</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 50 }}>
              {last7Days.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', background: d.hours > 0 ? 'var(--accent)' : 'var(--border)', borderRadius: 3, height: `${Math.max(4, (d.hours / maxHours) * 36)}px`, transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Log Form */}
      {adding && (
        <Modal onClose={() => setAdding(false)} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 520, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card social-form-card" style={{ marginBottom: 0, borderRadius: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Log Social Time</div>

            {/* Quick activity buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {QUICK_ACTIVITIES.map(a => (
                <button key={a} className={`btn btn-ghost btn-sm ${form.activity === a ? 'active' : ''}`} style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => set('activity', a)}>{a}</button>
              ))}
            </div>

            <div className="social-form-grid">
              <div className="social-form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div className="social-form-field"><label>Activity</label><input value={form.activity} onChange={e => set('activity', e.target.value)} placeholder="Adda, gaming, walk..." /></div>
              <div className="social-form-field"><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0} step={0.5} /></div>
            </div>
            <div className="social-form-field social-form-wide" style={{ marginBottom: 10 }}>
              <label>With whom (comma-separated)</label>
              <input value={form.persons} onChange={e => set('persons', e.target.value)} placeholder="Rahim, Karim, Jamal..." />
            </div>
            <div className="social-form-actions">
              <button className="btn btn-primary social-form-save" onClick={save}>Save</button>
              <button className="btn btn-ghost social-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity Breakdown */}
      {Object.keys(activityMap).length > 1 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Activity breakdown</div>
          {Object.entries(activityMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([act, hrs]) => (
            <div key={act} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span>{act}</span>
                <span style={{ color: 'var(--muted)' }}>{hrs.toFixed(1)}h · {totalHoursAll > 0 ? Math.round((hrs / totalHoursAll) * 100) : 0}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${totalHoursAll > 0 ? (hrs / totalHoursAll) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log List */}
      {logs.map(l => (
        <div key={l.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{l.activity}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.date}{l.persons ? ` · with ${l.persons}` : ''}</div>
          </div>
          <span className="tag tag-gray">{l.hours}h</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => deleteLog(l.id)}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}

      {logs.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Track how much time you spend with friends and what you get up to.</p>
        </div>
      )}
    </div>
  );
}

// ── Projects ─────────────────────────────────────────────────────────────────
const PROJECT_TYPES = ['Academic', 'Personal', 'Club', 'Freelance', 'Research', 'Other'];
const TYPE_COLORS = { Academic: 'tag-purple', Personal: 'tag-blue', Club: 'tag-green', Freelance: 'tag-yellow', Research: 'tag-pink', Other: 'tag-gray' };
const STATUS_COLORS = { active: 'tag-green', done: 'tag-blue', paused: 'tag-yellow' };

export function Projects() {
  const [projects, setProjects] = useState(() => store.get('projects') || []);
  const [form, setForm] = useState({ name: '', type: 'Academic', status: 'active', desc: '', deadline: '' });
  const [adding, setAdding] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const today = todayStr();

  const saveProject = () => {
    if (!form.name.trim()) return;
    const u = [{ ...form, id: uid(), tasks: [] }, ...projects];
    setProjects(u); store.set('projects', u); setAdding(false);
    setForm({ name: '', type: 'Academic', status: 'active', desc: '', deadline: '' });
  };

  const deleteProject = (id) => {
    const u = projects.filter(x => x.id !== id); setProjects(u); store.set('projects', u);
    if (expandedId === id) setExpandedId(null);
  };

  const startEdit = (p) => { setEditingId(p.id); setEditForm({ ...p }); setExpandedId(null); };
  const saveEdit = () => {
    const u = projects.map(p => p.id === editingId ? { ...editForm } : p);
    setProjects(u); store.set('projects', u); setEditingId(null); setEditForm(null);
  };

  // Task operations
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

  const isOverdue = (p) => p.deadline && p.deadline < today && p.status === 'active';

  const counts = { all: projects.length, active: projects.filter(p => p.status === 'active').length, done: projects.filter(p => p.status === 'done').length, paused: projects.filter(p => p.status === 'paused').length };
  const overdueCount = projects.filter(p => isOverdue(p)).length;

  const filtered = filterStatus === 'all' ? projects : projects.filter(p => p.status === filterStatus);

  return (
    <div className="page-enter page-container">
      {/* Hero Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Projects</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Track academic and personal projects with tasks</p>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Add Project</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginTop: 14 }}>
          <div className="stat-mini"><div className="stat-mini-val">{counts.active}</div><div className="stat-mini-lbl">Active</div></div>
          <div className="stat-mini"><div className="stat-mini-val">{counts.done}</div><div className="stat-mini-lbl">Done</div></div>
          <div className="stat-mini"><div className="stat-mini-val">{counts.paused}</div><div className="stat-mini-lbl">Paused</div></div>
          {overdueCount > 0 && (
            <div className="stat-mini stat-mini-danger"><div className="stat-mini-val">{overdueCount}</div><div className="stat-mini-lbl">Overdue</div></div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tab-row" style={{ marginBottom: 12 }}>
        {[['all', 'All'], ['active', 'Active'], ['done', 'Done'], ['paused', 'Paused']].map(([k, l]) => (
          <button key={k} className={`filter-tab ${filterStatus === k ? 'active' : ''}`} onClick={() => setFilterStatus(k)}>{l} ({counts[k] || 0})</button>
        ))}
      </div>

      {/* Add Form */}
      {adding && (
        <Modal onClose={() => setAdding(false)} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 560, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card projects-form-card" style={{ marginBottom: 0, borderRadius: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add Project</div>
            <div className="projects-form-grid projects-form-grid-top">
              <div className="projects-form-field projects-form-wide">
                <label>Project Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Smart Campus App" />
              </div>
              <div className="projects-form-field">
                <label>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="projects-form-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
            <div className="projects-form-grid projects-form-grid-bottom">
              <div className="projects-form-field projects-form-wide">
                <label>Deadline</label>
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
              </div>
            </div>
            <div className="projects-form-field projects-form-wide" style={{ marginBottom: 10 }}>
              <label>Description</label>
              <textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} />
            </div>
            <div className="projects-form-actions">
              <button className="btn btn-primary projects-form-save" onClick={saveProject}>Save</button>
              <button className="btn btn-ghost projects-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {filtered.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>{projects.length === 0 ? 'Track your academic and personal projects here.' : `No ${filterStatus} projects.`}</p>
        </div>
      )}

      {filtered.map(p => {
        const tasks = p.tasks || [];
        const doneTasks = tasks.filter(t => t.done).length;
        const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
        const overdue = isOverdue(p);
        const isExpanded = expandedId === p.id;
        const isEditing = editingId === p.id;

        if (isEditing && editForm) {
          return (
            <div key={p.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Edit Project</div>
              <div className="projects-form-grid projects-form-grid-top">
                <div className="projects-form-field projects-form-wide">
                  <label>Project Name</label>
                  <input value={editForm.name} onChange={e => setEdit('name', e.target.value)} />
                </div>
                <div className="projects-form-field">
                  <label>Type</label>
                  <select value={editForm.type} onChange={e => setEdit('type', e.target.value)}>
                    {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="projects-form-field">
                  <label>Status</label>
                  <select value={editForm.status} onChange={e => setEdit('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="done">Done</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>
              <div className="projects-form-field" style={{ marginBottom: 10 }}>
                <label>Deadline</label>
                <input type="date" value={editForm.deadline || ''} onChange={e => setEdit('deadline', e.target.value)} />
              </div>
              <div className="projects-form-field projects-form-wide" style={{ marginBottom: 10 }}>
                <label>Description</label>
                <textarea value={editForm.desc || ''} onChange={e => setEdit('desc', e.target.value)} rows={2} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveEdit}><Check size={13} /> Save</button>
                <button className="btn btn-ghost" onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={p.id} className="card" style={{ marginBottom: 8 }}>
            {/* Project header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                  <span className={`tag ${STATUS_COLORS[p.status] || 'tag-gray'}`}>{p.status}</span>
                  <span className={`tag ${TYPE_COLORS[p.type] || 'tag-gray'}`}>{p.type}</span>
                  {overdue && <span className="tag tag-red">Overdue</span>}
                </div>
                {p.desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{p.desc}</div>}
                {p.deadline && (
                  <div style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--muted)' }}>
                    Deadline: {p.deadline}{overdue ? ' ⚠️' : ''}
                  </div>
                )}

                {/* Progress bar */}
                {tasks.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
                      <span>{doneTasks}/{tasks.length} tasks done</span>
                      <span style={{ color: progress === 100 ? 'var(--success)' : 'var(--muted)', fontWeight: 600 }}>{progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ padding: '4px 7px', fontSize: 11 }} onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                  {isExpanded ? '▾' : '▸'} Tasks {tasks.length > 0 ? `(${tasks.length})` : ''}
                </button>
                <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => startEdit(p)}><Edit2 size={11} /></button>
                <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => deleteProject(p.id)}><Trash2 size={11} color="var(--danger)" /></button>
              </div>
            </div>

            {/* Task checklist */}
            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {tasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', border: `1px solid ${task.done ? 'var(--success)' : 'var(--border)'}`, borderRadius: 4, color: task.done ? 'var(--success)' : 'var(--muted)', minWidth: 24, fontSize: 12 }}
                      onClick={() => toggleTask(p.id, task.id)}
                    >
                      {task.done ? '✓' : '○'}
                    </button>
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
  const profile = getProfile();
  const currentTermKey = profile.currentTermKey || '';
  const termMatch = currentTermKey.match(/Y(\d)T(\d)/);
  const termYear = termMatch ? Number(termMatch[1]) : null;
  const termNo = termMatch ? Number(termMatch[2]) : null;

  if (!profile.dept || !currentTermKey || termYear === null || termNo === null) {
    return (
      <div className="page-enter page-container">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📚 Syllabus</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Course syllabus and topics</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Profile Incomplete</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Please set your department and term in Profile first.</p>
          <a href="/profile" className="btn btn-primary" style={{ display: 'inline-block' }}>Go to Profile</a>
        </div>
      </div>
    );
  }

  const allCourses = getAllCourses(profile);
  const deptSyllabus = getDeptSyllabus(profile.dept);
  const [selectedCourseId] = useState(() => store.get('selectedSyllabusCourseid'));
  const selectedCourse = selectedCourseId ? allCourses.find(c => c.id === selectedCourseId) : null;
  const displayTermKey = selectedCourse ? `Y${selectedCourse.year}T${selectedCourse.term}` : currentTermKey;
  const courses = selectedCourse ? [selectedCourse] : allCourses.filter(c => c.year === termYear && c.term === termNo);

  const [expandedTopics, setExpandedTopics] = useState({});
  const [openCourses, setOpenCourses] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selfStudyData, setSelfStudyData] = useState(() => store.get('selfstudy_academic') || []);

  useEffect(() => {
    if (selectedCourseId) store.remove('selectedSyllabusCourseid');
  }, [selectedCourseId]);

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

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📚 {getTermLabelFromKey(displayTermKey)} Syllabus</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {courses.length} courses • {courses.reduce((sum, c) => sum + (c.credits || 0), 0).toFixed(1)} credits
          </p>
        </div>
      </div>

      {!selectedCourse && (
        <div style={{ marginBottom: 16 }}>
          <input type="text" placeholder="🔍 Search courses or topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: courses.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginBottom: 20 }}>
        {courses
          .filter(c => {
            if (selectedCourse) return true;
            const q = searchQuery.toLowerCase();
            if (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) return true;
            const topics = syllabusCourseMap[c.code]?.topics || [];
            return topics.some(t => t.toLowerCase().includes(q));
          })
          .map(course => {
            const { sylData } = getCourseData(course.code);
            const topics = sylData.topics || [];
            const references = sylData.references || [];
            const courseStudy = selfStudyData.filter(s => s.courseId === course.id);
            const courseDiary = diaryData.filter(d => d.courseId === course.id);
            const completedCount = courseStudy.filter(s => s.endDate).length;
            const progressPercent = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
            const diaryCoveredCount = topics.filter(t => topicCoveredInDiary(t, courseDiary)).length;

            return (
              <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden', borderTop: '4px solid #8b5cf6', background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '14px', background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.05em' }}>{course.code}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{course.name}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', background: '#8b5cf6', color: 'white', borderRadius: 4 }}>{course.credits} cr</div>
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
                  <div className="card" style={{ margin: 0, padding: '8px', textAlign: 'center', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Official</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6' }}>{topics.length}</div>
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
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>📖 References</div>
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
                              onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                              onMouseLeave={e => { e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.08)' : 'transparent'; }}
                            >
                              <div style={{ marginTop: 2, fontSize: 11, color: isCompleted ? '#10b981' : '#8b5cf6', fontWeight: 700 }}>{isExpanded ? '▼' : '▶'}</div>
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
                                      <div key={j} style={{ marginBottom: 2 }}>📚 {s.date}{s.hours ? ` (${s.hours}h)` : ''}</div>
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
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>⚠️ No syllabus data available</div>
                )}
              </div>
            );
          })}
      </div>

      {courses.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
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
    if (!started) alert('Please set a valid countdown time.');
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
    <div className="page-container time-tracker-page">
      <div className="time-tracker-layout">
        <div className="time-tracker-main-column">
          <div className="card time-tracker-panel time-tracker-card time-tracker-panel--merged">
            <div className="time-tracker-hero time-tracker-hero--merged">
              <div className="time-tracker-hero-copy">
                <div className="time-tracker-kicker">Focus by design</div>
                <h1>Time Tracker</h1>
                <p>Run a clean focus timer, log work fast, and review the day without visual clutter.</p>
              </div>
            </div>
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
                    <button className="time-tracker-pref-btn-compact" title="Toggle sound" onClick={() => { const next = { ...timerPrefs, sound: !timerPrefs.sound }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}>{timerPrefs.sound ? '🔊' : '🔈'}</button>
                    <button className="time-tracker-pref-btn-compact" title="Toggle vibrate" onClick={() => { const next = { ...timerPrefs, vibrate: !timerPrefs.vibrate }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}>{timerPrefs.vibrate ? '📳' : '📴'}</button>
                    <button className="time-tracker-pref-btn-compact" title="Toggle notify" onClick={() => { const next = { ...timerPrefs, notify: !timerPrefs.notify }; setTimerPrefsState(next); store.set('timer_prefs_v1', next); }}>{timerPrefs.notify ? '🔔' : '🔕'}</button>
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
    <div className="page-enter page-container">
      {/* Hero Card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tuition Tracker</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Track sessions, income and travel costs</p>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(v => !v)}><Plus size={13} /> Log Session</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 14 }}>
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

// ── Food & Health ─────────────────────────────────────────────────────────────
const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', factor: 1.2 },
  { value: 'light', label: 'Light active', factor: 1.375 },
  { value: 'moderate', label: 'Moderate', factor: 1.55 },
  { value: 'active', label: 'Very active', factor: 1.725 },
];

export function Food() {
  const profileData = store.get('profile') || {};
  const [bmi, setBmi] = useState(() => store.get('bmi_data') || { weight: '', height: '', activityLevel: 'light' });
  const [logs, setLogs] = useState(() => store.get('foodlogs') || []);
  const [form, setForm] = useState({ date: todayStr(), meal: 'Lunch', item: '', calories: '' });
  const [adding, setAdding] = useState(false);
  const [viewDate, setViewDate] = useState(todayStr());
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setBMI = (k, v) => {
    const next = { ...bmi, [k]: v };
    setBmi(next);
    store.set('bmi_data', next);
  };

  const bmiVal = bmi.weight && bmi.height ? (+bmi.weight / ((+bmi.height / 100) ** 2)).toFixed(1) : null;
  const bmiLabel = !bmiVal ? '' : +bmiVal < 18.5 ? 'Underweight' : +bmiVal < 25 ? 'Normal' : +bmiVal < 30 ? 'Overweight' : 'Obese';
  const bmiColor = !bmiVal ? 'var(--muted)' : +bmiVal < 18.5 ? 'var(--warning)' : +bmiVal < 25 ? 'var(--success)' : +bmiVal < 30 ? 'var(--warning)' : 'var(--danger)';

  // Better TDEE using Harris-Benedict + activity factor
  const activityFactor = ACTIVITY_LEVELS.find(a => a.value === bmi.activityLevel)?.factor || 1.375;
  const bmr = bmi.weight && bmi.height ? Math.round(10 * +bmi.weight + 6.25 * +bmi.height - 5 * (profileData.age || 20) + 5) : 0;
  const suggestedCal = bmr > 0 ? Math.round(bmr * activityFactor) : 2200;

  const save = () => {
    if (!form.item.trim() || !form.calories) return;
    const u = [{ ...form, calories: +form.calories, id: uid() }, ...logs];
    setLogs(u); store.set('foodlogs', u); setAdding(false);
  };

  const today = todayStr();
  const viewLogs = logs.filter(l => l.date === viewDate);
  const viewCal = viewLogs.reduce((s, l) => s + (+l.calories || 0), 0);
  const todayCal = logs.filter(l => l.date === today).reduce((s, l) => s + (+l.calories || 0), 0);

  // 7-day calorie history
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = dateKey(d);
    const dayLogs = logs.filter(l => l.date === ds);
    const cal = dayLogs.reduce((s, l) => s + (+l.calories || 0), 0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { label: dayNames[d.getDay()], cal, date: ds };
  });
  const maxCal = Math.max(...last7.map(d => d.cal), suggestedCal, 1);

  return (
    <div className="page-enter page-container">
      {/* Hero stats */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Food & Health</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>BMI, calorie tracker, daily nutrition</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginTop: 14 }}>
          <div className="stat-mini" style={{ borderColor: bmiColor }}>
            <div className="stat-mini-val" style={{ color: bmiColor }}>{bmiVal || '—'}</div>
            <div className="stat-mini-lbl">BMI · {bmiLabel || 'not set'}</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{todayCal}</div>
            <div className="stat-mini-lbl">Today kcal</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-val">{suggestedCal}</div>
            <div className="stat-mini-lbl">Target kcal</div>
          </div>
          <div className={`stat-mini ${todayCal > suggestedCal ? 'stat-mini-danger' : 'stat-mini-success'}`}>
            <div className="stat-mini-val">{todayCal > suggestedCal ? `+${todayCal - suggestedCal}` : `−${suggestedCal - todayCal}`}</div>
            <div className="stat-mini-lbl">{todayCal > suggestedCal ? 'Over target' : 'Remaining'}</div>
          </div>
        </div>

        {/* 7-day calorie chart */}
        {logs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>7-day calorie history</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 54 }}>
              {last7.map((d, i) => {
                const barPct = (d.cal / maxCal) * 40;
                const targetPct = (suggestedCal / maxCal) * 40;
                const isOver = d.cal > suggestedCal;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }} onClick={() => setViewDate(d.date)}>
                    <div style={{ width: '100%', background: d.cal > 0 ? (isOver ? 'var(--danger)' : 'var(--accent)') : 'var(--border)', borderRadius: 3, height: `${Math.max(4, barPct)}px`, transition: 'height 0.3s', opacity: viewDate === d.date ? 1 : 0.7 }} />
                    <span style={{ fontSize: 10, color: viewDate === d.date ? 'var(--text)' : 'var(--muted)', fontWeight: viewDate === d.date ? 600 : 400 }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Click a bar to view that day's meals</div>
          </div>
        )}
      </div>

      {/* BMI card */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>BMI & calorie target</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <div><label>Weight (kg)</label><input type="number" value={bmi.weight} onChange={e => setBMI('weight', e.target.value)} placeholder="65" /></div>
          <div><label>Height (cm)</label><input type="number" value={bmi.height} onChange={e => setBMI('height', e.target.value)} placeholder="170" /></div>
          <div>
            <label>Activity level</label>
            <select value={bmi.activityLevel} onChange={e => setBMI('activityLevel', e.target.value)}>
              {ACTIVITY_LEVELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label>BMI</label>
            <div style={{ padding: '7px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontWeight: 700, fontSize: 15, color: bmiColor }}>
              {bmiVal || '—'} <span style={{ fontSize: 11, fontWeight: 400 }}>{bmiLabel}</span>
            </div>
          </div>
        </div>
        {bmiVal && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Daily target: ~{suggestedCal} kcal (Harris-Benedict + activity)</div>}
      </div>

      {/* Calorie tracker */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {viewDate === today ? "Today's meals" : `Meals on ${viewDate}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Target: ~{suggestedCal} kcal</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: viewCal > suggestedCal ? 'var(--danger)' : 'var(--success)' }}>{viewCal} kcal</div>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(100, (viewCal / suggestedCal) * 100)}%`, background: viewCal > suggestedCal ? 'var(--danger)' : 'var(--accent)', transition: 'width 0.3s' }} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setAdding(v => !v)}>
          <Plus size={13} /> Log Meal
        </button>
      </div>

      {adding && (
        <Modal onClose={() => setAdding(false)} overlayStyle={{ padding: 12 }} contentStyle={{ width: '100%', maxWidth: 520, borderRadius: 20, padding: 0, background: 'transparent', maxHeight: 'calc(100vh - 24px)', overflow: 'auto' }}>
          <div className="card food-log-form-card" style={{ marginBottom: 0, borderRadius: 20 }}>
            <div className="food-log-form-grid">
              <div className="food-log-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div className="food-log-field">
                <label>Meal</label>
                <select value={form.meal} onChange={e => set('meal', e.target.value)}>
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="food-log-field food-log-item-field"><label>Food item</label><input value={form.item} onChange={e => set('item', e.target.value)} placeholder="Bhat, Dal, Chicken..." /></div>
              <div className="food-log-field"><label>Calories (kcal)</label><input type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="400" /></div>
            </div>
            <div className="food-log-actions">
              <button className="btn btn-primary food-log-save-btn" onClick={save}>Save</button>
              <button className="btn btn-ghost food-log-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {viewLogs.map(l => (
        <div key={l.id} className="card" style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`tag ${l.meal === 'Breakfast' ? 'tag-yellow' : l.meal === 'Lunch' ? 'tag-green' : l.meal === 'Dinner' ? 'tag-blue' : 'tag-gray'}`}>{l.meal}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{l.item}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{l.calories} kcal</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
            const u = logs.filter(x => x.id !== l.id); setLogs(u); store.set('foodlogs', u);
          }}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}

      {viewLogs.length === 0 && !adding && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 12 }}>
          No meals logged for {viewDate === today ? 'today' : viewDate}. Tap "Log Meal" to add one.
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
  const expenses = store.get('expenses') || [];
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
  const periodExpenses = expenses.filter(e => e.date && inRange(e.date, start, end));
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
      '  kuetx.vercel.app',
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
    <div className="page-enter page-container">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Reports</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Export summaries of your student life · {label}</p>
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