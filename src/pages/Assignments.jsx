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

  const pendingCount = items.filter(a => a.status !== 'done').length;
  const doneCount = items.filter(a => a.status === 'done').length;

  return (
    <div className="page-enter assignments-page">
      <div className="assignments-hero">
        <div className="page-container assignments-hero-inner">
          <div className="assignments-hero-copy">
            <div className="assignments-kicker">Academic planner</div>
            <h1 className="assignments-title">Assignments</h1>
            <p className="assignments-subtitle">Track coursework, deadlines, and completion status in one clean view.</p>

            <div className="assignments-stats">
              <div className="assignments-stat assignments-stat-pending">
                <span className="assignments-stat-icon">📋</span>
                <div>
                  <div className="assignments-stat-label">Pending</div>
                  <div className="assignments-stat-value">{pendingCount}</div>
                </div>
              </div>
              <div className="assignments-stat assignments-stat-done">
                <span className="assignments-stat-icon">✓</span>
                <div>
                  <div className="assignments-stat-label">Completed</div>
                  <div className="assignments-stat-value">{doneCount}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="assignments-hero-actions">
            <button className="btn btn-primary assignments-add-btn" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add Assignment
            </button>
          </div>
        </div>
      </div>

      <div className="page-container assignments-content">
        {/* Add Form */}
        {adding && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)', borderWidth: 2, boxShadow: '0 4px 16px rgba(22,163,74,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>➕</span>
                Add New Assignment
              </div>
              <button className="btn btn-ghost" onClick={() => { setAdding(false); setForm({ courseId: '', teacherName: '', titles: [''], title: '', desc: '', due: '', status: 'pending', priority: 'medium' }); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600 }}>Cancel</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Course</label>
                <select value={form.courseId} onChange={e => handleCourseChange(e.target.value)} style={{ minHeight: 42 }}>
                  <option value="">Select course</option>
                  {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ minHeight: 42 }}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              {form.titles.map((title, index) => (
                <div key={index} style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{index === 0 ? 'Assignment Title' : `Title ${index + 1}`}</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                    <input value={title} onChange={e => setTitleLine(index, e.target.value)} placeholder={index === 0 ? 'Lab Report #3 — Linked List' : `Another title`} style={{ flex: 1, minHeight: 42, borderRadius: 10, fontFamily: 'inherit' }} />
                    {form.titles.length > 1 && (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => removeTitleLine(index)} style={{ whiteSpace: 'nowrap', minHeight: 42 }}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost" onClick={addTitleLine} style={{ height: 40, fontSize: 12, justifyContent: 'center', fontWeight: 600 }}>+ Add another title</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Teacher</label>
                <select value={form.teacherName} onChange={e => set('teacherName', e.target.value)} disabled={!form.courseId || getCourseTeachers(form.courseId).length === 0} style={{ minHeight: 42 }}>
                  <option value="">Select teacher</option>
                  {getCourseTeachers(form.courseId).map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => form.courseId && setTeacherDialog({ open: true, courseId: form.courseId })} disabled={!form.courseId} style={{ height: 42, fontSize: 12, fontWeight: 600 }}>
                {!form.courseId ? 'Course First' : getCourseTeachers(form.courseId).length >= 2 ? 'Edit' : 'Add'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Due Date</label>
                <input type="date" value={form.due} onChange={e => set('due', e.target.value)} style={{ minHeight: 42 }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Details</label>
              <textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} placeholder="Topics, requirements..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-primary" onClick={add} style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700 }}>Save Assignment</button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="assignments-filters">
          {['all', 'pending', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '10px 18px', borderRadius: 10, border: filter === f ? 'none' : '1.5px solid var(--border)',
              background: filter === f ? 'linear-gradient(135deg, var(--accent) 0%, rgb(34,197,94) 100%)' : 'transparent',
              color: filter === f ? 'white' : 'var(--text)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700,
              transition: 'all 0.25s ease',
              boxShadow: filter === f ? '0 4px 12px rgba(22,163,74,0.25)' : 'none',
            }}>
              {f === 'all' ? '📋 All' : f === 'pending' ? '⏳ Pending' : '✅ Done'}
            </button>
          ))}
        </div>

        {/* Assignment Grid */}
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {filtered.map(a => {
            const c = getCourse(a.courseId);
            const teacherLabel = a.teacherName || getCourseTeachers(a.courseId)[0] || 'Not set';
            const overdue = a.status !== 'done' && isOverdue(a.due);
            const daysLeft = getDaysLeft(a.due);
            const courseColor = getCourseColor(a.courseId);
            const assignmentTitles = Array.isArray(a.titles) ? a.titles.filter(Boolean) : [a.title].filter(Boolean);
            
            // Priority styling
            const priorityConfig = {
              high: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', icon: '🔴', border: 'rgba(220,38,38,0.2)' },
              medium: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)', icon: '🟡', border: 'rgba(234,88,12,0.2)' },
              low: { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icon: '⚪', border: 'rgba(107,114,128,0.2)' },
            };
            const priority = priorityConfig[a.priority] || priorityConfig.medium;

            // Due date indicator
            let dueBadgeText = '';
            let dueBadgeColor = '';
            if (overdue) { dueBadgeText = '⚠️ Overdue'; dueBadgeColor = '#dc2626'; }
            else if (daysLeft === 0) { dueBadgeText = '🔔 Due today'; dueBadgeColor = '#ea580c'; }
            else if (daysLeft === 1) { dueBadgeText = '⏰ Due tomorrow'; dueBadgeColor = '#ea580c'; }
            else if (daysLeft <= 3) { dueBadgeText = `⏳ ${daysLeft} days left`; dueBadgeColor = '#f59e0b'; }
            else if (daysLeft <= 7) { dueBadgeText = `📅 ${daysLeft} days left`; dueBadgeColor = '#10b981'; }
            else { dueBadgeText = `📆 ${a.due}`; dueBadgeColor = 'var(--muted)'; }
            
            return (
              <div key={a.id} style={{
                padding: 16,
                borderRadius: 14,
                background: a.status === 'done' ? 'rgba(107,114,128,0.04)' : 'var(--surface)',
                border: a.status === 'done' ? '1px solid rgba(107,114,128,0.08)' : `1px solid ${priority.border}`,
                borderLeft: a.status === 'done' ? '4px solid rgba(107,114,128,0.2)' : `4px solid ${priority.color}`,
                opacity: a.status === 'done' ? 0.75 : 1,
                transition: 'all 0.2s ease',
                cursor: 'default',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 14,
                alignItems: 'start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {/* Checkbox */}
                <button onClick={() => toggle(a.id)} style={{
                  width: 24, height: 24, borderRadius: 6, border: `2.5px solid ${a.status === 'done' ? 'var(--accent)' : priority.color}`,
                  background: a.status === 'done' ? 'var(--accent)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
                }}>
                  {a.status === 'done' && <Check size={14} color="white" />}
                </button>

                {/* Main Content */}
                <div style={{ display: 'grid', gap: 9 }}>
                  {/* Title Row with Badge */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {c && (
                      <div style={{
                        padding: '5px 11px', borderRadius: 7, background: courseColor.bg, border: `1.5px solid ${courseColor.border}`,
                        color: courseColor.text, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                        marginTop: 2
                      }}>
                        {c.code}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      {assignmentTitles.map((text, idx) => (
                        <div key={idx} style={{
                          fontWeight: idx === 0 ? 800 : 700,
                          fontSize: idx === 0 ? 15 : 13,
                          textDecoration: a.status === 'done' ? 'line-through' : 'none',
                          color: a.status === 'done' ? 'var(--muted)' : 'var(--text)',
                          lineHeight: 1.4,
                        }}>
                          {text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meta Row: Priority, Teacher, Due Date */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
                    {/* Priority Badge */}
                    <span style={{
                      padding: '5px 9px', borderRadius: 6, background: priority.bg, color: priority.color,
                      fontWeight: 800, whiteSpace: 'nowrap', fontSize: 10, display: 'flex', alignItems: 'center', gap: 5
                    }}>
                      {priority.icon} {a.priority.toUpperCase()}
                    </span>

                    {/* Teacher Label */}
                    <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      👨‍🏫 {teacherLabel}
                    </span>

                    {/* Due Date Badge */}
                    {a.due && (
                      <span style={{
                        padding: '5px 9px', borderRadius: 6, background: `${dueBadgeColor}12`, color: dueBadgeColor,
                        fontWeight: 800, whiteSpace: 'nowrap', fontSize: 10, display: 'flex', alignItems: 'center', gap: 5
                      }}>
                        {dueBadgeText}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {a.desc && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 2 }}>{a.desc}</div>}
                </div>

                {/* Delete Button */}
                <button className="btn btn-ghost" style={{ padding: '7px 9px', minWidth: 0 }} onClick={() => del(a.id)} title="Delete">
                  <Trash2 size={15} color="var(--danger)" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && !adding && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{filter === 'done' ? '✅' : filter === 'pending' ? '⏳' : '📚'}</div>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              {filter === 'done' ? 'No completed assignments yet' : filter === 'pending' ? 'All assignments done! 🎉' : 'No assignments yet'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {filter !== 'all' && `Try viewing "${['all', 'pending', 'done'][['all', 'pending', 'done'].indexOf(filter)]}" tab`}
            </p>
          </div>
        )}
      </div>

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
