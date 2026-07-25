import { useState } from 'react';
import { ClipboardList, Target, BookOpen, Lightbulb } from 'lucide-react';
import { store, getGradeFromPct, getAttendanceMarks, computeEffectiveAttendance, GRADE_SCALE, getProfile, getCurrentTermKey, getTermTimeline, recordAudit } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import TeacherVerifiedCard from '../components/TeacherVerifiedCard';

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

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

// ── Get teacher names from schedule ────────────────────────────────────────
function getTeachersForCourse(courseId) {
  const schedule = Array.isArray(store.get('schedule')) ? store.get('schedule') : [];
  const settings = store.get('scheduleSettings') || {};
  const fromCourseMap = Array.isArray(settings.courseTeacherMap?.[courseId]) ? settings.courseTeacherMap[courseId] : [];
  const fromSchedule = schedule
    .filter(s => s.courseId === courseId)
    .flatMap(s => Array.isArray(s.teacherNames) && s.teacherNames.length > 0 ? s.teacherNames : [s.teacherName])
    .map(normalizeTeacherName)
    .filter(Boolean);

  return [...new Set([...fromCourseMap, ...fromSchedule].map(normalizeTeacherName).filter(Boolean))];
}

// ── Course card: Modern grid-based layout ──────────────────────────────────
function CourseCard({ course, marks, onChange, onClearCourse, onOpenMarkingHelp, isCurrentOngoingTerm }) {
  const m = marks[course.id] || {};
  const { pct: attPct, source: attSource } = computeEffectiveAttendance(course.id);
  const inputDisabled = false;
  
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

  const teachers = getTeachersForCourse(course.id);
  const teacher1Name = teachers[0] || 'Teacher 1';
  const teacher2Name = teachers[1] || 'Teacher 2';

  const hallTotal = clamp(m.hall, 0, 210);
  const ctTeacher1 = clamp(m.ctTeacher1, 0, 30);
  const ctTeacher2 = clamp(m.ctTeacher2, 0, 30);

  // Teacher 1 & 2 can use standard (CT + Attendance) or manual override (0-45)
  const useManual1 = !!m.useManualTeacher1;
  const useManual2 = !!m.useManualTeacher2;
  const manualMarks1 = clamp(m.manualTeacher1, 0, 45);
  const manualMarks2 = clamp(m.manualTeacher2, 0, 45);

  // Attendance modes: 'auto' (pull from Attendance page),
  // 'manual_percent' (single percentage input), 'manual_marks' (per-teacher marks inputs)
  const attMode = m.attMode || 'auto';
  const manualAttPct = m.attPctManual === undefined || m.attPctManual === null ? null : Number(m.attPctManual);

  const attendanceSourcePct = attMode === 'auto' ? attPct : (attMode === 'manual_percent' ? manualAttPct : null);
  const attendancePerTeacherFromPct = attendanceSourcePct !== null && attendanceSourcePct !== undefined ? (getAttendanceMarks(attendanceSourcePct) / 10) * 15 : 0;

  // Attendance capped at 15 per teacher
  const attendanceAuto1 = Math.min(attendancePerTeacherFromPct, 15);
  const attendanceAuto2 = Math.min(attendancePerTeacherFromPct, 15);

  const attTeacher1 = attMode === 'manual_marks' ? clamp(m.attTeacher1, 0, 15) : attendanceAuto1;
  const attTeacher2 = attMode === 'manual_marks' ? clamp(m.attTeacher2, 0, 15) : attendanceAuto2;

  // Each teacher: either (CT + Attendance) or manual override
  const teacher1Continuous = useManual1 ? manualMarks1 : Math.min(45, ctTeacher1 + attTeacher1);
  const teacher2Continuous = useManual2 ? manualMarks2 : Math.min(45, ctTeacher2 + attTeacher2);
  const currentContinuous = Math.min(90, teacher1Continuous + teacher2Continuous);
  const currentTotal = Math.min(300, hallTotal + currentContinuous);
  const currentGrade = getGradeFromPct(currentTotal);

  const targetGrade = m.targetGrade || null;
  const targetGradeObj = targetGrade ? GRADE_SCALE.find(g => g.grade === targetGrade) : null;
  const teacherSyncLabel = teachers.length > 0 ? `Synced from Schedule: ${teachers.join(' · ')}` : '';
  const requiredHallNode = targetGradeObj && targetGradeObj.minPct ? (() => {
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
  })() : null;

  return (
    <div className="planner-course-card">
      {/* Header */}
      <div className="planner-card-header">
        <div>
          <h3 className="planner-card-title">{course.code}</h3>
          <p className="planner-card-desc">{course.name}</p>
        </div>
        {Object.keys(m).length > 0 && (
          <button
            type="button"
            onClick={() => onClearCourse(course.id)}
            disabled={inputDisabled}
            title="Clear all entered marks for this course"
            style={{
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)',
              borderRadius: 8, padding: '5px 10px', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Clear entry
          </button>
        )}
      </div>

      {/* Planner is purely local; no remote mark entry/status shown here */}

      {/* Main Input Section */}
      <div className="planner-card-body">
        {/* Hall & Attendance Row */}
        <div className="planner-grid-2 planner-assessment-grid">
          <div className="planner-input-field planner-hall-field">
            <label>Hall Exam</label>
            <div className="planner-input-wrapper planner-input-wrapper-hall">
              <input type="number" min={0} max={210} value={m.hall ?? ''} onChange={e => onChange(course.id, 'hall', e.target.value === '' ? null : Math.min(210, Math.max(0, +e.target.value)))} disabled={inputDisabled} placeholder="0" />
              <span className="planner-input-unit">/210</span>
            </div>
          </div>

          <div className="planner-input-field planner-attendance-field">
            <label>Attendance {attPct !== null ? `(${attPct}%)` : ''}</label>
            <div className="planner-attendance-shell">
              <div className="planner-attendance-modes">
                <label>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'auto'} onChange={() => onChange(course.id, 'attMode', 'auto')} disabled={inputDisabled} />
                  Auto
                </label>
                <label>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'manual_percent'} onChange={() => onChange(course.id, 'attMode', 'manual_percent')} disabled={inputDisabled} />
                  Manual %
                </label>
                <label>
                  <input type="radio" name={`attMode-${course.id}`} checked={attMode === 'manual_marks'} onChange={() => onChange(course.id, 'attMode', 'manual_marks')} disabled={inputDisabled} />
                  Manual Marks
                </label>
              </div>

              {attMode === 'auto' && attSource === 'log' && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>
                  Auto from Attendance page
                </div>
              )}
              {attMode === 'auto' && attSource === 'combined' && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>
                  Auto from Combined attendance data
                </div>
              )}
              {attMode === 'auto' && attSource === 'manual' && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>
                  Auto from manual attendance entry
                </div>
              )}
              {attMode === 'manual_percent' && (
                <input className="planner-attendance-inline-input" type="number" min={0} max={100} value={m.attPctManual ?? ''} onChange={e => onChange(course.id, 'attPctManual', e.target.value === '' ? null : Math.min(100, Math.max(0, +e.target.value)))} placeholder="Attendance %" />
              )}

              {attMode === 'manual_marks' && (
                <div className="planner-attendance-marks">
                  <input type="number" min={0} max={15} value={m.attTeacher1 ?? ''} onChange={e => onChange(course.id, 'attTeacher1', e.target.value === '' ? null : Math.min(15, Math.max(0, +e.target.value)))} placeholder="T1" disabled={inputDisabled} />
                  <input type="number" min={0} max={15} value={m.attTeacher2 ?? ''} onChange={e => onChange(course.id, 'attTeacher2', e.target.value === '' ? null : Math.min(15, Math.max(0, +e.target.value)))} placeholder="T2" disabled={inputDisabled} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teachers Section */}
        <div className="planner-teachers-section">
          <div className="planner-teacher-card">
            <div className="planner-teacher-name">{teacher1Name}</div>
            {useManual1 ? (
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Marks (0-45)</label>
                <input type="number" min={0} max={45} value={m.manualTeacher1 ?? ''} onChange={e => onChange(course.id, 'manualTeacher1', e.target.value === '' ? null : Math.min(45, Math.max(0, +e.target.value)))} disabled={inputDisabled} placeholder="0" />
              </div>
            ) : (
              <div className="planner-teacher-inputs">
                <div className="planner-input-field">
                  <label style={{ fontSize: 11 }}>CT (0-30)</label>
                  <input type="number" min={0} max={30} value={m.ctTeacher1 ?? ''} onChange={e => onChange(course.id, 'ctTeacher1', e.target.value === '' ? null : Math.min(30, Math.max(0, +e.target.value)))} disabled={inputDisabled} placeholder="0" />
                </div>
                <div className="planner-input-field">
                  <label style={{ fontSize: 11 }}>Att (0-15)</label>
                  <input type="number" min={0} max={15} value={attMode === 'manual_marks' ? (m.attTeacher1 ?? '') : attendanceAuto1} onChange={e => onChange(course.id, 'attTeacher1', e.target.value === '' ? null : Math.min(15, Math.max(0, +e.target.value)))} placeholder="auto" style={{ opacity: attMode !== 'manual_marks' ? 0.6 : 1 }} disabled={attMode !== 'manual_marks'} />
                </div>
              </div>
            )}
            <label style={{ fontSize: 11, marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: useManual1 ? '1px solid var(--accent)' : '1px solid rgba(var(--accentRGB), 0.1)', background: useManual1 ? 'rgba(var(--accentRGB), 0.06)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input type="checkbox" checked={useManual1} onChange={e => onChange(course.id, 'useManualTeacher1', e.target.checked)} disabled={inputDisabled} style={{ cursor: 'pointer', margin: 0 }} />
              <span>Custom 0-45 marks</span>
            </label>
          </div>

          <div className="planner-teacher-card">
            <div className="planner-teacher-name">{teacher2Name}</div>
            {useManual2 ? (
              <div className="planner-input-field">
                <label style={{ fontSize: 11 }}>Marks (0-45)</label>
                <input type="number" min={0} max={45} value={m.manualTeacher2 ?? ''} onChange={e => onChange(course.id, 'manualTeacher2', e.target.value === '' ? null : Math.min(45, Math.max(0, +e.target.value)))} disabled={inputDisabled} placeholder="0" />
              </div>
            ) : (
              <div className="planner-teacher-inputs">
                <div className="planner-input-field">
                  <label style={{ fontSize: 11 }}>CT (0-30)</label>
                  <input type="number" min={0} max={30} value={m.ctTeacher2 ?? ''} onChange={e => onChange(course.id, 'ctTeacher2', e.target.value === '' ? null : Math.min(30, Math.max(0, +e.target.value)))} disabled={inputDisabled} placeholder="0" />
                </div>
                <div className="planner-input-field">
                  <label style={{ fontSize: 11 }}>Att (0-15)</label>
                  <input type="number" min={0} max={15} value={attMode === 'manual_marks' ? (m.attTeacher2 ?? '') : attendanceAuto2} onChange={e => onChange(course.id, 'attTeacher2', e.target.value === '' ? null : Math.min(15, Math.max(0, +e.target.value)))} placeholder="auto" style={{ opacity: attMode !== 'manual_marks' ? 0.6 : 1 }} disabled={attMode !== 'manual_marks'} />
                </div>
              </div>
            )}
            <label style={{ fontSize: 11, marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: useManual2 ? '1px solid var(--accent)' : '1px solid rgba(var(--accentRGB), 0.1)', background: useManual2 ? 'rgba(var(--accentRGB), 0.06)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <input type="checkbox" checked={useManual2} onChange={e => onChange(course.id, 'useManualTeacher2', e.target.checked)} disabled={inputDisabled} style={{ cursor: 'pointer', margin: 0 }} />
              <span>Custom 0-45 marks</span>
            </label>
          </div>
        </div>

        {teacherSyncLabel && <div className="planner-sync-note">{teacherSyncLabel}</div>}

        {/* Grade Selector */}
        <div className="planner-target-section">
          <div className="planner-target-head">
            <label className="planner-target-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Target size={14} color="var(--accent)" /> Target Grade</label>
            <button type="button" className="planner-help-link" onClick={onOpenMarkingHelp}>
              How marking works
            </button>
          </div>
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
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Estimate only. Full breakdown is in the help popup.</div>
        </div>

        {/* Required Hall Display */}
        {requiredHallNode}
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
  const [markingHelpOpen, setMarkingHelpOpen] = useState(false);
  const deptLabel = profile?.dept || 'your department';

  const onChange = (id, field, value) => {
    const updated = { ...marks, [id]: { ...(marks[id] || {}), [field]: value } };
    setMarks(updated);
    store.set('marks', updated);
    try {
      recordAudit({ action: 'marks_update', courseId: id, field, before: marks[id] || null, after: (updated[id] || {})[field] });
    } catch {}
  };

  // Wipes a course's entire marks record. Mainly a recovery tool for
  // records that picked up a stray 0 (e.g. a hall/CT/attendance field
  // written before number inputs correctly distinguished "cleared" from
  // "entered 0") — resetting is simpler and safer than trying to guess
  // which individual field was the accidental one.
  const onClearCourse = (id) => {
    if (!marks[id]) return;
    if (!window.confirm('Clear all entered marks for this course? This cannot be undone.')) return;
    const updated = { ...marks };
    delete updated[id];
    setMarks(updated);
    store.set('marks', updated);
    try {
      recordAudit({ action: 'marks_clear', courseId: id, before: marks[id] || null, after: null });
    } catch {}
  };

  const active = allCourses.filter(c => c.status === 'active' || c.status === 'backlog');
  const theory = active.filter(c => c.type === 'Theory');

  if (allCourses.length === 0) {
    return (
      <div className="page-enter page-container marks-page content-page-bg">
        <div className="content-page-hero" style={{ marginBottom: 16 }}>
          <div className="content-page-hero-icon">
            <ClipboardList size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Term Planner</h1>
            <p className="content-page-hero-subtitle">Estimate and plan your final grades</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="icon"><BookOpen size={28} color="var(--muted)" /></div>
          <p>No curriculum data is loaded for {deptLabel} yet. Open Courses to confirm the department setup or switch to a department with course data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter page-container marks-page content-page-bg">
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <div className="planner-page-copy">
          <div className="planner-page-kicker">Academic planning</div>
          <div className="content-page-hero" style={{ marginBottom: 0 }}>
            <div className="content-page-hero-icon">
              <ClipboardList size={18} color="var(--accent)" />
            </div>
            <div>
              <h1 className="content-page-hero-title">Term Planner</h1>
              <p className="content-page-hero-subtitle">Track hall-needed targets in a compact, local-only workspace.</p>
            </div>
          </div>
          <button type="button" className="planner-hero-link" onClick={() => setMarkingHelpOpen(true)}>
            View marking system
          </button>
        </div>
        <div className="planner-header-pills" aria-label="Planner summary">
          <span className="planner-pill">{theory.length} courses</span>
          <span className="planner-pill">{currentTermKey || 'N/A'}</span>
          <span className={`planner-pill ${currentTermIsOngoing ? 'is-active' : ''}`}>{currentTermIsOngoing ? 'Ongoing' : 'Planning'}</span>
        </div>
      </div>

      {/* §9.5 of the merged Faculty Module prompt — read-only card, only
          renders anything if a real teacher has sent verified marks for
          this student. Fully additive: does not read or modify any of
          this page's own `marks` state above. */}
      <TeacherVerifiedCard profile={profile} />

      {/* Content */}
      {theory.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><BookOpen size={28} color="var(--muted)" /></div>
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
                onClearCourse={onClearCourse}
                onOpenMarkingHelp={() => setMarkingHelpOpen(true)}
                isCurrentOngoingTerm={currentTermIsOngoing && currentTermKey === `Y${c.year}T${c.term}`}
              />
            ))}
          </div>

          {/* Tips Section */}
          <div className="planner-tips">
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Lightbulb size={16} color="var(--accent)" /> How It Works</h3>
            <ul>
              <li>Enter hall marks (0–210) and your continuous assessment marks per teacher (CT + Attendance).</li>
              <li>Pick a target grade to instantly see how much hall you need to achieve it.</li>
              <li>Attendance syncs from the Attendance page, or enter it manually as % or marks.</li>
            </ul>
          </div>
        </>
      )}

      {markingHelpOpen && (
        <div className="planner-help-backdrop" onClick={() => setMarkingHelpOpen(false)}>
          <div className="planner-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="planner-help-header">
              <div>
                <div className="planner-help-kicker">Marking system</div>
                <h3>How this calculator works</h3>
              </div>
              <button type="button" className="planner-help-close" onClick={() => setMarkingHelpOpen(false)}>×</button>
            </div>

            <div className="planner-help-layout" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
              {/* Top Row: 3-column cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div className="planner-help-card">
                  <strong>Each teacher</strong>
                  <div className="planner-help-mini-list">
                    <div>CT: 0-30</div>
                    <div>Attendance: 0-15</div>
                    <div>Total per teacher: 45</div>
                  </div>
                </div>

                <div className="planner-help-card">
                  <strong>Custom marks</strong>
                  <p>If needed, check 'Custom 0-45 marks' and enter the full marks directly.</p>
                </div>

                <div className="planner-help-card">
                  <strong>Hall exam (0-210)</strong>
                  <p>Use the target grade buttons to see how much hall you need. Total = Hall (0-210) + Continuous (0-90).</p>
                </div>
              </div>

              {/* Bottom: Full-width attendance table */}
              <div className="planner-help-card planner-help-card-auto">
                <strong>Auto attendance</strong>
                <div className="planner-help-scale" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, marginTop: 10 }}>
                  <div style={{ textAlign: 'center', fontWeight: 600, borderBottom: '1px solid rgba(var(--accentRGB), 0.2)', paddingBottom: 6 }}>Attendance %</div>
                  <div style={{ textAlign: 'center', fontWeight: 600, borderBottom: '1px solid rgba(var(--accentRGB), 0.2)', paddingBottom: 6 }}>Per Teacher (0-15)</div>
                  <div style={{ textAlign: 'center', fontWeight: 600, borderBottom: '1px solid rgba(var(--accentRGB), 0.2)', paddingBottom: 6 }}>Full Course (0-30)</div>
                  
                  <div style={{ textAlign: 'center' }}>90%+</div><div style={{ textAlign: 'center' }}>15</div><div style={{ textAlign: 'center' }}>30</div>
                  <div style={{ textAlign: 'center' }}>85-89</div><div style={{ textAlign: 'center' }}>13.5</div><div style={{ textAlign: 'center' }}>27</div>
                  <div style={{ textAlign: 'center' }}>80-84</div><div style={{ textAlign: 'center' }}>12</div><div style={{ textAlign: 'center' }}>24</div>
                  <div style={{ textAlign: 'center' }}>75-79</div><div style={{ textAlign: 'center' }}>10.5</div><div style={{ textAlign: 'center' }}>21</div>
                  <div style={{ textAlign: 'center' }}>70-74</div><div style={{ textAlign: 'center' }}>9</div><div style={{ textAlign: 'center' }}>18</div>
                  <div style={{ textAlign: 'center' }}>65-69</div><div style={{ textAlign: 'center' }}>7.5</div><div style={{ textAlign: 'center' }}>15</div>
                  <div style={{ textAlign: 'center' }}>60-64</div><div style={{ textAlign: 'center' }}>6</div><div style={{ textAlign: 'center' }}>12</div>
                  <div style={{ textAlign: 'center' }}>Below 60</div><div style={{ textAlign: 'center' }}>0</div><div style={{ textAlign: 'center' }}>0</div>
                </div>
              </div>
            </div>

            <div className="planner-help-footer">
              <button type="button" className="btn btn-primary" onClick={() => setMarkingHelpOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}