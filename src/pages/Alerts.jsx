import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { store, computeCourseGrade, computeCGPA, computeEffectiveAttendance, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, MAX_THEORY_COURSES_PER_TERM, MIN_CREDITS_FIRST_4_TERMS, MIN_CREDITS_FIRST_6_TERMS, HONORS_CGPA, DEANS_LIST_GPA } from '../store/store';

export default function Alerts() {
  const profile = store.get('profile') || {};
  const courses = store.get('courses') || [];

  const { critical, warnings, positives } = useMemo(() => {
    const critical = [], warnings = [], positives = [];

    // Attendance per course
    courses.filter(c => c.status === 'active' || c.status === 'backlog').forEach(c => {
      const { pct, held } = computeEffectiveAttendance(c.id);
      if (!held) return;
      if (pct < MIN_ATTENDANCE_PERCENT)
        critical.push({ msg: `${c.code}: Attendance ${pct}% — course will be CANCELLED (Art. 11.3)`, link: '/attendance' });
      else if (pct < SCHOLARSHIP_ATTENDANCE_PCT)
        warnings.push({ msg: `${c.code}: ${pct}% attendance — not eligible for scholarship (Art. 14.2)`, link: '/attendance' });
    });

    // Theory course count per term
    const theoryCounts = {};
    courses.filter(c => c.status === 'active' && c.type === 'Theory').forEach(c => {
      const k = `Y${c.year}T${c.term}`;
      theoryCounts[k] = (theoryCounts[k] || 0) + 1;
    });
    Object.entries(theoryCounts).forEach(([k, n]) => {
      if (n > MAX_THEORY_COURSES_PER_TERM)
        warnings.push({ msg: `${k}: ${n} theory courses — max is ${MAX_THEORY_COURSES_PER_TERM} (Art. 11.2)`, link: '/courses' });
    });

    // F in core courses
    courses.forEach(c => {
      const { grade } = computeCourseGrade(c);
      if (grade === 'F' && c.isCore)
        critical.push({ msg: `${c.code}: F grade in core course — must repeat (Art. 16)`, link: '/results' });
    });

    // Backlog grade cap warning
    courses.filter(c => c.status === 'backlog').forEach(c => {
      const { grade } = computeCourseGrade(c);
      if (grade === 'A+' || grade === 'A' || grade === 'A-')
        warnings.push({ msg: `${c.code}: Backlog course — grade capped at B+ (Art. 16)`, link: '/marks' });
    });

    // CGPA / GPA
    const { cgpa, earnedCredits } = computeCGPA(courses);
    if (cgpa !== null) {
      if (cgpa < 2.20)  critical.push({ msg: `CGPA ${cgpa.toFixed(2)} < 2.20 — Academic probation risk! (Art. 20)`, link: '/results' });
      if (cgpa >= HONORS_CGPA) positives.push({ msg: `CGPA ${cgpa.toFixed(2)} ≥ 3.75 — Honors eligible (Art. 18.1) 🎓`, link: '/results' });
      if (cgpa >= DEANS_LIST_GPA) positives.push({ msg: `On track for Dean's List — maintain in both terms, no F grades (Art. 18.2) 📋`, link: '/results' });
      if (cgpa >= 3.75 && earnedCredits >= 100) positives.push({ msg: `Gold Medal track — finish in 4 years with no F (Art. 18.3) 🏅`, link: '/results' });
    }

    // Credit milestones
    const termKeys = [...new Set(courses.map(c => `Y${c.year}T${c.term}`))].sort();
    const first4Keys = termKeys.filter(k => k <= 'Y2T2');
    if (first4Keys.length === 4) {
      const first4cr = courses
        .filter(c => first4Keys.includes(`Y${c.year}T${c.term}`))
        .reduce((s, c) => { const { grade, point } = computeCourseGrade(c); return grade !== 'F' && point >= 2.0 ? s + (c.credits || 0) : s; }, 0);
      if (first4cr < MIN_CREDITS_FIRST_4_TERMS)
        critical.push({ msg: `Only ${first4cr}/${MIN_CREDITS_FIRST_4_TERMS} credits in first 4 terms — Struck-off risk! (Art. 12.1.iv)`, link: '/credits' });
    }

    // Graduation milestone
    if (earnedCredits >= (profile.totalCreditsRequired || 160))
      positives.push({ msg: `All credits completed — eligible to apply for graduation! (Art. 28) 🎉`, link: '/credits' });
    else if (earnedCredits >= 120)
      positives.push({ msg: `${earnedCredits} credits done — on track for graduation`, link: '/credits' });

    return { critical, warnings, positives };
  }, [courses, profile]);

  const Section = ({ title, items, color, emoji }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{emoji} {title} ({items.length})</div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>None — all clear ✓</div>
        : items.map((a, i) => (
          <Link key={i} to={a.link || '#'} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', borderRadius: 8, marginBottom: 5,
            background: color === 'var(--danger)' ? '#fff1f1' : color === 'var(--warning)' ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${color === 'var(--danger)' ? '#fecaca' : color === 'var(--warning)' ? '#fde68a' : '#bbf7d0'}`,
            textDecoration: 'none', color: 'var(--text)', fontSize: 12,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
            <span style={{ flex: 1 }}>{a.msg}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>→</span>
          </Link>
        ))
      }
    </div>
  );

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Alerts & Suggestions</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          {critical.length} critical · {warnings.length} warnings · {positives.length} good news
        </p>
      </div>
      <Section title="Critical Alerts" items={critical} color="var(--danger)" emoji="🔴" />
      <Section title="Warnings" items={warnings} color="var(--warning)" emoji="🟡" />
      <Section title="Good News" items={positives} color="var(--success)" emoji="🟢" />
    </div>
  );
}
