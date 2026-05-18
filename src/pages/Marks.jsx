import { useState } from 'react';
import { store, getGradeFromPct, getAttendanceMarks, computeEffectiveAttendance, GRADE_SCALE, getAllCourses, getProfile, getCurrentTermKey, getTermTimeline, recordAudit } from '../store/store';

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

// ── Course card: Modern grid-based layout ──────────────────────────────────
function CourseCard({ course, marks, onChange, isCurrentOngoingTerm }) {
  const m = marks[course.id] || {};
  const { pct: attPct } = computeEffectiveAttendance(course.id);
  const inputDisabled = !!isCurrentOngoingTerm;
  
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

  const teachers = getTeachersForCourse(course.id);
  const teacher1Name = teachers[0] || 'Teacher 1';
  const teacher2Name = teachers[1] || 'Teacher 2';

  const hallTotal = clamp(m.hall, 0, 210);
  const ctTeacher1 = clamp(m.ctTeacher1, 0, 30);
  const ctTeacher2 = clamp(m.ctTeacher2, 0, 30);
  const ctBonus1 = clamp(m.bonusTeacher1, 0, 30);
  const ctBonus2 = clamp(m.bonusTeacher2, 0, 30);
  const assignmentTeacher1 = clamp(m.assignmentTeacher1, 0, 15);
  const assignmentTeacher2 = clamp(m.assignmentTeacher2, 0, 15);

  const attendanceCap1 = Math.max(0, 15 - assignmentTeacher1);
  const attendanceCap2 = Math.max(0, 15 - assignmentTeacher2);

  // Attendance modes: 'auto' (pull from Attendance page),
  // 'manual_percent' (single percentage input), 'manual_marks' (per-teacher marks inputs)
  const attMode = m.attMode || 'auto';
  const manualAttPct = m.attPctManual === undefined || m.attPctManual === null ? null : Number(m.attPctManual);

  const attendanceSourcePct = attMode === 'auto' ? attPct : (attMode === 'manual_percent' ? manualAttPct : null);
  const attendancePerTeacherFromPct = attendanceSourcePct !== null && attendanceSourcePct !== undefined ? (getAttendanceMarks(attendanceSourcePct) / 10) * 15 : 0;

  const attendanceAuto1 = Math.min(attendancePerTeacherFromPct, attendanceCap1);
  const attendanceAuto2 = Math.min(attendancePerTeacherFromPct, attendanceCap2);

  const attTeacher1 = attMode === 'manual_marks' ? clamp(m.attTeacher1, 0, attendanceCap1) : attendanceAuto1;
  const attTeacher2 = attMode === 'manual_marks' ? clamp(m.attTeacher2, 0, attendanceCap2) : attendanceAuto2;

  const ctEffective1 = Math.min(30, ctTeacher1 + ctBonus1);
  const ctEffective2 = Math.min(30, ctTeacher2 + ctBonus2);

  const teacherContinuous1 = ctEffective1 + assignmentTeacher1 + attTeacher1;
  const teacherContinuous2 = ctEffective2 + assignmentTeacher2 + attTeacher2;
  const currentContinuous = Math.min(90, teacherContinuous1 + teacherContinuous2);
  const currentTotal = Math.min(300, hallTotal + currentContinuous);
  const currentGrade = getGradeFromPct(currentTotal);

  const targetGrade = m.targetGrade || null;
  const targetGradeObj = targetGrade ? GRADE_SCALE.find(g => g.grade === targetGrade) : null;

  return (
    <div className="planner-course-card">
      {/* Header */}
      <div className="planner-card-header">
        <div>
          <h3 className="planner-card-title">{course.code}</h3>
          <p className="planner-card-desc">{course.name}</p>
          <p className="planner-card-note" style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>Local estimate — does not affect official results.</p>
        </div>
      </div>

      {/* Planner is purely local; no remote mark entry/status shown here */}

      {/* Main Input Section */}
      <div className="planner-card-body">
        {/* Hall & Attendance Row */}
        <div className="planner-grid-2">
          <div className="planner-input-field">
            <label>Hall Exam</label>
            <div className="planner-input-wrapper">
              <input type="number" min={0} max={210} value={m.hall ?? ''} onChange={e => onChange(course.id, 'hall', Math.min(210, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              <span className="planner-input-unit">/210</span>
            </div>
          </div>
          <div className="planner-input-field">
            <label>Attendance {attPct !== null ? `(${attPct}%)` : ''}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'auto'} onChange={() => onChange(course.id, 'attMode', 'auto')} disabled={inputDisabled} /> Auto
                </label>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'manual_percent'} onChange={() => onChange(course.id, 'attMode', 'manual_percent')} disabled={inputDisabled} /> Manual %
                </label>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'manual_marks'} onChange={() => onChange(course.id, 'attMode', 'manual_marks')} disabled={inputDisabled} /> Manual Marks
                </label>
              </div>

              {attMode === 'manual_percent' && (
                <input type="number" min={0} max={100} value={m.attPctManual ?? ''} onChange={e => onChange(course.id, 'attPctManual', e.target.value === '' ? null : Math.min(100, Math.max(0, +e.target.value)))} placeholder="Attendance %" style={{ marginLeft: 8, width: 120 }} />
              )}

              {attMode === 'manual_marks' && (
                <div style={{ display: 'flex', gap: 6, flex: 1, marginLeft: 8 }}>
                  <input type="number" min={0} max={attendanceCap1} value={m.attTeacher1 ?? ''} onChange={e => onChange(course.id, 'attTeacher1', Math.min(attendanceCap1, Math.max(0, +e.target.value || 0)))} placeholder="0" disabled={inputDisabled} style={{ flex: 1 }} />
                  <input type="number" min={0} max={attendanceCap2} value={m.attTeacher2 ?? ''} onChange={e => onChange(course.id, 'attTeacher2', Math.min(attendanceCap2, Math.max(0, +e.target.value || 0)))} placeholder="0" disabled={inputDisabled} style={{ flex: 1 }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teachers Section */}
        <div className="planner-teachers-section">
          <div className="planner-teacher-card">
            <div className="planner-teacher-name">{teacher1Name}</div>
            <div className="planner-teacher-inputs">
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>CT</label>
                <input type="number" min={0} max={30} value={m.ctTeacher1 ?? ''} onChange={e => onChange(course.id, 'ctTeacher1', Math.min(30, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Bonus</label>
                <input type="number" min={0} max={30} value={m.bonusTeacher1 ?? ''} onChange={e => onChange(course.id, 'bonusTeacher1', Math.min(30, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Assign</label>
                <input type="number" min={0} max={15} value={m.assignmentTeacher1 ?? ''} onChange={e => onChange(course.id, 'assignmentTeacher1', Math.min(15, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
            </div>
          </div>

          <div className="planner-teacher-card">
            <div className="planner-teacher-name">{teacher2Name}</div>
            <div className="planner-teacher-inputs">
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>CT</label>
                <input type="number" min={0} max={30} value={m.ctTeacher2 ?? ''} onChange={e => onChange(course.id, 'ctTeacher2', Math.min(30, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Bonus</label>
                <input type="number" min={0} max={30} value={m.bonusTeacher2 ?? ''} onChange={e => onChange(course.id, 'bonusTeacher2', Math.min(30, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Assign</label>
                <input type="number" min={0} max={15} value={m.assignmentTeacher2 ?? ''} onChange={e => onChange(course.id, 'assignmentTeacher2', Math.min(15, Math.max(0, +e.target.value || 0)))} disabled={inputDisabled} placeholder="0" />
              </div>
            </div>
          </div>
        </div>

        {/* Grade Selector */}
        <div className="planner-target-section">
          <label className="planner-target-label">🎯 Target Grade</label>
          <div className="planner-grade-buttons">
            {GRADE_SCALE.map(gradeObj => {
              const isSelected = m.targetGrade === gradeObj.grade;
              const rawNeeded = Math.ceil((gradeObj.minPct / 100) * 300 - currentContinuous);
              const needed = Math.max(0, rawNeeded);
              const isPossible = rawNeeded <= 210;
              return (
                <button
                  key={gradeObj.grade}
                  onClick={() => onChange(course.id, 'targetGrade', isSelected ? null : gradeObj.grade)}
                  disabled={inputDisabled || !isPossible}
                  className={`planner-grade-btn ${isSelected ? 'active' : ''} ${isPossible ? '' : 'impossible'}`}
                >
                  <span>{gradeObj.grade}</span>
                  <span>{isPossible ? needed : '✗'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Display */}
        <div className="planner-result-box">
          <div className="planner-result-row">
            <span>Continuous</span>
            <strong>{currentContinuous.toFixed(1)}/90</strong>
          </div>
          <div className="planner-result-row">
            <span>Total Marks</span>
            <strong>{currentTotal.toFixed(0)}/300</strong>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>This is an estimate only — does not affect official records.</div>
        </div>

        {/* Required Hall Display */}
        {targetGradeObj && targetGradeObj.minPct ? (() => {
          const targetTotal = (targetGradeObj.minPct / 100) * 300;
          const rawNeeded = Math.ceil(targetTotal - currentContinuous);
          const possible = rawNeeded <= 210;
          const neededToShow = Math.max(0, rawNeeded);
          const boxClass = possible ? (neededToShow > hallTotal ? 'warning' : 'success') : 'danger';
          return (
            <div className={`planner-needed-box ${boxClass}`}>
              <div className="planner-needed-label">To achieve {m.targetGrade}:</div>
              <div className="planner-needed-value">
                {possible
                  ? `${neededToShow}/210 hall marks needed`
                  : 'Impossible with current continuous'
                }
              </div>
            </div>
          );
        })() : null}
      </div>
    </div>
  );
}

// ── Main Marks Page ───────────────────────────────────────────────────────
export default function Marks() {
  const profile = getProfile();
  const allCourses = getAllCourses(profile);
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermTimeline = currentTermKey ? getTermTimeline(profile?.termStartDate, profile?.dept, currentTermKey) : null;
  const currentTermIsOngoing = !!(
    (currentTermTimeline && new Date() <= currentTermTimeline.classEndDate) ||
    (currentTermKey && allCourses.some(c => `Y${c.year}T${c.term}` === currentTermKey && (c.status === 'active' || c.status === 'backlog')))
  );
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
      <div className="page-enter page-container marks-page">
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
    <div className="page-enter page-container marks-page">
      {/* Header Section */}
      <div className="planner-page-header">
        <div>
          <h1>📊 Term Planner</h1>
          <p>Plan and estimate your final grades by entering continuous marks</p>
        </div>
        <div className="planner-header-stats">
          <div className="planner-stat">
            <span className="planner-stat-label">Active Courses</span>
            <span className="planner-stat-value">{theory.length}</span>
          </div>
          <div className="planner-stat">
            <span className="planner-stat-label">Current Term</span>
            <span className="planner-stat-value">{currentTermKey || 'N/A'}</span>
          </div>
          <div className="planner-stat">
            <span className="planner-stat-label">Status</span>
            <span className="planner-stat-value">{currentTermIsOngoing ? '⏱ Ongoing' : '📋 Planning'}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {theory.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <p>No active theory courses to plan. Add courses from the Courses section.</p>
        </div>
      ) : (
        <>
          {/* Courses Grid */}
          <div className="planner-courses-grid">
            {theory.map(c => (
              <CourseCard
                key={c.id}
                course={c}
                marks={marks}
                onChange={onChange}
                isCurrentOngoingTerm={currentTermIsOngoing && currentTermKey === `Y${c.year}T${c.term}`}
              />
            ))}
          </div>

          {/* Tips Section */}
          <div className="planner-tips">
            <h3>💡 How It Works</h3>
            <ul>
              <li><strong>Enter your marks:</strong> Hall exam, CT, Bonus, Assignments, and Attendance for each teacher</li>
              <li><strong>Select target grade:</strong> Click on a grade to see how many hall marks you need</li>
              <li><strong>Attendance:</strong> Automatically pulled from your Attendance page (can override)</li>
              <li><strong>Final grades:</strong> Confirmed only after official results are published</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
