import { useState, useRef, useEffect } from 'react';
import { X, Edit2, Plus } from 'lucide-react';

// Normalize teacher name: "Ahmed" → "Ahmed Sir"
// Honorifics already present at end of name → don't append "Sir".
// BUGFIX (removed honorific guessing per CR feedback): this used to force
// " Sir" onto any name that didn't already end in a recognized honorific.
// The CR/whoever assigns the teacher already knows exactly what that
// teacher goes by, so the app shouldn't guess or rewrite it — this now
// only trims and collapses whitespace, matching Schedule.jsx's version, so
// this selector never disagrees with what's actually saved to the routine.
const normalizeTeacherName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

export default function TeacherSelector({
  selectedTeachers = [],
  onTeachersChange,
  availableTeachers = [],
  maxTeachers = 2,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setEditingIndex(null);
        setEditValue('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTeacher = (teacher) => {
    if (selectedTeachers.length < maxTeachers) {
      const normalized = normalizeTeacherName(teacher);
      const updated = [...selectedTeachers, normalized];
      onTeachersChange(updated);
      setFilterValue('');
      setIsOpen(false);
    }
  };

  const handleRemoveTeacher = (index) => {
    const updated = selectedTeachers.filter((_, i) => i !== index);
    onTeachersChange(updated);
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditValue(selectedTeachers[index]);
  };

  const handleSaveEdit = () => {
    if (editValue.trim()) {
      const normalized = normalizeTeacherName(editValue);
      const updated = [...selectedTeachers];
      updated[editingIndex] = normalized;
      onTeachersChange(updated);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDeleteDuringEdit = () => {
    handleRemoveTeacher(editingIndex);
    setEditingIndex(null);
    setEditValue('');
  };

  // Filter teachers: exclude already selected, include typed value
  const filteredTeachers = availableTeachers
    .filter(t => !selectedTeachers.includes(t))
    .filter(t => t.toLowerCase().includes(filterValue.toLowerCase()));

  // Show typed value as option if it's not empty and not already listed
  const showCustomOption =
    filterValue.trim() &&
    !availableTeachers.includes(filterValue) &&
    !selectedTeachers.includes(filterValue);

  const slotsLeft = maxTeachers - selectedTeachers.length;
  const canAddMore = slotsLeft > 0 && !disabled;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Selected Teachers Display */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8,
          marginBottom: 8,
        }}
      >
        {selectedTeachers.map((teacher, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 6,
              border: editingIndex === index ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: editingIndex === index ? 'rgba(59,130,246,0.08)' : 'var(--card)',
              fontSize: 13,
              minHeight: 38,
              position: 'relative',
            }}
          >
            {editingIndex === index ? (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                  }}
                  placeholder="Edit name..."
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={handleSaveEdit}
                    style={{
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleDeleteDuringEdit}
                    title="Delete"
                    style={{
                      background: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {teacher}
                </span>
                <button
                  onClick={() => handleStartEdit(index)}
                  title="Edit"
                  style={{
                    background: 'var(--accentBg)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Edit2 size={12} color="var(--accent)" />
                </button>
                <button
                  onClick={() => handleRemoveTeacher(index)}
                  title="Remove"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.6,
                  }}
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Add More Slot */}
        {canAddMore && editingIndex === null && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 6,
              border: isOpen ? '2px solid var(--accent)' : '1px dashed var(--border)',
              background: isOpen ? 'rgba(59,130,246,0.08)' : 'var(--card)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: isOpen ? 'var(--accent)' : 'var(--muted)',
              minHeight: 38,
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={14} />
            Add Teacher
          </button>
        )}
      </div>

      {/* Slots left indicator */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>
        {slotsLeft === maxTeachers
          ? `No teachers assigned yet — ${maxTeachers} slots available`
          : slotsLeft === 0
            ? `All ${maxTeachers} teacher slots filled`
            : `${slotsLeft} slot${slotsLeft > 1 ? 's' : ''} left`}
      </div>

      {/* Dropdown */}
      {isOpen && canAddMore && editingIndex === null && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: 250,
            overflowY: 'auto',
          }}
        >
          {/* Search box */}
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)' }}>
            <input
              type="text"
              placeholder="Search or type teacher name..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>

          {/* Options */}
          <div>
            {filteredTeachers.length === 0 && !showCustomOption ? (
              <div style={{ padding: '12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
                {filterValue ? 'No matching teachers' : 'No teachers available'}
              </div>
            ) : (
              <>
                {/* Existing teachers */}
                {filteredTeachers.map((teacher) => (
                  <button
                    key={teacher}
                    onClick={() => handleAddTeacher(teacher)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'background 0.15s ease',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => (e.target.style.background = 'var(--accentBg)')}
                    onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                  >
                    {teacher}
                  </button>
                ))}

                {/* Custom input option */}
                {showCustomOption && (
                  <button
                    onClick={() => handleAddTeacher(filterValue)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: 'rgba(59,130,246,0.08)',
                      color: 'var(--accent)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.target.style.background = 'rgba(59,130,246,0.15)')}
                    onMouseLeave={(e) => (e.target.style.background = 'rgba(59,130,246,0.08)')}
                  >
                    + Add "{filterValue}"
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
