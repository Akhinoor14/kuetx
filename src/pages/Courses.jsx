import { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Trash2, X, Check, BookOpen, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COURSE_STATUSES, COURSE_TYPES, getCustomCourses, getProfile, getTermLabelFromKey, setCourseOverride, setCustomCourses, uid, store } from '../store/store';
import { getAllCourses, getDeptOptionalCourses, setOptionalSelection } from '../store/curriculumStore';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import ConfirmDialog from '../components/ConfirmDialog';

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

const getTeacherChipClass = () => 'tag tag-pink';

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
            width: 'min(260px, calc(100vw - 32px))',
            maxWidth: 'calc(100vw - 32px)',
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
  const profile = getProfile();
  let defaultYear = 1;
  let defaultTerm = 1;
  const currentTermKey = profile?.currentTermKey;
  if (currentTermKey) {
    const m = String(currentTermKey).match(/^Y(\d+)T(\d+)$/);
    if (m) {
      defaultYear = +m[1];
      defaultTerm = +m[2];
    }
  }

  const blank = { code: '', name: '', type: 'Theory', credits: 3, year: defaultYear, term: defaultTerm, status: 'active', isCore: true, notes: '', chapters: [] };
  const [f, setF] = useState(initial || blank);
  const [newChapter, setNewChapter] = useState('');
  // Chapters used to default to collapsed (only one open at a time, via a
  // single expandedChapter index) — it wasn't obvious there was anything
  // to expand at all. Now every chapter starts open, and each can be
  // toggled independently, so the syllabus reads as "all visible" by
  // default instead of hiding content behind an unclear arrow.
  const [expandedChapters, setExpandedChapters] = useState(() => {
    const initialChapters = (initial || blank).chapters || [];
    return new Set(initialChapters.map((_, i) => i));
  });
  const [newSubtopic, setNewSubtopic] = useState({});
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  
  const addChapter = () => {
    if (newChapter.trim()) {
      setF(p => {
        const nextChapters = [...(p.chapters || []), { chapter: newChapter, subtopics: [] }];
        // New chapter opens expanded too, matching the always-open default.
        setExpandedChapters(prev => new Set(prev).add(nextChapters.length - 1));
        return { ...p, chapters: nextChapters };
      });
      setNewChapter('');
    }
  };
  
  const removeChapter = (idx) => {
    setF(p => ({ ...p, chapters: p.chapters.filter((_, i) => i !== idx) }));
    setExpandedChapters(prev => {
      const next = new Set();
      prev.forEach(i => {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      });
      return next;
    });
  };

  const toggleChapter = (idx) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
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
       <div className="form-row form-row-2">
         <div><label>Year</label><select value={f.year} onChange={e => set('year', +e.target.value)}>{YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}</select></div>
         <div><label>Term</label><select value={f.term} onChange={e => set('term', +e.target.value)}><option value={1}>Term 1</option><option value={2}>Term 2</option></select></div>
       </div>
      
      {/* Chapters/Syllabus */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Course Syllabus (Optional)</label>
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
                    onClick={() => toggleChapter(chapIdx)}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: expandedChapters.has(chapIdx) ? 'rgba(139,92,246,0.08)' : 'var(--surface)',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span>{expandedChapters.has(chapIdx) ? '▼' : '▶'}</span>
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
                  {expandedChapters.has(chapIdx) && (
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedTerms, setExpandedTerms] = useState(() => {
    const k = profile?.currentTermKey || '';
    return k ? { [k]: true } : {};
  });

  const courses = useMemo(() => getAllCourses(profile), [profile.dept, profile.currentTermKey, version]);
  const customCourses = useMemo(() => getCustomCourses(), [version]);
  const optionalCatalog = getDeptOptionalCourses(profile.dept);
  const [settings, setSettings] = useState(() => store.get('scheduleSettings') || {});
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '' });
  const [teacherInfoState, setTeacherInfoState] = useState({ open: false, courseId: '', teacherName: '', teacher: null });
  const teacherInfoTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (teacherInfoTimerRef.current) {
        clearTimeout(teacherInfoTimerRef.current);
      }
    };
  }, []);

  const getTeacherInfo = (name) => {
    const teachers = store.get('teachers') || [];
    return teachers.find(t => normalizeTeacherName(t.name) === normalizeTeacherName(name)) || null;
  };

  const openTeacherInfo = (courseId, teacherName) => {
    const teacher = getTeacherInfo(teacherName);
    setTeacherInfoState({ open: true, courseId, teacherName, teacher });
  };

  const closeTeacherInfo = () => setTeacherInfoState(prev => ({ ...prev, open: false }));

  const handleTeacherChipClick = (courseId, teacherName) => {
    if (teacherInfoTimerRef.current) {
      clearTimeout(teacherInfoTimerRef.current);
      teacherInfoTimerRef.current = null;
      return;
    }
    teacherInfoTimerRef.current = window.setTimeout(() => {
      openTeacherInfo(courseId, teacherName);
      teacherInfoTimerRef.current = null;
    }, 280);
  };

  const handleTeacherChipDoubleClick = (courseId) => {
    if (teacherInfoTimerRef.current) {
      clearTimeout(teacherInfoTimerRef.current);
      teacherInfoTimerRef.current = null;
    }
    setTeacherInfoState(prev => ({ ...prev, open: false }));
    openTeacherDialog(courseId);
  };

  const toggleTerm = (key) => setExpandedTerms(p => ({ ...p, [key]: !p[key] }));
  const viewCourseSyllabus = (id) => {
    // Passed as route state (not store.set) on purpose: this used to write
    // to the persistent store, whose IndexedDB delete on the Syllabus page
    // runs async/fire-and-forget (removeFromDB(...).catch(...) with no
    // await). If the user navigated away again before that delete
    // finished, the stale value could survive in IndexedDB and get
    // reloaded into memoryCache on the next store init — reproducing the
    // "still shows just one course" bug even after it looked cleared.
    // Route state has no such race: React Router owns its lifecycle and
    // it's gone the moment you leave the route by any means other than
    // forward/back through this exact history entry.
    navigate('/syllabus', { state: { selectedSyllabusCourseId: id } });
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

  const normalizeTeacherName = (value) => {
    const clean = String(value || '').trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
  };

  const normalizeTeacherList = (teachers = []) => {
    return [...new Set((teachers || [])
      .map(normalizeTeacherName)
      .filter(Boolean))].slice(0, 2);
  };

  const getCourseTeachers = (courseId) => {
    return Array.isArray(settings?.courseTeacherMap?.[courseId]) ? settings.courseTeacherMap[courseId] : [];
  };

  const openTeacherDialog = (courseId) => setCourseTeacherDialogState({ open: true, courseId });
  const handleCourseTeacherDialogClose = () => setCourseTeacherDialogState({ open: false, courseId: '' });

  const handleCourseTeacherDialogSave = (teachers) => {
    const courseId = courseTeacherDialogState.courseId;
    if (!courseId) return;
    const normalizedTeachers = normalizeTeacherList(teachers);
    if (normalizedTeachers.length < 2) return;

    const nextSettings = { ...(settings || {}), courseTeacherMap: { ...(settings.courseTeacherMap || {}), [courseId]: normalizedTeachers } };
    store.set('scheduleSettings', nextSettings);
    setSettings(nextSettings);

    const existingTeachers = store.get('teachers') || [];
    const existingNames = new Set(existingTeachers.map(t => t.name));
    const newTeachers = normalizedTeachers
      .filter(name => !existingNames.has(name))
      .map(name => ({
        id: uid(),
        name,
        initial: name.split(/\s+/).map(part => part[0].toUpperCase()).join(''),
        title: '',
        dept: profile?.dept || '',
        phone: '',
        email: '',
        courses: '',
        officeRoom: '',
        rating: '',
        notes: 'Auto-added from course page',
      }));

    if (newTeachers.length > 0) {
      store.set('teachers', [...existingTeachers, ...newTeachers]);
    }

    handleCourseTeacherDialogClose();
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
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <BookOpen size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Courses</h1>
          </div>
          <p className="content-page-hero-subtitle">{courses.length} courses loaded</p>
        </div>
        {!addingCustom && (
          <div className="content-page-hero-actions">
            <button className="btn btn-primary" onClick={() => { setAddingCustom(true); setEditingCustom(null); }}><Plus size={14} /> <span className="btn-txt">Add Custom Course</span></button>
          </div>
        )}
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

      {teacherInfoState.open && (
        <div
          style={{
            position: 'fixed',
            top: 92,
            right: 18,
            zIndex: 1100,
            width: 'min(360px, calc(100vw - 32px))',
            maxWidth: 360,
          }}
          onClick={closeTeacherInfo}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              padding: 18,
              border: '1px solid var(--border)',
              borderRadius: 18,
              boxShadow: '0 22px 56px rgba(15, 23, 42, 0.16)',
              background: 'var(--surface)',
              minWidth: 0,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(59,130,246,0.12)', display: 'grid', placeItems: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>
                {teacherInfoState.teacher?.initial || (teacherInfoState.teacherName || '?').slice(0, 1)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, lineHeight: 1.25 }}>{teacherInfoState.teacher?.name || teacherInfoState.teacherName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                  {teacherInfoState.teacher?.title || 'Teacher information preview'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeTeacherInfo}
                style={{ padding: '6px 10px', minWidth: 'auto', fontSize: 14, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            {teacherInfoState.teacher ? (
              <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Dept</span>
                  <span>{teacherInfoState.teacher.dept || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Courses</span>
                  <span>{teacherInfoState.teacher.courses || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Office</span>
                  <span>{teacherInfoState.teacher.officeRoom || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Phone</span>
                  <span>{teacherInfoState.teacher.phone || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Email</span>
                  <span>{teacherInfoState.teacher.email || '—'}</span>
                </div>
                {teacherInfoState.teacher.rating && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)' }}>Rating</span>
                    <span>{'★'.repeat(+teacherInfoState.teacher.rating)}{'☆'.repeat(5 - +teacherInfoState.teacher.rating)}</span>
                  </div>
                )}
                {teacherInfoState.teacher.notes && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 14, background: 'rgba(59,130,246,0.08)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {teacherInfoState.teacher.notes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                No teacher card exists yet for <strong>{teacherInfoState.teacherName}</strong>.
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-secondary" type="button" onClick={() => { closeTeacherInfo(); navigate('/teachers'); }} style={{ padding: '6px 10px', fontSize: 12 }}>
                    Open Teachers page
                  </button>
                  <button className="btn btn-sm btn-ghost" type="button" onClick={() => { closeTeacherInfo(); openTeacherDialog(teacherInfoState.courseId); }} style={{ padding: '6px 10px', fontSize: 12 }}>
                    Edit course teachers
                  </button>
                </div>
              </div>
            )}
          </div>
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
              {g.items.map(c => {
                const courseTeachers = getCourseTeachers(c.id);
                const hasTeachers = courseTeachers.length > 0;

                return (
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
                      {`Y${c.year}T${c.term}` === profile.currentTermKey && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
                          {hasTeachers ? (
                            courseTeachers.map((teacher, index) => (
                              <span
                                key={index}
                                className={getTeacherChipClass(teacher)}
                                style={{ ...CHIP_STYLE, fontSize: 11, cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); handleTeacherChipClick(c.id, teacher); }}
                                onDoubleClick={(e) => { e.stopPropagation(); handleTeacherChipDoubleClick(c.id); }}
                                title="Single click to preview teacher info, double click to edit"
                              >
                                {teacher}
                              </span>
                            ))
                          ) : (
                            <span className="tag tag-muted" style={{ ...CHIP_STYLE, fontSize: 11, color: 'var(--muted)' }}>No teachers set</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 110, width: 110, alignItems: 'flex-end' }}>
                      {c.isOptional && <select value={c.optionalCode || ''} onChange={e => updateOptional(c, e.target.value)} style={{ fontSize: 13, padding: 6 }}><option value="">Select</option>{optionalCatalog.map(opt => <option key={opt.code} value={opt.code}>{opt.code} — {opt.title}</option>)}</select>}
                      {!hasTeachers && `Y${c.year}T${c.term}` === profile.currentTermKey && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openTeacherDialog(c.id)} style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, minWidth: 98, justifyContent: 'center' }}>
                          <BookOpen size={12} />
                          Add
                        </button>
                      )}
                      <StatusChip course={c} onChange={newStatus => updateOverride(c.id, { status: newStatus })} />
                    </div>
                  </div>
                );
              })}
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
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingCustom(c.id)} title="Edit"><Pencil size={14} color="var(--muted)" /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(c.id)} title="Delete"><Trash2 size={14} color="var(--danger)" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete custom course?"
        message="This will permanently remove the custom course from your local list."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={() => {
          setCustomCourses(customCourses.filter(x => x.id !== deleteTarget));
          setVersion(v => v + 1);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <CourseTeacherDialog
        isOpen={courseTeacherDialogState.open}
        onClose={handleCourseTeacherDialogClose}
        course={courses.find(course => course.id === courseTeacherDialogState.courseId)}
        currentTeachers={getCourseTeachers(courseTeacherDialogState.courseId)}
        onSave={handleCourseTeacherDialogSave}
        requireTwoTeachers={true}
      />

      {courses.length === 0 && !addingCustom && (
        <div className="empty-state">
          <div className="icon"><BookOpen size={28} color="var(--muted)" /></div>
          <p style={{ marginBottom: 16 }}>Select department and term in Profile to load courses.</p>
        </div>
      )}
    </div>
  );
}