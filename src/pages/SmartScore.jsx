import { useMemo } from 'react';
import { store, computeCourseGrade, computeEffectiveAttendance, getAllCourses, getProfile } from '../store/store';

const PARAMS = [
  { key: 'cgpa',       label: 'Academic CGPA',       weight: 25, icon: '🎓', hint: 'Based on all your course marks' },
  { key: 'attendance', label: 'Avg Attendance',       weight: 15, icon: '📅', hint: 'Average across all active courses' },
  { key: 'namaz',      label: 'Namaz (7-day)',        weight: 15, icon: '🕌', hint: '5 prayers × 7 days' },
  { key: 'assignments',label: 'Assignments Done',     weight: 10, icon: '📝', hint: '% of assignments completed' },
  { key: 'selfrating', label: 'Daily Self Rating',    weight: 10, icon: '💎', hint: 'Your 1-5 ratings last 7 days' },
  { key: 'goodbad',    label: 'Good vs Bad Deeds',    weight: 10, icon: '⚖️', hint: 'Good deeds ratio from Self Eval' },
  { key: 'money',      label: 'Budget Tracking',      weight:  5, icon: '💰', hint: 'Consistency of expense logging' },
  { key: 'diary',      label: 'Class Diary',          weight:  5, icon: '📓', hint: 'Days logged in last week' },
  { key: 'selfStudy',  label: 'Self Study Hours',     weight:  5, icon: '📚', hint: 'Target: 2h/day = 14h/week' },
];

export default function SmartScore() {
  const profile     = getProfile();
  const courses     = getAllCourses(profile);
  const namaz       = store.get('namaz') || {};
  const assignments = store.get('assignments') || [];
  const selfeval    = store.get('selfeval') || {};
  const expenses    = store.get('expenses') || [];
  const diary       = store.get('diary') || [];
  const selfStudy   = store.get('selfstudy') || [];

  const scores = useMemo(() => {
    const s = {};

    // CGPA score (0–100)
    let pts = 0, cr = 0;
    courses.forEach(c => {
      const { grade, point } = computeCourseGrade(c);
      if (grade !== 'F' && grade !== 'W' && grade !== 'X' && c.credits && point >= 2.0) {
        pts += point * c.credits; cr += c.credits;
      }
    });
    const cgpa = cr ? pts / cr : null;
    s.cgpa = cgpa !== null ? Math.min(100, (cgpa / 4) * 100) : null;

    // Attendance score
    const attPcts = courses.map(c => computeEffectiveAttendance(c.id).pct).filter(p => p !== null);
    s.attendance = attPcts.length ? Math.min(100, attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : null;

    // Namaz: last 7 days
    const last7dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    const namazDone = last7dates.reduce((sum, date) => {
      const r = namaz[date] || {};
      return sum + ['Fajr','Dhuhr','Asr','Maghrib','Isha'].filter(p => r[p]?.done).length;
    }, 0);
    s.namaz = Object.keys(namaz).length > 0 ? Math.round((namazDone / 35) * 100) : null;

    // Assignments
    s.assignments = assignments.length ? Math.round((assignments.filter(a => a.status === 'done').length / assignments.length) * 100) : null;

    // Self rating (1-5 → 0-100)
    const ratings = last7dates.map(d => selfeval[d]?.rating).filter(Boolean);
    s.selfrating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100) : null;

    // Good vs Bad
    const allGood = last7dates.reduce((s, d) => s + ((selfeval[d]?.good || []).length), 0);
    const allBad  = last7dates.reduce((s, d) => s + ((selfeval[d]?.bad  || []).length), 0);
    s.goodbad = (allGood + allBad) > 0 ? Math.round((allGood / (allGood + allBad + 1)) * 100) : null;

    // Money tracking consistency (proxy: entries in last 30 days)
    const recent30 = expenses.filter(e => e.date && (new Date() - new Date(e.date)) < 30 * 86400000);
    s.money = expenses.length > 0 ? Math.min(100, Math.round((recent30.length / 30) * 100)) : null;

    // Diary: days logged in last 7
    const diaryDates = new Set(diary.map(e => e.date));
    s.diary = diary.length > 0 ? Math.round((last7dates.filter(d => diaryDates.has(d)).length / 7) * 100) : null;

    // Self study: hours last 7 days vs 14h target
    const ssHours = selfStudy.filter(e => e.date && last7dates.includes(e.date)).reduce((s, e) => s + (e.hours || 0), 0);
    s.selfStudy = selfStudy.length > 0 ? Math.min(100, Math.round((ssHours / 14) * 100)) : null;

    return s;
  }, [courses, namaz, assignments, selfeval, expenses, diary, selfStudy]);

  const { total, evaluated } = useMemo(() => {
    let wSum = 0, sSum = 0, count = 0;
    PARAMS.forEach(p => {
      const v = scores[p.key];
      if (v !== null && v !== undefined) { sSum += (v / 100) * p.weight; wSum += p.weight; count++; }
    });
    return { total: wSum > 0 ? Math.round((sSum / wSum) * 100) : null, evaluated: count };
  }, [scores]);

  const scoreColor = (v) => {
    if (v === null || v === undefined) return 'var(--muted)';
    if (v >= 80) return 'var(--success)';
    if (v >= 55) return 'var(--warning)';
    return 'var(--danger)';
  };

  const totalLabel = total === null ? '—' : total >= 85 ? 'Excellent 🌟' : total >= 70 ? 'Good 👍' : total >= 50 ? 'Average' : 'Needs Work';

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Smart Score</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Holistic student life score — auto-calculated from all your data</p>
      </div>

      {/* Big score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 20, padding: '28px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Overall Score</div>
        <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.06em', color: total ? scoreColor(total) : 'var(--border)', lineHeight: 1 }}>
          {total ?? '—'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>/100 · {totalLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{evaluated}/{PARAMS.length} parameters tracked</div>
        {total !== null && (
          <div style={{ marginTop: 14, maxWidth: 300, margin: '14px auto 0' }}>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{ width: `${total}%`, background: scoreColor(total) }} />
            </div>
          </div>
        )}
      </div>

      {/* Parameter breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PARAMS.map(p => {
          const val = scores[p.key];
          const has = val !== null && val !== undefined;
          return (
            <div key={p.key} className="card" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{p.hint}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: has ? scoreColor(val) : 'var(--muted)' }}>
                      {has ? `${Math.round(val)}/100` : 'No data'}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${has ? val : 0}%`, background: has ? scoreColor(val) : 'var(--border)' }} />
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)', width: 36, textAlign: 'right', flexShrink: 0 }}>×{p.weight}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        💡 Score improves automatically as you log data across all modules. Track daily for best accuracy.
      </div>
    </div>
  );
}
