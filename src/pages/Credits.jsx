import { useMemo } from 'react';
import { store, computeCourseGrade, computeCGPA, getYearClass, MIN_CREDITS_FIRST_4_TERMS, MIN_CREDITS_FIRST_6_TERMS, MAX_BACKLOG_CREDITS_PER_YEAR, MAX_IMPROVEMENT_CREDITS, MAX_TERMS, MIN_CGPA_GRADUATION, getAllCourses, getProfile } from '../store/store';

export default function Credits() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
  const required = profile.totalCreditsRequired || 160;

  const { earnedCredits, byTerm, warnings, backlogCredits } = useMemo(() => {
    const byTerm = {};
    let earnedCredits = 0, backlogCredits = 0;
    const warnings = [];

    courses.forEach(c => {
      const k = `Y${c.year}T${c.term}`;
      if (!byTerm[k]) byTerm[k] = { label: `Year ${c.year} · Term ${c.term}`, key: k, earned: 0, courses: [] };
      const { grade, point, isX } = computeCourseGrade(c);
      byTerm[k].courses.push({ ...c, grade, point });
      if (!isX && grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
        byTerm[k].earned += c.credits;
        earnedCredits    += c.credits;
        if (c.status === 'backlog') backlogCredits += c.credits;
      }
    });

    // Milestone warnings
    const keys = Object.keys(byTerm).sort();
    const first4keys = keys.filter(k => k <= 'Y2T2');
    const first6keys = keys.filter(k => k <= 'Y3T2');
    const first4cr = first4keys.reduce((s, k) => s + byTerm[k].earned, 0);
    const first6cr = first6keys.reduce((s, k) => s + byTerm[k].earned, 0);

    if (first4keys.length === 4 && first4cr < MIN_CREDITS_FIRST_4_TERMS)
      warnings.push({ type: 'critical', msg: `Only ${first4cr}/${MIN_CREDITS_FIRST_4_TERMS} credits in first 4 terms — Struck-off risk! (Art. 12.1.iv)` });
    if (first6keys.length >= 5 && first6cr < MIN_CREDITS_FIRST_6_TERMS)
      warnings.push({ type: 'warning', msg: `Only ${first6cr}/${MIN_CREDITS_FIRST_6_TERMS} credits in first 6 terms (Art. 12.1.iv)` });
    if (backlogCredits > MAX_BACKLOG_CREDITS_PER_YEAR)
      warnings.push({ type: 'warning', msg: `Backlog credits ${backlogCredits} > ${MAX_BACKLOG_CREDITS_PER_YEAR} max per year (Art. 21.iii)` });

    return { earnedCredits, byTerm, warnings, backlogCredits };
  }, [courses]);

  const pct = Math.min(100, Math.round((earnedCredits / required) * 100));
  const yearClass = getYearClass(earnedCredits);
  const { cgpa } = computeCGPA(courses);

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Credit Tracker</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Art. 7.5: Min {required} credits for graduation</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Earned Credits', value: earnedCredits, sub: `of ${required} required` },
          { label: 'Remaining', value: required - earnedCredits, sub: 'to graduate' },
          { label: 'Year Class', value: yearClass, sub: `CGPA: ${cgpa ? cgpa.toFixed(2) : '—'}` },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Graduation Progress</span>
          <span style={{ color: 'var(--muted)' }}>{pct}%</span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
          {[0, 30, 60, 90, required].map(v => <span key={v}>{v}cr</span>)}
        </div>
      </div>

      {warnings.map((w, i) => (
        <div key={i} style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 8, fontSize: 12,
          background: w.type === 'critical' ? '#fee2e2' : '#fef9c3',
          border: `1px solid ${w.type === 'critical' ? '#fca5a5' : '#fde68a'}`,
          color: w.type === 'critical' ? '#991b1b' : '#854d0e',
        }}>
          {w.type === 'critical' ? '🔴' : '⚠️'} {w.msg}
        </div>
      ))}

      {Object.values(byTerm).sort((a, b) => a.key.localeCompare(b.key)).map(t => (
        <div key={t.key} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.earned} credits earned</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {t.courses.map(c => (
              <div key={c.id} style={{
                padding: '3px 9px', borderRadius: 5, fontSize: 11,
                background: c.grade === 'F' || c.grade === 'W' ? '#fee2e2' : c.grade === 'X' ? '#fef9c3' : 'var(--bg)',
                border: '1px solid var(--border)',
                color: c.grade === 'F' ? 'var(--danger)' : c.grade === 'X' ? 'var(--warning)' : 'var(--text)',
              }}>
                {c.code} <strong>{c.grade || '?'}</strong> ({c.credits}cr)
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 12, fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>KUET Credit Rules</div>
        {[
          ['Min credits to graduate', `${required}`, 'Art. 7.5'],
          ['Max core credits', '150', 'Art. 7.5'],
          ['First 4 terms minimum', '36 credits', 'Art. 12.1.iv'],
          ['First 6 terms minimum', '54 credits', 'Art. 12.1.iv'],
          ['Per term range', '15–24 credits', 'Art. 11.2'],
          ['Max theory per term', '5 courses', 'Art. 11.2'],
          ['Max backlog per year', '12 credits', 'Art. 21.iii'],
          ['Max extra improvement', '15 credits lifetime', 'Art. 24'],
          ['Max completion time', `${MAX_TERMS} terms (7 years)`, 'Art. 25'],
          ['Min CGPA for degree', `${MIN_CGPA_GRADUATION}`, 'Art. 17'],
        ].map(([k, v, art]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v} <span style={{ color: 'var(--muted)', fontSize: 10 }}>({art})</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
