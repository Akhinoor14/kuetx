import { useState } from 'react';
import { store, getGradeFromPct, getAttendanceMarks, computeEffectiveAttendance, GRADE_SCALE, getAllCourses, getProfile, recordAudit } from '../store/store';
import Collapsible from '../components/Collapsible';

// ── Helper: Calculate required hall marks for a target grade ──────────────
function calcHallNeeded(targetMinPct, continuousMarks) {
  // Convert percentage to actual marks out of 300
  // Total = Hall + Continuous (max 300)
  // We need: Total >= targetMinPct% of 300
  // So: Hall = (targetMinPct/100 * 300) - Continuous
  const targetTotal = (targetMinPct / 100) * 300;
  const hallNeeded = Math.max(0, Math.ceil(targetTotal - continuousMarks));
  return Math.min(210, hallNeeded);
}

// ── Get teacher names from schedule ────────────────────────────────────────
function getTeachersForCourse(courseId) {
  const schedule = store.get('schedule') || [];
  const teachers = [...new Set(
    schedule
      .filter(s => s.courseId === courseId)
      .map(s => s.teacherName)
      .filter(Boolean)
  )];
  // Return empty array if no schedule found (no placeholders)
  return teachers;
}

// ── Course card: Estimate Hall marks needed for target grade ──────────────
function CourseCard({ course, marks, onChange }) {
  const m = marks[course.id] || {};
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { pct: attPct } = computeEffectiveAttendance(course.id);
  
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

  // Get actual teacher names from schedule
  const teachers = getTeachersForCourse(course.id);
  const teacher1Name = teachers[0] || 'Teacher 1';
  const teacher2Name = teachers[1] || 'Teacher 2';

  // Parse inputs and compute continuous per teacher (kuet300 logic)
  const hallTotal = clamp(m.hall, 0, 210);

  const ctTeacher1 = clamp(m.ctTeacher1, 0, 30);
  const ctTeacher2 = clamp(m.ctTeacher2, 0, 30);
  // CT bonus (mirrors store's ctBonus1/2) - allow up to 30
  const ctBonus1 = clamp(m.bonusTeacher1, 0, 30);
  const ctBonus2 = clamp(m.bonusTeacher2, 0, 30);

  // Assignments: store uses up to 15 per teacher
  const assignmentTeacher1 = clamp(m.assignmentTeacher1, 0, 15);
  const assignmentTeacher2 = clamp(m.assignmentTeacher2, 0, 15);

  // Attendance: compute per-teacher auto attendance (cap depends on assignment)
  const attendancePerTeacherAuto = attPct !== null ? (getAttendanceMarks(attPct) / 10) * 15 : 0;
  const attendanceCap1 = Math.max(0, 15 - assignmentTeacher1);
  const attendanceCap2 = Math.max(0, 15 - assignmentTeacher2);
  const attendanceAuto1 = Math.min(attendancePerTeacherAuto, attendanceCap1);
  const attendanceAuto2 = Math.min(attendancePerTeacherAuto, attendanceCap2);

  // If user disables auto attendance for this course, allow manual per-teacher attendance inputs
  const useAutoAtt = m.useAutoAtt === undefined ? true : !!m.useAutoAtt;
  const attTeacher1 = useAutoAtt ? attendanceAuto1 : clamp(m.attTeacher1, 0, attendanceCap1);
  const attTeacher2 = useAutoAtt ? attendanceAuto2 : clamp(m.attTeacher2, 0, attendanceCap2);

  // Effective CT per teacher: ct + ctBonus, capped at 30
  const ctEffective1 = Math.min(30, ctTeacher1 + ctBonus1);
  const ctEffective2 = Math.min(30, ctTeacher2 + ctBonus2);

  const teacherContinuous1 = ctEffective1 + assignmentTeacher1 + attTeacher1;
  const teacherContinuous2 = ctEffective2 + assignmentTeacher2 + attTeacher2;

  // Total continuous (two teachers) — max 90
  const currentContinuous = Math.min(90, teacherContinuous1 + teacherContinuous2);
  const currentTotal = Math.min(300, hallTotal + currentContinuous);
  const currentGrade = getGradeFromPct(currentTotal);
  const statusLabel = course.status === 'active' ? 'on going' : course.status;

  // Target grade & required hall calculation
  const targetGrade = m.targetGrade || null;
  const targetGradeObj = targetGrade ? GRADE_SCALE.find(g => g.grade === targetGrade) : null;
  const hallNeeded = targetGradeObj ? calcHallNeeded(targetGradeObj.minPct, currentContinuous) : null;

  return (
    <Collapsible
      className="mb-3"
      title={`${course.code} - ${course.name}`}
      subtitle={`Y${course.year}T${course.term} · ${course.credits} credits · Theory`}
      defaultCollapsed={true}
      storageKey={`marks:${course.id}:open`}
      right={(
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: course.status === 'active' ? 'var(--accent)' : 'var(--text)' }}>{statusLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{currentTotal.toFixed(1)}/300</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>CT {currentContinuous.toFixed(1)}/90</div>
        </div>
      )}
      rightCollapsed={(
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{statusLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{currentTotal.toFixed(1)}/300</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>CT {currentContinuous.toFixed(1)}/90</div>
        </div>
      )}
    >
        <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8, display: 'block' }}>
          🎯 Target Grade → Hall Exam Needed
        </label>
        {/* Inputs: Hall, CTs, Bonus, Assignment, Attendance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Hall Exam (/210)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <input type="number" min={0} max={210} value={m.hall ?? ''} onChange={e => onChange(course.id, 'hall', Math.min(210, Math.max(0, +e.target.value || 0)))} style={{ width: 120, fontSize: 14 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>/210</div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Attendance</label>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Auto: {attPct !== null ? `${attPct}%` : 'No data'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={useAutoAtt} onChange={e => onChange(course.id, 'useAutoAtt', e.target.checked)} /> Auto</label>
              {!useAutoAtt && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min={0} max={attendanceCap1} value={m.attTeacher1 ?? ''} onChange={e => onChange(course.id, 'attTeacher1', Math.min(attendanceCap1, Math.max(0, +e.target.value || 0)))} placeholder={teacher1Name} style={{ width: 80 }} />
                  <input type="number" min={0} max={attendanceCap2} value={m.attTeacher2 ?? ''} onChange={e => onChange(course.id, 'attTeacher2', Math.min(attendanceCap2, Math.max(0, +e.target.value || 0)))} placeholder={teacher2Name} style={{ width: 80 }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{teacher1Name} (CT/Bonus/Assign)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={0} max={30} value={m.ctTeacher1 ?? ''} onChange={e => onChange(course.id, 'ctTeacher1', Math.min(30, Math.max(0, +e.target.value || 0)))} placeholder="CT" style={{ width: 80 }} />
              <input type="number" min={0} max={30} value={m.bonusTeacher1 ?? ''} onChange={e => onChange(course.id, 'bonusTeacher1', Math.min(30, Math.max(0, +e.target.value || 0)))} placeholder="Bonus" style={{ width: 80 }} />
              <input type="number" min={0} max={15} value={m.assignmentTeacher1 ?? ''} onChange={e => onChange(course.id, 'assignmentTeacher1', Math.min(15, Math.max(0, +e.target.value || 0)))} placeholder="Assign" style={{ width: 80 }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{teacher2Name} (CT/Bonus/Assign)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={0} max={30} value={m.ctTeacher2 ?? ''} onChange={e => onChange(course.id, 'ctTeacher2', Math.min(30, Math.max(0, +e.target.value || 0)))} placeholder="CT" style={{ width: 80 }} />
              <input type="number" min={0} max={30} value={m.bonusTeacher2 ?? ''} onChange={e => onChange(course.id, 'bonusTeacher2', Math.min(30, Math.max(0, +e.target.value || 0)))} placeholder="Bonus" style={{ width: 80 }} />
              <input type="number" min={0} max={15} value={m.assignmentTeacher2 ?? ''} onChange={e => onChange(course.id, 'assignmentTeacher2', Math.min(15, Math.max(0, +e.target.value || 0)))} placeholder="Assign" style={{ width: 80 }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Continuous total: <strong style={{ color: 'var(--accent)' }}>{currentContinuous.toFixed(1)}/90</strong></div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>Total: <strong>{currentTotal.toFixed(1)}/300</strong></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(55px, 1fr))', gap: 6 }}>
          {GRADE_SCALE.map(gradeObj => {
            const isSelected = m.targetGrade === gradeObj.grade;
            const rawNeeded = Math.ceil((gradeObj.minPct / 100) * 300 - currentContinuous);
            const needed = Math.max(0, rawNeeded);
            const isPossible = rawNeeded <= 210;
            return (
              <button
                key={gradeObj.grade}
                onClick={() => onChange(course.id, 'targetGrade', isSelected ? null : gradeObj.grade)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: isSelected ? `2px solid var(--accent)` : `1px solid var(--border)`,
                  background: isSelected ? 'rgba(var(--accentRGB), 0.15)' : 'transparent',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 700 : 600,
                  fontSize: 11,
                  color: isSelected ? 'var(--accent)' : isPossible ? 'var(--text)' : 'var(--muted)',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                  opacity: isPossible ? 1 : 0.5,
                }}
                disabled={!isPossible}
              >
                <div>{gradeObj.grade}</div>
                <div style={{ fontSize: 9, color: isSelected ? 'var(--accent)' : isPossible ? 'var(--muted)' : 'var(--muted)', marginTop: 2, fontWeight: 500 }}>
                  {isPossible ? `${needed}/210` : '✗'}
                </div>
              </button>
            );
          })}
        </div>
        
      {/* Required Hall Display */}
      {targetGradeObj && (() => {
        const targetTotal = (targetGradeObj.minPct / 100) * 300;
        const rawNeeded = Math.ceil(targetTotal - currentContinuous);
        const possible = rawNeeded <= 210;
        const neededToShow = Math.max(0, rawNeeded);
        return (
          <div style={{
            padding: '12px 14px',
            background: possible ? (neededToShow > hallTotal ? 'rgba(255, 193, 7, 0.1)' : 'rgba(76, 175, 80, 0.1)') : 'rgba(244, 67, 54, 0.1)',
            borderRadius: 10,
            borderLeft: `4px solid ${possible ? (neededToShow > hallTotal ? 'var(--warning)' : 'var(--success)') : 'var(--danger)'}`,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>To achieve {m.targetGrade}:</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: possible ? (neededToShow > hallTotal ? 'var(--warning)' : 'var(--success)') : 'var(--danger)',
            }}>
              {possible
                ? `Hall exam-এ ${neededToShow}/210 লাগবে`
                : 'Impossible with current continuous'
              }
            </div>
            {possible && neededToShow > hallTotal && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                You have {hallTotal}/210 → Need {(neededToShow - hallTotal).toFixed(0)} more marks
              </div>
            )}
          </div>
        );
      })()}
    </Collapsible>
  );
}

