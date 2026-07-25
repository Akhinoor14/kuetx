import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2, Clock3, Check, Zap, BookOpen, CheckCircle2, Timer, AlarmClock, FileText, GraduationCap, Film, Paperclip } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store, uid, getProfile, getTermLabelFromKey } from '../store/store';
import { getAllCourses, getDeptSyllabus } from '../store/curriculumStore';

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// Self Study used to be a single sidebar item with an in-page toggle
// between "Academic" and "⚡ Deep Focus" — several people reported not
// realizing Deep Focus existed at all, or not understanding what the
// two tabs meant, since both hid behind one generic "Self Study" label
// with no indication there were two different modes inside. Academic
// and Deep Focus are now their own entry points under a "Self Study"
// nav subgroup (see nav.js), each with its own URL
// (/self-study/academic, /self-study/deep-focus) — so the tab a
// student lands on always matches what they clicked, and each mode is
// individually discoverable/bookmarkable instead of being a hidden
// toggle. The two tabs still share one component (all the state/data
// below is used by both), just driven by the URL instead of a bare
// useState default.
const tabFromPath = (pathname) => (pathname.endsWith('/deep-focus') ? 'extra' : 'academic');

export default function SelfStudy() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const deptSyllabus = getDeptSyllabus(profile.dept);
  const currentTermKey = profile.currentTermKey || '';
  const currentTermCourses = courses.filter(c => `Y${c.year}T${c.term}` === currentTermKey);
  const isSessionalCourse = (course) => {
    const name = String(course?.name || '').toLowerCase();
    return course?.type === 'Sessional' || name.includes('sessional');
  };
  const currentTermAcademicCourses = currentTermCourses.filter(course => !isSessionalCourse(course));
  const deptLabel = profile?.dept || 'your department';

  const [academicSessions, setAcademicSessions] = useState(() => store.get('selfstudy_academic') || []);
  const [extraReading, setExtraReading] = useState(() => store.get('selfstudy_extra') || []);
  const [activeTab, setActiveTabState] = useState(() => tabFromPath(location.pathname));
  // Keep the tab in sync with the URL (covers direct links, back/
  // forward nav, and the sidebar's Academic/Deep Focus items), and keep
  // the URL in sync when the tab changes some other way (defensive —
  // every setActiveTab call in this file already goes through
  // setActiveTab below, which navigates first).
  useEffect(() => {
    setActiveTabState(tabFromPath(location.pathname));
  }, [location.pathname]);
  const setActiveTab = (tab) => {
    const target = tab === 'extra' ? '/self-study/deep-focus' : '/self-study/academic';
    if (location.pathname !== target) navigate(target);
    setActiveTabState(tab);
  };
  const [adding, setAdding] = useState(false);
  const [addingAcademic, setAddingAcademic] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ startDate: '', endDate: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [compactView, setCompactView] = useState(false);
  const [openCourses, setOpenCourses] = useState(() => {
    const initial = {};
    currentTermAcademicCourses.forEach(c => { initial[c.id] = false; });
    return initial;
  });
  const [showHistory, setShowHistory] = useState(false);

  const [academicForm, setAcademicForm] = useState({
    date: todayStr(),
    courseId: '',
    topic: '',
    hours: ''
  });

  const [extraForm, setExtraForm] = useState({
    category: 'book',
    title: '',
    startDate: todayStr(),
    endDate: '',
    notes: '',
    attachment: ''
  });

  useEffect(() => {
    const prefill = store.get('syllabusStudyPrefill');
    if (!prefill?.courseId) return;

    setActiveTab('academic');
    setAcademicForm(prev => ({
      ...prev,
      courseId: prefill.courseId,
      topic: prefill.topic || prev.topic,
    }));
    store.remove('syllabusStudyPrefill');
  }, []);

  useEffect(() => {
    const timerPrefill = store.get('selfstudy_timer_prefill');
    if (!timerPrefill) return;
    setActiveTab('academic');
    setAddingAcademic(true);
    setAcademicForm(prev => ({
      ...prev,
      date: timerPrefill.date || prev.date,
      topic: timerPrefill.topic || prev.topic,
      hours: timerPrefill.hours ? String(timerPrefill.hours) : prev.hours,
    }));
    store.remove('selfstudy_timer_prefill');
  }, []);

  const toggleCourse = (courseId) => {
    setOpenCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  const updateAcademicDates = (id, startDate, endDate) => {
    const updated = academicSessions.map(session => (
      session.id === id
        ? { ...session, startDate: startDate || null, endDate: endDate || null, done: !!endDate }
        : session
    ));
    setAcademicSessions(updated);
    store.set('selfstudy_academic', updated);
    setEditingId(null);
  };

  const toggleAcademicComplete = (id) => {
    const session = academicSessions.find(item => item.id === id);
    if (!session) return;
    const today = todayStr();
    const endDate = !session.endDate ? today : null;
    updateAcademicDates(id, session.startDate || today, endDate);
  };

  const delAcademic = (id) => {
    const updated = academicSessions.filter(session => session.id !== id);
    setAcademicSessions(updated);
    store.set('selfstudy_academic', updated);
  };

  const addAcademic = () => {
    if (!academicForm.date || !academicForm.courseId || !academicForm.topic || !academicForm.hours) return;
    const updated = [{
      id: uid(),
      ...academicForm,
      hours: Number(academicForm.hours) || 0,
    }, ...academicSessions];
    setAcademicSessions(updated);
    store.set('selfstudy_academic', updated);
    setAddingAcademic(false);
    setAcademicForm({
      date: todayStr(),
      courseId: '',
      topic: '',
      hours: ''
    });
  };

  const addExtra = () => {
    if (!extraForm.title) return;
    const updated = [{
      ...extraForm,
      id: uid(),
      done: !!extraForm.endDate
    }, ...extraReading];
    setExtraReading(updated);
    store.set('selfstudy_extra', updated);
    setAdding(false);
    setExtraForm({
      category: 'book',
      title: '',
      startDate: todayStr(),
      endDate: '',
      notes: '',
      attachment: ''
    });
  };

  const toggleExtraDone = (id) => {
    const today = todayStr();
    const updated = extraReading.map(item => (
      item.id === id ? { ...item, endDate: item.endDate ? '' : today, done: !item.endDate } : item
    ));
    setExtraReading(updated);
    store.set('selfstudy_extra', updated);
  };

  const delExtra = (id) => {
    const updated = extraReading.filter(item => item.id !== id);
    setExtraReading(updated);
    store.set('selfstudy_extra', updated);
  };

  const getCourse = (id) => courses.find(course => course.id === id);

  const getTopicEntries = (courseId, topic) => {
    return academicSessions.filter(session => session.courseId === courseId && session.topic === topic);
  };

  const getLatestEntry = (entries) => {
    if (!entries.length) return null;
    return entries
      .slice()
      .sort((a, b) => String(b.endDate || b.startDate || b.date || '').localeCompare(String(a.endDate || a.startDate || a.date || '')))[0];
  };

  const getDurationDays = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end - start) / 86400000) + 1;
    return Math.max(1, diff);
  };

  const startTopic = (courseId, topic) => {
    const today = todayStr();
    const inProgress = academicSessions.find(session => session.courseId === courseId && session.topic === topic && !session.endDate);
    if (inProgress) return;

    const updated = [{
      id: uid(),
      courseId,
      topic,
      date: today,
      startDate: today,
      endDate: null,
      hours: null,
      source: 'academic'
    }, ...academicSessions];
    setAcademicSessions(updated);
    store.set('selfstudy_academic', updated);
  };

  const endTopic = (courseId, topic) => {
    const today = todayStr();
    let updatedOne = false;
    const updated = academicSessions.map(session => {
      if (updatedOne) return session;
      if (session.courseId === courseId && session.topic === topic && !session.endDate) {
        updatedOne = true;
        return { ...session, startDate: session.startDate || today, endDate: today, done: true };
      }
      return session;
    });

    if (!updatedOne) {
      updated.unshift({
        id: uid(),
        courseId,
        topic,
        date: today,
        startDate: today,
        endDate: today,
        hours: null,
        source: 'academic',
        done: true
      });
    }

    setAcademicSessions(updated);
    store.set('selfstudy_academic', updated);
  };

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

  const currentTermLabel = getTermLabelFromKey(currentTermKey);

  const currentTermCourseStats = useMemo(() => {
    return currentTermAcademicCourses
      .map(course => {
        const topics = deptSyllabus?.courses?.[course.code]?.topics || [];
        const topicRows = topics.map((topic, index) => {
          const entries = getTopicEntries(course.id, topic);
          const latest = getLatestEntry(entries);
          const status = latest?.endDate ? 'done' : latest?.startDate ? 'running' : 'idle';
          const durationDays = latest?.endDate ? getDurationDays(latest.startDate, latest.endDate) : null;
          const runningDays = latest?.startDate && !latest?.endDate
            ? Math.max(1, Math.ceil((new Date() - new Date(latest.startDate)) / 86400000))
            : null;

          return {
            id: `${course.id}:${index}`,
            topic,
            entries,
            latest,
            status,
            durationDays,
            runningDays,
          };
        });

        const coveredTopics = topicRows.filter(item => item.status !== 'idle').length;
        const completedTopics = topicRows.filter(item => item.status === 'done').length;
        const runningTopics = topicRows.filter(item => item.status === 'running').length;

        return {
          ...course,
          topics: topicRows,
          totalTopics: topicRows.length,
          coveredTopics,
          completedTopics,
          runningTopics,
          progress: topicRows.length ? Math.round((coveredTopics / topicRows.length) * 100) : 0,
        };
      })
      .filter(course => course.totalTopics > 0);
  }, [currentTermAcademicCourses, deptSyllabus, academicSessions]);

  const totalOfficialTopics = currentTermCourseStats.reduce((sum, course) => sum + course.totalTopics, 0);
  const coveredTopics = currentTermCourseStats.reduce((sum, course) => sum + course.coveredTopics, 0);
  const completedTopics = currentTermCourseStats.reduce((sum, course) => sum + course.completedTopics, 0);
  const runningTopics = currentTermCourseStats.reduce((sum, course) => sum + course.runningTopics, 0);

  const last7Hours = academicSessions.filter(session => {
    const d = new Date(session.date);
    return (new Date() - d) < 7 * 86400000;
  }).reduce((sum, session) => sum + (Number(session.hours) || 0), 0);

  // Today's quick stats
  const today = todayStr();
  const todayHours = academicSessions.filter(s => s.date === today).reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
  const todayTopicsTouched = new Set(academicSessions.filter(s => s.date === today).map(s => `${s.courseId}:${s.topic}`)).size;

  // Weekly heatmap data
  const weeklyHeatmap = useMemo(() => {
    const days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    return days.map(day => ({
      day,
      label: new Date(day).toLocaleDateString('en-BD', {weekday: 'short'}),
      hours: academicSessions.filter(s => s.date === day).reduce((sum, s) => sum + (s.hours || 0), 0)
    }));
  }, [academicSessions]);

  // Due soon: topics in progress 3+ days
  const dueSoon = useMemo(() => {
    const allTopics = [];
    currentTermCourseStats.forEach(course => {
      course.topics.forEach(topic => {
        if (topic.status === 'running' && topic.runningDays >= 3) {
          allTopics.push({
            courseCode: course.code,
            courseName: course.name,
            topic: topic.topic,
            daysRunning: topic.runningDays,
            startDate: topic.latest?.startDate,
          });
        }
      });
    });
    return allTopics.sort((a, b) => b.daysRunning - a.daysRunning);
  }, [currentTermCourseStats]);

  // Quick topic toggle
  const quickToggleTopic = (courseId, topic) => {
    const entries = getTopicEntries(courseId, topic);
    if (!entries.length) {
      // No entry yet, start it
      startTopic(courseId, topic);
    } else {
      const latest = getLatestEntry(entries);
      if (latest?.endDate) {
        // Already done, so undo completion
        updateAcademicDates(latest.id, latest.startDate || today, null);
      } else {
        // In progress, so end it
        endTopic(courseId, topic);
      }
    }
  };

  const visibleCurrentTermCourseStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return currentTermCourseStats
      .filter(course => courseFilter === 'all' || course.id === courseFilter)
      .map(course => {
        const courseText = `${course.code} ${course.name}`.toLowerCase();
        const visibleTopics = course.topics.filter(item => {
          const matchesStatus = (() => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'notStarted') return item.status === 'idle';
            if (statusFilter === 'inProgress') return item.status === 'running';
            if (statusFilter === 'complete') return item.status === 'done';
            return item.status === statusFilter;
          })();
          const matchesQuery = !q || courseText.includes(q) || item.topic.toLowerCase().includes(q);
          return matchesStatus && matchesQuery;
        });

        if (!visibleTopics.length) return null;

        return {
          ...course,
          visibleTopics,
        };
      })
      .filter(Boolean);
  }, [currentTermCourseStats, courseFilter, searchQuery, statusFilter]);

  const filteredAcademicSessions = academicSessions.filter(session => {
    const matchesCourse = courseFilter === 'all' || session.courseId === courseFilter;
    const status = getAcademicStatus(session);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const q = searchQuery.toLowerCase();
    const course = getCourse(session.courseId);
    const courseText = `${course?.code || ''} ${course?.name || ''}`.toLowerCase();
    const matchesQuery = !q || (session.topic || '').toLowerCase().includes(q) || courseText.includes(q);
    return matchesCourse && matchesStatus && matchesQuery;
  });

  const byDate = {};
  filteredAcademicSessions.forEach(session => {
    if (!byDate[session.date]) byDate[session.date] = [];
    byDate[session.date].push(session);
  });

  const weeklyData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const total = academicSessions
      .filter(session => session.date === key)
      .reduce((sum, session) => sum + (session.hours || 0), 0);
    return { date: d.toLocaleDateString('en-BD', { weekday: 'short' }), hours: Number(total.toFixed(2)) };
  });

  const activeSummary = activeTab === 'academic'
    ? [
        { label: 'Current term courses', value: currentTermCourseStats.length, note: currentTermLabel || 'Current term' },
        { label: 'Topics covered', value: totalOfficialTopics ? `${coveredTopics}/${totalOfficialTopics}` : '0/0', note: `${completedTopics} completed` },
        { label: 'In progress', value: runningTopics, note: 'topics running now' },
        { label: 'Last 7 days', value: `${last7Hours.toFixed(1)}h`, note: 'study time logged' },
      ]
    : [
        { label: 'Deep Focus items', value: extraReading.length, note: 'books, courses, papers' },
        { label: 'Finished', value: extraReading.filter(item => item.done).length, note: 'marked complete' },
        { label: 'Open', value: extraReading.filter(item => !item.done).length, note: 'still active' },
        { label: 'Attachments', value: extraReading.filter(item => item.attachment).length, note: 'linked resources' },
      ];

  const courseBars = currentTermCourseStats
    .slice()
    .sort((a, b) => b.progress - a.progress || a.code.localeCompare(b.code));

  const weeklyMaxHours = Math.max(1, ...weeklyHeatmap.map(day => day.hours || 0));

  return (
    <div className="page-enter page-container content-page-bg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div className="content-page-hero">
          <div className="content-page-hero-icon">
            <BookOpen size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Self Study</h1>
            <p className="content-page-hero-subtitle">Track what you learn, topic by topic</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className={`btn ${activeTab === 'academic' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('academic')}>
            Academic ({currentTermCourseStats.length})
          </button>
          <button className={`btn ${activeTab === 'extra' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('extra')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={13} /> Deep Focus ({extraReading.length})</span>
          </button>
        </div>
      </div>

      {courses.length === 0 && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <p>No curriculum data is available for {deptLabel}. The academic tracker can only auto-fill from loaded department courses.</p>
        </div>
      )}

      {activeTab === 'academic' && (
        <div style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 12, marginBottom: 12, background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(16,185,129,0.06))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Today</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {todayHours.toFixed(1)}h logged - {todayTopicsTouched} topics touched
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Tap a topic name to toggle done/undone.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Quick Topic Toggle <Zap size={12} /></span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
            {activeSummary.map((card, idx) => {
              const icons = [BookOpen, CheckCircle2, Timer, AlarmClock];
              const colors = ['rgba(139,92,246,0.12)', 'rgba(34,197,94,0.12)', 'rgba(249,115,22,0.12)', 'rgba(14,165,233,0.12)'];
              const Icon = icons[idx];
              return (
                <div key={card.label} className="card" style={{ padding: 12, background: `linear-gradient(135deg, ${colors[idx]}, transparent)`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ marginBottom: 6 }}><Icon size={20} color="var(--accent)" /></div>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, marginBottom: 2 }}>{card.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{card.note}</div>
                </div>
              );
            })}
          </div>
          
          {totalOfficialTopics > 0 && (
            <div className="card" style={{ padding: 12, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(34,197,94,0.08))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Overall Progress</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6' }}>{Math.round((coveredTopics / totalOfficialTopics) * 100)}%</div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.2)', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${(coveredTopics / totalOfficialTopics) * 100}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #8b5cf6, #10b981)' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} /> {totalOfficialTopics} topics total</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={11} /> {coveredTopics} touched</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> {completedTopics} done</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{completedTopics}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Completed</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{runningTopics}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>In Progress</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--muted)' }}>{totalOfficialTopics - coveredTopics}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Not Started</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
        {activeTab === 'extra' && activeSummary.map(card => (
          <div key={card.label} className="card" style={{ padding: 12, background: 'linear-gradient(180deg, rgba(139,92,246,0.08), transparent)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{card.note}</div>
          </div>
        ))}
      </div>

      {activeTab === 'academic' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Filters</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{currentTermLabel || 'Current term'} syllabus only</div>
                </div>
                <button className={`btn btn-sm ${compactView ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCompactView(v => !v)}>
                  {compactView ? 'Dense' : 'Spacious'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) 1fr 1fr', gap: 10 }}>
                <div>
                  <label>Search</label>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Topic, code, or course" />
                </div>
                <div>
                  <label>Course</label>
                  <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                    <option value="all">All courses</option>
                    {currentTermCourseStats.map(course => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Status</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="notStarted">Not Started</option>
                    <option value="inProgress">In Progress</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 12, borderColor: 'var(--accent)', background: addingAcademic ? 'linear-gradient(135deg, rgba(139,92,246,0.08), transparent)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: addingAcademic ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> Log Study</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Manual entry for any study session</div>
                </div>
                <button className={`btn btn-sm ${addingAcademic ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAddingAcademic(v => !v)}>
                  {addingAcademic ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {addingAcademic && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label>Date</label>
                    <input type="date" value={academicForm.date} onChange={e => setAcademicForm({ ...academicForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label>Hours</label>
                    <input type="number" step="0.5" value={academicForm.hours} onChange={e => setAcademicForm({ ...academicForm, hours: e.target.value })} placeholder="e.g., 2.5" />
                  </div>
                  <div>
                    <label>Course</label>
                    <select value={academicForm.courseId} onChange={e => setAcademicForm({ ...academicForm, courseId: e.target.value })}>
                      <option value="">Select course</option>
                      {currentTermCourseStats.map(course => <option key={course.id} value={course.id}>{course.code}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Topic / Activity</label>
                    <input value={academicForm.topic} onChange={e => setAcademicForm({ ...academicForm, topic: e.target.value })} placeholder="e.g., Chapter 3 review" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button className="btn btn-primary" onClick={addAcademic} style={{ width: '100%' }}>Save Entry</button>
                  </div>
                </div>
              )}
            </div>

            <style>{`
              @keyframes slideDown {
                from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1000px; }
              }
              @keyframes slideUp {
                from { opacity: 1; max-height: 1000px; } to { opacity: 0; max-height: 0; }
              }
              .course-topics-expand { animation: slideDown 0.3s ease-out; }
              .course-topics-collapse { animation: slideUp 0.3s ease-in; }
            `}</style>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${compactView ? '280px' : '340px'}, 1fr))`, gap: 14 }}>
              {visibleCurrentTermCourseStats.map(course => {
                const progressWidth = course.totalTopics ? Math.max(8, course.progress) : 0;
                const completionPercent = course.totalTopics ? Math.round((course.completedTopics / course.totalTopics) * 100) : 0;
                const isOpen = openCourses[course.id];

                return (
                  <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${progressWidth > 50 ? '#8b5cf6' : '#10b981'}`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 14px 12px', background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(16,185,129,0.06))', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s ease' }} onClick={() => toggleCourse(course.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{course.code}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{course.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: completionPercent === 100 ? '#10b981' : '#f59e0b', background: completionPercent === 100 ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)', padding: '3px 10px', borderRadius: 6 }}>{completionPercent}%</span>
                          <div style={{ fontSize: 18, transition: 'transform 0.3s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} /> {course.coveredTopics}/{course.totalTopics}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> {course.completedTopics} done</span>
                        {course.runningTopics > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={11} /> {course.runningTopics} active</span>}
                      </div>
                      <div style={{ marginTop: 0, height: 7, borderRadius: 999, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                        <div style={{ width: `${progressWidth}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #8b5cf6, #10b981)', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ maxHeight: compactView ? 320 : 420, overflowY: 'auto', animation: 'slideDown 0.3s ease-out', flex: 1 }}>
                        {course.visibleTopics.length === 0 ? (
                          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No topics match filters</div>
                        ) : (
                          course.visibleTopics.map((topicRow, idx) => (
                            <div key={topicRow.id} style={{ padding: compactView ? '10px 14px' : '12px 14px', borderBottom: idx < course.visibleTopics.length - 1 ? '1px solid var(--border)' : 'none', transition: 'all 0.2s ease' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div onClick={() => quickToggleTopic(course.id, topicRow.topic)} style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35, cursor: 'pointer' }}>{topicRow.topic}</div>
                                  {!compactView && topicRow.latest?.startDate && (
                                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                                      Start: {topicRow.latest.startDate}{topicRow.latest.endDate ? ` • End: ${topicRow.latest.endDate}` : ''}
                                    </div>
                                  )}
                                  {!compactView && topicRow.durationDays && (
                                    <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>Finished in {topicRow.durationDays} days</div>
                                  )}
                                  {!compactView && topicRow.runningDays && (
                                    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Running {topicRow.runningDays} days</div>
                                  )}
                                  <div style={{ marginTop: compactView ? 2 : 6, fontSize: 10, fontWeight: 500, color: topicRow.status === 'done' ? '#10b981' : topicRow.status === 'running' ? '#f59e0b' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {topicRow.status === 'done' ? <><CheckCircle2 size={11} /> Completed</> : topicRow.status === 'running' ? <><Timer size={11} /> In progress</> : 'Not started'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => startTopic(course.id, topicRow.topic)}>
                                    Start
                                  </button>
                                  <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={() => endTopic(course.id, topicRow.topic)}>
                                    End
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {visibleCurrentTermCourseStats.length === 0 && (
              <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                <p>No current-term topics match your filters.</p>
              </div>
            )}

            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>History</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>All saved academic entries</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setShowHistory(v => !v)}>
                  {showHistory ? 'Hide' : 'Show'}
                </button>
              </div>
              {showHistory && (
                <div style={{ marginTop: 10 }}>
                  {Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => (
                    <div key={date} style={{ marginBottom: 12 }}>
                      <div className="section-title">{new Date(date).toLocaleDateString('en-BD', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      {byDate[date].map(session => {
                        const course = getCourse(session.courseId);
                        const status = getAcademicStatus(session);
                        const statusColor = getStatusColor(status);
                        const isEditing = editingId === session.id;

                        return (
                          <div key={session.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button onClick={() => toggleAcademicComplete(session.id)} style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                border: `2px solid ${statusColor}`,
                                background: status === 'complete' ? statusColor : (status === 'inProgress' ? `${statusColor}40` : 'transparent'),
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {status === 'complete' && <Check size={12} color="white" />}
                                {status === 'inProgress' && <Clock3 size={10} color={statusColor} />}
                              </button>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{session.topic}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{course?.code}{session.hours ? ` · ${session.hours}h` : ''}</div>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingId(isEditing ? null : session.id);
                                  if (!isEditing) {
                                    setEditForm({ startDate: session.startDate || '', endDate: session.endDate || '' });
                                  }
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px', fontSize: 12 }}
                              >
                                {isEditing ? 'X' : 'Edit'}
                              </button>
                              <button onClick={() => delAcademic(session.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px 8px' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {isEditing && !compactView && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginLeft: 30, padding: '8px', backgroundColor: 'var(--card)', borderRadius: 4 }}>
                                <div>
                                  <label style={{ fontSize: 11, color: 'var(--muted)' }}>Start</label>
                                  <input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} style={{ width: '100%', fontSize: 12 }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, color: 'var(--muted)' }}>End (optional)</label>
                                  <input type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} style={{ width: '100%', fontSize: 12 }} />
                                </div>
                                <button onClick={() => updateAcademicDates(session.id, editForm.startDate, editForm.endDate)} className="btn btn-primary btn-sm">Save</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {filteredAcademicSessions.length === 0 && !adding && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      <p>No academic study sessions match your filters.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Weekly Mini-Calendar</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {weeklyHeatmap.map(day => {
                  const intensity = Math.min(1, (day.hours || 0) / weeklyMaxHours);
                  const background = `rgba(16, 185, 129, ${0.15 + intensity * 0.75})`;
                  return (
                    <div key={day.day} title={`${day.label}: ${Number(day.hours || 0).toFixed(1)}h`} style={{ padding: '8px 0', textAlign: 'center', borderRadius: 8, background, color: intensity > 0.6 ? '#052e1b' : '#064e3b', fontSize: 11, fontWeight: 700 }}>
                      {day.label}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>Brighter = more hours logged</div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Due Soon</div>
              {dueSoon.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>No in-progress topics older than 3 days.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {dueSoon.slice(0, 5).map(item => (
                    <div key={`${item.courseCode}:${item.topic}`} style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{item.courseCode}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.topic}</div>
                      <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>Running {item.daysRunning} days</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Current term overview</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {courseBars.map(course => (
                  <div key={course.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{course.code}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{course.name}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{course.coveredTopics}/{course.totalTopics}</div>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                      <div style={{ width: `${course.progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #8b5cf6, #10b981)' }} />
                    </div>
                  </div>
                ))}
                {courseBars.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>No current-term syllabus topics found for this department.</div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Weekly Progress (Hours)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>How this works</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                <div>Start opens a topic as active.</div>
                <div>End closes it and records the total days.</div>
                <div>Filters apply to the current-term syllabus map, not just the history.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'extra' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Zap size={13} /> Deep Focus</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Books, courses, tutorials, papers, and anything outside the syllabus</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={13} /> Add</button>
              </div>
            </div>

            {adding && (
              <div className="card" style={{ borderColor: 'var(--accent)', padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Add Deep Focus Item</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label>Type</label>
                    <select value={extraForm.category} onChange={e => setExtraForm({ ...extraForm, category: e.target.value })}>
                      <option value="book">Book</option>
                      <option value="course">Course</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="paper">Research Paper</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div><label>Start Date</label><input type="date" value={extraForm.startDate} onChange={e => setExtraForm({ ...extraForm, startDate: e.target.value })} /></div>
                  <div><label>End Date</label><input type="date" value={extraForm.endDate} onChange={e => setExtraForm({ ...extraForm, endDate: e.target.value })} /></div>
                </div>
                <div style={{ marginBottom: 10 }}><label>Title</label><input value={extraForm.title} onChange={e => setExtraForm({ ...extraForm, title: e.target.value })} placeholder="e.g., Atomic Habits" /></div>
                <div style={{ marginBottom: 10 }}><label>Attachment / Link</label><input value={extraForm.attachment} onChange={e => setExtraForm({ ...extraForm, attachment: e.target.value })} placeholder="Drive link or file name" /></div>
                <div style={{ marginBottom: 10 }}><label>Notes</label><textarea value={extraForm.notes} onChange={e => setExtraForm({ ...extraForm, notes: e.target.value })} rows={2} placeholder="Chapters, key goals..." /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addExtra}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              </div>
            )}

            {extraReading.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {extraReading.map(item => (
                  <div key={item.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {item.category === 'book' && <FileText size={13} color="var(--accent)" />}
                            {item.category === 'course' && <GraduationCap size={13} color="var(--accent)" />}
                            {item.category === 'tutorial' && <Film size={13} color="var(--accent)" />}
                            {item.category === 'paper' && <FileText size={13} color="var(--accent)" />}
                            {item.category === 'other' && <Paperclip size={13} color="var(--accent)" />}
                            {item.title}
                          </span>
                          {item.endDate && <span className="tag tag-green" style={{ fontSize: 10 }}>✓ Done</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Start: {item.startDate || '—'}{item.endDate ? ` · End: ${item.endDate}` : ''}</div>
                        {item.attachment && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={11} /> {item.attachment}</div>}
                        {item.notes && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => toggleExtraDone(item.id)}>
                          {item.endDate ? 'Reopen' : 'End'}
                        </button>
                        <button onClick={() => delExtra(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {extraReading.length === 0 && !adding && (
              <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                <p>No Deep Focus items yet. Add books, courses, tutorials, or papers here.</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Deep Focus summary</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>Total items</span><strong>{extraReading.length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>Finished</span><strong>{extraReading.filter(item => item.done).length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>Open</span><strong>{extraReading.filter(item => !item.done).length}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>With link</span><strong>{extraReading.filter(item => item.attachment).length}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}