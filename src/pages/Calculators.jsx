import { useState, useMemo } from 'react';
import { store, GRADE_SCALE, getGradeFromPct, getAttendanceMarks, cgpaToPercent, addWorkingDays } from '../store/store';

// ─── Legacy CGPA + Max Achievable Calculator ───────────────────────────────
function LegacyCGPACalc() {
  const TOTAL_TERMS = 8;
  const [terms, setTerms] = useState(() =>
    Array.from({ length: TOTAL_TERMS }, (_, i) => ({
      id: i + 1,
      label: `Year ${Math.floor(i / 2) + 1} · Term ${(i % 2) + 1}`,
      gpa: '',
      credits: '',
      done: false,
    }))
  );
  const [targetCGPA, setTargetCGPA] = useState('3.50');

  const updateTerm = (idx, field, val) => {
    setTerms(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  const { cgpa, earnedCr, totalCr, maxAchievable, neededGPAs } = useMemo(() => {
    const doneCr = terms.filter(t => t.done && t.credits && t.gpa)
      .reduce((s, t) => s + (+t.credits * +t.gpa), 0);
    const doneCredits = terms.filter(t => t.done && t.credits && t.gpa)
      .reduce((s, t) => s + +t.credits, 0);
    const cgpa = doneCredits ? doneCr / doneCredits : null;

    // Max achievable: remaining terms all get 4.00
    const remaining = terms.filter(t => !t.done);
    // Assume avg 18 credits per remaining term
    const remCr = remaining.reduce((s, t) => s + (+t.credits || 18), 0);
    const maxPts = doneCr + remCr * 4.00;
    const maxCr = doneCredits + remCr;
    const maxAchievable = maxCr ? maxPts / maxCr : 4.00;

    // Needed GPA per remaining term to reach target
    const target = +targetCGPA || 3.0;
    const neededPts = target * maxCr - doneCr;
    const neededPerTerm = remCr > 0 ? Math.min(4.00, neededPts / remCr) : null;

    return { cgpa, earnedCr: doneCredits, totalCr: doneCredits + remCr, maxAchievable, neededGPAs: neededPerTerm };
  }, [terms, targetCGPA]);

  const cgpaColor = cgpa === null ? 'var(--muted)' : cgpa >= 3.75 ? 'var(--success)' : cgpa < 2.20 ? 'var(--danger)' : 'var(--text)';

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📚 Legacy CGPA Import & Future Planner</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        পুরনো semester-এর GPA enter করো, ভবিষ্যতে কত CGPA পাওয়া সম্ভব তা দেখো।
        KUET-এ 4 Year × 2 Term = 8 Semester।
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {terms.map((t, i) => (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '140px 80px 80px 1fr auto',
            gap: 8, alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 8,
            background: t.done ? 'var(--bg)' : 'transparent',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: t.done ? 'var(--text)' : 'var(--muted)' }}>{t.label}</div>
            <div>
              <input
                type="number" min={0} max={4} step={0.01}
                value={t.gpa} onChange={e => updateTerm(i, 'gpa', e.target.value)}
                placeholder="GPA" style={{ fontSize: 12, padding: '5px 8px' }}
                disabled={!t.done}
              />
            </div>
            <div>
              <input
                type="number" min={0} max={30}
                value={t.credits} onChange={e => updateTerm(i, 'credits', e.target.value)}
                placeholder="Credits" style={{ fontSize: 12, padding: '5px 8px' }}
                disabled={!t.done}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t.done && t.gpa && t.credits
                ? `Points: ${(+t.gpa * +t.credits).toFixed(2)}`
                : t.done ? 'Fill GPA & credits' : 'Not completed yet'}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginBottom: 0, fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={t.done} onChange={e => updateTerm(i, 'done', e.target.checked)} style={{ width: 'auto' }} />
              Done
            </label>
          </div>
        ))}
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Current CGPA</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: cgpaColor }}>{cgpa ? cgpa.toFixed(2) : '—'}</div>
          {cgpa && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{cgpaToPercent(cgpa).toFixed(1)}%</div>}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Max Achievable CGPA</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success)' }}>{maxAchievable.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>if all remaining = 4.00</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Credits Done</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{earnedCr}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>of ~{totalCr} total</div>
        </div>
      </div>

      {/* Target planner */}
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎯 Target CGPA Planner</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <label>আমার লক্ষ্য CGPA</label>
            <input type="number" min={2} max={4} step={0.01} value={targetCGPA} onChange={e => setTargetCGPA(e.target.value)} style={{ fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ flex: 2 }}>
            {neededGPAs !== null ? (
              neededGPAs > 4.00 ? (
                <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
                  ❌ এই CGPA আর সম্ভব না। Max achievable: {maxAchievable.toFixed(2)}
                </div>
              ) : neededGPAs < 0 ? (
                <div style={{ padding: '10px 14px', background: '#dcfce7', borderRadius: 8, fontSize: 13, color: 'var(--success)' }}>
                  ✅ ইতিমধ্যে লক্ষ্য পূরণ হয়ে গেছে!
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                  বাকি প্রতি semester-এ গড়ে <strong style={{ color: 'var(--accent)', fontSize: 16 }}>{neededGPAs.toFixed(2)}</strong> GPA রাখতে হবে
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    এটি {neededGPAs >= 3.75 ? 'A/A+ গ্রেড মানে — কঠিন কিন্তু সম্ভব' : neededGPAs >= 3.0 ? 'B+ থেকে A রেঞ্জ — achievable' : 'B থেকে B+ রেঞ্জ — realistic'}
                  </div>
                </div>
              )
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Completed semester-এর তথ্য দাও</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── What do I need in Final? ──────────────────────────────────────────────
function FinalNeededCalc() {
  const [ctTotal, setCtTotal] = useState('');
  const [ctMax, setCtMax] = useState('20');
  const [attPct, setAttPct] = useState('80');
  const [targetGrade, setTargetGrade] = useState('B+');

  const target = GRADE_SCALE.find(g => g.grade === targetGrade)?.minPct || 65;
  const attMarks = getAttendanceMarks(+attPct);
  const ctNorm = ctMax > 0 ? ((+ctTotal) / (+ctMax)) * 20 : 0;
  const needed = (target - attMarks - ctNorm) / 0.70;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📝 Final-এ কত লাগবে?</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>CT + attendance দাও, target grade-এর জন্য Final-এ কত পেতে হবে বের হবে।</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label>CT Total (obtained)</label>
          <input type="number" value={ctTotal} onChange={e => setCtTotal(e.target.value)} placeholder="e.g. 14" />
        </div>
        <div>
          <label>CT Max Marks</label>
          <input type="number" value={ctMax} onChange={e => setCtMax(e.target.value)} placeholder="20" />
        </div>
        <div>
          <label>Attendance %</label>
          <input type="number" value={attPct} onChange={e => setAttPct(e.target.value)} placeholder="80" min={0} max={100} />
        </div>
        <div>
          <label>Target Grade</label>
          <select value={targetGrade} onChange={e => setTargetGrade(e.target.value)}>
            {GRADE_SCALE.filter(g => g.grade !== 'F').map(g => (
              <option key={g.grade} value={g.grade}>{g.grade} (≥{g.minPct}%)</option>
            ))}
          </select>
        </div>
      </div>
      <div className="card" style={{ background: 'var(--bg)', borderColor: needed > 100 ? 'var(--danger)' : 'var(--accent)' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Attendance Marks: {attMarks}/10 · CT contribution: {ctNorm.toFixed(1)}/20</div>
        {needed > 100 ? (
          <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 18 }}>❌ {targetGrade} আর সম্ভব না — প্রয়োজন {needed.toFixed(1)}/100</div>
        ) : needed < 0 ? (
          <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 18 }}>✅ Already secured {targetGrade}!</div>
        ) : (
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Final exam-এ লাগবে: </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>{needed.toFixed(1)}/100</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CGPA Target Planner ───────────────────────────────────────────────────
function WhatIfCalc() {
  const courses = store.get('courses') || [];
  const [whatIfGrades, setWhatIfGrades] = useState({});
  const marks = store.get('marks') || {};
  const att = store.get('attendance') || {};

  const activeCourses = courses.filter(c => c.status === 'active');

  const cgpa = useMemo(() => {
    let pts = 0, cr = 0;
    activeCourses.forEach(c => {
      const g = whatIfGrades[c.id] || 'B';
      const gp = GRADE_SCALE.find(x => x.grade === g)?.point || 3.0;
      if (c.credits) { pts += gp * c.credits; cr += c.credits; }
    });
    return cr ? (pts / cr).toFixed(2) : null;
  }, [activeCourses, whatIfGrades]);

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔮 What If? Semester Simulator</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>এই semester-এ প্রতিটা course-এ কোন grade পেলে GPA কত হবে simulate করো।</p>
      {activeCourses.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Active courses নেই।</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {activeCourses.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 12 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{c.code}</span>
              <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{c.credits}cr</span>
            </div>
            <select value={whatIfGrades[c.id] || 'B'} onChange={e => setWhatIfGrades(p => ({ ...p, [c.id]: e.target.value }))} style={{ width: 100 }}>
              {GRADE_SCALE.map(g => <option key={g.grade} value={g.grade}>{g.grade} ({g.point})</option>)}
            </select>
          </div>
        ))}
      </div>
      {cgpa && (
        <div className="card" style={{ textAlign: 'center', borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Simulated Semester GPA</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: +cgpa >= 3.75 ? 'var(--success)' : +cgpa < 2.20 ? 'var(--danger)' : 'var(--accent)' }}>{cgpa}</div>
          {+cgpa >= 3.75 && <div className="tag tag-green" style={{ margin: '6px auto 0', display: 'inline-flex' }}>Dean's List eligible!</div>}
        </div>
      )}
    </div>
  );
}

// ─── Registration Deadline Calc ────────────────────────────────────────────
function DeadlineCalc() {
  const [start, setStart] = useState('');
  const addDays = (d, n) => {
    return addWorkingDays(d, n).toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const deadlines = start ? [
    { label: 'Regular Registration', days: 8 },
    { label: 'Late Registration (with fee)', days: 15 },
    { label: 'Course Add deadline', days: 10 },
    { label: 'Course Drop deadline', days: 15 },
  ] : [];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📅 Registration Deadline Calculator</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Term শুরুর তারিখ দাও — সব deadline বের হয়ে যাবে।</p>
      <div style={{ marginBottom: 12 }}>
        <label>Term Start Date</label>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ width: 'auto' }} />
      </div>
      {deadlines.map(d => (
        <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', marginBottom: 4, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>{d.label}</span>
          <span style={{ fontWeight: 600 }}>{addDays(start, d.days)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Calculators Page ─────────────────────────────────────────────────
const CALC_TABS = [
  { id: 'legacy', label: '📚 Legacy CGPA', comp: LegacyCGPACalc },
  { id: 'final', label: '📝 Final Needed', comp: FinalNeededCalc },
  { id: 'whatif', label: '🔮 What If?', comp: WhatIfCalc },
  { id: 'deadline', label: '📅 Deadlines', comp: DeadlineCalc },
];

export default function Calculators() {
  const [tab, setTab] = useState('legacy');
  const Comp = CALC_TABS.find(t => t.id === tab)?.comp || LegacyCGPACalc;

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Smart Calculators</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>KUET-specific academic calculators</p>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {CALC_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, fontFamily: 'Sora, sans-serif',
          }}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        <Comp />
      </div>
    </div>
  );
}
