import { useState } from 'react';
import { Info } from 'lucide-react';
import { store, getGradeFromPct, getAttendanceMarks, computeEffectiveAttendance, GRADE_SCALE, getAllCourses, getProfile } from '../store/store';
import Collapsible from '../components/Collapsible';
import FinalNeededCalc from '../components/FinalNeededCalc';

// ── Tooltip / info helper ──────────────────────────────────────────────────
function Tip({ text }) {
  return (
    <span title={text} style={{ color: 'var(--muted)', cursor: 'help', marginLeft: 5 }}>
      <Info size={13} />
    </span>
  );
}

// ── Mini result badge ──────────────────────────────────────────────────────
function GradeBadge({ total, status }) {
  if (total === null) return null;
  const g = getGradeFromPct(total);
  const col = g.grade === 'F' ? 'var(--danger)' : g.grade.startsWith('A') ? 'var(--success)' : 'var(--text)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', color: col }}>{total.toFixed(1)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Grade</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: col }}>{g.grade}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Point</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{g.point.toFixed(2)}</div>
      </div>
    </div>
  );
}

// ── Theory course card ─────────────────────────────────────────────────────
function TheoryCard({ course, marks, onChange }) {
  const m = marks[course.id] || {};

  const { pct: attPct } = computeEffectiveAttendance(course.id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

  const hallTeacher1 = clamp(m.hallTeacher1, 0, 105);
  const hallTeacher2 = clamp(m.hallTeacher2, 0, 105);

  const ctTeacher1 = clamp(m.ctTeacher1, 0, 30);
  const ctTeacher2 = clamp(m.ctTeacher2, 0, 30);
  const ctBonus1 = clamp(m.ctBonus1, 0, 30);
  const ctBonus2 = clamp(m.ctBonus2, 0, 30);

  const ctEffective1 = clamp(ctTeacher1 + ctBonus1, 0, 30);
  const ctEffective2 = clamp(ctTeacher2 + ctBonus2, 0, 30);

  const assignment1 = clamp(m.assignment1, 0, 15);
  const assignment2 = clamp(m.assignment2, 0, 15);

  const useAutoAtt = m.useAutoAtt !== false;
  const attendanceBasePerTeacher = attPct !== null ? (getAttendanceMarks(attPct) / 10) * 15 : 0;
  const attendanceCap1 = Math.max(0, 15 - assignment1);
  const attendanceCap2 = Math.max(0, 15 - assignment2);
  const attendanceAuto1 = Math.min(attendanceBasePerTeacher, attendanceCap1);
  const attendanceAuto2 = Math.min(attendanceBasePerTeacher, attendanceCap2);
  const attendance1 = useAutoAtt ? attendanceAuto1 : clamp(m.attTeacher1, 0, attendanceCap1);
  const attendance2 = useAutoAtt ? attendanceAuto2 : clamp(m.attTeacher2, 0, attendanceCap2);

  const teacherContinuous1 = ctEffective1 + assignment1 + attendance1;
  const teacherContinuous2 = ctEffective2 + assignment2 + attendance2;

  const hallTotal = hallTeacher1 + hallTeacher2;
  const continuousTotal = teacherContinuous1 + teacherContinuous2;
  const rawTotal = Math.min(300, hallTotal + continuousTotal);
  const hasAnyEntry = Object.values(m).some(v => v !== '' && v !== null && v !== undefined);

  return (
    <Collapsible
      className="mb-3"
      title={`${course.code} - ${course.name}`}
      subtitle={`Y${course.year} T${course.term} · ${course.credits} credits · Theory`}
      defaultCollapsed={true}
      storageKey={`marks:${course.id}:open`}
      right={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag tag-green">Running</span>
          {course.status === 'backlog' && <span className="tag tag-red">Backlog</span>}
          {hasAnyEntry && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>CT {continuousTotal.toFixed(1)}/90</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Hall {hallTotal.toFixed(1)}/210</div>
            </div>
          )}
        </div>
      )}
    >

          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--inputBg)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ① Exam Hall Marks (210)
              <Tip text="Theory main exam = 210. Teacher-1: 105, Teacher-2: 105." />
            </div>
            <div className="form-row form-row-2">
              <div>
                <label>Teacher 1 Hall Exam (/105)</label>
                <input type="number" value={m.hallTeacher1 || ''} onChange={e => onChange(course.id, 'hallTeacher1', +e.target.value)} placeholder="0" min={0} max={105} />
              </div>
              <div>
                <label>Teacher 2 Hall Exam (/105)</label>
                <input type="number" value={m.hallTeacher2 || ''} onChange={e => onChange(course.id, 'hallTeacher2', +e.target.value)} placeholder="0" min={0} max={105} />
              </div>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
              Hall Total: {hallTotal.toFixed(1)}/210
            </div>
          </div>

          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--inputBg)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ② Continuous Marks (90) — CT 60 + Attendance/Assignment 30
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id={`auto-att-${course.id}`} checked={useAutoAtt} onChange={e => onChange(course.id, 'useAutoAtt', e.target.checked)} style={{ width: 'auto' }} />
              <label htmlFor={`auto-att-${course.id}`} style={{ marginBottom: 0, fontSize: 12, color: 'var(--accent)', textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>
                Auto attendance split for both teachers
                {attPct !== null ? ` (${attPct}% attendance)` : ' (no attendance data)'}
              </label>
            </div>

            <div className="form-row form-row-2">
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Teacher 1 (max 45)</div>
                <div className="form-row form-row-3">
                  <div>
                    <label>CT (/30)</label>
                    <input type="number" value={m.ctTeacher1 || ''} onChange={e => onChange(course.id, 'ctTeacher1', +e.target.value)} placeholder="0" min={0} max={30} />
                  </div>
                  <div>
                    <label>Bonus (+)</label>
                    <input type="number" value={m.ctBonus1 || ''} onChange={e => onChange(course.id, 'ctBonus1', +e.target.value)} placeholder="0" min={0} max={30} />
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>CT + Bonus capped at 30</div>
                  </div>
                  <div>
                    <label>Assignment (/15)</label>
                    <input type="number" value={m.assignment1 || ''} onChange={e => onChange(course.id, 'assignment1', +e.target.value)} placeholder="0" min={0} max={15} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label>Attendance Part (/15)</label>
                  <input
                    type="number"
                    value={attendance1.toFixed(1)}
                    onChange={e => onChange(course.id, 'attTeacher1', +e.target.value)}
                    min={0}
                    max={attendanceCap1}
                    disabled={useAutoAtt}
                  />
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Assignment add করলে attendance অংশ auto হয়ে বাকি থেকে যাবে: {attendanceCap1.toFixed(1)} max
                  </div>
                </div>
                <div className="text-xs" style={{ marginTop: 6, color: 'var(--muted)' }}>
                  Teacher 1 subtotal: {teacherContinuous1.toFixed(1)}/45
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Teacher 2 (max 45)</div>
                <div className="form-row form-row-3">
                  <div>
                    <label>CT (/30)</label>
                    <input type="number" value={m.ctTeacher2 || ''} onChange={e => onChange(course.id, 'ctTeacher2', +e.target.value)} placeholder="0" min={0} max={30} />
                  </div>
                  <div>
                    <label>Bonus (+)</label>
                    <input type="number" value={m.ctBonus2 || ''} onChange={e => onChange(course.id, 'ctBonus2', +e.target.value)} placeholder="0" min={0} max={30} />
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>CT + Bonus capped at 30</div>
                  </div>
                  <div>
                    <label>Assignment (/15)</label>
                    <input type="number" value={m.assignment2 || ''} onChange={e => onChange(course.id, 'assignment2', +e.target.value)} placeholder="0" min={0} max={15} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label>Attendance Part (/15)</label>
                  <input
                    type="number"
                    value={attendance2.toFixed(1)}
                    onChange={e => onChange(course.id, 'attTeacher2', +e.target.value)}
                    min={0}
                    max={attendanceCap2}
                    disabled={useAutoAtt}
                  />
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Assignment add করলে attendance অংশ auto হয়ে বাকি থেকে যাবে: {attendanceCap2.toFixed(1)} max
                  </div>
                </div>
                <div className="text-xs" style={{ marginTop: 6, color: 'var(--muted)' }}>
                  Teacher 2 subtotal: {teacherContinuous2.toFixed(1)}/45
                </div>
              </div>
            </div>

            <div className="text-xs text-muted" style={{ marginTop: 8 }}>
              Continuous Total: {continuousTotal.toFixed(1)}/90
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="text-xs text-muted mb-2">Progress Summary</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div><div className="text-xs text-muted">Hall</div><div className="fw-800" style={{ fontSize: 20 }}>{hallTotal.toFixed(1)}/210</div></div>
                  <div><div className="text-xs text-muted">Continuous</div><div className="fw-800" style={{ fontSize: 20 }}>{continuousTotal.toFixed(1)}/90</div></div>
                  <div><div className="text-xs text-muted">Total</div><div className="fw-800" style={{ fontSize: 20 }}>{rawTotal.toFixed(1)}/300</div></div>
                </div>
              </div>
            </div>
          </div>
    </Collapsible>
  );
}

