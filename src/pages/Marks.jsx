import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { store, getGradeFromPct, getAttendanceMarks, computeEffectiveAttendance, GRADE_SCALE } from '../store/store';

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
// KUET theory: Attendance+Participation+Assignment = 30%, CT = 60%, Term Final = ?
// But distribution is custom per teacher. So: fully manual with attendance auto-fill option.
function TheoryCard({ course, marks, onChange }) {
  const m = marks[course.id] || {};
  const [open, setOpen] = useState(true);

  // Attendance auto-fill
  const { pct: attPct } = computeEffectiveAttendance(course.id);
  const attAutoMarks = attPct !== null ? getAttendanceMarks(attPct) : null;

  // User defines their own distribution
  const totalMarks   = +(m.totalMarks || 100);
  const finalMax     = +(m.finalMax   || 70);  // default 70
  const ctTotalMax   = +(m.ctTotalMax || 20);  // user sets total CT marks
  const partMax      = +(m.partMax    || 10);  // attendance + participation + assignment

  const finalObtained = +(m.final   || 0);
  const ctObtained    = +(m.ctTotal || 0);
  const partObtained  = m.useAutoAtt && attAutoMarks !== null
    ? (attAutoMarks / 10) * partMax  // scale auto att marks to partMax
    : +(m.part || 0);

  const pct = totalMarks > 0
    ? ((finalObtained / finalMax) * finalMax +
       (ctObtained    / ctTotalMax) * ctTotalMax +
       partObtained) / totalMarks * 100
    : null;

  // simpler: just sum raw and compute percent
  const rawTotal = finalObtained + ctObtained + partObtained;
  const rawMax   = finalMax + ctTotalMax + partMax;
  const totalPct = rawMax > 0 ? (rawTotal / rawMax) * 100 : null;
  const grade    = totalPct !== null ? getGradeFromPct(totalPct) : null;
  // Backlog cap
  const effectiveGrade = course.status === 'backlog' && grade && grade.point > 3.25
    ? GRADE_SCALE.find(g => g.grade === 'B+') : grade;

  return (
    <div className="card mb-3">
      {/* Header */}
      <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="mono fw-700" style={{ fontSize: 15 }}>{course.code}</span>
            <span style={{ fontSize: 14 }}>{course.name}</span>
            {course.status === 'backlog' && <span className="tag tag-red">Backlog</span>}
          </div>
          <div className="text-muted" style={{ marginTop: 2 }}>Y{course.year} T{course.term} · {course.credits} credits · Theory</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {effectiveGrade && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: effectiveGrade.grade === 'F' ? 'var(--danger)' : 'var(--success)' }}>
                {effectiveGrade.grade}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{rawTotal.toFixed(0)}/{rawMax}</div>
            </div>
          )}
          {open ? <ChevronUp size={18} color="var(--muted)" /> : <ChevronDown size={18} color="var(--muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 18 }}>

          {/* Step 1: Setup max marks */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--inputBg)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ① Mark Distribution Setup
              <Tip text="Set how many marks each section is worth in your course. This varies by teacher." />
            </div>
            <div className="form-row form-row-3">
              <div>
                <label>Term Final (max marks)</label>
                <input type="number" value={m.finalMax || 70} onChange={e => onChange(course.id, 'finalMax', +e.target.value)} placeholder="70" min={0} />
              </div>
              <div>
                <label>CT Total (max marks)</label>
                <input type="number" value={m.ctTotalMax || 20} onChange={e => onChange(course.id, 'ctTotalMax', +e.target.value)} placeholder="20" min={0} />
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>e.g. 30+30=60, or 20, custom</div>
              </div>
              <div>
                <label>Att+Part+Assign (max)</label>
                <input type="number" value={m.partMax || 10} onChange={e => onChange(course.id, 'partMax', +e.target.value)} placeholder="10" min={0} />
              </div>
            </div>
          </div>

          {/* Step 2: Enter marks */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--inputBg)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ② Enter Your Marks
            </div>
            <div className="form-row form-row-3">
              <div>
                <label>Term Final Obtained</label>
                <input type="number" value={m.final || ''} onChange={e => onChange(course.id, 'final', +e.target.value)} placeholder="0" min={0} max={m.finalMax || 70} />
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>out of {m.finalMax || 70}</div>
              </div>
              <div>
                <label>CT Total Obtained</label>
                <input type="number" value={m.ctTotal || ''} onChange={e => onChange(course.id, 'ctTotal', +e.target.value)} placeholder="0" min={0} max={m.ctTotalMax || 20} />
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>out of {m.ctTotalMax || 20}</div>
              </div>
              <div>
                <label>Att+Part+Assign Obtained</label>
                {attAutoMarks !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <input type="checkbox" id={`auto-${course.id}`} checked={!!m.useAutoAtt} onChange={e => onChange(course.id, 'useAutoAtt', e.target.checked)} style={{ width: 'auto' }} />
                    <label htmlFor={`auto-${course.id}`} style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'none', letterSpacing: 0, marginBottom: 0, cursor: 'pointer' }}>
                      Auto from attendance ({attPct}%)
                    </label>
                  </div>
                )}
                <input type="number" value={m.useAutoAtt ? partObtained.toFixed(1) : (m.part || '')} onChange={e => onChange(course.id, 'part', +e.target.value)} placeholder="0" min={0} max={m.partMax || 10} disabled={!!m.useAutoAtt} />
              </div>
            </div>
          </div>

          {/* Result */}
          <div style={{ padding: '14px 16px', background: effectiveGrade?.grade === 'F' ? '#fff1f1' : '#f0fdf4', borderRadius: 9, border: `1px solid ${effectiveGrade?.grade === 'F' ? '#fecaca' : '#bbf7d0'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="text-xs text-muted mb-2">Result</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div><div className="text-xs text-muted">Obtained</div><div className="fw-800" style={{ fontSize: 20 }}>{rawTotal.toFixed(1)}/{rawMax}</div></div>
                  <div><div className="text-xs text-muted">Percentage</div><div className="fw-800" style={{ fontSize: 20 }}>{totalPct !== null ? totalPct.toFixed(1) + '%' : '—'}</div></div>
                  <div><div className="text-xs text-muted">Grade</div><div className="fw-800" style={{ fontSize: 24, color: effectiveGrade?.grade === 'F' ? 'var(--danger)' : 'var(--success)' }}>{effectiveGrade?.grade || '—'}</div></div>
                  <div><div className="text-xs text-muted">GPA Point</div><div className="fw-800" style={{ fontSize: 20, color: 'var(--accent)' }}>{effectiveGrade?.point?.toFixed(2) || '—'}</div></div>
                </div>
              </div>
              {course.status === 'backlog' && effectiveGrade?.grade !== effectiveGrade?.grade && (
                <div className="tag tag-yellow">⚠ Capped at B+ (Art.16)</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessional/Lab course card ──────────────────────────────────────────────
function SessionalCard({ course, marks, onChange }) {
  const m = marks[course.id] || {};
  const [open, setOpen] = useState(true);
  const { pct: attPct } = computeEffectiveAttendance(course.id);
  const attMarks = attPct !== null ? getAttendanceMarks(attPct) : (+(m.manualAtt || 0));

  const quiz        = +(m.quiz        || 0);
  const centralViva = +(m.centralViva || 0);
  const performance = +(m.performance || 0);
  const total       = attMarks + quiz + centralViva + performance;
  const grade       = getGradeFromPct(total);

  return (
    <div className="card mb-3">
      <div className="flex-between" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono fw-700" style={{ fontSize: 15 }}>{course.code}</span>
            <span style={{ fontSize: 14 }}>{course.name}</span>
          </div>
          <div className="text-muted" style={{ marginTop: 2 }}>Y{course.year} T{course.term} · {course.credits}cr · Lab/Sessional</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: grade.grade === 'F' ? 'var(--danger)' : 'var(--success)' }}>{grade.grade}</div>
            <div className="text-xs text-muted">{total.toFixed(0)}/100</div>
          </div>
          {open ? <ChevronUp size={18} color="var(--muted)" /> : <ChevronDown size={18} color="var(--muted)" />}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--inputBg)', borderRadius: 9, fontSize: 13, color: 'var(--muted)' }}>
            Art. 14.1.ii: Attendance 10% + Lab Quiz/Viva 20% + Central Viva 20% + Performance/Report 50%
          </div>

          <div className="form-row form-row-4">
            <div>
              <label>Attendance (/10)</label>
              {attPct !== null ? (
                <div style={{ padding: '9px 13px', background: 'var(--inputBg)', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {attMarks}/10 <span className="text-xs text-muted">({attPct}%)</span>
                </div>
              ) : (
                <input type="number" value={m.manualAtt || ''} onChange={e => onChange(course.id, 'manualAtt', Math.min(10, +e.target.value))} placeholder="0" min={0} max={10} />
              )}
            </div>
            <div>
              <label>Lab Quiz/Viva (/20)</label>
              <input type="number" value={m.quiz || ''} onChange={e => onChange(course.id, 'quiz', Math.min(20, +e.target.value))} placeholder="0" min={0} max={20} />
            </div>
            <div>
              <label>Central Viva (/20)</label>
              <input type="number" value={m.centralViva || ''} onChange={e => onChange(course.id, 'centralViva', Math.min(20, +e.target.value))} placeholder="0" min={0} max={20} />
            </div>
            <div>
              <label>Performance/Report (/50)</label>
              <input type="number" value={m.performance || ''} onChange={e => onChange(course.id, 'performance', Math.min(50, +e.target.value))} placeholder="0" min={0} max={50} />
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 9, border: '1px solid #bbf7d0', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><div className="text-xs text-muted">Total</div><div className="fw-800" style={{ fontSize: 20 }}>{total.toFixed(0)}/100</div></div>
            <div><div className="text-xs text-muted">Grade</div><div className="fw-800" style={{ fontSize: 24, color: grade.grade === 'F' ? 'var(--danger)' : 'var(--success)' }}>{grade.grade}</div></div>
            <div><div className="text-xs text-muted">Point</div><div className="fw-800" style={{ fontSize: 20, color: 'var(--accent)' }}>{grade.point.toFixed(2)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Marks Page ───────────────────────────────────────────────────────
export default function Marks() {
  const allCourses = store.get('courses') || [];
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
    <div className="page-enter" style={{ padding: 20, maxWidth: 820 }}>
      <div className="flex-between mb-4">
        <div>
          <h1>Marks & CT</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Set your own mark distribution — fully flexible for every teacher's system
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

      {/* Grade reference */}
      <div className="card mt-4" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>KUET Grade Scale (Art. 13.1)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {GRADE_SCALE.map(g => (
            <div key={g.grade} style={{ textAlign: 'center', padding: '6px 12px', background: 'var(--inputBg)', borderRadius: 8, minWidth: 60 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: g.grade === 'F' ? 'var(--danger)' : 'var(--text)' }}>{g.grade}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{g.point.toFixed(2)}</div>
              <div className="text-xs text-muted">≥{g.minPct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
