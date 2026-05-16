import { useMemo, useState, useEffect } from 'react';
import { store, computeCourseGrade, computeEffectiveAttendance, getAllCourses, getProfile, getPublishedCGPA, recordAudit, saveSmartSnapshot, getLatestSmartSnapshot, computeHash, getAuditLog } from '../store/store';

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
  const [prefs, setPrefs] = useState(() => store.get('smartscorePrefs') || { provisional: false, excludeMissing: false });
  useEffect(() => store.set('smartscorePrefs', prefs), [prefs]);
  const [snapshotStatus, setSnapshotStatus] = useState(null);
  const [latestSnap, setLatestSnap] = useState(() => getLatestSmartSnapshot());
  const [audits, setAudits] = useState(() => getAuditLog());
  const [auditOpen, setAuditOpen] = useState(false);

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
    const pub = getPublishedCGPA(courses);
    s.cgpaCoverage = pub.totalCredits > 0 ? Math.round((pub.publishedCredits / pub.totalCredits) * 100) : 0;
    if (prefs.provisional) {
      // fallback to provisional (computed) grades when user allows it
      let pts = 0, cr = 0;
      courses.forEach(c => {
        const { grade, point, isX } = computeCourseGrade(c);
        if (isX) return;
        if (grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
          pts += point * c.credits; cr += c.credits;
        }
      });
      const pcgpa = cr ? pts / cr : null;
      s.cgpa = pcgpa !== null ? Math.min(100, (pcgpa / 4) * 100) : (pub.cgpa !== null ? Math.min(100, (pub.cgpa / 4) * 100) : null);
      s.cgpaMode = 'provisional';
    } else {
      s.cgpa = pub.cgpa !== null ? Math.min(100, (pub.cgpa / 4) * 100) : null;
      s.cgpaMode = 'published';
    }

    // Attendance score — average only across active courses (current term)
    const activeCourses = courses.filter(c => c.status === 'active');
    const attDetails = activeCourses.map(c => computeEffectiveAttendance(c.id)).filter(d => d && d.pct !== null);
    const attPcts = attDetails.map(d => d.pct);
    s.attendance = attPcts.length ? Math.min(100, attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : null;
    s.attSources = Array.from(new Set(attDetails.map(d => d.source))).join(', ');

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
  }, [courses, namaz, assignments, selfeval, expenses, diary, selfStudy, prefs]);

  const { total, evaluatedWeight, totalWeight } = useMemo(() => {
    const totalW = PARAMS.reduce((a, b) => a + b.weight, 0);
    let sSum = 0, evalW = 0;
    PARAMS.forEach(p => {
      const v = scores[p.key];
      if (v !== null && v !== undefined) { sSum += (v / 100) * p.weight; evalW += p.weight; }
      // missing metrics count as zero when excludeMissing=false
    });
    let tot = null;
    if (prefs.excludeMissing) {
      // exclude missing metrics from denominator (evaluated-only)
      tot = evalW > 0 ? Math.round((sSum / evalW) * 100) : null;
    } else {
      tot = totalW > 0 ? Math.round((sSum / totalW) * 100) : null;
    }
    return { total: tot, evaluatedWeight: evalW, totalWeight: totalW };
  }, [scores, prefs]);

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
        {/* Interactive controls */}
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={prefs.provisional} onChange={async (e) => {
              const before = prefs.provisional;
              if (e.target.checked) {
                const ans = window.prompt('Enabling provisional grades may make the score non-official. Type CONFIRM to proceed.');
                if (String(ans || '').trim() !== 'CONFIRM') return; // abort
              }
              const next = { ...prefs, provisional: e.target.checked };
              setPrefs(next);
              recordAudit({ action: 'pref_change', key: 'provisional', before, after: next.provisional });
              setAudits(getAuditLog());
            }} />{' '}
            Include provisional grades
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={prefs.excludeMissing} onChange={(e) => {
              const before = prefs.excludeMissing;
              const next = { ...prefs, excludeMissing: e.target.checked };
              setPrefs(next);
              recordAudit({ action: 'pref_change', key: 'excludeMissing', before, after: next.excludeMissing });
              setAudits(getAuditLog());
            }} />{' '}
            Exclude missing metrics from denominator
          </label>
          <div style={{ marginLeft: 'auto', fontSize: 12 }}>
            Quick links: 
            <button onClick={() => (window.location.hash = '#/SelfEval')} style={{ marginLeft: 8 }}>Self Eval</button>
            <button onClick={() => (window.location.hash = '#/Attendance')} style={{ marginLeft: 6 }}>Attendance</button>
            <button onClick={() => (window.location.hash = '#/Assignments')} style={{ marginLeft: 6 }}>Assignments</button>
            <button onClick={async () => {
              const payload = { marks: store.get('marks') || {}, prefs, scores, ts: new Date().toISOString() };
              const snap = await saveSmartSnapshot('manual', payload);
              setLatestSnap(snap);
              setSnapshotStatus('created');
              setAudits(getAuditLog());
            }} style={{ marginLeft: 8 }}>Create Snapshot</button>
            <button onClick={async () => {
              const snap = getLatestSmartSnapshot();
              if (!snap) { setSnapshotStatus('no-snapshot'); return; }
              const currentPayload = { marks: store.get('marks') || {}, prefs, scores };
              const h = await computeHash(currentPayload);
              setSnapshotStatus(h === snap.hash ? 'ok' : 'changed');
              setLatestSnap(snap);
            }} style={{ marginLeft: 6 }}>Verify Snapshot</button>
            <button onClick={() => { setAudits(getAuditLog()); setLatestSnap(getLatestSmartSnapshot()); setAuditOpen(true); }} style={{ marginLeft: 6 }}>View Audits</button>
          </div>
        </div>
      </div>

      {/* Big score */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 20, padding: '28px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Overall Score</div>
        <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.06em', color: total ? scoreColor(total) : 'var(--border)', lineHeight: 1 }}>
          {total ?? '—'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>/100 · {totalLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{evaluatedWeight}/{totalWeight} weight evaluated</div>
        {evaluatedWeight / totalWeight < 0.6 && (
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>Insufficient data — score may be unreliable</div>
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
        <div style={{ marginTop: 6 }}>
          Snapshot status: {snapshotStatus ?? (latestSnap ? `last ${new Date(latestSnap.ts).toLocaleString()}` : 'no snapshot')}
        </div>
        <div style={{ marginTop: 6 }}>
          Last audits: {audits.slice(-3).map(a => `${a.action}@${a.ts}`).join(' | ') || 'none'}
        </div>
      </div>

      {/* Audit Viewer Modal */}
      {auditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '90%', maxWidth: 900, maxHeight: '80%', overflow: 'auto', background: 'white', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Audit Log & Snapshots</div>
              <div>
                <button onClick={() => { setAuditOpen(false); }} style={{ marginLeft: 8 }}>Close</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginTop: 0 }}>Recent audits</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{audits.length} entries</div>
                <div style={{ marginTop: 8 }}>
                  {audits.slice().reverse().map((a, i) => (
                    <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{a.action}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.ts}</div>
                      <div style={{ marginTop: 6 }}>{JSON.stringify(a, null, 2)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ width: 360 }}>
                <h3 style={{ marginTop: 0 }}>Snapshots</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(store.get('smartscoreSnapshots') || []).length} saved</div>
                <div style={{ marginTop: 8 }}>
                  {(store.get('smartscoreSnapshots') || []).slice().reverse().map((s, i) => (
                    <div key={i} style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700 }}>{s.name} · {new Date(s.ts).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>hash: {s.hash}</div>
                      <div style={{ marginTop: 6 }}>
                        <button onClick={async () => {
                          const currentPayload = { marks: store.get('marks') || {}, prefs, scores };
                          const h = await computeHash(currentPayload);
                          alert(h === s.hash ? 'Snapshot matches current data' : 'Snapshot differs from current data');
                        }}>Compare</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        💡 Score improves automatically as you log data across all modules. Track daily for best accuracy.
      </div>
    </div>
  );
}
