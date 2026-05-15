import { useState } from 'react';
import { GRADE_SCALE, getAttendanceMarks } from '../store/store';

export default function FinalNeededCalc() {
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
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Final Exam Target Planner</div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        Theory course total 300: Hall 210 + Continuous 90. Target grade পেতে hall exam-এ minimum কত লাগবে দেখাবে।
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
            Not possible — Hall exam-এ {neededHall.toFixed(1)}/210 লাগবে
          </div>
        ) : neededHall <= 0 ? (
          <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 18 }}>Already secured {targetGrade}!</div>
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
