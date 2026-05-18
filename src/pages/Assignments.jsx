import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey } from '../store/store';
import CourseTeacherDialog from '../components/CourseTeacherDialog';

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

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
  const [scheduleSettings, setScheduleSettings] = useState(() => store.get('scheduleSettings') || {});
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ courseId: '', teacherName: '', titles: [''], title: '', desc: '', due: '', status: 'pending', priority: 'medium' });
  const [teacherDialog, setTeacherDialog] = useState({ open: false, courseId: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setTitleLine = (index, value) => setForm(f => ({
    ...f,
    titles: f.titles.map((t, idx) => idx === index ? value : t),
  }));
  const addTitleLine = () => setForm(f => ({ ...f, titles: [...(f.titles || ['']), ''] }));
  const removeTitleLine = (index) => setForm(f => ({
    ...f,
    titles: f.titles.filter((_, idx) => idx !== index) || [''],
  }));

  useEffect(() => {
    const refresh = () => setScheduleSettings(store.get('scheduleSettings') || {});
    window.addEventListener('kuetx:store-updated', refresh);
    return () => window.removeEventListener('kuetx:store-updated', refresh);
  }, []);

  const courseTeacherMap = scheduleSettings?.courseTeacherMap || {};

  const getCourseTeachers = (courseId) => {
    const mapped = Array.isArray(courseTeacherMap?.[courseId]) ? courseTeacherMap[courseId].map(normalizeTeacherName).filter(Boolean) : [];
    return [...new Set(mapped)].slice(0, 2);
  };

  const ensureCourseTeacherSetup = (courseId) => {
    const teachers = getCourseTeachers(courseId);
    if (teachers.length >= 2) return true;
    setTeacherDialog({ open: true, courseId });
    return false;
  };

  const handleCourseChange = (courseId) => {
    const teachers = getCourseTeachers(courseId);
    setForm(prev => ({
      ...prev,
      courseId,
      teacherName: teachers[0] || '',
    }));
    if (courseId) ensureCourseTeacherSetup(courseId);
  };

  const add = () => {
    if (!form.courseId) return;
    const teachers = getCourseTeachers(form.courseId);
    if (teachers.length < 2) {
      ensureCourseTeacherSetup(form.courseId);
      return;
    }

    const selectedTeacher = normalizeTeacherName(form.teacherName);
    if (!selectedTeacher) {
      alert('Please select a teacher for this assignment course.');
      return;
    }

    const titles = (form.titles || [])
      .map(line => String(line || '').trim())
      .filter(Boolean);

    if (titles.length === 0) {
      alert('Please enter at least one assignment title.');
      return;
    }

    const assignment = {
      ...form,
      titles,
      title: titles[0],
      teacherName: selectedTeacher,
      id: uid(),
    };

    const updated = [assignment, ...items];
    setItems(updated);
    store.set('assignments', updated);
    setForm({
      courseId: form.courseId,
      teacherName: form.teacherName,
      titles: [''],
      title: '',
      desc: form.desc,
      due: form.due,
      status: 'pending',
      priority: form.priority,
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
            <div style={{ fontWeight: 600, fontSize: 13 }}>Add Assignment</div>
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setForm({ courseId: '', teacherName: '', titles: [''], title: '', desc: '', due: '', status: 'pending', priority: 'medium' }); }} style={{ padding: '4px 8px' }}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => handleCourseChange(e.target.value)}>
                <option value="">Select course</option>
                {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
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
          <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
            {form.titles.map((title, index) => (
              <div key={index} style={{ display: 'grid', gap: 6 }}>
                <label>{index === 0 ? 'Assignment Title' : `Title ${index + 1}`}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <input
                    value={title}
                    onChange={e => setTitleLine(index, e.target.value)}
                    placeholder={index === 0 ? 'Lab Report #3 — Linked List' : `Another title`}
                    style={{ flex: 1, minHeight: 44, borderRadius: 10, fontFamily: 'inherit' }}
                  />
                  {form.titles.length > 1 && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeTitleLine(index)} style={{ whiteSpace: 'nowrap', minHeight: 44 }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost" onClick={addTitleLine} style={{ height: 40 }}>
                + Add title
              </button>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Add another title row here. Save when you are done to keep them as one assignment group.
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 10 }}>
            <div>
              <label>Teacher</label>
              <select
                value={form.teacherName}
                onChange={e => set('teacherName', e.target.value)}
                disabled={!form.courseId || getCourseTeachers(form.courseId).length === 0}
              >
                <option value="">Select teacher</option>
                {getCourseTeachers(form.courseId).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => form.courseId && setTeacherDialog({ open: true, courseId: form.courseId })}
                disabled={!form.courseId}
                style={{ height: 44 }}
              >
                {!form.courseId ? 'Select Course First' : getCourseTeachers(form.courseId).length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
              </button>
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--muted)' }}>
              {form.courseId ? 'You can update teacher assignments here.' : 'Select a course to enable teacher setup.'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Due Date</label>
              <input type="date" value={form.due} onChange={e => set('due', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Details</label>
            <textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} placeholder="Topics, requirements..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-primary" onClick={add}>Save assignment</button>
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
        const teacherLabel = a.teacherName || getCourseTeachers(a.courseId)[0] || 'Teacher not set';
        const overdue = a.status !== 'done' && isOverdue(a.due);
        const daysLeft = getDaysLeft(a.due);
        const courseColor = getCourseColor(a.courseId);
        const priorityBg = a.priority === 'high' ? 'rgba(239,68,68,0.1)' : a.priority === 'medium' ? 'rgba(249,115,22,0.1)' : 'rgba(107,114,128,0.1)';
        const priorityColor = a.priority === 'high' ? 'rgb(239,68,68)' : a.priority === 'medium' ? 'rgb(249,115,22)' : 'rgb(107,114,128)';
        const assignmentTitles = Array.isArray(a.titles) ? a.titles.filter(Boolean) : [a.title].filter(Boolean);
        
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
                  <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                    {assignmentTitles.map((text, idx) => (
                      <span key={idx} style={{
                        fontWeight: idx === 0 ? 600 : 500,
                        fontSize: idx === 0 ? 13 : 12,
                        textDecoration: a.status === 'done' ? 'line-through' : 'none',
                        color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {text}
                      </span>
                    ))}
                  </div>
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

                <div style={{ fontSize: 11, color: 'var(--text)', opacity: 0.85, marginBottom: 4 }}>
                  Teacher: {teacherLabel}
                </div>
                
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

      <CourseTeacherDialog
        isOpen={teacherDialog.open}
        onClose={() => setTeacherDialog({ open: false, courseId: '' })}
        course={getCourse(teacherDialog.courseId)}
        currentTeachers={getCourseTeachers(teacherDialog.courseId)}
        onSave={(teachers) => {
          const normalizedTeachers = [...new Set((teachers || []).map(normalizeTeacherName).filter(Boolean))].slice(0, 2);
          const next = { ...(scheduleSettings || {}), courseTeacherMap: { ...(scheduleSettings?.courseTeacherMap || {}), [teacherDialog.courseId]: normalizedTeachers } };
          store.set('scheduleSettings', next);
          setScheduleSettings(next);
          setForm(prev => ({ ...prev, courseId: teacherDialog.courseId, teacherName: prev.teacherName || normalizedTeachers[0] || '' }));
          setTeacherDialog({ open: false, courseId: '' });
        }}
        allTeachers={Object.values(courseTeacherMap || {}).flat().map(normalizeTeacherName).filter(Boolean)}
        requireTwoTeachers
      />
    </div>
  );
}
