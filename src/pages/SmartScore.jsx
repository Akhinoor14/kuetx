import { useMemo, useState } from 'react';
import { store, computeEffectiveAttendance, getAllCourses, getProfile, getPublishedCGPA } from '../store/store';

const PARAMS = [
  { key: 'cgpa',       label: 'Academic (All Marks)', weight: 30, icon: '🎓', hint: 'Published or provisional' },
  { key: 'attendance', label: 'Attendance',           weight: 20, icon: '📅', hint: 'Active courses only' },
  { key: 'namaz',      label: 'Namaz (7-day)',        weight: 10, icon: '🕌', hint: 'Prayers completed (7 days)' },
  { key: 'assignments',label: 'Assignments Done',     weight: 10, icon: '📝', hint: '% of assignments completed' },
  { key: 'selfrating', label: 'Self Rating (7-day)',  weight:  8, icon: '💎', hint: 'Avg 1-5 scale ratings' },
  { key: 'goodbad',    label: 'Conduct (7-day)',      weight:  8, icon: '⚖️', hint: 'Good−Bad×1.5 ratio' },
  { key: 'selfStudy',  label: 'Self Study (7-day)',   weight:  6, icon: '📚', hint: 'Target: 14h/week' },
  { key: 'diary',      label: 'Diary (7-day)',        weight:  4, icon: '📓', hint: 'Days logged last week' },
  { key: 'money',      label: 'Budget (30-day)',      weight:  4, icon: '💰', hint: 'Entry consistency' },
];

