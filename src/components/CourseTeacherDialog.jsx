import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

export default function CourseTeacherDialog({
  isOpen,
  onClose,
  course,
  currentTeachers = [],
  onSave,
  allTeachers = [],
  requireTwoTeachers = false,
}) {
  const [teacher1, setTeacher1] = useState(currentTeachers[0] || '');
  const [teacher2, setTeacher2] = useState(currentTeachers[1] || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
  }, [isOpen, currentTeachers, course?.id]);

  const handleSave = () => {
    setError('');
    
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
    setTeacher1(currentTeachers[0] || '');
    setTeacher2(currentTeachers[1] || '');
    setError('');
    onClose();
  };

  if (!isOpen || !course) return null;

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
        padding: 12,
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{
          width: 500,
          maxWidth: '100%',
          padding: 24,
          background: 'var(--bg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Assign Teachers</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
              {course.code} · {course.name}
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

        {/* Teacher 1 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
            Teacher 1 (Required) *
          </label>
          <input
            type="text"
            value={teacher1}
            onChange={(e) => setTeacher1(e.target.value)}
            placeholder="e.g., Dr. Ahmed Khan"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Name will be normalized (e.g., "Ahmed" → "Ahmed Sir")
          </div>
        </div>

        {/* Teacher 2 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
            Teacher 2 {requireTwoTeachers ? '(Required) *' : '(Optional)'}
          </label>
          <input
            type="text"
            value={teacher2}
            onChange={(e) => setTeacher2(e.target.value)}
            placeholder={requireTwoTeachers ? 'e.g., Dr. Fatima Begum' : 'e.g., Dr. Fatima Begum (leave blank for single teacher)'}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
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
            fontSize: 12,
            color: 'var(--muted)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--accent)' }}>ℹ️ Info:</strong> After assigning, you can select either teacher when adding class entries. Edit button lets you change later.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ padding: '10px 16px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '10px 16px' }}
          >
            {currentTeachers.length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
          </button>
        </div>
      </div>
    </div>
  );
}
