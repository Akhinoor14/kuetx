import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { store, uid, getProfile } from '../store/store';
import { getAllCourses, getDeptSyllabus } from '../store/curriculumStore';
import '../styles/pages/diary.css';

// Helper: Get today's schedule courses
const getTodaySchedule = (courses) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const schedule = store.get('schedule') || [];
  return schedule.filter(item => item.day === today).map(item => {
    const course = courses.find(c => c.id === item.courseId);
    return { ...item, courseObj: course };
  });
};

export default function Diary() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const deptSyllabus = getDeptSyllabus(profile.dept);
  const [entries, setEntries] = useState(() => store.get('diary') || []);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    courseId: '', topics: '', notes: '', selfRating: 4, missed: false
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  
  // Get today's schedule
  const todaySchedule = getTodaySchedule(courses);
  const selectedCourse = courses.find(c => c.id === form.courseId);
  
  // Calculate syllabus progress for diary
  const getSyllabusProgress = (courseId) => {
    if (!courseId) return null;
    const course = courses.find(c => c.id === courseId);
    if (!course) return null;
    const syllabusTopics = deptSyllabus?.courses?.[course.code]?.topics || [];
    const trackedTopics = store.get('syllabusProgress')?.[courseId] || [];
    const completed = trackedTopics.filter(t => t.endDate).length;
    return {
      total: syllabusTopics.length,
      completed: completed,
      percentage: syllabusTopics.length ? Math.round((completed / syllabusTopics.length) * 100) : 0
    };
  };

  const add = () => {
    // Just save diary entry without auto-updating syllabus
    // Syllabus is fixed - user manually tracks progress there
    const updated = [{ ...form, id: uid(), source: form.courseId ? 'course' : 'general' }, ...entries];
    setEntries(updated); 
    store.set('diary', updated); 
    setAdding(false);
    setForm({ date: new Date().toISOString().split('T')[0], courseId: '', topics: '', notes: '', selfRating: 4, missed: false });
  };

  const del = (id) => { const u = entries.filter(e => e.id !== id); setEntries(u); store.set('diary', u); };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const getCourse = (id) => courses.find(c => c.id === id);
  const suggestedTopics = selectedCourse ? (deptSyllabus?.courses?.[selectedCourse.code]?.topics || []) : [];

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Class Diary</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>What was covered in each class</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={13} /> Log Class
        </button>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Log Today's Class</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {form.date === new Date().toISOString().split('T')[0] && todaySchedule.length > 0 && (
                  <>
                    <optgroup label="Today's Schedule">
                      {todaySchedule.map(item => (
                        <option key={item.courseId} value={item.courseId}>
                          {item.slot} — {item.courseObj?.code} ({item.displayName || item.courseObj?.name || 'Unknown'})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other Courses">
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </optgroup>
                  </>
                ) || (
                  <>{courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</>
                )}
              </select>
            </div>
          </div>

          {/* Syllabus Progress for Selected Course */}
          {selectedCourse && getSyllabusProgress(form.courseId) && (
            <div className="card" style={{ marginBottom: 10, backgroundColor: 'var(--card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Syllabus Progress</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{getSyllabusProgress(form.courseId).completed}/{getSyllabusProgress(form.courseId).total}</span>
              </div>
              <div className="progress-bar" style={{ marginBottom: 6 }}>
                <div className="progress-fill" style={{ width: `${getSyllabusProgress(form.courseId).percentage}%`, backgroundColor: '#28a745' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{getSyllabusProgress(form.courseId).percentage}% covered</span>
            </div>
          )}

          {suggestedTopics.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Suggested topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggestedTopics.slice(0, 8).map(t => (
                  <button key={t} className="btn btn-ghost btn-sm" onClick={() => set('topics', form.topics ? `${form.topics}, ${t}` : t)}>
                    + {t}
                  </button>
                ))}
                {suggestedTopics.length > 8 && (
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>+ {suggestedTopics.length - 8} more</span>
                )}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label>Topics Covered</label>
            <textarea value={form.topics} onChange={e => set('topics', e.target.value)} rows={2} placeholder="Linked lists, doubly linked lists..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Notes / Key Points</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Important formula, teacher's tips..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Class Quality (1-5)</label>
              <select value={form.selfRating} onChange={e => set('selfRating', +e.target.value)}>
                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} — {'★'.repeat(v)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                <input type="checkbox" checked={form.missed} onChange={e => set('missed', e.target.checked)} style={{ width: 'auto' }} />
                Class was missed
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>Save Entry</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div className="section-title">{new Date(date).toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          {byDate[date].map(e => {
            const c = getCourse(e.courseId);
            return (
              <div key={e.id} className="card" style={{ marginBottom: 6, borderLeft: `3px solid ${e.missed ? 'var(--danger)' : 'var(--accent)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>{c?.code || '?'}</span>
                    <span style={{ fontSize: 13 }}>{c?.name}</span>
                    {e.missed && <span className="tag tag-red">Missed</span>}
                    {e.selfRating && <span style={{ fontSize: 12, color: 'var(--warning)' }}>{'★'.repeat(e.selfRating)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => toggle(e.id)}>
                      {expanded[e.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(e.id)}><Trash2 size={12} color="var(--danger)" /></button>
                  </div>
                </div>
                {expanded[e.id] && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {e.topics && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--muted)', fontWeight: 500 }}>Topics: </span>{e.topics}</div>}
                    {e.notes && <div><span style={{ color: 'var(--muted)', fontWeight: 500 }}>Notes: </span>{e.notes}</div>}
                  </div>
                )}
                {!expanded[e.id] && e.topics && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{e.topics.slice(0, 80)}{e.topics.length > 80 ? '...' : ''}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {entries.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Start logging your classes to track what's been covered.</p>
        </div>
      )}
    </div>
  );
}
