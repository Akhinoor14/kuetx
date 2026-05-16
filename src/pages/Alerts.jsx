import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { store, computeCourseGrade, computeCGPA, computeEffectiveAttendance, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, MAX_THEORY_COURSES_PER_TERM, MIN_CREDITS_FIRST_4_TERMS, MIN_CREDITS_FIRST_6_TERMS, HONORS_CGPA, DEANS_LIST_GPA, getAllCourses, getProfile } from '../store/store';

export function computeAlerts(profile) {
  const courses = getAllCourses(profile);
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
}

export default function Alerts() {
  const profile = getProfile();
  const { critical, warnings, positives } = useMemo(() => computeAlerts(profile), [profile]);
  const totalCount = critical.length + warnings.length + positives.length;

  const tone = (color) => {
    if (color === 'var(--danger)') {
      return {
        bg: 'var(--dangerBg)',
        border: 'color-mix(in srgb, var(--danger) 28%, var(--border))',
        iconBg: 'rgba(248, 113, 113, 0.14)',
      };
    }
    if (color === 'var(--warning)') {
      return {
        bg: 'var(--warningBg)',
        border: 'color-mix(in srgb, var(--warning) 28%, var(--border))',
        iconBg: 'rgba(251, 191, 36, 0.14)',
      };
    }
    return {
      bg: 'var(--successBg)',
      border: 'color-mix(in srgb, var(--success) 28%, var(--border))',
      iconBg: 'rgba(74, 222, 128, 0.14)',
    };
  };

  const Section = ({ title, items, color, emoji }) => (
    <div style={{
      marginBottom: 16,
      padding: 16,
      borderRadius: 18,
      border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
      boxShadow: '0 10px 28px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: tone(color).iconBg,
            border: `1px solid ${tone(color).border}`,
          }}>{emoji}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color, padding: '6px 10px', borderRadius: 999, background: tone(color).iconBg, border: `1px solid ${tone(color).border}` }}>
          {items.length || '0'}
        </div>
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 2px' }}>None — all clear ✓</div>
        : items.map((a, i) => (
          <Link key={i} to={a.link || '#'} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 14, marginBottom: 8,
            background: tone(color).bg,
            border: `1px solid ${tone(color).border}`,
            textDecoration: 'none', color: 'var(--text)', fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4, boxShadow: `0 0 0 4px ${tone(color).iconBg}` }} />
            <span style={{ flex: 1, lineHeight: 1.55 }}>{a.msg}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, paddingTop: 1 }}>→</span>
          </Link>
        ))
      }
    </div>
  );

  return (
    <div className="page-enter page-container">
      <div className="hero-banner" style={{ marginBottom: 18, padding: 18, border: '1px solid rgba(var(--accentRGB), 0.14)', background: 'radial-gradient(circle at top left, rgba(var(--accentRGB), 0.12), transparent 34%), linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--muted)', marginBottom: 6 }}>Notifications</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Alerts & Suggestions</h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              {totalCount} total signals · {critical.length} critical · {warnings.length} warnings · {positives.length} good news
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, minWidth: 'min(100%, 360px)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--border))', background: 'var(--dangerBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Critical</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>{critical.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--warning) 28%, var(--border))', background: 'var(--warningBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Warnings</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--warning)' }}>{warnings.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--success) 28%, var(--border))', background: 'var(--successBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Good</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)' }}>{positives.length}</div>
            </div>
          </div>
        </div>
      </div>
      <Section title="Critical Alerts" items={critical} color="var(--danger)" emoji="🔴" />
      <Section title="Warnings" items={warnings} color="var(--warning)" emoji="🟡" />
      <Section title="Good News" items={positives} color="var(--success)" emoji="🟢" />
    </div>
  );
}