// ── Sessional/Lab course card ──────────────────────────────────────────────
function SessionalCard({ course, marks, onChange }) {
  const m = marks[course.id] || {};

  return (
    <Collapsible
      className="mb-3"
      title={`${course.code} - ${course.name}`}
      subtitle={`Y${course.year} T${course.term} · ${course.credits}cr · Lab/Sessional`}
      defaultCollapsed={true}
      storageKey={`marks:${course.id}:open`}
      right={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tag tag-green">Running</span>
        </div>
      )}
    >
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 9, fontSize: 13, color: 'var(--muted)' }}>
            Lab results are published as final grades. Use Results page for official upload.
          </div>
    </Collapsible>
  );
}

// ── Main Marks Page ───────────────────────────────────────────────────────
export default function Marks() {
  const profile = getProfile();
  const allCourses = getAllCourses(profile);
  const [marks, setMarks] = useState(() => store.get('marks') || {});
  const [activeTab, setActiveTab] = useState('theory');

  const onChange = (id, field, value) => {
    const updated = { ...marks, [id]: { ...(marks[id] || {}), [field]: value } };
    setMarks(updated);
    store.set('marks', updated);
  };

  const active     = allCourses.filter(c => c.status === 'active' || c.status === 'backlog');
  const theory     = active.filter(c => c.type === 'Theory');
  const sessional  = active.filter(c => c.type === 'Sessional');
  const project    = active.filter(c => c.type === 'Project');
  const nonCredit  = active.filter(c => c.type === 'NonCredit');

  return (
    <div className="page-enter page-container">
      <div className="hero-banner mb-4">
        <div>
          <h1>Term Planner</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Track CT + attendance now, and plan final (210) target
          </p>
        </div>
      </div>

      {allCourses.length === 0 && (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p>Add courses first, then come here to enter marks.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {[
          ['theory',    `Theory (${theory.length})`],
          ['sessional', `Lab (${sessional.length})`],
          ['project',   `Project (${project.length})`],
          ['noncredit', `Non-Credit (${nonCredit.length})`],
        ].map(([id, label]) => (
          <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* Theory */}
      {activeTab === 'theory' && (
        <div>
          {theory.length === 0
            ? <div className="info-box">No active theory courses. Add courses from the Courses section.</div>
            : theory.map(c => <TheoryCard key={c.id} course={c} marks={marks} onChange={onChange} />)
          }
        </div>
      )}

      {/* Sessional */}
      {activeTab === 'sessional' && (
        <div>
          {sessional.length === 0
            ? <div className="info-box">No active lab/sessional courses.</div>
            : sessional.map(c => <SessionalCard key={c.id} course={c} marks={marks} onChange={onChange} />)
          }
        </div>
      )}

      {/* Project/Thesis */}
      {activeTab === 'project' && (
        <div>
          {project.length === 0
            ? <div className="info-box">No active project/thesis courses.</div>
            : project.map(c => {
              const m = marks[c.id] || {};
              return (
                <div key={c.id} className="card mb-3">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.code} — {c.name}</div>
                  <div className="text-muted text-sm mb-3">Art. 14.1.iii: Term 1 = 30% (Supervisor 20% + Viva 10%) · Term 2 = 70% (Supervisor 40% + Viva 20% + External 10%)</div>
                  <div className="form-row form-row-2">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>TERM 1 — 30% of Total</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label>Supervisor (/20)</label><input type="number" value={m.supervisorT1||''} onChange={e=>onChange(c.id,'supervisorT1',Math.min(20,+e.target.value))} placeholder="0" min={0} max={20}/></div>
                        <div><label>Viva Committee (/10)</label><input type="number" value={m.vivaT1||''} onChange={e=>onChange(c.id,'vivaT1',Math.min(10,+e.target.value))} placeholder="0" min={0} max={10}/></div>
                        <div className="info-box">Grade: <strong style={{color:'var(--warning)'}}>X</strong> (In Progress — carries to Term 2)</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>TERM 2 — 70% of Total</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div><label>Supervisor (/40)</label><input type="number" value={m.supervisorT2||''} onChange={e=>onChange(c.id,'supervisorT2',Math.min(40,+e.target.value))} placeholder="0" min={0} max={40}/></div>
                        <div><label>Viva Committee (/20)</label><input type="number" value={m.vivaT2||''} onChange={e=>onChange(c.id,'vivaT2',Math.min(20,+e.target.value))} placeholder="0" min={0} max={20}/></div>
                        <div><label>External Examiner (/10)</label><input type="number" value={m.external||''} onChange={e=>onChange(c.id,'external',Math.min(10,+e.target.value))} placeholder="0" min={0} max={10}/></div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 10 }}>
                    <input type="checkbox" id={`proj-${c.id}`} checked={!!m.projectComplete} onChange={e=>onChange(c.id,'projectComplete',e.target.checked)} style={{width:'auto'}}/>
                    <label htmlFor={`proj-${c.id}`} style={{marginBottom:0,cursor:'pointer',fontSize:14,color:'var(--text)',textTransform:'none',letterSpacing:0,fontWeight:500}}>
                      Term 2 complete — calculate final grade
                    </label>
                  </div>
                  {m.projectComplete && (() => {
                    const total = ((m.supervisorT1||0)+(m.vivaT1||0))*0.30 + ((m.supervisorT2||0)+(m.vivaT2||0)+(m.external||0))*0.70;
                    const g = getGradeFromPct(total);
                    return (
                      <div className="alert-success">
                        Final: <strong>{total.toFixed(1)}/100</strong> → Grade: <strong style={{fontSize:18,color:g.grade==='F'?'var(--danger)':'var(--success)'}}>{g.grade}</strong> ({g.point.toFixed(2)} points)
                      </div>
                    );
                  })()}
                </div>
              );
            })
          }
        </div>
      )}

      {/* Non-Credit */}
      {activeTab === 'noncredit' && (
        <div>
          {nonCredit.length === 0
            ? <div className="info-box">No non-credit courses.</div>
            : nonCredit.map(c => {
              const m = marks[c.id] || {};
              return (
                <div key={c.id} className="card mb-3">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.code} — {c.name}</div>
                  <div className="text-muted text-sm mb-3">Art. 9.4: Non-credit courses get S (Satisfactory) or U (Unsatisfactory). Not counted in GPA.</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['S', 'U'].map(grade => (
                      <button key={grade} onClick={() => onChange(c.id, 'suGrade', grade)} style={{
                        flex: 1, padding: '12px', borderRadius: 9, border: '2px solid', cursor: 'pointer',
                        fontWeight: 800, fontSize: 18, fontFamily: 'Sora, sans-serif',
                        borderColor: m.suGrade === grade ? (grade === 'S' ? 'var(--success)' : 'var(--danger)') : 'var(--border)',
                        background: m.suGrade === grade ? (grade === 'S' ? '#f0fdf4' : '#fff1f1') : 'transparent',
                        color: m.suGrade === grade ? (grade === 'S' ? 'var(--success)' : 'var(--danger)') : 'var(--muted)',
                      }}>
                        {grade} — {grade === 'S' ? 'Satisfactory' : 'Unsatisfactory'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      <div className="card mt-4" style={{ marginTop: 24 }}>
        <FinalNeededCalc />
      </div>
    </div>
  );
}