// ── Main Marks Page ───────────────────────────────────────────────────────
export default function Marks() {
  const profile = getProfile();
  const allCourses = getAllCourses(profile);
  const [marks, setMarks] = useState(() => store.get('marks') || {});
  const deptLabel = profile?.dept || 'your department';

  const onChange = (id, field, value) => {
    const updated = { ...marks, [id]: { ...(marks[id] || {}), [field]: value } };
    setMarks(updated);
    store.set('marks', updated);
    try {
      recordAudit({ action: 'marks_update', courseId: id, field, before: marks[id] || null, after: (updated[id] || {})[field] });
    } catch {}
  };

  const active = allCourses.filter(c => c.status === 'active' || c.status === 'backlog');
  const theory = active.filter(c => c.type === 'Theory');

  if (allCourses.length === 0) {
    return (
      <div className="page-enter page-container">
        <div className="hero-banner mb-4">
          <h1>Term Planner</h1>
          <p className="text-muted text-sm">Estimate and plan your final grades</p>
        </div>
        <div className="empty-state">
          <div className="icon">📚</div>
          <p>No curriculum data is loaded for {deptLabel} yet. Open Courses to confirm the department setup or switch to a department with course data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter page-container">
      <div className="hero-banner mb-4">
        <div>
          <h1>Term Planner</h1>
          <p className="text-muted text-sm">
            Estimate hall exam marks needed to achieve your target grade
          </p>
        </div>
      </div>

      {theory.length === 0 ? (
        <div className="info-box">
          <p>No active theory courses. Add courses from the Courses section.</p>
        </div>
      ) : (
        <>
          {/* Theory Courses */}
          <div className="mb-6">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
              Theory Courses ({theory.length})
            </h2>
            {theory.map(c => (
              <CourseCard key={c.id} course={c} marks={marks} onChange={onChange} />
            ))}
          </div>

          {/* Planning Tips */}
          <div style={{
            padding: '16px 14px',
            background: 'linear-gradient(135deg, rgba(var(--accentRGB), 0.05), rgba(var(--accentRGB), 0.02))',
            borderRadius: 12,
            borderLeft: '4px solid var(--accent)',
            marginTop: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>💡 Planning Tips</div>
            <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: 4 }}>• Enter your Hall exam and CT marks to see your current grade</li>
              <li style={{ marginBottom: 4 }}>• Select a target grade to see the minimum hall exam marks needed</li>
              <li style={{ marginBottom: 4 }}>• Attendance marks are automatically pulled from your Attendance page</li>
              <li>• Final grades are only confirmed after official results are published</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