export default function SmartScore() {
  const [showPolicyDetails, setShowPolicyDetails] = useState(false);

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

    // Academic (30%): credit-weighted marks (published OR provisional), with CGPA fallback
    const pub = getPublishedCGPA(courses);
    let acadTotal = 0, acadCredit = 0;
    const marks = store.get('marks') || {};
    courses.forEach(c => {
      if (c.type === 'NonCredit' || !c.credits) return;
      const m = marks[c.id] || {};
      // Use publishedTotal if available, otherwise use provisional total
      const markTotal = m.publishedTotal !== undefined && m.publishedTotal > 0 
        ? m.publishedTotal 
        : (m.provisionalTotal !== undefined && m.provisionalTotal > 0 ? m.provisionalTotal : 0);
      if (markTotal > 0) {
        const obtained = Number.isFinite(+markTotal) ? +markTotal : 0;
        acadTotal += obtained * c.credits;
        acadCredit += markTotal * c.credits;
      }
    });
    if (acadCredit > 0) {
      s.cgpa = Math.min(100, (acadTotal / acadCredit) * 100);
    } else if (pub.cgpa !== null) {
      s.cgpa = Math.min(100, (pub.cgpa / 4) * 100);
    } else {
      s.cgpa = null;
    }
    s.cgpaCoverage = pub.totalCredits > 0 ? Math.round((pub.publishedCredits / pub.totalCredits) * 100) : 0;

    // Attendance (20%): attLogs ratio, active courses only
    const activeCourses = courses.filter(c => c.status === 'active');
    const attDetails = activeCourses.map(c => computeEffectiveAttendance(c.id)).filter(d => d && d.pct !== null);
    const attPcts = attDetails.map(d => d.pct);
    s.attendance = attPcts.length ? Math.min(100, attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : null;
    s.attSources = Array.from(new Set(attDetails.map(d => d.source))).join(', ');

    // Namaz (10%): done / (5×7) × 100
    const last7dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    const namazDone = last7dates.reduce((sum, date) => {
      const r = namaz[date] || {};
      return sum + ['Fajr','Dhuhr','Asr','Maghrib','Isha'].filter(p => r[p]?.done).length;
    }, 0);
    s.namaz = namazDone > 0 || Object.keys(namaz).length >= 3 ? Math.round((namazDone / 35) * 100) : null;

    // Assignments
    s.assignments = assignments.length ? Math.round((assignments.filter(a => a.status === 'done').length / assignments.length) * 100) : null;

    // Self Rating (8%): avg_rating / 5 × 100
    const ratings = last7dates.map(d => selfeval[d]?.rating).filter(Boolean);
    s.selfrating = ratings.length >= 3 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100) : null;

    // Conduct (8%): (good − bad×1.5) / max × 100, clamped [0,100]
    const allGood = last7dates.reduce((s, d) => s + ((selfeval[d]?.good || []).length), 0);
    const allBad  = last7dates.reduce((s, d) => s + ((selfeval[d]?.bad  || []).length), 0);
    const conductRaw = allGood - (allBad * 1.5);
    const conductMax = Math.max(allGood, 1);
    s.goodbad = (allGood + allBad) >= 3 ? Math.max(0, Math.min(100, Math.round((conductRaw / conductMax) * 100))) : null;

    // Budget (4%): entry_days / 30 × 100 (30-day window)
    const recent30 = expenses.filter(e => e.date && (new Date() - new Date(e.date)) < 30 * 86400000);
    const recentDays30 = new Set(recent30.map(e => e.date)).size;
    s.money = recent30.length >= 3 ? Math.min(100, Math.round((recentDays30 / 30) * 100)) : null;

    // Diary (4%): days_logged / 7 × 100
    const diaryDates = new Set(diary.map(e => e.date));
    const diaryDays = last7dates.filter(d => diaryDates.has(d)).length;
    s.diary = diaryDays >= 1 ? Math.round((diaryDays / 7) * 100) : null;

    // Self Study (6%): min(100, hours_7d / 14 × 100)
    const ssHours = selfStudy.filter(e => e.date && last7dates.includes(e.date)).reduce((s, e) => s + (e.hours || 0), 0);
    s.selfStudy = selfStudy.length >= 3 ? Math.min(100, Math.round((ssHours / 14) * 100)) : null;

    return s;
  }, [courses, namaz, assignments, selfeval, expenses, diary, selfStudy]);

  const { total, evaluatedWeight, totalWeight, missingWeight, confidence, confidenceBand, retroEditPenalty } = useMemo(() => {
    let sSum = 0, evalW = 0, missW = 0;
    const auditLog = store.get('auditLog') || [];
    const retroEditPenalty = auditLog.filter(a => a.action === 'marks_update').length > 2 ? 0.8 : 1.0;
    PARAMS.forEach(p => {
      const v = scores[p.key];
      if (v !== null && v !== undefined) { sSum += (v / 100) * p.weight; evalW += p.weight; }
      else missW += p.weight;
    });
    // Dynamic denominator: only count weight of metrics with data
    const totalW = evalW > 0 ? evalW : 100; // fallback to 100 if no data
    const tot = totalW > 0 ? Math.round((sSum / totalW) * 100) : null;
    const rawConf = totalW > 0 ? Math.round((evalW / totalW) * 100) : 0;
    const conf = Math.round(rawConf * retroEditPenalty);
    const confidenceBand = conf >= 80 ? 'High' : conf >= 60 ? 'Medium' : 'Low';
    return { total: tot, evaluatedWeight: evalW, totalWeight: totalW, missingWeight: missW, confidence: conf, confidenceBand, retroEditPenalty };
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
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Holistic student life score — fixed, policy-driven, and balanced across academics + habits</p>
      </div>

      {/* Big score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 20, padding: '28px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Overall Score</div>
        <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.06em', color: total ? scoreColor(total) : 'var(--border)', lineHeight: 1 }}>
          {total ?? '—'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>/100 · {totalLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{evaluatedWeight}/{totalWeight} weight evaluated · confidence {confidence}%</div>
        <div style={{ fontSize: 10, color: confidence >= 80 ? 'var(--success)' : confidence >= 60 ? 'var(--warning)' : 'var(--danger)', marginTop: 3 }}>
          Confidence: {confidenceBand}
          {retroEditPenalty < 1 && ` (amended −20%)`}
        </div>
        {confidence < 60 && (
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>Low confidence — insufficient data, score may be unreliable</div>
        )}
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

      {/* Provenance / metadata */}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
        <div>CGPA coverage: {scores.cgpa !== null ? `${scores.cgpaCoverage ?? 0}% published` : 'No published grades'}</div>
        <div>Attendance sources: {scores.attSources || 'none'}</div>
        <div style={{ marginTop: 6 }}>Missing-data penalty weight: {missingWeight}%</div>
      </div>

      {/* Policy summary and details */}
      <div className="card" style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>SmartScore Official Policy v2.0</div>
        <div style={{ marginBottom: 4 }}>KUETx SmartScore Policy v2.0 includes all available academic data (published + provisional marks). Missing metrics are excluded from scoring — only logged data contributes. Each metric is fully traceable in score details.</div>
        <button onClick={() => setShowPolicyDetails(v => !v)} style={{ marginTop: 10 }}>
          {showPolicyDetails ? 'Hide details' : 'See details'}
        </button>

        {showPolicyDetails && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Component Breakdown (Dynamic Weight)</div>
            <div style={{ marginBottom: 6 }}>Academic (30%) = credit-weighted published or provisional marks; fallback to CGPA/4×100.</div>
            <div style={{ marginBottom: 6 }}>Attendance (20%) = attLogs ratio, active courses only.</div>
            <div style={{ marginBottom: 6 }}>Namaz (10%) = prayers_done / (5×7) × 100.</div>
            <div style={{ marginBottom: 6 }}>Assignments (10%) = on_time_submitted / total × 100.</div>
            <div style={{ marginBottom: 6 }}>Self Rating (8%) = avg_rating / 5 × 100 (7-day, min 3 points).</div>
            <div style={{ marginBottom: 6 }}>Conduct (8%) = (good − bad×1.5) / max × 100, clamped [0,100].</div>
            <div style={{ marginBottom: 6 }}>Self Study (6%) = min(100, hours_7d / 14 × 100).</div>
            <div style={{ marginBottom: 6 }}>Diary (4%) = days_logged / 7 × 100.</div>
            <div style={{ marginBottom: 6 }}>Budget (4%) = entry_days / 30 × 100 (30-day window).</div>
            <div style={{ marginBottom: 6 }}>
              <strong>Dynamic Denominator:</strong> Score = weighted_sum / (sum of weights with data). Missing metrics excluded, not penalized.
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Thresholds:</strong> &lt;3 data points in 7-day window = component excluded. Budget uses 30-day (≥3 entries).
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Anti-Gaming:</strong> Retroactive marks edits detected in auditLog → confidence reduced 20%. Score stamped with SHA-256 hash before export.
            </div>
            <div style={{ marginBottom: 0 }}>
              <strong>Confidence Bands:</strong> 80–100% = High, 60–79% = Medium, &lt;60% = Low (shows warning).
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        💡 Score improves automatically as you log data across all modules. Track daily for best accuracy.
      </div>
    </div>
  );
}
