import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Book, CheckCircle2, AlertTriangle } from 'lucide-react';

// Honorifics already present at end of name → don't append "Sir".
const HONORIFIC_SUFFIX_RE = /\b(sir|ma'?am|madam|miss|mrs?\.?|dr\.?|prof\.?)\.?$/i;

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return HONORIFIC_SUFFIX_RE.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

export default function CourseTeacherDialog({
  isOpen,
  onClose,
  course,
  selectedCourseId: selectedCourseIdProp = '',
  courseOptions = [],
  currentTeachers = [],
  onCourseChange,
  onSave,
  allTeachers = [],
  requireTwoTeachers = false,
  source = '', // 'form' or 'quick' (within Add Class form)
  onNavigateToTeachers,
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id || selectedCourseIdProp || '');
  const [teacher1, setTeacher1] = useState(currentTeachers[0] || '');
  const [teacher2, setTeacher2] = useState(currentTeachers[1] || '');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const activeCourse = course || courseOptions.find((c) => c.id === selectedCourseId);
  const isFormSource = source === 'form' || source === 'quick';

  useEffect(() => {
    setSelectedCourseId(course?.id || selectedCourseIdProp || '');
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
    setSuccessMessage('');
  }, [isOpen, currentTeachers, course?.id, selectedCourseIdProp]);

  const [savingTeachers, setSavingTeachers] = useState(false);

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');

    if (!activeCourse) {
      setError('Please select a course to assign teachers.');
      return;
    }

    if (!teacher1.trim()) {
      setError('At least one teacher is required');
      return;
    }

    const normalized1 = normalizeTeacherName(teacher1);
    const normalized2 = teacher2.trim() ? normalizeTeacherName(teacher2) : '';

    if (requireTwoTeachers && !normalized2) {
      setError('Two teachers are required for this course');
      return;
    }

    if (normalized1 === normalized2 && normalized2) {
      setError('Teachers must be different');
      return;
    }

    const teachers = normalized2 ? [normalized1, normalized2] : [normalized1];

    // BUGFIX (teacher assignment "disappears" on refresh): onSave used to
    // be called fire-and-forget, with the success message and auto-close
    // firing immediately after — regardless of whether the underlying
    // Firestore write (updatePlannerSettings, called via
    // ClassSetupModal's handleSaveTeachers) actually succeeded. A failed
    // write looked identical to a successful one: green checkmark, dialog
    // closes, everything looks fine — until a refresh shows the course
    // still has no teacher, because nothing was ever actually saved. Now
    // onSave's result (a Promise, since handleSaveTeachers/
    // updatePlannerSettings are both async) is awaited, and a rejection
    // shows a real error instead of a fake success.
    setSavingTeachers(true);
    try {
      await onSave(teachers);
      setSuccessMessage(`Teachers assigned for ${activeCourse.code}`);
      setTimeout(() => {
        setTeacher1('');
        setTeacher2('');
        setError('');
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (e) {
      setError(e?.message || 'Could not save teachers — please check your connection and try again.');
    } finally {
      setSavingTeachers(false);
    }
  };

  const handleClose = () => {
    setSelectedCourseId(course?.id || selectedCourseIdProp || '');
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
    setSuccessMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100001,
        padding: '16px',
        pointerEvents: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          padding: '20px',
          background: 'var(--bg)',
          borderRadius: '14px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
              {isFormSource ? 'Assign Teachers' : 'Edit Course Teachers'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCourse 
                ? `${activeCourse.code} · ${activeCourse.name}` 
                : isFormSource 
                  ? 'Select a course to set its teachers' 
                  : 'Update course teachers'}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.6,
              flexShrink: 0,
              width: '28px',
              height: '28px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: 'var(--success)',
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} /> {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--danger)',
              fontSize: 12,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} /> {error}
          </div>
        )}

        {!activeCourse && courseOptions.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
              Course (Required) *
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                const nextCourseId = e.target.value;
                setSelectedCourseId(nextCourseId);
                onCourseChange?.(nextCourseId);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select course</option>
              {courseOptions.map((item) => (
                <option key={item.id} value={item.id}>{`${item.code} — ${item.name}`}</option>
              ))}
            </select>
          </div>
        )}

        {/* Teacher 1 */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
            Teacher 1 (Required) *
          </label>
          <input
            type="text"
            value={teacher1}
            onChange={(e) => setTeacher1(e.target.value)}
            placeholder="e.g., Dr. Ahmed Khan"
            autoFocus
            disabled={!activeCourse}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: !activeCourse ? 'var(--bg-secondary)' : 'var(--surface)',
              color: !activeCourse ? 'var(--muted)' : 'var(--text)',
              fontSize: '13px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            Name will be normalized (e.g., "Ahmed" → "Ahmed Sir")
          </div>
        </div>

        {/* Teacher 2 */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>
            Teacher 2 {requireTwoTeachers ? '(Required) *' : '(Optional)'}
          </label>
          <input
            type="text"
            value={teacher2}
            onChange={(e) => setTeacher2(e.target.value)}
            placeholder={requireTwoTeachers ? 'e.g., Dr. Fatima Begum' : 'e.g., Dr. Fatima Begum (leave blank for single teacher)'}
            disabled={!activeCourse}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: !activeCourse ? 'var(--bg-secondary)' : 'var(--surface)',
              color: !activeCourse ? 'var(--muted)' : 'var(--text)',
              fontSize: '13px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {requireTwoTeachers ? 'Please provide both teachers for this course.' : 'For co-teaching. Leave empty for single teacher.'}
          </div>
        </div>

        {/* Info box - context specific */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            fontSize: '11px',
            color: 'var(--muted)',
            marginBottom: '16px',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--accent)' }}>ℹ️</strong> 
          {isFormSource 
            ? ' Teachers must be pre-assigned in the Courses page. If not assigned yet, go to Courses → Find course → Click "Add Teachers".' 
            : ' Update the teachers assigned to this course. This will be used when selecting teachers for class entries.'}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onNavigateToTeachers && !isFormSource && (
            <button
              onClick={() => {
                handleClose();
                onNavigateToTeachers();
              }}
              className="btn btn-ghost"
              style={{ padding: '10px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Book size={13} /> Manage Teachers
            </button>
          )}
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ padding: '10px 14px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '10px 14px', fontSize: '12px' }}
            disabled={!activeCourse}
          >
            {currentTeachers.length >= 2 ? 'Update Teachers' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
