import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey } from '../store/store';
import CourseTeacherDialog from '../components/CourseTeacherDialog';

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

export default function TermQS() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  
  // Filter courses to show only current term courses
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(() => {
    if (!currentTermKey) return courses;
    const match = currentTermKey.match(/Y(\d)T(\d)/);
    if (!match) return courses;
    const [, year, term] = match.map(Number);
    return courses.filter(c => c.year === year && c.term === term);
  }, [courses, currentTermKey]);
  
  const [items, setItems] = useState(() => store.get('term-qs') || []);
  const [scheduleSettings, setScheduleSettings] = useState(() => store.get('scheduleSettings') || {});
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ 
    courseId: '', 
    teacherName: '', 
    title: '', 
    desc: '', 
    year: '',
    status: 'pending', 
    priority: 'medium',
    questionCount: '',
    link: ''
  });
  const [teacherDialog, setTeacherDialog] = useState({ open: false, courseId: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    if (!form.courseId || !form.title || !form.year) {
      alert('Please fill in Course, Title, and Year fields.');
      return;
    }
    const teachers = getCourseTeachers(form.courseId);
    if (teachers.length < 2) {
      ensureCourseTeacherSetup(form.courseId);
      return;
    }

    const selectedTeacher = normalizeTeacherName(form.teacherName);
    if (!selectedTeacher) {
      alert('Please select a teacher.');
      return;
    }

    const item = {
      ...form,
      teacherName: selectedTeacher,
      id: uid(),
    };

    const updated = [item, ...items];
    setItems(updated);
    store.set('term-qs', updated);
    setForm({
      courseId: '',
      teacherName: '',
      title: '',
      desc: '',
      year: '',
      status: 'pending',
      priority: 'medium',
      questionCount: '',
      link: ''
    });
  };

  const toggle = (id) => {
    const updated = items.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'pending' : 'done' } : a);
    setItems(updated); 
    store.set('term-qs', updated);
  };

  const del = (id) => { 
    const u = items.filter(a => a.id !== id); 
    setItems(u); 
    store.set('term-qs', u); 
  };

  const getCourse = (id) => courses.find(c => c.id === id);

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

  const filtered = items.filter(a => filter === 'all' ? true : filter === 'pending' ? a.status !== 'done' : a.status === 'done');

  const pendingCount = items.filter(a => a.status !== 'done').length;
  const doneCount = items.filter(a => a.status === 'done').length;

  return (
    <div className="page-enter assignments-page">
      <div className="assignments-hero">
        <div className="page-container assignments-hero-inner">
          <div className="assignments-hero-copy">
            <div className="assignments-kicker">Exam Preparation</div>
            <h1 className="assignments-title">Term Question & Solution</h1>
            <p className="assignments-subtitle">Collect and organize term questions and solutions for each course.</p>

            <div className="assignments-stats">
              <div className="assignments-stat assignments-stat-pending">
                <span className="assignments-stat-icon">📝</span>
                <div>
                  <div className="assignments-stat-label">Total Items</div>
                  <div className="assignments-stat-value">{items.length}</div>
                </div>
              </div>
              <div className="assignments-stat assignments-stat-done">
                <span className="assignments-stat-icon">✓</span>
                <div>
                  <div className="assignments-stat-label">Reviewed</div>
                  <div className="assignments-stat-value">{doneCount}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="assignments-hero-actions">
            <button className="btn btn-primary assignments-add-btn" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Add Q&S
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
                Add New Q&S Set
              </div>
              <button className="btn btn-ghost" onClick={() => { setAdding(false); setForm({ courseId: '', teacherName: '', title: '', desc: '', year: '', status: 'pending', priority: 'medium', questionCount: '', link: '' }); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600 }}>Cancel</button>
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
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Year</label>
                <select value={form.year} onChange={e => set('year', e.target.value)} style={{ minHeight: 42 }}>
                  <option value="">Select year</option>
                  <option value="Y1">Year 1</option>
                  <option value="Y2">Year 2</option>
                  <option value="Y3">Year 3</option>
                  <option value="Y4">Year 4</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Title/Label</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g., Term 1 2024, Final Exam Set, Midterm Q&S" style={{ minHeight: 42, borderRadius: 10, fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Question Count</label>
                <input type="number" value={form.questionCount} onChange={e => set('questionCount', e.target.value)} placeholder="e.g., 10, 20" style={{ minHeight: 42 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Link/File</label>
                <input value={form.link} onChange={e => set('link', e.target.value)} placeholder="Drive link, PDF file..." style={{ minHeight: 42 }} />
              </div>
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
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text)' }}>Notes</label>
              <textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} placeholder="Additional notes or details..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-primary" onClick={add} style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700 }}>Save Q&S</button>
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
              {f === 'all' ? '📝 All' : f === 'pending' ? '⏳ Pending' : '✅ Reviewed'}
            </button>
          ))}
        </div>

        {/* Q&S Grid */}
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {filtered.map(item => {
            const c = getCourse(item.courseId);
            const teacherLabel = item.teacherName || getCourseTeachers(item.courseId)[0] || 'Not set';
            const courseColor = getCourseColor(item.courseId);
            
            return (
              <div key={item.id} style={{
                padding: 16,
                borderRadius: 14,
                background: item.status === 'done' ? 'rgba(107,114,128,0.04)' : 'var(--surface)',
                border: item.status === 'done' ? '1px solid rgba(107,114,128,0.08)' : '1px solid rgba(59,130,246,0.2)',
                borderLeft: item.status === 'done' ? '4px solid rgba(107,114,128,0.2)' : '4px solid rgb(59,130,246)',
                opacity: item.status === 'done' ? 0.75 : 1,
                transition: 'all 0.2s ease',
                cursor: 'default',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 14,
                alignItems: 'start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {/* Checkbox */}
                <button onClick={() => toggle(item.id)} style={{
                  width: 24, height: 24, borderRadius: 6, border: `2.5px solid ${item.status === 'done' ? 'var(--accent)' : 'rgb(59,130,246)'}`,
                  background: item.status === 'done' ? 'var(--accent)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
                }}>
                  {item.status === 'done' && <Check size={14} color="white" />}
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
                      <div style={{
                        fontWeight: 800,
                        fontSize: 15,
                        textDecoration: item.status === 'done' ? 'line-through' : 'none',
                        color: item.status === 'done' ? 'var(--muted)' : 'var(--text)',
                        lineHeight: 1.4,
                      }}>
                        {item.title}
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>📅 {item.year}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👨‍🏫 {teacherLabel}</span>
                    {item.questionCount && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>❓ {item.questionCount} questions</span>}
                  </div>

                  {/* Description */}
                  {item.desc && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 4 }}>
                      {item.desc}
                    </div>
                  )}

                  {/* Link */}
                  {item.link && (
                    <div style={{ marginTop: 8 }}>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none',
                        padding: '6px 10px', background: 'rgba(22,163,74,0.1)', borderRadius: 6,
                        display: 'inline-block', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(22,163,74,0.2)'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(22,163,74,0.1)'}
                      >
                        🔗 Open link
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <button onClick={() => del(item.id)} style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
                  color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.color = '#dc2626'}
                onMouseLeave={(e) => e.target.style.color = 'var(--muted)'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
            <p>No Q&S items found. {items.length > 0 && filter !== 'all' ? 'Change filter to see more.' : 'Start by adding your first Q&S set.'}</p>
          </div>
        )}
      </div>

      {teacherDialog.open && (
        <CourseTeacherDialog 
          courseId={teacherDialog.courseId} 
          onClose={() => setTeacherDialog({ open: false, courseId: '' })}
        />
      )}
    </div>
  );
}
