import { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { store, GRADE_SCALE, cgpaToPercent, addWorkingDays, getLegacyTermResults, getProfile, setLegacyTermResults } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';

const TERM_KEYS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

// ─── Legacy CGPA + Max Achievable Calculator ───────────────────────────────
function LegacyCGPACalc() {
  const [terms, setTerms] = useState(() => {
    const imported = getLegacyTermResults();
    return TERM_KEYS.map((key, i) => {
      const row = imported.find(r => r.termKey === key) || {};
      return {
        id: i + 1,
        key,
        label: `Year ${Math.floor(i / 2) + 1} · Term ${(i % 2) + 1}`,
        gpa: row.gpa ?? '',
        credits: row.credits ?? '',
        done: Number.isFinite(+row.gpa) && Number.isFinite(+row.credits),
      };
    });
  });
  const [targetCGPA, setTargetCGPA] = useState('3.50');

  const updateTerm = (idx, field, val) => {
    setTerms(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  useEffect(() => {
    const payload = terms
      .filter(t => t.done && Number.isFinite(+t.gpa) && Number.isFinite(+t.credits) && +t.credits > 0)
      .map(t => ({ termKey: t.key, gpa: +t.gpa, credits: +t.credits }));
    setLegacyTermResults(payload);
  }, [terms]);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
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
  const [ct1, setCt1] = useState('0');
  const [ct2, setCt2] = useState('0');
  const [bonus1, setBonus1] = useState('0');
  const [bonus2, setBonus2] = useState('0');
  const [assign1, setAssign1] = useState('0');
  const [assign2, setAssign2] = useState('0');
  const [attPct, setAttPct] = useState('80');
  const [targetGrade, setTargetGrade] = useState('B+');

  const target = GRADE_SCALE.find(g => g.grade === targetGrade)?.minPct || 65;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

  const ctEff1 = clamp(clamp(ct1, 0, 30) + clamp(bonus1, 0, 30), 0, 30);
  const ctEff2 = clamp(clamp(ct2, 0, 30) + clamp(bonus2, 0, 30), 0, 30);
  const assignment1 = clamp(assign1, 0, 15);
  const assignment2 = clamp(assign2, 0, 15);

  const attendanceBasePerTeacher = (getAttendanceMarks(clamp(attPct, 0, 100)) / 10) * 15;
  const att1 = Math.min(attendanceBasePerTeacher, Math.max(0, 15 - assignment1));
  const att2 = Math.min(attendanceBasePerTeacher, Math.max(0, 15 - assignment2));

  const continuousTotal = ctEff1 + ctEff2 + assignment1 + assignment2 + att1 + att2;
  const targetTotal = (target / 100) * 300;
  const neededHall = targetTotal - continuousTotal;
  const neededPerTeacherAvg = neededHall / 2;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📝 Final-এ কত লাগবে?</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        Theory course মোট 300: Hall 210 + Continuous 90। Target grade পেতে hall exam-এ minimum কত লাগবে দেখাবে।
      </p>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Teacher-wise Continuous Input</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <div>
          <label>CT Teacher 1 (/30)</label>
          <input type="number" value={ct1} onChange={e => setCt1(e.target.value)} min={0} max={30} />
          <input type="range" min={0} max={30} value={ct1} onChange={e => setCt1(e.target.value)} />
        </div>
        <div>
          <label>Bonus Teacher 1 (+)</label>
          <input type="number" value={bonus1} onChange={e => setBonus1(e.target.value)} min={0} max={30} />
          <input type="range" min={0} max={30} value={bonus1} onChange={e => setBonus1(e.target.value)} />
        </div>
        <div>
          <label>Assignment Teacher 1 (/15)</label>
          <input type="number" value={assign1} onChange={e => setAssign1(e.target.value)} min={0} max={15} />
          <input type="range" min={0} max={15} value={assign1} onChange={e => setAssign1(e.target.value)} />
        </div>
        <div>
          <label>CT Teacher 2 (/30)</label>
          <input type="number" value={ct2} onChange={e => setCt2(e.target.value)} min={0} max={30} />
          <input type="range" min={0} max={30} value={ct2} onChange={e => setCt2(e.target.value)} />
        </div>
        <div>
          <label>Bonus Teacher 2 (+)</label>
          <input type="number" value={bonus2} onChange={e => setBonus2(e.target.value)} min={0} max={30} />
          <input type="range" min={0} max={30} value={bonus2} onChange={e => setBonus2(e.target.value)} />
        </div>
        <div>
          <label>Assignment Teacher 2 (/15)</label>
          <input type="number" value={assign2} onChange={e => setAssign2(e.target.value)} min={0} max={15} />
          <input type="range" min={0} max={15} value={assign2} onChange={e => setAssign2(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label>Attendance %</label>
          <input type="number" value={attPct} onChange={e => setAttPct(e.target.value)} placeholder="80" min={0} max={100} />
          <input type="range" min={0} max={100} value={attPct} onChange={e => setAttPct(e.target.value)} />
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

      <div className="calc-grid" style={{ marginBottom: 10 }}>
        <div className="calc-stat">
          <div className="text-xs text-muted">Continuous</div>
          <div className="stat-num" style={{ fontSize: 28 }}>{continuousTotal.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/90</span></div>
        </div>
        <div className="calc-stat">
          <div className="text-xs text-muted">Target Total ({targetGrade})</div>
          <div className="stat-num" style={{ fontSize: 28 }}>{targetTotal.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/300</span></div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg)', borderColor: neededHall > 210 ? 'var(--danger)' : 'var(--accent)' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          Continuous: {continuousTotal.toFixed(1)}/90
          {' · '}
          Target total for {targetGrade}: {targetTotal.toFixed(1)}/300
        </div>
        {neededHall > 210 ? (
          <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 18 }}>
            ❌ {targetGrade} আর সম্ভব না — Hall exam-এ {neededHall.toFixed(1)}/210 লাগবে
          </div>
        ) : neededHall <= 0 ? (
          <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 18 }}>✅ Already secured {targetGrade}!</div>
        ) : (
          <div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hall exam-এ minimum লাগবে: </span>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)' }}>{neededHall.toFixed(1)}/210</span>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Average per teacher (if equal split): {neededPerTeacherAvg.toFixed(1)}/105
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CGPA Target Planner ───────────────────────────────────────────────────
function WhatIfCalc() {
  const profile = getProfile();
  const courses = getAllCourses(profile);
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
  return (
    <div className="page-enter page-container content-page-bg">
      <div className="hero-banner" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="content-page-hero-icon">
            <Calculator size={18} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Smart Calculators</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Moved into Term Planner</p>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Calculators moved</div>
        <p className="text-muted text-sm">
          Final-needed and term planning tools are now inside the Term Planner page for a simpler 2-page flow.
        </p>
      </div>
    </div>
  );
}
