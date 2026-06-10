import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play, Pause, Square, RotateCcw, Save, ChevronDown } from 'lucide-react';
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
export function Tours() {
  const [tours, setTours] = useState(() => store.get('tours') || []);
  const [form, setForm] = useState({ name: '', date: '', companions: '', budget: '', spent: '', notes: '', type: 'with_friends', outline: [] });
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addOutlineSection = () => setForm(f => ({ ...f, outline: [...f.outline, { title: '', topics: [''] }] }));
  const updateOutlineTitle = (index, title) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === index ? { ...s, title } : s) }));
  const updateOutlineTopic = (si, ti, value) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === si ? { ...s, topics: s.topics.map((t, j) => j === ti ? value : t) } : s) }));
  const addOutlineTopic = (index) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === index ? { ...s, topics: [...s.topics, ''] } : s) }));
  const removeOutlineSection = (index) => setForm(f => ({ ...f, outline: f.outline.filter((_, i) => i !== index) }));
  const removeOutlineTopic = (si, ti) => setForm(f => ({ ...f, outline: f.outline.map((s, i) => i === si ? { ...s, topics: s.topics.filter((_, j) => j !== ti) } : s) }));

  const save = () => {
    const u = [{ ...form, id: uid() }, ...tours];
    setTours(u); store.set('tours', u); setAdding(false);
    setForm({ name: '', date: '', companions: '', budget: '', spent: '', notes: '', type: 'with_friends', outline: [] });
  };

  return (
    <div className="page-enter page-container">
      <div className="tours-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tours</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Plan, track and remember your trips</p>
        </div>
        <button className="btn btn-primary tours-add-btn" onClick={() => setAdding(true)}><Plus size={13} /> Add Tour</button>
      </div>

      {adding && (
        <div className="card tours-form-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add Tour</div>
          <div className="tours-form-grid tours-form-grid-top">
            <div className="tours-form-field tours-form-wide"><label>Tour / Destination</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Cox's Bazar trip" /></div>
            <div className="tours-form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="tours-form-field">
              <label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="solo">Solo</option>
                <option value="with_friends">With Friends</option>
                <option value="family">Family</option>
                <option value="department">Dept. Tour</option>
              </select>
            </div>
          </div>
          <div className="tours-form-grid tours-form-grid-mid">
            <div className="tours-form-field"><label>Companions</label><input value={form.companions} onChange={e => set('companions', e.target.value)} placeholder="Rahim, Karim..." /></div>
            <div className="tours-form-field"><label>Budget (৳)</label><input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} /></div>
            <div className="tours-form-field"><label>Actual Spent (৳)</label><input type="number" value={form.spent} onChange={e => set('spent', e.target.value)} /></div>
          </div>
          <div className="tours-form-field tours-form-wide" style={{ marginBottom: 10 }}><label>Tour Description</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Short summary: best moments, tips, highlights..." /></div>

          <div className="tours-outline-card">
            <div className="tours-outline-header">
              <div style={{ fontWeight: 700, fontSize: 13 }}>Trip Outline</div>
              <button className="btn btn-ghost tours-outline-add-section" onClick={addOutlineSection}>Add section</button>
            </div>
            {form.outline.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add chapters, stops, activities or topic groups to structure the trip plan.</div>
            )}
            {form.outline.map((section, si) => (
              <div key={si} className="tours-outline-section">
                <div className="tours-outline-section-row">
                  <input
                    value={section.title}
                    onChange={e => updateOutlineTitle(si, e.target.value)}
                    placeholder={`Chapter ${si + 1} title`}
                    className="tours-outline-section-title"
                  />
                  <button className="btn btn-danger tours-outline-remove-section" onClick={() => removeOutlineSection(si)}>Remove</button>
                </div>
                {section.topics.map((topic, ti) => (
                  <div key={ti} className="tours-outline-item-row">
                    <span className="tours-outline-item-index">{si + 1}.{ti + 1}</span>
                    <input
                      value={topic}
                      onChange={e => updateOutlineTopic(si, ti, e.target.value)}
                      placeholder="Chapter / stop / topic"
                      className="tours-outline-item-input"
                    />
                    {section.topics.length > 1 && (
                      <button className="btn btn-ghost tours-outline-remove-item" onClick={() => removeOutlineTopic(si, ti)}>×</button>
                    )}
                  </div>
                ))}
                <button className="btn btn-secondary tours-outline-add-item" onClick={() => addOutlineTopic(si)}>Add item</button>
              </div>
            ))}
          </div>

          <div className="tours-form-actions">
            <button className="btn btn-primary tours-form-save" onClick={save}>Save</button>
            <button className="btn btn-ghost tours-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {tours.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Log your tours and track travel expenses here.</p>
        </div>
      )}

      {tours.map(t => (
        <div key={t.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.date} · {t.type?.replace('_', ' ')}</div>
              {t.companions && <div style={{ fontSize: 12, marginTop: 4 }}>👥 {t.companions}</div>}
              {t.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t.notes}</div>}
              {t.outline?.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Trip outline</div>
                  <div style={{ paddingLeft: 10 }}>
                    {t.outline.map((section, si) => (
                      <div key={si} style={{ marginBottom: 8 }}>
                        {section.title && <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{section.title}</div>}
                        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>
                          {section.topics.filter(Boolean).map((topic, ti) => (
                            <li key={ti}>{topic}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {t.spent && <div style={{ fontWeight: 700, color: 'var(--danger)' }}>৳{(+t.spent).toLocaleString()}</div>}
              {t.budget && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Budget: ৳{(+t.budget).toLocaleString()}</div>}
              <button className="btn btn-ghost" style={{ padding: '4px 8px', marginTop: 6 }} onClick={() => {
                const u = tours.filter(x => x.id !== t.id); setTours(u); store.set('tours', u);
              }}><Trash2 size={11} color="var(--danger)" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Social Time ───────────────────────────────────────────────────────────────
export function Social() {
  const [logs, setLogs] = useState(() => store.get('social') || []);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], activity: '', persons: '', hours: '' });
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    const u = [{ ...form, hours: +form.hours, id: uid() }, ...logs];
    setLogs(u); store.set('social', u); setAdding(false);
    setForm({ date: new Date().toISOString().split('T')[0], activity: '', persons: '', hours: '' });
  };

  const total7 = logs.filter(l => {
    const d = new Date(l.date);
    return (new Date() - d) < 7 * 86400000;
  }).reduce((s, l) => s + (l.hours || 0), 0);

  return (
    <div className="page-enter page-container">
      <div className="social-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Social Time</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Track time spent with friends — last 7 days: {total7.toFixed(1)}h</p>
        </div>
        <button className="btn btn-primary social-add-btn" onClick={() => setAdding(true)}><Plus size={13} /> Log</button>
      </div>

      {adding && (
        <div className="card social-form-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Log Social Time</div>
          <div className="social-form-grid">
            <div className="social-form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="social-form-field"><label>Activity</label><input value={form.activity} onChange={e => set('activity', e.target.value)} placeholder="Adda, gaming, walk..." /></div>
            <div className="social-form-field"><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0} step={0.5} /></div>
          </div>
          <div className="social-form-field social-form-wide" style={{ marginBottom: 10 }}><label>With whom</label><input value={form.persons} onChange={e => set('persons', e.target.value)} placeholder="Rahim, Karim..." /></div>
          <div className="social-form-actions">
            <button className="btn btn-primary social-form-save" onClick={save}>Save</button>
            <button className="btn btn-ghost social-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {logs.slice(0, 15).map(l => (
        <div key={l.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{l.activity}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.date}{l.persons ? ` · with ${l.persons}` : ''}</div>
          </div>
          <span className="tag tag-gray">{l.hours}h</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
            const u = logs.filter(x => x.id !== l.id); setLogs(u); store.set('social', u);
          }}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}

      {logs.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Track how much time you spend socializing.</p>
        </div>
      )}
    </div>
  );
}

// ── Projects ─────────────────────────────────────────────────────────────────
export function Projects() {
  const [projects, setProjects] = useState(() => store.get('projects') || []);
  const [form, setForm] = useState({ name: '', type: 'Academic', status: 'active', desc: '', deadline: '' });
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    const u = [{ ...form, id: uid() }, ...projects];
    setProjects(u); store.set('projects', u); setAdding(false);
    setForm({ name: '', type: 'Academic', status: 'active', desc: '', deadline: '' });
  };

  const TYPES = ['Academic', 'Personal', 'Club', 'Freelance', 'Research', 'Other'];
  const statusColor = { active: 'tag-green', done: 'tag-blue', paused: 'tag-yellow' };

  return (
    <div className="page-enter page-container">
      <div className="projects-header">
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Projects</h1>
        <button className="btn btn-primary projects-add-btn" onClick={() => setAdding(true)}><Plus size={13} /> Add Project</button>
      </div>

      {adding && (
        <div className="card projects-form-card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add Project</div>
          <div className="projects-form-grid projects-form-grid-top">
            <div className="projects-form-field projects-form-wide"><label>Project Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Smart Campus App" /></div>
            <div className="projects-form-field"><label>Type</label><select value={form.type} onChange={e => set('type', e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="projects-form-field"><label>Status</label><select value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Active</option><option value="done">Done</option><option value="paused">Paused</option></select></div>
          </div>
          <div className="projects-form-grid projects-form-grid-bottom">
            <div className="projects-form-field projects-form-wide"><label>Deadline</label><input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
          </div>
          <div className="projects-form-field projects-form-wide" style={{ marginBottom: 10 }}><label>Description</label><textarea value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} /></div>
          <div className="projects-form-actions">
            <button className="btn btn-primary projects-form-save" onClick={save}>Save</button>
            <button className="btn btn-ghost projects-form-cancel" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {projects.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Track your academic and personal projects here.</p>
        </div>
      )}

      {projects.map(p => (
        <div key={p.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
              <span className={`tag ${statusColor[p.status] || 'tag-gray'}`}>{p.status}</span>
              <span className="tag tag-gray">{p.type}</span>
            </div>
            {p.desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{p.desc}</div>}
            {p.deadline && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Deadline: {p.deadline}</div>}
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
            const u = projects.filter(x => x.id !== p.id); setProjects(u); store.set('projects', u);
          }}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}
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
  
  // If profile not set, show message
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
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Please set your department and term in Profile first.
          </p>
          <a href="/profile" className="btn btn-primary" style={{ display: 'inline-block' }}>
            Go to Profile
          </a>
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

  // Helper to get course data
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
    const today = new Date().toISOString().split('T')[0];
    const openIndex = selfStudyData.findIndex(s => s.courseId === courseId && s.topic === topic && !s.endDate);
    let next = [];

    if (openIndex >= 0) {
      next = selfStudyData.map((s, i) => {
        if (i !== openIndex) return s;
        return { ...s, startDate: s.startDate || today, endDate: today, done: true };
      });
    } else {
      next = [{
        id: uid(),
        courseId,
        topic,
        date: today,
        startDate: today,
        endDate: today,
        hours: null,
        source: 'syllabus',
        done: true,
      }, ...selfStudyData];
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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📚 {getTermLabelFromKey(displayTermKey)} Syllabus</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {courses.length} courses • {courses.reduce((sum, c) => sum + (c.credits || 0), 0).toFixed(1)} credits
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      {!selectedCourse && (
        <div style={{ marginBottom: 16 }}>
          <input 
            type="text" 
            placeholder="🔍 Search courses or topics..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Courses Grid */}
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
              <div key={course.id} className="card" style={{ 
                padding: 0, 
                overflow: 'hidden',
                borderTop: '4px solid #8b5cf6',
                background: 'var(--card)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Course Header */}
                <div style={{ 
                  padding: '14px',
                  background: 'rgba(139,92,246,0.08)',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.05em' }}>
                        {course.code}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                        {course.name}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      fontWeight: 600, 
                      padding: '4px 8px', 
                      background: '#8b5cf6',
                      color: 'white',
                      borderRadius: 4
                    }}>
                      {course.credits} cr
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    ⏱ {course.contactHour || 'N/A'} • {topics.length} topics
                  </div>
                </div>

                {/* Progress Bar */}
                {topics.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.04)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                        Progress: {completedCount}/{topics.length}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                        {progressPercent}%
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progressPercent}%`,
                        background: '#10b981',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                )}

                {/* Comparison Summary */}
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

                {/* References */}
                {references.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.04)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>
                      📖 References
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {references.slice(0, 3).map((ref, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>
                          • {ref}
                        </div>
                      ))}
                      {references.length > 3 && (
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
                          +{references.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Topics Accordion */}
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
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  background: isCompleted ? 'rgba(16,185,129,0.08)' : 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.08)' : 'transparent';
                                }}
                              >
                                <div style={{ marginTop: 2, fontSize: 11, color: isCompleted ? '#10b981' : '#8b5cf6', fontWeight: 700 }}>
                                  {isExpanded ? '▼' : '▶'}
                                </div>
                                {isCompleted && <div style={{ fontSize: 12, color: '#10b981' }}>✓</div>}
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)' }}>
                                    {topic.substring(0, 100)}{topic.length > 100 ? '...' : ''}
                                  </div>
                                  {topicStudy.length > 0 && (
                                    <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 3 }}>
                                      {topicStudy.length} session(s)
                                    </div>
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--card)',
                                  borderTop: '1px solid var(--border)',
                                  fontSize: 12,
                                  color: 'var(--text)',
                                  lineHeight: 1.6
                                }}>
                                  <div style={{ marginBottom: 8 }}>
                                    {topic}
                                  </div>
                                  {topicStudy.length > 0 && (
                                    <div style={{ fontSize: 11, color: 'var(--muted)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Studied:</div>
                                      {topicStudy.map((s, j) => (
                                        <div key={j} style={{ marginBottom: 2 }}>
                                          📚 {s.date}{s.hours ? ` (${s.hours}h)` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    Track progress from Self Study.
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
                    ⚠️ No syllabus data available
                  </div>
                )}
              </div>
            );
          })
        }
      </div>

      {/* Empty State */}
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
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: 'Study', hours: '', note: '' });
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

    const date = new Date(session.endedAt).toISOString().split('T')[0];
    persistCompatibilityLog({
      date,
      category: session.category,
      hours: hoursFromMs(session.actualMs),
      note: session.note ? `${session.note} [Digital Timer]` : '[Digital Timer]',
      source: 'digital_timer',
      timerMode: session.mode,
    });

    if (session.category === 'Self Study' || session.category === 'Study') {
      store.set('selfstudy_timer_prefill', {
        topic: session.note || 'Focused study session',
        hours: hoursFromMs(session.actualMs),
        date,
      });
    }
  };

  const saveManualLog = () => {
    const u = [{ ...form, hours: +form.hours, id: uid() }, ...logs];
    setLogs(u);
    store.set('timelogs', u);
    setManualOpen(false);
  };

  const handleStart = () => {
    if (timer.isRunning) return;
    if (mode === TIMER_MODES.UP) {
      timer.startUp({ category: form.category, note: form.note });
      return;
    }
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
      if (lastAutoSavedId !== timer.state.id) {
        setLastAutoSavedId(timer.state.id);
      }
      return;
    }
    if (lastAutoSavedId === timer.state.id) return;
    const endedState = {
      ...timer.state,
      endedAt: timer.state.endedAt || Date.now(),
      accumulatedMs: timer.state.mode === TIMER_MODES.DOWN ? timer.state.targetMs : timer.elapsedMs,
    };
    saveTimerSession(endedState, 'completed');
    setLastAutoSavedId(timer.state.id);
    // Pomodoro auto-cycle: if enabled and we were running a countdown, auto-start the next segment
    try {
      if (pomodoro.enabled && timer.state.mode === TIMER_MODES.DOWN) {
        const wasWork = pomodoro.isWork;
        // toggle work/break
        const nextIsWork = !wasWork;
        setPomodoro(p => ({ ...p, isWork: nextIsWork, cycles: nextIsWork ? p.cycles + 1 : p.cycles }));
        const nextMs = wasWork ? (pomodoro.breakMs || 5 * 60000) : (pomodoro.workMs || 25 * 60000);
        // start next countdown automatically
        setTimeout(() => {
          try { timer.startDown(nextMs, { category: form.category, note: form.note }); } catch {}
        }, 400);
      }
    } catch (e) {}
  }, [timer.isCompleted, timer.state, timer.elapsedMs, lastAutoSavedId]);

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date === today);
  const productive = todayLogs
    .filter(l => PRODUCTIVE_TIME_CATEGORIES.includes(l.category))
    .reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const waste = todayLogs
    .filter(l => DISTRACTION_TIME_CATEGORIES.includes(l.category))
    .reduce((s, l) => s + (Number(l.hours) || 0), 0);

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
      <circle
        cx="50"
        cy="50"
        r="36"
        stroke="var(--accent)"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 180ms linear' }}
      />
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
            {/* Header: Mode + Status */}
            <div className="time-tracker-header-section">
              <div className="time-tracker-mode-switch" role="tablist" aria-label="Timer mode">
                <button
                  className={`time-tracker-mode-btn ${mode === TIMER_MODES.UP ? 'active' : ''}`}
                  onClick={() => setMode(TIMER_MODES.UP)}
                  disabled={timer.isRunning}
                  aria-pressed={mode === TIMER_MODES.UP}
                >
                  Count Up
                </button>
                <button
                  className={`time-tracker-mode-btn ${mode === TIMER_MODES.DOWN ? 'active' : ''}`}
                  onClick={() => setMode(TIMER_MODES.DOWN)}
                  disabled={timer.isRunning}
                  aria-pressed={mode === TIMER_MODES.DOWN}
                >
                  Count Down
                </button>
              </div>
              <div className={`time-tracker-status-pill ${timer.isRunning ? 'is-running' : timer.isCompleted ? 'is-complete' : ''}`}>
                <span>Status</span>
                <strong>{timerStatusLabel}</strong>
              </div>
            </div>

            {/* Display Section */}
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

            {/* Presets + Prefs Row */}
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

            {/* Today's Stats */}
            <div className="time-tracker-stats-section">
              <div className="time-tracker-stat-item">
                <div className="stat-label">Productive</div>
                <div className="stat-value">{productive}h</div>
              </div>
              <div className="time-tracker-stat-item">
                <div className="stat-label">Distracted</div>
                <div className="stat-value">{waste}h</div>
              </div>
              <div className="time-tracker-stat-item">
                <div className="stat-label">Focus ratio</div>
                <div className="stat-value">{focusRatio}%</div>
              </div>
            </div>

            {/* Countdown Inputs (show only when in DOWN mode) */}
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

            {/* Form Section: Category + Note */}
            <div className="time-tracker-form-section">
              <div className="time-tracker-section-label">This session</div>
              <div className="time-tracker-grid time-tracker-info-grid">
                <TimeTrackerCategorySelect value={form.category} onChangeValue={(next) => set('category', next)} />
                <div className="form-field time-tracker-note-field"><label>Note</label><input value={form.note} onChange={e => set('note', e.target.value)} placeholder="What are you doing?" /></div>
              </div>
            </div>

            {/* Action Buttons */}
            {!(timer.isRunning || timer.isPaused) && (
              <div className="time-tracker-actions-section">
                {!timer.isRunning && !timer.isPaused && !timer.isCompleted && (
                  <button className="btn btn-primary" onClick={handleStart}><Play size={13} /> Start</button>
                )}
                {(timer.isPaused || timer.isCompleted || timer.isIdle) && <button className="btn btn-ghost" onClick={timer.reset}><RotateCcw size={13} /> Reset</button>}
              </div>
            )}
            </div>{/* end time-tracker-panel-body */}
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
                        <div className="time-session-time">{new Date(s.endedAt || s.savedAt).toLocaleTimeString('en-BD', {hour:'2-digit', minute:'2-digit'})}</div>
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
  const [form, setForm] = useState({ studentName: '', subject: '', date: new Date().toISOString().split('T')[0], hours: '', travelTime: '', travelCost: '', fee: '' });
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    const u = [{ ...form, hours: +form.hours, travelTime: +form.travelTime, travelCost: +form.travelCost, fee: +form.fee, id: uid() }, ...sessions];
    setSessions(u); store.set('tuition', u); setAdding(false);
  };

  const totalFee = sessions.reduce((s, t) => s + (t.fee || 0), 0);
  const totalTravel = sessions.reduce((s, t) => s + (t.travelCost || 0), 0);
  const net = totalFee - totalTravel;

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tuition Tracker</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Net income: ৳{net.toLocaleString()} (fee ৳{totalFee.toLocaleString()} - travel ৳{totalTravel.toLocaleString()})</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Log Session</button>
      </div>

      {adding && (
        <div className="card tuition-form" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <div className="tuition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div className="form-field"><label>Student Name</label><input value={form.studentName} onChange={e => set('studentName', e.target.value)} placeholder="Rahim" /></div>
            <div className="form-field"><label>Subject</label><input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Math" /></div>
            <div className="form-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          </div>

          <div className="tuition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div className="form-field"><label>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} placeholder="1.5" min={0} step={0.5} /></div>
            <div className="form-field"><label>Travel Time (min)</label><input type="number" value={form.travelTime} onChange={e => set('travelTime', e.target.value)} placeholder="30" /></div>
            <div className="form-field"><label>Travel Cost (৳)</label><input type="number" value={form.travelCost} onChange={e => set('travelCost', e.target.value)} placeholder="40" /></div>
            <div className="form-field"><label>Fee Received (৳)</label><input type="number" value={form.fee} onChange={e => set('fee', e.target.value)} placeholder="500" /></div>
          </div>

          <div className="tuition-actions time-tracker-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {sessions.slice(0, 20).map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.studentName} — {s.subject}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.date} · {s.hours}h · Travel: {s.travelTime}min / ৳{s.travelCost}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: 'var(--success)' }}>+৳{s.fee}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Net: ৳{(s.fee - s.travelCost).toLocaleString()}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
            const u = sessions.filter(x => x.id !== s.id); setSessions(u); store.set('tuition', u);
          }}><Trash2 size={11} color="var(--danger)" /></button>
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
export function Food() {
  const profile = store.get('profile') || {};
  const [bmi, setBmi] = useState({ weight: '', height: '' });
  const [logs, setLogs] = useState(() => store.get('foodlogs') || []);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], meal: 'Lunch', item: '', calories: '' });
  const [adding, setAdding] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setBMI = (k, v) => setBmi(b => ({ ...b, [k]: v }));

  const bmiVal = bmi.weight && bmi.height ? (bmi.weight / ((bmi.height / 100) ** 2)).toFixed(1) : null;
  const bmiLabel = !bmiVal ? '' : bmiVal < 18.5 ? 'Underweight' : bmiVal < 25 ? 'Normal' : bmiVal < 30 ? 'Overweight' : 'Obese';
  const suggestedCal = bmi.weight ? Math.round(bmi.weight * 33) : 2200; // rough TDEE

  const save = () => {
    const u = [{ ...form, calories: +form.calories, id: uid() }, ...logs];
    setLogs(u); store.set('foodlogs', u); setAdding(false);
  };

  const today = new Date().toISOString().split('T')[0];
  const todayCal = logs.filter(l => l.date === today).reduce((s, l) => s + (l.calories || 0), 0);

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Food & Health</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>BMI, calorie tracker, daily nutrition — Bangladesh perspective</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>BMI Calculator</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label>Weight (kg)</label><input type="number" value={bmi.weight} onChange={e => setBMI('weight', e.target.value)} placeholder="65" /></div>
          <div><label>Height (cm)</label><input type="number" value={bmi.height} onChange={e => setBMI('height', e.target.value)} placeholder="170" /></div>
          <div>
            <label>BMI</label>
            <div style={{ padding: '7px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontWeight: 700, fontSize: 15, color: bmiVal && +bmiVal >= 18.5 && +bmiVal < 25 ? 'var(--success)' : bmiVal ? 'var(--warning)' : 'var(--muted)' }}>
              {bmiVal || '—'} <span style={{ fontSize: 11, fontWeight: 400 }}>{bmiLabel}</span>
            </div>
          </div>
        </div>
        {bmiVal && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Suggested daily calories: ~{suggestedCal} kcal</div>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Today's Calories</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Target: ~{suggestedCal} kcal</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: todayCal > suggestedCal ? 'var(--danger)' : 'var(--success)' }}>{todayCal} kcal</div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(100, (todayCal / suggestedCal) * 100)}%`, background: todayCal > suggestedCal ? 'var(--danger)' : 'var(--accent)' }} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={() => setAdding(!adding)}>
          <Plus size={13} /> Log Meal
        </button>
      </div>

      {adding && (
        <div className="card food-log-form-card" style={{ marginBottom: 14 }}>
          <div className="food-log-form-grid">
            <div className="food-log-field"><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="food-log-field"><label>Meal</label><select value={form.meal} onChange={e => set('meal', e.target.value)}>{['Breakfast','Lunch','Dinner','Snack'].map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="food-log-field food-log-item-field"><label>Food Item</label><input value={form.item} onChange={e => set('item', e.target.value)} placeholder="Bhat, Dal, Chicken..." /></div>
            <div className="food-log-field"><label>Calories (kcal)</label><input type="number" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="400" /></div>
          </div>
          <div className="food-log-actions">
            <button className="btn btn-primary food-log-save-btn" onClick={save}>Save</button>
            <button className="btn btn-ghost food-log-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {logs.filter(l => l.date === today).map(l => (
        <div key={l.id} className="card" style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tag tag-gray">{l.meal}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{l.item}</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{l.calories} kcal</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
            const u = logs.filter(x => x.id !== l.id); setLogs(u); store.set('foodlogs', u);
          }}><Trash2 size={11} color="var(--danger)" /></button>
        </div>
      ))}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function Reports() {
  const profile = getProfile();
  const courses  = getAllCourses(profile);
  const expenses = store.get('expenses') || [];
  const namaz   = store.get('namaz') || {};
  const selfeval = store.get('selfeval') || {};
  const diary   = store.get('diary') || [];
  const timerSessions = getTimerSessions();
  const timerHours = timerSessions.reduce((sum, session) => sum + hoursFromMs(session.actualMs || 0), 0);

  const exportReport = (period) => {
    const now = new Date();
    const lines = [
      `KUETx ${period} Report — ${now.toLocaleDateString('en-BD')}`,
      '='.repeat(50),
      '',
      `Courses: ${courses.length}`,
      `Diary Entries: ${diary.length}`,
      `Expenses logged: ${expenses.length}`,
      `Digital timer sessions: ${timerSessions.length}`,
      `Digital timer hours: ${timerHours.toFixed(2)}h`,
      '',
      'Generated by KUETx — KUET Student Life OS',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kuetx-${period.toLowerCase()}-report-${now.toISOString().split('T')[0]}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Reports</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Export summaries of your academic life</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {['Daily', 'Weekly', 'Monthly', 'Semester'].map(p => (
          <div key={p} className="card" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p} Report</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Summary of activities, marks, attendance</div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => exportReport(p)}>
              Download {p}
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Data Overview</div>
        {[
          ['Courses', courses.length],
          ['Expenses recorded', expenses.length],
          ['Diary entries', diary.length],
          ['Digital timer sessions', timerSessions.length],
          ['Digital timer hours', `${timerHours.toFixed(2)}h`],
          ['Days with Namaz data', Object.keys(namaz).length],
          ['Self-eval days', Object.keys(selfeval).length],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}