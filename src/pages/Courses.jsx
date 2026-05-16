import { useMemo, useState } from 'react';
import { Plus, Trash2, X, Check, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COURSE_STATUSES, COURSE_TYPES, getAllCourses, getCustomCourses, getDeptOptionalCourses, getProfile, getTermLabelFromKey, setCourseOverride, setCustomCourses, setOptionalSelection, uid, store } from '../store/store';

const YEARS = [1, 2, 3, 4];
const STATUS_COLORS = { active: 'tag-green', completed: 'tag-blue', backlog: 'tag-red', withdrawal: 'tag-yellow', incomplete: 'tag-gray' };

function CustomCourseForm({ initial, onSave, onCancel }) {
  const blank = { code: '', name: '', type: 'Theory', credits: 3, year: 1, term: 1, status: 'active', isCore: true, notes: '' };
  const [f, setF] = useState(initial || blank);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="card mb-3" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
        {initial?.id ? 'Edit Custom Course' : '+ Add Custom Course'}
      </div>
      <div className="form-row form-row-2">
        <div><label>Course Code</label><input value={f.code} onChange={e => set('code', e.target.value)} /></div>
        <div><label>Course Name</label><input value={f.name} onChange={e => set('name', e.target.value)} /></div>
      </div>
      <div className="form-row form-row-3">
        <div><label>Type</label><select value={f.type} onChange={e => set('type', e.target.value)}>{COURSE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
        <div><label>Credits</label><input type="number" value={f.credits} onChange={e => set('credits', +e.target.value)} min={0.5} max={6} step={0.5} /></div>
        <div><label>Status</label><select value={f.status} onChange={e => set('status', e.target.value)}>{COURSE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onSave(f)}><Check size={14} /> Save</button>
        <button className="btn btn-ghost" onClick={onCancel}><X size={14} /> Cancel</button>
      </div>
    </div>
  );
}

