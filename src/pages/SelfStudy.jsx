import { useState, useMemo } from 'react';
import { Plus, Trash2, Clock3, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store, uid, getAllCourses, getDeptSyllabus, getProfile } from '../store/store';

export default function SelfStudy() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const deptSyllabus = getDeptSyllabus(profile.dept);
  
  // Two separate storage systems
  const [academicSessions, setAcademicSessions] = useState(() => store.get('selfstudy_academic') || []);
  const [extraReading, setExtraReading] = useState(() => store.get('selfstudy_extra') || []);
  
  const [activeTab, setActiveTab] = useState('academic'); // 'academic' or 'extra'
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ startDate: '', endDate: '' });
  
  // Forms for each tab
  const [academicForm, setAcademicForm] = useState({
    date: new Date().toISOString().split('T')[0],
    courseId: '', topic: '', hours: ''
  });
  
  const [extraForm, setExtraForm] = useState({
    category: 'book',
    title: '',
    progress: 0,
    startDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Academic Tab Handlers
  const addAcademic = () => {
    if (!academicForm.topic || !academicForm.courseId) return;
    const today = new Date().toISOString().split('T')[0];
    const u = [{
      ...academicForm,
      id: uid(),
      startDate: today,
      endDate: null,
      hours: academicForm.hours ? +academicForm.hours : null,
      source: 'academic'
    }, ...academicSessions];
    setAcademicSessions(u);
    store.set('selfstudy_academic', u);
    setAdding(false);
    setAcademicForm({
      date: new Date().toISOString().split('T')[0],
      courseId: '', topic: '', hours: ''
    });
  };

  const updateAcademicDates = (id, startDate, endDate) => {
    const u = academicSessions.map(s =>
      s.id === id ? { ...s, startDate: startDate || null, endDate: endDate || null, done: !!endDate } : s
    );
    setAcademicSessions(u);
    store.set('selfstudy_academic', u);
    setEditingId(null);
  };

  const toggleAcademicComplete = (id) => {
    const session = academicSessions.find(s => s.id === id);
    if (!session) return;
    const today = new Date().toISOString().split('T')[0];
    const endDate = !session.endDate ? today : null;
    updateAcademicDates(id, session.startDate || today, endDate);
  };

  const delAcademic = (id) => {
    const u = academicSessions.filter(s => s.id !== id);
    setAcademicSessions(u);
    store.set('selfstudy_academic', u);
  };

  // Extra Reading Handlers
  const addExtra = () => {
    if (!extraForm.title) return;
    const u = [{
      ...extraForm,
      progress: +extraForm.progress || 0,
      id: uid(),
      done: false
    }, ...extraReading];
    setExtraReading(u);
    store.set('selfstudy_extra', u);
    setAdding(false);
    setExtraForm({
      category: 'book',
      title: '',
      progress: 0,
      startDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const updateExtraProgress = (id, progress) => {
    const u = extraReading.map(e =>
      e.id === id ? { ...e, progress: +progress, done: progress >= 100, endDate: progress >= 100 ? new Date().toISOString().split('T')[0] : null } : e
    );
    setExtraReading(u);
    store.set('selfstudy_extra', u);
  };

  const delExtra = (id) => {
    const u = extraReading.filter(e => e.id !== id);
    setExtraReading(u);
    store.set('selfstudy_extra', u);
  };

  // Helper functions
  const getCourse = (id) => courses.find(c => c.id === id);
  const selectedCourse = getCourse(academicForm.courseId);
  const suggestedTopics = selectedCourse ? (deptSyllabus?.courses?.[selectedCourse.code]?.topics || []) : [];

  const getAcademicStatus = (session) => {
    if (!session.startDate) return 'notStarted';
    if (!session.endDate) return 'inProgress';
    return 'complete';
  };

  const getStatusColor = (status) => {
    const colors = {
      notStarted: '#999',
      inProgress: '#ffc107',
      complete: '#28a745'
    };
    return colors[status] || '#999';
  };

  // Stats
  const totalHours = academicSessions.reduce((s, x) => s + (x.hours || 0), 0);
  const last7Hours = academicSessions.filter(s => {
    const d = new Date(s.date);
    return (new Date() - d) < 7 * 86400000;
  }).reduce((s, x) => s + (x.hours || 0), 0);

  const byDate = {};
  academicSessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  return (
    <div className="page-enter page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Self Study</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{totalHours.toFixed(1)} hours logged</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={13} /> Add</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button className={`btn ${activeTab === 'academic' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('academic')}>
          📚 Academic ({academicSessions.length})
        </button>
        <button className={`btn ${activeTab === 'extra' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('extra')}>
          📖 Extra Reading ({extraReading.length})
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Last 7 Days</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{last7Hours.toFixed(1)}h</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total Sessions</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{academicSessions.length}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Extra Reading</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{extraReading.filter(e => e.done).length}/{extraReading.length}</div>
        </div>
      </div>

      {/* ACADEMIC TOPICS TAB */}
      {activeTab === 'academic' && (
        <>
          {adding && (
            <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Log Study Session</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label>Date</label><input type="date" value={academicForm.date} onChange={e => setAcademicForm({...academicForm, date: e.target.value})} /></div>
                <div>
                  <label>Course</label>
                  <select value={academicForm.courseId} onChange={e => setAcademicForm({...academicForm, courseId: e.target.value})}>
                    <option value="">Select course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div><label>Hours (optional)</label><input type="number" value={academicForm.hours} onChange={e => setAcademicForm({...academicForm, hours: e.target.value})} placeholder="1.5" min={0.25} step={0.25} /></div>
              </div>
              
              {suggestedTopics.length > 0 && (
                <div className="card" style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Suggested topics</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestedTopics.slice(0, 8).map(t => (
                      <button key={t} className="btn btn-ghost btn-sm" onClick={() => setAcademicForm({...academicForm, topic: t})}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div style={{ marginBottom: 10 }}><label>Topic</label><input value={academicForm.topic} onChange={e => setAcademicForm({...academicForm, topic: e.target.value})} placeholder="Binary Search Trees" /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={addAcademic}>Save</button>
                <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          )}

          {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
            <div key={date} style={{ marginBottom: 12 }}>
              <div className="section-title">{new Date(date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              {byDate[date].map(s => {
                const c = getCourse(s.courseId);
                const status = getAcademicStatus(s);
                const statusColor = getStatusColor(status);
                const isEditing = editingId === s.id;
                return (
                  <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => toggleAcademicComplete(s.id)} style={{
                        width: 20, height: 20, borderRadius: 4, border: `2px solid ${statusColor}`,
                        background: status === 'complete' ? statusColor : (status === 'inProgress' ? statusColor + '40' : 'transparent'),
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {status === 'complete' && <Check size={12} color="white" />}
                        {status === 'inProgress' && <Clock3 size={10} color={statusColor} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{s.topic}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c?.code}{s.hours ? ` · ${s.hours}h` : ''}</div>
                      </div>
                      <button onClick={() => { setEditingId(isEditing ? null : s.id); if (!isEditing) { setEditForm({ startDate: s.startDate || '', endDate: s.endDate || '' }); } }} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px', fontSize: 12 }}>
                        {isEditing ? 'X' : 'Edit'}
                      </button>
                      <button onClick={() => delAcademic(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px 8px' }}><Trash2 size={11} /></button>
                    </div>
                    {isEditing && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginLeft: 30, padding: '8px', backgroundColor: 'var(--card)', borderRadius: 4 }}>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)' }}>Start</label>
                          <input type="date" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})} style={{ width: '100%', fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--muted)' }}>End (optional)</label>
                          <input type="date" value={editForm.endDate} onChange={e => setEditForm({...editForm, endDate: e.target.value})} style={{ width: '100%', fontSize: 12 }} />
                        </div>
                        <button onClick={() => updateAcademicDates(s.id, editForm.startDate, editForm.endDate)} className="btn btn-primary btn-sm">Save</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {academicSessions.length === 0 && !adding && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
              <p>No academic study sessions yet. Log topics you've studied.</p>
            </div>
          )}
        </>
      )}

      {/* EXTRA READING TAB */}
      {activeTab === 'extra' && (
        <>
          {adding && (
            <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Add Reading Target</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label>Category</label>
                  <select value={extraForm.category} onChange={e => setExtraForm({...extraForm, category: e.target.value})}>
                    <option value="book">📕 Book</option>
                    <option value="course">🎓 Online Course</option>
                    <option value="tutorial">🎬 Tutorial</option>
                    <option value="paper">📄 Research Paper</option>
                    <option value="other">📌 Other</option>
                  </select>
                </div>
                <div><label>Start Date</label><input type="date" value={extraForm.startDate} onChange={e => setExtraForm({...extraForm, startDate: e.target.value})} /></div>
              </div>
              <div style={{ marginBottom: 10 }}><label>Title / Target</label><input value={extraForm.title} onChange={e => setExtraForm({...extraForm, title: e.target.value})} placeholder="e.g., 'Read Data Structures by XYZ'" /></div>
              <div style={{ marginBottom: 10 }}><label>Notes</label><textarea value={extraForm.notes} onChange={e => setExtraForm({...extraForm, notes: e.target.value})} rows={2} placeholder="Chapters, specific topics..." /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={addExtra}>Add Target</button>
                <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          )}

          {extraReading.map(e => (
            <div key={e.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {e.category === 'book' && '📕'}
                      {e.category === 'course' && '🎓'}
                      {e.category === 'tutorial' && '🎬'}
                      {e.category === 'paper' && '📄'}
                      {e.category === 'other' && '📌'}
                      {' '}{e.title}
                    </span>
                    {e.done && <span className="tag tag-green" style={{ fontSize: 10 }}>✓ Done</span>}
                  </div>
                  {e.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{e.notes}</div>}
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                      <span>Progress</span>
                      <span>{e.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${e.progress}%`, backgroundColor: e.progress >= 100 ? '#28a745' : '#ffc107' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
                    Started: {e.startDate} {e.endDate && `· Completed: ${e.endDate}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input type="range" min="0" max="100" value={e.progress} onChange={ev => updateExtraProgress(e.id, ev.target.value)} style={{ width: 60 }} />
                  <button onClick={() => delExtra(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}

          {extraReading.length === 0 && !adding && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
              <p>No reading targets. Add books, courses, or tutorials you want to explore.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
