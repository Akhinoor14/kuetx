import { useMemo, useState, useEffect } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COURSE_STATUSES, COURSE_TYPES, getAllCourses, getCustomCourses, getDeptOptionalCourses, getProfile, getTermLabelFromKey, setCourseOverride, setCustomCourses, setOptionalSelection, uid, store } from '../store/store';

const YEARS = [1, 2, 3, 4];

const STATUS_COLORS = {
  active: 'tag-green', completed: 'tag-blue',
  backlog: 'tag-red', withdrawal: 'tag-yellow', incomplete: 'tag-gray'
};

function CustomCourseForm({ initial, onSave, onCancel }) {
  const blank = { code:'', name:'', type:'Theory', credits:3, year:1, term:1, status:'active', isCore:true, notes:'' };
  const [f, setF] = useState(initial || blank);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  return (
    <div className="card mb-3" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
        {initial?.id ? 'Edit Custom Course' : '+ Add Custom Course'}
      </div>

      <div className="form-row form-row-2">
        <div>
          <label>Course Code</label>
          <input value={f.code} onChange={e=>set('code',e.target.value)} placeholder="e.g. CSE 2201" />
        </div>
        <div>
          <label>Course Name</label>
          <input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Data Structures & Algorithms" />
        </div>
      </div>

      <div className="form-row form-row-3">
        <div>
          <label>Type</label>
          <select value={f.type} onChange={e=>set('type',e.target.value)}>
            {COURSE_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label>Credits</label>
          <input type="number" value={f.credits} onChange={e=>set('credits',+e.target.value)} min={0.5} max={6} step={0.5} />
        </div>
        <div>
          <label>Status</label>
          <select value={f.status} onChange={e=>set('status',e.target.value)}>
            {COURSE_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row form-row-2">
        <div>
          <label>Year</label>
          <select value={f.year} onChange={e=>set('year',+e.target.value)}>
            {YEARS.map(y=><option key={y} value={y}>Year {y}</option>) }
          </select>
        </div>
        <div>
          <label>Term</label>
          <select value={f.term} onChange={e=>set('term',+e.target.value)}>
            {[1,2].map(t=><option key={t} value={t}>Term {t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>Notes / Pre-requisites (optional)</label>
        <input value={f.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Pre-req: CSE 1101, or any note..." />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" id="custom-isCore" checked={!!f.isCore} onChange={e=>set('isCore',e.target.checked)} style={{width:'auto'}}/>
        <label htmlFor="custom-isCore" style={{marginBottom:0,cursor:'pointer',fontSize:14,color:'var(--text)',textTransform:'none',letterSpacing:0,fontWeight:500}}>
          Core course (must pass for degree)
        </label>
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" onClick={()=>onSave(f)}><Check size={15}/> Save Course</button>
        <button className="btn btn-ghost" onClick={onCancel}><X size={15}/> Cancel</button>
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
    // Auto-expand current term on initial load
    const currentTermKey = profile?.currentTermKey || '';
    return currentTermKey ? { [currentTermKey]: true } : {};
  });

  const courses = useMemo(() => getAllCourses(profile), [profile.dept, profile.currentTermKey, version]);
  const customCourses = useMemo(() => getCustomCourses(), [version]);
  const optionalCatalog = getDeptOptionalCourses(profile.dept);

  const saveCustom = (list) => {
    setCustomCourses(list);
    setVersion(v => v + 1);
  };

  const addCustomCourse = (f) => {
    saveCustom([{ ...f, id: uid(), source: 'custom' }, ...customCourses]);
    setAddingCustom(false);
  };

  const editCustomCourse = (f) => {
    saveCustom(customCourses.map(c => c.id === f.id ? f : c));
    setEditingCustom(null);
  };

  const delCustom = (id) => {
    if (!confirm('Delete this custom course?')) return;
    saveCustom(customCourses.filter(c => c.id !== id));
  };

  const updateOverride = (courseId, patch) => {
    setCourseOverride(courseId, patch);
    setVersion(v => v + 1);
  };

  const updateOptional = (course, code) => {
    setOptionalSelection({ deptCode: course.deptCode, termKey: `Y${course.year}T${course.term}`, slotIndex: course.optionalSlotIndex, code });
    setVersion(v => v + 1);
  };

  const toggleTerm = (key) => {
    setExpandedTerms(p => ({ ...p, [key]: !p[key] }));
  };

  const viewCourseSyllabus = (courseId) => {
    // Store the selected course ID so Syllabus component can pre-select it
    store.set('selectedSyllabusCourseid', courseId);
    navigate('/syllabus');
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
          <p className="text-muted" style={{marginTop:4}}>{courses.length} courses loaded</p>
        </div>
        {!addingCustom && (
          <button className="btn btn-primary" onClick={() => { setAddingCustom(true); setEditingCustom(null); }}>
            <Plus size={16}/> Add Custom Course
          </button>
        )}
      </div>

      {addingCustom && <CustomCourseForm onSave={addCustomCourse} onCancel={() => setAddingCustom(false)} />}

      {courses.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
          {['all', ...YEARS.map(String)].map(y => (
            <button key={y} onClick={()=>setFilterYear(y)} style={{
              padding:'6px 14px', borderRadius:8, border:'1.5px solid', cursor:'pointer',
              fontWeight:filterYear===y?700:400, fontSize:13, fontFamily:'Sora,sans-serif',
              borderColor:filterYear===y?'var(--accent)':'var(--border)',
              background:filterYear===y?'var(--accent)':'transparent',
              color:filterYear===y?'var(--accentFg)':'var(--muted)',
            }}>{y==='all'?'All Years':`Year ${y}`}</button>
          ))}
        </div>
      )}

      {sortedGroups.map(g => (
        <div key={g.key} style={{ marginBottom: 20 }}>
          <button 
            onClick={() => toggleTerm(g.key)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: expandedTerms[g.key] ? 'rgba(59,130,246,0.08)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: expandedTerms[g.key] ? 12 : 10,
              transition: 'all 200ms ease'
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
              {g.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', minWidth: 24, textAlign: 'right' }}>
              {expandedTerms[g.key] ? '▼' : '▶'}
            </span>
          </button>
          {expandedTerms[g.key] && (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {g.items.map(c => (
                <div key={c.id} className="card" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer',transition:'all 200ms ease'}} onClick={() => viewCourseSyllabus(c.id)} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span className="mono fw-700" style={{fontSize:14}}>{c.code}</span>
                      <span style={{fontSize:14}}>{c.name}</span>
                    </div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:5}}>
                      <span className={`tag ${STATUS_COLORS[c.status]||'tag-gray'}`}>{c.status}</span>
                      <span className="tag tag-gray">{c.type}</span>
                      <span className="tag tag-gray">{c.credits} cr</span>
                      {c.isCore && <span className="tag tag-blue">Core</span>}
                    {c.isOptional && <span className="tag tag-yellow">Optional Slot</span>}
                  </div>
                  {c.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{c.notes}</div>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                  {c.isOptional && (
                    <select value={c.optionalCode || ''} onChange={e => updateOptional(c, e.target.value)}>
                      <option value="">Select optional course</option>
                      {optionalCatalog.map(opt => (
                        <option key={opt.code} value={opt.code}>{opt.code} — {opt.title}</option>
                      ))}
                    </select>
                  )}
                  <select value={c.status} onChange={e => updateOverride(c.id, { status: e.target.value })}>
                    {COURSE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <input value={c.notes || ''} onChange={e => updateOverride(c.id, { notes: e.target.value })} placeholder="Notes / pre-reqs" />
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {customCourses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
            Custom Courses
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {customCourses.map(c => (
              <div key={c.id}>
                {editingCustom === c.id
                  ? <CustomCourseForm initial={c} onSave={editCustomCourse} onCancel={() => setEditingCustom(null)} />
                  : (
                    <div className="card" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span className="mono fw-700" style={{fontSize:14}}>{c.code}</span>
                          <span style={{fontSize:14}}>{c.name}</span>
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:5}}>
                          <span className={`tag ${STATUS_COLORS[c.status]||'tag-gray'}`}>{c.status}</span>
                          <span className="tag tag-gray">{c.type}</span>
                          <span className="tag tag-gray">{c.credits} cr</span>
                          {c.isCore && <span className="tag tag-blue">Core</span>}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setEditingCustom(c.id)} title="Edit">
                        ✎
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>delCustom(c.id)} title="Delete">
                        <Trash2 size={14} color="var(--danger)"/>
                      </button>
                    </div>
                  )
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {courses.length === 0 && !addingCustom && (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p style={{marginBottom:16}}>Select department and term in Profile to load courses.</p>
        </div>
      )}
    </div>
  );
}
