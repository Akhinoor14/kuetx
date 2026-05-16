import { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Trash2, X, Check, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COURSE_STATUSES, COURSE_TYPES, getAllCourses, getCustomCourses, getDeptOptionalCourses, getProfile, getTermLabelFromKey, setCourseOverride, setCustomCourses, setOptionalSelection, uid, store } from '../store/store';

const YEARS = [1, 2, 3, 4];
const STATUS_COLORS = { active: 'tag-green', completed: 'tag-blue', backlog: 'tag-red', withdrawal: 'tag-yellow', incomplete: 'tag-gray' };

const CHIP_STYLE = {
  fontSize: 9,
  lineHeight: 1,
  padding: '1px 7px',
  minHeight: 18,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center'
};
const CHIP_ICON_STYLE = {
  ...CHIP_STYLE,
  width: 20,
  padding: 0,
  justifyContent: 'center'
};

// Status chip dropdown removed: use native select in forms to avoid showing active/completed chip in cards

function StatusChip({ course, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const status = course.status || 'backlog';
  const label = (COURSE_STATUSES.find(s => s.id === status) || { label: status }).label;
  const className = STATUS_COLORS[status] || 'tag-gray';

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className={`tag ${className}`} style={{ ...CHIP_STYLE, cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>{label}</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, zIndex: 40 }}>
          <select value={status} onChange={e => { onChange(e.target.value); setOpen(false); }}>
            {COURSE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function NoteChipEditor({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const hasValue = !!String(value || '').trim();

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="tag tag-gray"
        style={{
          ...CHIP_STYLE,
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          maxWidth: 130,
          whiteSpace: 'nowrap'
        }}
        title={hasValue ? value : 'Notes / pre-reqs'}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{hasValue ? 'Notes' : '+ Notes'}</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 20,
            width: 260,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(12, 34, 64, 0.12)',
            padding: 8
          }}
        >
          <textarea
            autoFocus
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setOpen(false)}
            placeholder="Notes / pre-reqs"
            rows={3}
            style={{ width: '100%', fontSize: 12, padding: 8, resize: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomCourseForm({ initial, onSave, onCancel }) {
  const blank = { code: '', name: '', type: 'Theory', credits: 3, year: 1, term: 1, status: 'active', isCore: true, notes: '', chapters: [] };
  const [f, setF] = useState(initial || blank);
  const [newChapter, setNewChapter] = useState('');
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [newSubtopic, setNewSubtopic] = useState({});
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const addChapter = () => {
    if (newChapter.trim()) {
      setF(p => ({ ...p, chapters: [...(p.chapters || []), { chapter: newChapter, subtopics: [] }] }));
      setNewChapter('');
    }
  };
  
  const removeChapter = (idx) => {
    setF(p => ({ ...p, chapters: p.chapters.filter((_, i) => i !== idx) }));
    setExpandedChapter(null);
  };
  
  const addSubtopic = (chapterIdx) => {
    const text = newSubtopic[chapterIdx]?.trim();
    if (text) {
      setF(p => {
        const updated = [...p.chapters];
        updated[chapterIdx].subtopics.push(text);
        return { ...p, chapters: updated };
      });
      setNewSubtopic(s => ({ ...s, [chapterIdx]: '' }));
    }
  };
  
  const removeSubtopic = (chapterIdx, subtopicIdx) => {
    setF(p => {
      const updated = [...p.chapters];
      updated[chapterIdx].subtopics.splice(subtopicIdx, 1);
      return { ...p, chapters: updated };
    });
  };

  return (
    <div className="card mb-3" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
        {initial?.id ? 'Edit Custom Course' : '+ Add Custom Course'}
      </div>
      
      {/* Basic Info */}
      <div className="form-row form-row-2">
        <div><label>Course Code</label><input value={f.code} onChange={e => set('code', e.target.value)} placeholder="e.g., CS 2101" /></div>
        <div><label>Course Name</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g., Data Structures" /></div>
      </div>
      <div className="form-row form-row-2">
        <div><label>Type</label><select value={f.type} onChange={e => set('type', e.target.value)}>{COURSE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
        <div><label>Credits</label><input type="number" value={f.credits} onChange={e => set('credits', +e.target.value)} min={0.5} max={6} step={0.5} /></div>
      </div>
      
      {/* Chapters/Syllabus */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>📚 Course Syllabus (Optional)</label>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 10 }}>Organize your course into chapters with sub-topics</p>
        
        {/* Add Chapter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input 
            type="text" 
            value={newChapter} 
            onChange={e => setNewChapter(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && addChapter()}
            placeholder="Add chapter (e.g., Chapter 1: Fundamentals)" 
            style={{ flex: 1 }}
          />
          <button className="btn btn-sm btn-primary" onClick={addChapter} style={{ fontSize: 12 }}>
            <Plus size={12} /> Chapter
          </button>
        </div>
        
        {/* Chapters List */}
        {f.chapters && f.chapters.length > 0 && (
          <div style={{ 
            background: 'rgba(139,92,246,0.04)', 
            border: '1px solid var(--border)', 
            borderRadius: 8, 
            overflow: 'hidden'
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              {f.chapters.length} chapter{f.chapters.length !== 1 ? 's' : ''}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {f.chapters.map((chap, chapIdx) => (
                <div key={chapIdx}>
                  {/* Chapter Header */}
                  <div 
                    onClick={() => setExpandedChapter(expandedChapter === chapIdx ? null : chapIdx)}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: expandedChapter === chapIdx ? 'rgba(139,92,246,0.08)' : 'var(--surface)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span>{expandedChapter === chapIdx ? '▼' : '▶'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chap.chapter}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>({chap.subtopics?.length || 0})</span>
                    </div>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={(e) => { e.stopPropagation(); removeChapter(chapIdx); }}
                      style={{ padding: '2px 6px', minWidth: 'auto' }}
                      title="Remove chapter"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  
                  {/* Sub-topics */}
                  {expandedChapter === chapIdx && (
                    <div style={{ background: 'var(--surface)', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      {/* Add Sub-topic */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <input 
                          type="text" 
                          value={newSubtopic[chapIdx] || ''}
                          onChange={e => setNewSubtopic(s => ({ ...s, [chapIdx]: e.target.value }))}
                          onKeyPress={e => e.key === 'Enter' && addSubtopic(chapIdx)}
                          placeholder="Add a topic (e.g., Arrays basics)" 
                          style={{ flex: 1, fontSize: 12 }}
                        />
                        <button className="btn btn-sm btn-ghost" onClick={() => addSubtopic(chapIdx)} style={{ fontSize: 11 }}>
                          <Plus size={12} />
                        </button>
                      </div>
                      
                      {/* Sub-topics List */}
                      {chap.subtopics && chap.subtopics.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {chap.subtopics.map((subtopic, subIdx) => (
                            <div 
                              key={subIdx}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                background: 'rgba(139,92,246,0.04)',
                                padding: '8px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                gap: 8,
                                marginLeft: 16
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                • {subtopic}
                              </span>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                onClick={() => removeSubtopic(chapIdx, subIdx)}
                                style={{ padding: '2px 6px', minWidth: 'auto' }}
                                title="Remove topic"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginLeft: 16 }}>
                          No topics yet. Add one above.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
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
  const getStatusChipLabel = (status) => status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '';

  return (
    <div className="page-enter page-container">
      <div className="flex-between mb-4">
        <div>
          <h1>Courses</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>{courses.length} courses loaded</p>
        </div>
        {!addingCustom && <button className="btn btn-primary" onClick={() => { setAddingCustom(true); setEditingCustom(null); }}><Plus size={14} /> Add Custom Course</button>}
      </div>

      {courses.length === 0 && (
        <div className="info-box" style={{ marginBottom: 18 }}>
          <p>No curriculum is loaded for {profile?.dept || 'this department'} yet. The planner and self-study pages stay empty until this department's terms are populated.</p>
        </div>
      )}

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
                      <span className="tag tag-gray" style={CHIP_STYLE}>{c.type}</span>
                      <span className="tag tag-gray" style={CHIP_STYLE}>{c.credits} cr</span>
                      {c.isOptional && <span className="tag tag-yellow" style={CHIP_STYLE}>Optional</span>}
                      <NoteChipEditor value={c.notes || ''} onChange={(notes) => updateOverride(c.id, { notes })} />
                      <button onClick={(e) => { e.stopPropagation(); viewCourseSyllabus(c.id); }} className="tag tag-blue" style={{ ...CHIP_STYLE, fontSize: 9, fontWeight: 700, cursor: 'pointer' }} title="Open exact syllabus">
                        <BookOpen size={11} />
                        <span style={{ marginLeft: 4 }}>Syllabus</span>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110, width: 110 }}>
                    {c.isOptional && <select value={c.optionalCode || ''} onChange={e => updateOptional(c, e.target.value)} style={{ fontSize: 13, padding: 6 }}><option value="">Select</option>{optionalCatalog.map(opt => <option key={opt.code} value={opt.code}>{opt.code} — {opt.title}</option>)}</select>}
                    <StatusChip course={c} onChange={newStatus => updateOverride(c.id, { status: newStatus })} />
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
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        <span className="tag tag-gray" style={CHIP_STYLE}>{c.type}</span>
                        <span className="tag tag-gray" style={CHIP_STYLE}>{c.credits} cr</span>
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
