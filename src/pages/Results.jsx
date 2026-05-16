import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList } from 'recharts';
import { Sparkles, Target, TrendingUp, ArrowRight } from 'lucide-react';
import { store, GRADE_SCALE, cgpaToPercent, computeCourseGrade, computeCGPA, getAllCourses, getLegacyTermResults, getProfile, setLegacyTermResults, TERM_KEYS, getTermCreditsFromCurriculum } from '../store/store';
import Collapsible from '../components/Collapsible';

export default function Results() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const [marks, setMarks] = useState(() => store.get('marks') || {});
  const [legacyTerms, setLegacyTerms] = useState(() => getLegacyTermResults());
  const [legacyResolutions, setLegacyResolutions] = useState(() => store.get('legacyTermResolution') || {});
  const setTermResolution = (termKey, value) => {
    const next = { ...(store.get('legacyTermResolution') || {}), ...(legacyResolutions || {}) };
    if (!value) delete next[termKey]; else next[termKey] = value;
    setLegacyResolutions(next);
    store.set('legacyTermResolution', next);
  };

  const onMarkChange = (courseId, field, value) => {
    const next = { ...marks, [courseId]: { ...(marks[courseId] || {}), [field]: value } };
    setMarks(next);
    store.set('marks', next);
  };

  const updateLegacyRow = (index, field, value) => {
    const next = legacyTerms.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    setLegacyTerms(next);
    setLegacyTermResults(next);
  };

  const addLegacyRow = () => {
    const used = new Set(legacyTerms.map(r => r.termKey));
    const free = TERM_KEYS.find(k => !used.has(k)) || '';
    const next = [...legacyTerms, { termKey: free, gpa: '', credits: '' }];
    setLegacyTerms(next);
    setLegacyTermResults(next);
  };

  const removeLegacyRow = (index) => {
    const next = legacyTerms.filter((_, i) => i !== index);
    setLegacyTerms(next);
    setLegacyTermResults(next);
  };

  // Calculate max possible CGPA for all 8 curriculum terms
  const calcMaxCGPA = () => {
    const profile = getProfile();
    const deptCode = profile?.dept;
    if (!deptCode) return null;

    let totalPts = 0;
    let totalCr = 0;
    const resolutions = store.get('legacyTermResolution') || {};
    const legacyRows = Array.isArray(legacyTerms) ? legacyTerms : [];
    const legacyMap = Object.fromEntries(legacyRows.map(row => [row?.termKey, row]));

    // Group courses by term for quick lookup
    const coursesByTerm = {};
    courses.forEach(c => {
      const termKey = `Y${c.year}T${c.term}`;
      if (!coursesByTerm[termKey]) coursesByTerm[termKey] = [];
      coursesByTerm[termKey].push(c);
    });

    // Loop through all 8 curriculum terms
    TERM_KEYS.forEach(termKey => {
      const curriculumCredits = getTermCreditsFromCurriculum(deptCode, termKey);
      if (curriculumCredits <= 0) return;

      // Determine GPA for this term
      let termGPA = 4.0; // Default to perfect for future terms

      // Priority 1: Check for legacy import (if not overridden to use_courses)
      if (legacyMap[termKey] && resolutions[termKey] !== 'use_courses') {
        const legacyGPA = +legacyMap[termKey].gpa;
        if (Number.isFinite(legacyGPA)) {
          termGPA = legacyGPA;
        }
      } 
      // Priority 2: Use course grades if this term has them
      else if (coursesByTerm[termKey]) {
        let coursePts = 0;
        let courseCr = 0;
        coursesByTerm[termKey].forEach(c => {
          if (c.type === 'NonCredit') return;
          const { grade, point, isX } = computeCourseGrade(c);
          if (isX) return;
          if (grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
            coursePts += point * c.credits;
            courseCr += c.credits;
          }
        });
        if (courseCr > 0) {
          termGPA = coursePts / courseCr;
        }
      }

      totalPts += termGPA * curriculumCredits;
      totalCr += curriculumCredits;
    });

    return totalCr > 0 ? +(totalPts / totalCr).toFixed(2) : null;
  };

  const { courseResults, terms, cgpa } = useMemo(() => {
    const courseResults = courses.map(c => {
      const { grade, point, total, isX } = computeCourseGrade(c);
      const m = marks[c.id] || {};
      const hasPublishedResult = !!String(m.publishedGrade || m.resultGrade || '').trim();
      const hasAnyEntry = Object.values(m).some(v => v !== '' && v !== null && v !== undefined);
      const isRunningCourse = c.status === 'active' || c.status === 'backlog';
      const displayStatus = hasPublishedResult ? 'completed' : (isRunningCourse ? 'running' : 'completed');

      // Do not show synthetic F before result upload.
      if (!hasPublishedResult && !hasAnyEntry) {
        return { ...c, grade: '—', gradePoint: null, total: null, isX: false, displayStatus };
      }

      return { ...c, grade, gradePoint: point, total, isX, displayStatus };
    });

    // Group courses by term and compute course-only pts/cr
    const courseTermMap = {};
    courseResults.forEach(c => {
      const k = `Y${c.year}T${c.term}`;
      if (!courseTermMap[k]) courseTermMap[k] = { label: `Year ${c.year} · Term ${c.term}`, key: k, courses: [], pts: 0, cr: 0 };
      courseTermMap[k].courses.push(c);
      if (!c.isX && c.grade !== 'F' && c.grade !== 'W' && c.gradePoint >= 2.0 && c.credits) {
        courseTermMap[k].pts += c.gradePoint * c.credits;
        courseTermMap[k].cr  += c.credits;
      }
    });

    // Map legacy imports by term
    const legacyMap = {};
    legacyTerms.forEach(row => {
      const k = row?.termKey;
      const gpa = +row?.gpa;
      const credits = +row?.credits;
      if (!k || !Number.isFinite(gpa) || !Number.isFinite(credits) || credits <= 0) return;
      legacyMap[k] = { gpa, credits, pts: gpa * credits };
    });

    // Build union of keys
    const keys = new Set([...Object.keys(courseTermMap), ...Object.keys(legacyMap)]);
    const termList = [];
    keys.forEach(k => {
      const coursePart = courseTermMap[k] || { label: `Year ${k.slice(1,2)} · Term ${k.slice(3)}`, key: k, courses: [], pts: 0, cr: 0 };
      const legacyPart = legacyMap[k] || null;

      // combined by default
      let pts = coursePart.pts + (legacyPart ? legacyPart.pts : 0);
      let cr = coursePart.cr + (legacyPart ? legacyPart.credits : 0);

      // detect conflict when both exist
      let conflict = null;
      if (legacyPart && coursePart.cr > 0) {
        const courseGpa = coursePart.cr ? (coursePart.pts / coursePart.cr) : null;
        const legacyGpa = legacyPart.gpa;
        const gpaDiff = courseGpa !== null ? Math.abs(courseGpa - legacyGpa) : 0;
        if (gpaDiff >= 0.05 || Math.abs(coursePart.cr - legacyPart.credits) >= 1) {
          conflict = { courseGpa: courseGpa ? +courseGpa.toFixed(2) : null, courseCredits: coursePart.cr, legacyGpa: legacyGpa, legacyCredits: legacyPart.credits };
        }
      }

      // apply resolution if user selected one
      const resolution = store.get('legacyTermResolution') || {};
      if (resolution[k] === 'use_legacy') {
        pts = legacyPart ? legacyPart.pts : pts;
        cr = legacyPart ? legacyPart.credits : cr;
      } else if (resolution[k] === 'use_courses') {
        pts = coursePart.pts;
        cr = coursePart.cr;
      }

      const courseOnlyGpa = coursePart.cr ? (coursePart.pts / coursePart.cr).toFixed(2) : '—';
      const hasLegacy = !!legacyPart;
      const displayGpa = resolution[k] === 'use_courses'
        ? courseOnlyGpa
        : hasLegacy
          ? legacyPart.gpa.toFixed(2)
          : courseOnlyGpa;
      // Use curriculum credits for the term, not just user's entered courses
      const deptCode = profile?.dept;
      const curriculumTermCredits = deptCode ? getTermCreditsFromCurriculum(deptCode, k) : 0;
      const termTotalCredits = coursePart.courses.reduce((s, c) => s + (c.credits || 0), 0) || curriculumTermCredits;

      termList.push({ label: coursePart.label || `Legacy ${k}`, key: k, courses: coursePart.courses, pts: coursePart.pts, cr: coursePart.cr, gpa: courseOnlyGpa, displayGpa, totalCredits: termTotalCredits, legacyGpa: legacyPart?.gpa || null, legacyCredits: legacyPart?.credits || null, conflict, resolution: (store.get('legacyTermResolution') || {})[k] || null });
    });

    const terms = termList.sort((a,b) => a.key.localeCompare(b.key));

    const { cgpa } = computeCGPA(courses);
    return { courseResults, terms, cgpa };
  }, [courses, marks, legacyTerms, legacyResolutions]);

  const maxCgpa = calcMaxCGPA();
  const chartData = terms.map(t => ({
    term: t.key,
    label: t.label,
    gpa: Number.isFinite(parseFloat(t.displayGpa)) ? parseFloat(t.displayGpa) : null,
  }));
  const chartVisibleData = chartData.filter(item => Number.isFinite(item.gpa));
  const chartAverage = chartVisibleData.length ? chartVisibleData.reduce((sum, item) => sum + item.gpa, 0) / chartVisibleData.length : 0;
  const chartBest = chartVisibleData.reduce((best, item) => (!best || item.gpa > best.gpa ? item : best), null);
  const chartLatest = chartVisibleData[chartVisibleData.length - 1] || null;

  const renderGpaTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload;
    return (
      <div style={{
        background: 'var(--surfaceGlassStrong)',
        border: '1px solid rgba(var(--accentRGB), 0.18)',
        borderRadius: 14,
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
        padding: '12px 14px',
        minWidth: 170,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{item.label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.04em' }}>{item.gpa.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>GPA</div>
        </div>
        <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: 'rgba(var(--accentRGB), 0.12)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (item.gpa / 4) * 100)}%`, height: '100%', borderRadius: 999, background: item.gpa >= 3.75 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #0ea5e9)' }} />
        </div>
      </div>
    );
  };

  const gradeColor = (g) => {
    if (!g || g === '—') return 'var(--muted)';
    if (g === 'F' || g === 'W') return 'var(--danger)';
    if (g === 'X') return 'var(--warning)';
    if (['A+','A','A-'].includes(g)) return 'var(--success)';
    return 'var(--text)';
  };

  return (
    <div className="page-enter page-container">
      {/* Current vs Max CGPA Banner */}
      {cgpa !== null && (
        <div className="hero-banner" style={{
          marginBottom: 20,
          padding: 20,
          border: '1px solid rgba(var(--accentRGB), 0.16)',
          background: 'radial-gradient(circle at top left, rgba(var(--accentRGB), 0.18), transparent 38%), linear-gradient(135deg, rgba(var(--accentRGB), 0.12) 0%, rgba(var(--accentRGB), 0.04) 54%, rgba(16, 185, 129, 0.08) 100%)',
          boxShadow: '0 22px 50px rgba(15, 23, 42, 0.10)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', inset: -40, background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 24%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(var(--accentRGB), 0.12)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px rgba(var(--accentRGB), 0.12)' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Academic Outlook</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>Current standing versus graduation ceiling</div>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--surfaceGlass)', border: '1px solid rgba(var(--accentRGB), 0.12)', color: 'var(--text)', fontSize: 11, fontWeight: 700 }}>
                <TrendingUp size={14} />
                Live CGPA outlook
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 14, alignItems: 'stretch' }}>
            <div style={{
              padding: '18px 20px',
              borderRadius: 18,
              background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
              border: '1px solid rgba(var(--accentRGB), 0.12)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Current CGPA</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>
                  <Target size={13} />
                  Now
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.06em', color: cgpa >= 3.75 ? '#059669' : cgpa >= 2.20 ? '#0f172a' : '#dc2626', lineHeight: 0.95 }}>
                  {cgpa.toFixed(2)}
                </div>
                <div style={{ paddingBottom: 10, color: 'var(--muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: cgpa >= 3.75 ? '#10b981' : '#3b82f6' }} />
                  {cgpaToPercent(cgpa).toFixed(2)}% equivalent
                </div>
              </div>
              <div style={{ marginTop: 14, height: 8, background: 'rgba(var(--accentRGB), 0.10)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (cgpa / 4) * 100)}%`, height: '100%', borderRadius: 999, background: cgpa >= 3.75 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #0ea5e9)', transition: 'width 0.35s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 56 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--surfaceGlassStrong)', border: '1px solid rgba(var(--accentRGB), 0.14)', color: 'var(--accent)', fontWeight: 900, fontSize: 18, boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)' }}>
                <ArrowRight size={18} />
              </div>
            </div>

            <div style={{
              padding: '18px 20px',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.08))',
              border: '1px solid rgba(16, 185, 129, 0.18)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Max Possible CGPA</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: 11, fontWeight: 700 }}>
                  <Sparkles size={13} />
                  Ceiling
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.06em', color: '#059669', lineHeight: 0.95 }}>
                  {maxCgpa !== null ? maxCgpa.toFixed(2) : '—'}
                </div>
                <div style={{ paddingBottom: 10, color: 'var(--muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: '#10b981' }} />
                  if all remaining get 4.0
                </div>
              </div>
              <div style={{ marginTop: 14, height: 8, background: 'rgba(16, 185, 129, 0.12)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: maxCgpa !== null ? `${Math.min(100, (maxCgpa / 4) * 100)}%` : '0%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #34d399, #10b981)', transition: 'width 0.35s ease' }} />
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {!cgpa && (
        <div className="hero-banner" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Results & GPA</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Auto-calculated from your marks and attendance</p>
        </div>
      )}
      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 18, background: 'linear-gradient(180deg, var(--surfaceGlassStrong), rgba(var(--accentRGB), 0.02))', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Progress Trend</div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4 }}>GPA per Term</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>A term-by-term view with trend, best term, and recent momentum.</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', border: '1px solid rgba(var(--accentRGB), 0.10)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                Avg {chartAverage ? chartAverage.toFixed(2) : '—'}
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.10)', border: '1px solid rgba(16, 185, 129, 0.16)', fontSize: 12, fontWeight: 700, color: '#065f46' }}>
                Best {chartBest ? `${chartBest.term} · ${chartBest.gpa.toFixed(2)}` : '—'}
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.10)', border: '1px solid rgba(59, 130, 246, 0.14)', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                Latest {chartLatest ? chartLatest.gpa.toFixed(2) : '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(var(--accentRGB), 0.06)', border: '1px solid rgba(var(--accentRGB), 0.10)', fontSize: 11, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: 'linear-gradient(180deg, #3b82f6, #0ea5e9)' }} />
              Term GPA
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.12)', fontSize: 11, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#10b981' }} />
              Honors line
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(217, 119, 6, 0.06)', border: '1px solid rgba(217, 119, 6, 0.12)', fontSize: 11, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: '#d97706' }} />
              Graduation minimum
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="gpaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gpaStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(107,104,96,0.12)" strokeDasharray="4 6" vertical={false} />
              <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'var(--muted)', fontWeight: 700 }} tickLine={false} axisLine={false} dy={10} />
              <YAxis domain={[0, 4]} ticks={[0, 1, 2, 2.2, 3, 3.75, 4]} tick={{ fontSize: 10, fill: 'var(--muted)', fontWeight: 700 }} tickLine={false} axisLine={false} width={38} />
              <Tooltip content={renderGpaTooltip} cursor={{ stroke: 'rgba(var(--accentRGB), 0.18)', strokeWidth: 1.5 }} />
              <ReferenceLine y={2.2} stroke="#d97706" strokeDasharray="6 6" strokeOpacity={0.55} label={{ value: '2.20', position: 'insideRight', fill: '#d97706', fontSize: 10, fontWeight: 700 }} />
              <ReferenceLine y={3.75} stroke="#10b981" strokeDasharray="6 6" strokeOpacity={0.65} label={{ value: '3.75', position: 'insideRight', fill: '#10b981', fontSize: 10, fontWeight: 700 }} />
              <Area type="monotone" dataKey="gpa" stroke="url(#gpaStroke)" strokeWidth={3} fill="url(#gpaFill)" dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: 'var(--accent)' }} activeDot={{ r: 7, strokeWidth: 2, fill: '#fff', stroke: '#10b981' }} />
              <LabelList dataKey="gpa" position="top" offset={10} formatter={(value) => value ? value.toFixed(2) : ''} style={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Term results - collapsible by default */}
      {terms.map(term => {
        const gpaNum = parseFloat(term.displayGpa);
        const isGpa = Number.isFinite(gpaNum);
        const gpaColor = isGpa ? (gpaNum >= 3.75 ? '#10b981' : gpaNum >= 3.0 ? '#3b82f6' : gpaNum >= 2.0 ? '#f59e0b' : '#ef4444') : '#9ca3af';
        const courseCount = term.courses.length;
        const completedCount = term.courses.filter(c => c.displayStatus === 'completed').length;
        const completionPct = courseCount ? Math.round((completedCount / courseCount) * 100) : 0;

        return (
        <Collapsible
          key={term.key}
          className="mb-3"
          title={term.label}
          subtitle={null}
          defaultCollapsed={true}
          storageKey={`results:term:${term.key}:open`}
          right={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Completion Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', minWidth: 28, textAlign: 'right' }}>{completionPct}%</div>
                <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${completionPct}%`, height: '100%', background: gpaColor, transition: 'width 0.3s ease' }} />
                </div>
              </div>
              {/* GPA Badge */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: '6px 12px', 
                background: gpaColor, 
                borderRadius: 6, 
                minWidth: 56,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>GPA</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'white', lineHeight: 1, marginTop: 2 }}>{isGpa ? gpaNum.toFixed(2) : '—'}</div>
              </div>
              {/* Credits */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Credits</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{term.totalCredits}</div>
              </div>
            </div>
          )}
        >
          {/* Expanded header summary */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 24, 
            padding: '12px 0 16px 0', 
            marginBottom: 12,
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}>
            {/* Total Marks */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Mark Points</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{term.totalCredits} / {courseCount * 4.0}</div>
            </div>
            {/* Completion */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Courses Completed</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                <span style={{ color: gpaColor }}>{completedCount}</span>
                <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>/ {courseCount}</span>
              </div>
            </div>
            {/* Avg Grade */}
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Weighted Average</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: gpaColor }}>{isGpa ? gpaNum.toFixed(2) : '—'}</div>
            </div>
            {/* Conflict resolution controls */}
            {term.conflict && (
              <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>Mismatch detected</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Imported: {term.conflict.legacyGpa} ({term.conflict.legacyCredits}cr) — Courses: {term.conflict.courseGpa ?? '—'} ({term.conflict.courseCredits}cr)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={() => setTermResolution(term.key, 'use_legacy')}>Use Imported</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTermResolution(term.key, 'use_courses')}>Use Course Data</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTermResolution(term.key, null)}>Keep Both</button>
                </div>
              </div>
            )}
          </div>

          {/* Course table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--card)' }}>
            <div style={{ overflowX: 'auto' }}>
            <table className="kuet-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(var(--accentRGB), 0.03)' }}>
                  {['Code', 'Course Name', 'Type', 'Cr', 'Status', 'Total%', 'Grade', 'Point', 'Result Upload'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {term.courses.map((c, idx) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'rgba(0,0,0,0.01)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: 'var(--accent)' }}>{c.code}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 200, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11 }}><span className="tag tag-gray" style={{ fontSize: 10 }}>{c.type}</span></td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.credits}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`tag ${c.displayStatus === 'completed' ? 'tag-blue' : 'tag-green'}`} style={{ fontSize: 10 }}>
                        {c.displayStatus === 'completed' ? 'Completed' : 'Running'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{c.isX ? 'X' : (c.total ?? '—')}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: gradeColor(c.grade), fontSize: 13 }}>{c.grade}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11 }}>{Number.isFinite(+c.gradePoint) ? (+c.gradePoint).toFixed(2) : '—'}</td>
                    <td style={{ padding: '10px 12px', minWidth: 170 }}>
                      {String(c.id).startsWith('legacy-') ? (
                        <span className="text-xs text-muted">Imported</span>
                      ) : c.type === 'Sessional' ? (
                        <select value={(marks[c.id] || {}).resultGrade || ''} onChange={e => onMarkChange(c.id, 'resultGrade', e.target.value)}>
                          <option value="">Upload grade</option>
                          {GRADE_SCALE.map(g => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                        </select>
                      ) : (
                        <select value={(marks[c.id] || {}).publishedGrade || ''} onChange={e => onMarkChange(c.id, 'publishedGrade', e.target.value)}>
                          <option value="">Upload grade</option>
                          {GRADE_SCALE.map(g => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Per-term import section */}
          {(() => {
            const termLegacy = legacyTerms.find(r => r.termKey === term.key);
            const termCredits = term.courses.filter(c => !String(c.id).startsWith('legacy-')).reduce((sum, c) => sum + (c.credits || 0), 0);
            
            // Check if there's a GPA mismatch
            const courseGpaNum = parseFloat(term.gpa);
            const hasCoursesWithGrades = Number.isFinite(courseGpaNum) && term.gpa !== '—';
            const hasMismatch = termLegacy && hasCoursesWithGrades && Math.abs(courseGpaNum - +termLegacy.gpa) >= 0.05;
            
            return (
              <div className="card" style={{ marginTop: 16, background: 'rgba(var(--accentRGB), 0.03)', border: '1px dashed var(--border)' }}>
                {/* Conflict warning if GPA mismatch */}
                {hasMismatch && (
                  <div style={{ padding: 12, marginBottom: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>⚠️ GPA Mismatch Detected</div>
                    <div style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.5 }}>
                      Imported GPA (<strong>{termLegacy.gpa}</strong>) differs from calculated GPA from courses (<strong>{courseGpaNum.toFixed(2)}</strong>). 
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button 
                          className="btn" 
                          style={{ fontSize: 10, padding: '6px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => setTermResolution(term.key, 'use_legacy')}
                        >
                          Use Imported ({termLegacy.gpa})
                        </button>
                        <button 
                          className="btn" 
                          style={{ fontSize: 10, padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => setTermResolution(term.key, 'use_courses')}
                        >
                          Use Calculated ({courseGpaNum.toFixed(2)})
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Import Past Result for {term.key}</div>
                  {termLegacy && <span className="tag tag-green">✓ Imported</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, display: 'block' }}>GPA (0-4.00)</label>
                    <input 
                      type="number" 
                      min={0} 
                      max={4} 
                      step={0.01} 
                      value={termLegacy?.gpa ?? ''} 
                      onChange={e => {
                        const gpa = e.target.value;
                        if (termLegacy) {
                          updateLegacyRow(legacyTerms.indexOf(termLegacy), 'gpa', gpa);
                        } else if (gpa) {
                          const next = [...legacyTerms, { termKey: term.key, gpa, credits: termCredits }];
                          setLegacyTerms(next);
                          setLegacyTermResults(next);
                        }
                      }} 
                      placeholder="e.g. 3.42" 
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--input)', fontSize: 12 }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4, display: 'block' }}>Credits (from curriculum)</label>
                    <div 
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', fontSize: 12, color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
                    >
                      {termCredits}
                    </div>
                  </div>
                  {termLegacy && (
                    <button 
                      className="btn btn-ghost" 
                      onClick={() => {
                        const idx = legacyTerms.indexOf(termLegacy);
                        removeLegacyRow(idx);
                      }} 
                      style={{ padding: '8px 12px', fontSize: 12 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Collapsible>
        );
      })}

      {courses.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Add courses and enter marks to see results.</p>
        </div>
      )}

      {/* Final CGPA at bottom */}
      {cgpa !== null && (
        <div className="card" style={{ marginTop: 20, marginBottom: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(var(--accentRGB), 0.05)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Final CGPA</div>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.05em', color: cgpa >= 3.75 ? 'var(--success)' : cgpa < 2.20 ? 'var(--danger)' : 'var(--text)', lineHeight: 1 }}>
              {cgpa.toFixed(2)}
            </div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Equivalent %</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{cgpaToPercent(cgpa).toFixed(2)}%</div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--border)' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cgpa >= 3.75 && <span className="tag tag-green">🎓 Honors</span>}
            {cgpa >= 3.75 && <span className="tag tag-blue">📋 Dean's List</span>}
            {cgpa >= 3.75 && <span className="tag tag-yellow">🏅 Gold Medal</span>}
            {cgpa >= 2.20 && cgpa < 3.75 && <span className="tag tag-green">✓ Good Standing</span>}
            {cgpa < 2.20  && <span className="tag tag-red">⚠ Probation Risk</span>}
          </div>
        </div>
      )}

      {/* Grade reference */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>KUET Grading Scale (Art. 13.1)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {GRADE_SCALE.map(g => (
            <div key={g.grade} style={{ textAlign: 'center', padding: '4px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 11, minWidth: 52 }}>
              <div style={{ fontWeight: 700, color: g.grade === 'F' ? 'var(--danger)' : 'var(--text)' }}>{g.grade}</div>
              <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{g.point.toFixed(2)}</div>
              <div style={{ color: 'var(--muted)', fontSize: 10 }}>≥{g.minPct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
