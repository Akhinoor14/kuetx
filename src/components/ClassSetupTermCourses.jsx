import { useMemo, useState, useEffect } from 'react';
import { GraduationCap, ChevronDown, Pencil } from 'lucide-react';
import { TERM_KEYS, getTermLabelFromKey } from '../store/store';
import { getCoursesForTerm } from '../store/curriculumStore';
import CourseTeacherDialog from './CourseTeacherDialog';

/**
 * "Current Term" select + inline per-course teacher assignment, used by
 * BOTH the mandatory ClassSetupModal (first CR visit) and the dedicated
 * /class-setup page — one component, one behavior, nothing to keep in
 * sync between the two surfaces.
 *
 * Why this exists (see conversation): before this, a CR had to (1) set
 * Current Term somewhere, then (2) separately visit Class Planner to
 * assign teachers per course. Picking the term now immediately reveals
 * that term's course list right here, with a teacher-assign action next
 * to each course — no page hop required the first time through. Editing
 * later still works the same way, from either this page or Class
 * Planner (both read/write the same groups/{groupId}/meta/plannerSettings
 * .courseTeacherMap doc).
 *
 * Deliberately does NOT duplicate exam-date logic, routine, or the
 * class-planner "manual +1 logging" workflow — teacher assignment only.
 */
export default function ClassSetupTermCourses({
  dept,
  currentTermKey,
  onTermChange,
  courseTeacherMap,
  onSaveTeachers,
  savingTermKey,
}) {
  const [dialogState, setDialogState] = useState({ open: false, courseId: '' });

  const courses = useMemo(
    () => (dept && currentTermKey ? getCoursesForTerm(dept, currentTermKey) : []),
    [dept, currentTermKey],
  );
  const theoryCourses = useMemo(() => courses.filter((c) => String(c.type || 'Theory').toLowerCase() === 'theory'), [courses]);
  const otherCourses = useMemo(() => courses.filter((c) => String(c.type || 'Theory').toLowerCase() !== 'theory'), [courses]);

  const activeCourse = courses.find((c) => c.id === dialogState.courseId) || null;
  const currentTeachersForDialog = activeCourse ? (courseTeacherMap?.[activeCourse.id] || []) : [];

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
    appearance: 'none', WebkitAppearance: 'none', fontWeight: 700, cursor: 'pointer',
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };

  const CourseRow = ({ course }) => {
    const teachers = courseTeacherMap?.[course.id] || [];
    const hasTeachers = teachers.length > 0;
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--surface)', minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course.code}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hasTeachers ? teachers.join(', ') : 'No teacher assigned'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialogState({ open: true, courseId: course.id })}
          className={hasTeachers ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
          style={{ padding: '7px 10px', fontSize: 11.5, fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
        >
          <Pencil size={11} /> {hasTeachers ? 'Edit' : 'Assign'}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Current term</label>
        <div style={{ position: 'relative' }}>
          <select
            value={currentTermKey || ''}
            onChange={(e) => onTermChange(e.target.value)}
            style={inputStyle}
          >
            <option value="" disabled>Select current term</option>
            {TERM_KEYS.map((key) => (
              <option key={key} value={key}>{getTermLabelFromKey(key) || key}</option>
            ))}
          </select>
          <ChevronDown size={15} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
          {savingTermKey ? 'Updating for your whole class…' : 'Sets the term for everyone in your class — no one edits this individually.'}
        </div>
      </div>

      {currentTermKey && (
        <div style={{ display: 'grid', gap: 10 }}>
          {courses.length === 0 ? (
            <div style={{ padding: 14, border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 12.5, textAlign: 'center' }}>
              No courses found for this term.
            </div>
          ) : (
            <>
              {theoryCourses.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <GraduationCap size={12} /> Theory
                  </div>
                  {theoryCourses.map((course) => <CourseRow key={course.id} course={course} />)}
                </div>
              )}
              {otherCourses.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: theoryCourses.length > 0 ? 4 : 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sessional
                  </div>
                  {otherCourses.map((course) => <CourseRow key={course.id} course={course} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CourseTeacherDialog
        isOpen={dialogState.open}
        onClose={() => setDialogState({ open: false, courseId: '' })}
        course={activeCourse}
        currentTeachers={currentTeachersForDialog}
        onSave={(teachers) => {
          onSaveTeachers(dialogState.courseId, teachers);
          setDialogState({ open: false, courseId: '' });
        }}
      />
    </div>
  );
}
