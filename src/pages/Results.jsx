import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { store, GRADE_SCALE, cgpaToPercent, computeCourseGrade, computeCGPA, getAllCourses, getLegacyTermResults, getProfile, setLegacyTermResults } from '../store/store';
import Collapsible from '../components/Collapsible';

const TERM_KEYS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

export default function Results() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const [marks, setMarks] = useState(() => store.get('marks') || {});
  const [legacyTerms, setLegacyTerms] = useState(() => getLegacyTermResults());

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

    // Group by term
    const termMap = {};
    courseResults.forEach(c => {
      const k = `Y${c.year}T${c.term}`;
      if (!termMap[k]) termMap[k] = { label: `Year ${c.year} · Term ${c.term}`, key: k, courses: [], pts: 0, cr: 0 };
      termMap[k].courses.push(c);
      if (!c.isX && c.grade !== 'F' && c.grade !== 'W' && c.gradePoint >= 2.0 && c.credits) {
        termMap[k].pts += c.gradePoint * c.credits;
        termMap[k].cr  += c.credits;
      }
    });
    legacyTerms.forEach(row => {
      const k = row?.termKey;
      const gpa = +row?.gpa;
      const credits = +row?.credits;
      if (!k || !Number.isFinite(gpa) || !Number.isFinite(credits) || credits <= 0) return;
      if (!termMap[k]) termMap[k] = { label: `Legacy ${k}`, key: k, courses: [], pts: 0, cr: 0 };
      termMap[k].pts += gpa * credits;
      termMap[k].cr += credits;
      termMap[k].courses.push({
        id: `legacy-${k}`,
        code: 'LEGACY',
        name: `Imported GPA (${k})`,
        type: 'Legacy',
        credits,
        grade: '-',
        gradePoint: gpa,
        total: null,
        isX: false,
        displayStatus: 'completed',
      });
    });

    const terms = Object.values(termMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(t => ({ ...t, gpa: t.cr ? (t.pts / t.cr).toFixed(2) : '—', totalCredits: t.courses.reduce((s, c) => s + (c.credits || 0), 0) }));

    const { cgpa } = computeCGPA(courses);
    return { courseResults, terms, cgpa };
  }, [courses, marks, legacyTerms]);

  const chartData = terms.map(t => ({ term: t.key, gpa: parseFloat(t.gpa) || 0 }));

  const gradeColor = (g) => {
    if (!g || g === '—') return 'var(--muted)';
    if (g === 'F' || g === 'W') return 'var(--danger)';
    if (g === 'X') return 'var(--warning)';
    if (['A+','A','A-'].includes(g)) return 'var(--success)';
    return 'var(--text)';
  };

  return (
    <div className="page-enter page-container">
      <div className="hero-banner" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Results & GPA</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Auto-calculated from your marks and attendance</p>
      </div>

      {/* CGPA Banner */}
      {cgpa !== null && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>CGPA</div>
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

      <Collapsible
        className="mb-3"
        title="Previous Term Result Import"
        subtitle="Past term GPA + credits auto-add into CGPA"
        defaultCollapsed={true}
        storageKey="results:legacy-import:open"
      >
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          আগের term-এর GPA + credits দিলে সেটা automatic CGPA-তে যোগ হবে।
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {legacyTerms.map((row, idx) => (
            <div key={`${row.termKey || 'row'}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label>Term</label>
                <select value={row.termKey || ''} onChange={e => updateLegacyRow(idx, 'termKey', e.target.value)}>
                  <option value="">Select term</option>
                  {TERM_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label>GPA</label>
                <input type="number" min={0} max={4} step={0.01} value={row.gpa ?? ''} onChange={e => updateLegacyRow(idx, 'gpa', e.target.value)} placeholder="e.g. 3.42" />
              </div>
              <div>
                <label>Credits</label>
                <input type="number" min={0} max={30} step={0.5} value={row.credits ?? ''} onChange={e => updateLegacyRow(idx, 'credits', e.target.value)} placeholder="e.g. 19.5" />
              </div>
              <button className="btn btn-ghost" onClick={() => removeLegacyRow(idx)}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary" onClick={addLegacyRow}>+ Add Previous Term</button>
        </div>
      </Collapsible>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>GPA per Term</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData}>
              <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} formatter={(v) => [v.toFixed(2), 'GPA']} />
              <Bar dataKey="gpa" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Term results */}
      {terms.map(term => (
        <div key={term.key} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{term.label}</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span>GPA: <strong style={{ color: 'var(--accent)' }}>{term.gpa}</strong></span>
              <span style={{ color: 'var(--muted)' }}>Total credits: {term.totalCredits}</span>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Code', 'Course Name', 'Type', 'Cr', 'Status', 'Total%', 'Grade', 'Point', 'Result Upload'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {term.courses.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12 }}>{c.code}</td>
                    <td style={{ padding: '8px 12px', maxWidth: 200 }}>{c.name}</td>
                    <td style={{ padding: '8px 12px' }}><span className="tag tag-gray" style={{ fontSize: 10 }}>{c.type}</span></td>
                    <td style={{ padding: '8px 12px' }}>{c.credits}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span className={`tag ${c.displayStatus === 'completed' ? 'tag-blue' : 'tag-green'}`} style={{ fontSize: 10 }}>
                        {c.displayStatus === 'completed' ? 'Completed' : 'Running'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace' }}>{c.isX ? 'X' : (c.total ?? '—')}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: gradeColor(c.grade) }}>{c.grade}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace' }}>{Number.isFinite(+c.gradePoint) ? (+c.gradePoint).toFixed(2) : '—'}</td>
                    <td style={{ padding: '8px 12px', minWidth: 170 }}>
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
      ))}

      {courses.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Add courses and enter marks to see results.</p>
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
