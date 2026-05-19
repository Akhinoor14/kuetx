import { useState, useMemo, useEffect } from 'react';
import { Download, BookMarked } from 'lucide-react';
import { store, getProfile, getAllCourses, getCurrentTermKey } from '../store/store';
import '../styles/questionBankMinimal.css';

export default function QuestionBank() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const currentTermKey = getCurrentTermKey(profile);

  const [rawSets] = useState(() => store.get('questionBank') || []);
  const [search, setSearch] = useState('');
  const [viewCurrent, setViewCurrent] = useState(true);
  const [showContribute, setShowContribute] = useState(false);

  // dedupe: keep one set per courseId+year+term+examType
  const questionSets = useMemo(() => {
    const map = new Map();
    (rawSets || []).forEach(q => {
      const key = `${q.courseId}|${q.year}|${q.term}|${q.examType}`;
      if (!map.has(key)) map.set(key, q);
    });
    return Array.from(map.values());
  }, [rawSets]);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    let items = questionSets;
    if (viewCurrent && currentTermKey) {
      const match = currentTermKey.match(/Y(\\d)T(\\d)/);
      if (match) {
        const [, year, term] = match.map(Number);
        items = items.filter(i => i.year === year && i.term === term);
      }
    }
    if (q) items = items.filter(i => (i.courseCode + ' ' + i.courseName + ' ' + (i.examType||'')).toLowerCase().includes(q));
    return items;
  }, [questionSets, search, viewCurrent, currentTermKey]);

  const stats = useMemo(() => ({
    total: questionSets.length,
    available: questionSets.filter(s => s.status === 'available').length,
    solutions: questionSets.filter(s => s.solutionStatus === 'available').length,
    courses: new Set(questionSets.map(s => s.courseId)).size,
  }), [questionSets]);

  const handleDownloadTerm = (year, term) => {
    const termItems = questionSets.filter(s => s.year === year && s.term === term);
    if (!termItems.length) return alert('No questions for that term');
    alert('Preparing term ZIP — simulated');
  };

  const handleDownloadCourse = (courseId, year, term) => {
    const items = questionSets.filter(s => s.courseId === courseId && s.year === year && s.term === term);
    if (!items.length) return alert('No questions for that course/term');
    alert('Preparing course ZIP — simulated');
  };

  const openForm = () => {
    const ok = window.confirm('We will redirect you to a Google Form. Do you want to continue?');
    if (ok) window.open('https://forms.gle/9NahxuzSeeU6NTLw6', '_blank');
  };

  useEffect(() => {
    // no-op placeholder to keep parity with previous behaviour
  }, []);

  return (
    <div className="qb-root">
      <header className="qb-hero">
        <div>
          <div className="qb-badge">Question Bank</div>
          <h1 className="qb-title">Past papers & solutions</h1>
          <p className="qb-sub">Term-wise ZIP downloads · Solution progress · Minimal, modern view</p>
        </div>
        <div className="qb-stats">
          <div className="s"><div className="n">{stats.total}</div><div className="l">Sets</div></div>
          <div className="s"><div className="n">{stats.available}</div><div className="l">Available</div></div>
          <div className="s"><div className="n">{stats.solutions}</div><div className="l">Solutions</div></div>
          <div className="s"><div className="n">{stats.courses}</div><div className="l">Courses</div></div>
        </div>
      </header>

      <div className="qb-controls">
        <div className="qb-search">
          <input aria-label="Search" placeholder="Search by code or course" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="qb-actions">
          <button className={`chip ${viewCurrent ? 'active' : ''}`} onClick={() => setViewCurrent(true)}>Current term</button>
          <button className={`chip ${!viewCurrent ? 'active' : ''}`} onClick={() => setViewCurrent(false)}>All terms</button>
        </div>
      </div>

      <main className="qb-list">
        {filtered.length === 0 ? (
          <div className="qb-help">
            <div className="qb-help-meta">Need solutions or questions?</div>
            <div className="qb-help-title">Share a question paper or solution to help others.</div>
            <div className="qb-help-sub">Tap contribute to send the missing content and keep the bank complete.</div>
            <button className="btn primary" onClick={openForm}>Contribute</button>
          </div>
        ) : (
          filtered.map(item => (
            <article className="qb-card" key={item.id}>
              <div className="meta">
                <div className="code">{item.courseCode}</div>
                <div className="term">{item.termLabel || `Y${item.year} T${item.term}`}</div>
              </div>
              <div className="body">
                <div className="name">{item.courseName}</div>
                <div className="sub">{item.questionCount || '-'} questions · {item.examType || 'Exam'}</div>
              </div>
              <div className="card-actions">
                <button className="btn primary" onClick={() => handleDownloadTerm(item.year, item.term)}><Download size={14}/> Term</button>
                <button className="btn" onClick={() => handleDownloadCourse(item.courseId, item.year, item.term)}>Course</button>
              </div>
            </article>
          ))
        )}
      </main>

      {showContribute && (
        <div className="qb-footer-note">Thanks — redirecting to contribution form.</div>
      )}
    </div>
  );
}