export default function Courses() {
  const navigate = useNavigate();
  const profile = getProfile();
  const [filterYear, setFilterYear] = useState('all');
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingCustom, setEditingCustom] = useState(null);
  const [version, setVersion] = useState(0);
  const [expandedTerms, setExpandedTerms] = useState(() => {
    const k = profile?.currentTermKey || '';
    return k ? { [k]: true } : {};
  });

  const courses = useMemo(() => getAllCourses(profile), [profile.dept, profile.currentTermKey, version]);
  const customCourses = useMemo(() => getCustomCourses(), [version]);
  const optionalCatalog = getDeptOptionalCourses(profile.dept);

  const toggleTerm = (key) => setExpandedTerms(p => ({ ...p, [key]: !p[key] }));
  const viewCourseSyllabus = (id) => {
    store.set('selectedSyllabusCourseid', id);
    navigate('/syllabus');
  };
  const updateOverride = (id, patch) => {
    setCourseOverride(id, patch);
    setVersion(v => v + 1);
  };
  const updateOptional = (course, code) => {
    setOptionalSelection({
      deptCode: course.deptCode,
      termKey: `Y${course.year}T${course.term}`,
      slotIndex: course.optionalSlotIndex,
      code
    });
    setVersion(v => v + 1);
  };

  const filtered = filterYear === 'all' ? courses : courses.filter(c => c.year === +filterYear);
  const groups = {};
  filtered.forEach(c => {
    const k = `Y${c.year}T${c.term}`;
    if (!groups[k]) groups[k] = { label: getTermLabelFromKey(k), key: k, items: [] };
    groups[k].items.push(c);
  });
  const sortedGroups = Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="page-enter page-container">
      <div className="flex-between mb-4">
        <div>
          <h1>Courses</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>{courses.length} courses loaded</p>
        </div>
        {!addingCustom && <button className="btn btn-primary" onClick={() => { setAddingCustom(true); setEditingCustom(null); }}><Plus size={14} /> Add Custom Course</button>}
      </div>

      {addingCustom && <CustomCourseForm onSave={(f) => { setCustomCourses([{ ...f, id: uid(), source: 'custom' }, ...customCourses]); setVersion(v => v + 1); setAddingCustom(false); }} onCancel={() => setAddingCustom(false)} />}

      {courses.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {['all', ...YEARS.map(String)].map(y => (
            <button key={y} onClick={() => setFilterYear(y)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: filterYear === y ? 'var(--accent)' : 'transparent', color: filterYear === y ? 'var(--accentFg)' : 'var(--muted)' }}>{y === 'all' ? 'All Years' : `Year ${y}`}</button>
          ))}
        </div>
      )}

      {sortedGroups.map(g => (
        <div key={g.key} style={{ marginBottom: 18 }}>
          <button onClick={() => toggleTerm(g.key)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: expandedTerms[g.key] ? 'rgba(59,130,246,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{g.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{expandedTerms[g.key] ? '▼' : '▶'}</span>
          </button>
          {expandedTerms[g.key] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {g.items.map(c => (
                <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono fw-700" style={{ fontSize: 'clamp(12px,3.5vw,14px)', color: c.code && c.code.includes('CSE 2113') ? 'var(--accent)' : 'inherit' }}>{c.code}</span>
                      <span style={{ fontSize: 'clamp(13px,3.5vw,14px)', fontWeight: c.code && c.code.includes('CSE 2113') ? 800 : 600 }}>{c.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                      <span className={`tag ${STATUS_COLORS[c.status] || 'tag-gray'}`} style={{ fontSize: 12, padding: '4px 8px' }}>{c.status}</span>
                      <span className="tag tag-gray" style={{ fontSize: 12, padding: '4px 8px' }}>{c.type}</span>
                      <span className="tag tag-gray" style={{ fontSize: 12, padding: '4px 8px' }}>{c.credits} cr</span>
                      {c.isCore && <span className="tag tag-blue" style={{ fontSize: 12, padding: '4px 8px' }}>Core</span>}
                      {c.isOptional && <span className="tag tag-yellow" style={{ fontSize: 12, padding: '4px 8px' }}>Optional</span>}
                      <button onClick={(e) => { e.stopPropagation(); viewCourseSyllabus(c.id); }} className="tag" style={{ marginLeft: 6, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center' }} title="Open syllabus"><BookOpen size={14} /></button>
                    </div>
                    {c.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{c.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110, width: 110 }}>
                    {c.isOptional && <select value={c.optionalCode || ''} onChange={e => updateOptional(c, e.target.value)} style={{ fontSize: 13, padding: 6 }}><option value="">Select</option>{optionalCatalog.map(opt => <option key={opt.code} value={opt.code}>{opt.code} — {opt.title}</option>)}</select>}
                    <select value={c.status} onChange={e => updateOverride(c.id, { status: e.target.value })} style={{ fontSize: 13, padding: 6 }}>{COURSE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                    <input value={c.notes || ''} onChange={e => updateOverride(c.id, { notes: e.target.value })} placeholder="Notes / pre-reqs" style={{ fontSize: 13, padding: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {customCourses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Custom Courses</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customCourses.map(c => (
              <div key={c.id}>
                {editingCustom === c.id ? <CustomCourseForm initial={c} onSave={(f) => { setCustomCourses(customCourses.map(x => x.id === f.id ? f : x)); setVersion(v => v + 1); setEditingCustom(null); }} onCancel={() => setEditingCustom(null)} /> : (
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="mono fw-700" style={{ fontSize: 14 }}>{c.code}</span>
                        <span style={{ fontSize: 14 }}>{c.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className={`tag ${STATUS_COLORS[c.status] || 'tag-gray'}`}>{c.status}</span>
                        <span className="tag tag-gray">{c.type}</span>
                        <span className="tag tag-gray">{c.credits} cr</span>
                        {c.isCore && <span className="tag tag-blue">Core</span>}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingCustom(c.id)} title="Edit">✎</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Delete this custom course?')) { setCustomCourses(customCourses.filter(x => x.id !== c.id)); setVersion(v => v + 1); } }} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {courses.length === 0 && !addingCustom && (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p style={{ marginBottom: 16 }}>Select department and term in Profile to load courses.</p>
        </div>
      )}
    </div>
  );
}
