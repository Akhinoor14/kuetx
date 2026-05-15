import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { store, uid, COURSE_TYPES, COURSE_STATUSES } from '../store/store';

const YEARS = [1,2,3,4];
const TERMS = [1,2];

const STATUS_COLORS = {
  active: 'tag-green', completed: 'tag-blue',
  backlog: 'tag-red', withdrawal: 'tag-yellow', incomplete: 'tag-gray'
};

function CourseForm({ initial, onSave, onCancel }) {
  const blank = { code:'', name:'', type:'Theory', credits:3, year:1, term:1, status:'active', isCore:true, notes:'' };
  const [f, setF] = useState(initial || blank);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  return (
    <div className="card mb-3" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
        {initial?.id ? 'Edit Course' : '+ Add New Course'}
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
            {YEARS.map(y=><option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        <div>
          <label>Term</label>
          <select value={f.term} onChange={e=>set('term',+e.target.value)}>
            {TERMS.map(t=><option key={t} value={t}>Term {t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>Notes / Pre-requisites (optional)</label>
        <input value={f.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Pre-req: CSE 1101, or any note..." />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <input type="checkbox" id="isCore" checked={!!f.isCore} onChange={e=>set('isCore',e.target.checked)} style={{width:'auto'}}/>
        <label htmlFor="isCore" style={{marginBottom:0,cursor:'pointer',fontSize:14,color:'var(--text)',textTransform:'none',letterSpacing:0,fontWeight:500}}>
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
  const [courses, setCourses] = useState(()=>store.get('courses')||[]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterYear, setFilterYear] = useState('all');

  const save = (cs) => { store.set('courses', cs); setCourses(cs); };

  const addCourse = (f) => {
    save([...courses, {...f, id:uid()}]);
    setAdding(false);
  };
  const editCourse = (f) => {
    save(courses.map(c=>c.id===f.id?f:c));
    setEditing(null);
  };
  const del = (id) => {
    if (!confirm('Delete this course?')) return;
    save(courses.filter(c=>c.id!==id));
  };

  // Group by year+term
  const filtered = filterYear === 'all' ? courses : courses.filter(c=>c.year===+filterYear);
  const groups = {};
  filtered.forEach(c => {
    const k = `Y${c.year}T${c.term}`;
    if (!groups[k]) groups[k] = { label:`Year ${c.year} · Term ${c.term}`, key:k, items:[] };
    groups[k].items.push(c);
  });
  const sortedGroups = Object.values(groups).sort((a,b)=>a.key.localeCompare(b.key));

  return (
    <div className="page-enter page-container">
      <div className="flex-between mb-4">
        <div>
          <h1>Courses</h1>
          <p className="text-muted" style={{marginTop:4}}>{courses.length} courses added</p>
        </div>
        {!adding && <button className="btn btn-primary" onClick={()=>{setAdding(true);setEditing(null);}}>
          <Plus size={16}/> Add Course
        </button>}
      </div>

      {/* Add form */}
      {adding && <CourseForm onSave={addCourse} onCancel={()=>setAdding(false)} />}

      {/* Filter */}
      {courses.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
          {['all',...YEARS.map(String)].map(y=>(
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

      {/* Empty state */}
      {courses.length === 0 && !adding && (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p style={{marginBottom:16}}>No courses yet. Add your courses to get started.</p>
          <button className="btn btn-primary" onClick={()=>setAdding(true)}><Plus size={16}/> Add First Course</button>
        </div>
      )}

      {/* Groups */}
      {sortedGroups.map(g=>(
        <div key={g.key} style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
            {g.label}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {g.items.map(c=>(
              <div key={c.id}>
                {editing===c.id
                  ? <CourseForm initial={c} onSave={editCourse} onCancel={()=>setEditing(null)} />
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
                          {c.notes && <span style={{fontSize:12,color:'var(--muted)'}}>{c.notes}</span>}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(c.id)} title="Edit">
                        <Edit2 size={14}/>
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>del(c.id)} title="Delete">
                        <Trash2 size={14} color="var(--danger)"/>
                      </button>
                    </div>
                  )
                }
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
