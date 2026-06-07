import { useEffect, useState } from 'react';
import { X, Book } from 'lucide-react';

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
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
  onNavigateToTeachers,
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(course?.id || selectedCourseIdProp || '');
  const [teacher1, setTeacher1] = useState(currentTeachers[0] || '');
  const [teacher2, setTeacher2] = useState(currentTeachers[1] || '');
  const [error, setError] = useState('');

  const activeCourse = course || courseOptions.find((c) => c.id === selectedCourseId);

  useEffect(() => {
    setSelectedCourseId(course?.id || selectedCourseIdProp || '');
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
  }, [isOpen, currentTeachers, course?.id, selectedCourseIdProp]);

  const handleSave = () => {
    setError('');

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
    onSave(teachers);
    
    // Reset form
    setTeacher1('');
    setTeacher2('');
    setError('');
  };

  const handleClose = () => {
    setSelectedCourseId(course?.id || selectedCourseIdProp || '');
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
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
        zIndex: 2000,
        padding: '12px',
        overflowY: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '20px',
          background: 'var(--bg)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>Assign Teachers</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeCourse ? `${activeCourse.code} · ${activeCourse.name}` : 'Select a course to set teachers'}
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
            ⚠ {error}
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

        {/* Info box */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.2)',
            fontSize: '12px',
            color: 'var(--muted)',
            marginBottom: '16px',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--accent)' }}>ℹ️</strong> After assigning, select either teacher when adding class entries. Use Edit to change later.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onNavigateToTeachers && (
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
            {currentTeachers.length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
          </button>
        </div>
      </div>
    </div>
  );
}
