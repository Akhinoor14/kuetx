import React, { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS, DEFAULT_PROFILE, TERM_KEYS, getTermLabelFromKey } from '../store/store';

// Map dept codes: roll middle 2 digits -> dept code
const ROLL_DEPT_MAP = {
  '25': 'Arch',
  '23': 'BECM',
  '15': 'BME',
  '01': 'CE',
  '29': 'ChE',
  '07': 'CSE',
  '09': 'ECE',
  '03': 'EEE',
  '13': 'ESE',
  '11': 'IPE',
  '19': 'LE',
  '05': 'ME',
  '27': 'MSE',
  '31': 'MTE',
  '21': 'TE',
  '17': 'URP',
};

const HALL_OPTIONS = [
  'Fazlul Haque Hall',
  'Lalan Shah Hall',
  'Khan Jahan Ali Hall',
  'Dr. M.A Rashid Hall',
  'Rokeya Hall',
  'Amar Ekushey Hall',
  'Shaheed Smriti Hall',
];

const extractBatchFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (r.length < 2) return '';
  const firstTwoDigits = r.slice(0, 2);
  const year = parseInt(firstTwoDigits, 10);
  if (!Number.isFinite(year)) return '';
  return `2k${firstTwoDigits}`;
};

const extractDeptCodeFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (r.length < 5) return '';
  const deptDigits = r.slice(2, 4);
  return ROLL_DEPT_MAP[deptDigits] || '';
};

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surfaceGlassStrong)',
  fontSize: 14,
  color: 'var(--text)',
  fontFamily: 'inherit',
  height: 44,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sectionStyle = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surfaceGlass)',
};

const stepTabs = [
  { key: 'identity', title: 'Identity' },
  { key: 'academic', title: 'Academics' },
  { key: 'residence', title: 'Residence' },
  { key: 'review', title: 'Review' },
];

const requiredFieldMap = {
  0: ['name', 'studentId', 'dept', 'session'],
  1: ['currentTermKey'],
};

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && value.includes('-')) return value;
  const year = Number(value);
  return Number.isFinite(year) ? `${year}-01-01` : '';
};

const getFieldError = (key, form, autoCalculatedDept) => {
  const value = key === 'dept' ? (form.dept || autoCalculatedDept) : form[key];
  if (key === 'name' && !String(value || '').trim()) return 'Name is required';
  if (key === 'studentId') {
    const v = String(value || '').trim();
    if (!v) return 'Student ID is required';
    if (!/^\\d{7}$/.test(v)) return 'Student ID must be a 7-digit number';
  }
  if (key === 'dept' && !String(value || '').trim()) return 'Department is required';
  if (key === 'session' && !String(value || '').trim()) return 'Academic session is required';
  if (key === 'currentTermKey' && !String(value || '').trim()) return 'Current term is required';
  return '';
};

/**
 * Validate termStartDate format - must be ISO format (YYYY-MM-DD)
 */
const validateTermStartDate = (value) => {
  if (!value) return null; // Optional field
  
  // Check if it's ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + 'T00:00:00Z');
    if (!isNaN(parsed.getTime())) {
      return value; // Valid ISO date
    }
  }
  
  // Try to parse as Date object
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]; // Convert to ISO
    }
  } catch (e) {}
  
  return null; // Invalid date
};

export default function ProfileSetupModal({ isOpen, onClose, onSave, initialProfile = {} }) {
  const initial = useMemo(() => ({ ...DEFAULT_PROFILE, ...initialProfile }), [initialProfile]);
  const [form, setForm] = useState(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...initial,
      yearStarted: toDateInputValue(initial.yearStarted),
      termStartDate: initial.termStartDate || '',
    });
    setStepIndex(0);
    setErrors({});
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleChange = (key) => (e) => {
    let val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (key === 'studentId') {
      // Allow only digits and enforce max length 7
      val = String(val || '').replace(/\D/g, '').slice(0, 7);
    }
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const autoCalculatedBatch = extractBatchFromRoll(form.studentId);
  const autoCalculatedDept = extractDeptCodeFromRoll(form.studentId);
  const selectedDept = form.dept || autoCalculatedDept;

  const validateStep = (index) => {
    const stepFields = requiredFieldMap[index] || [];
    const nextErrors = {};

    stepFields.forEach((field) => {
      const error = getFieldError(field, form, autoCalculatedDept);
      if (error) nextErrors[field] = error;
    });

    if (index === 0 && !String(form.dept || autoCalculatedDept || '').trim()) {
      nextErrors.dept = 'Department is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(stepIndex)) return;
    setStepIndex(prev => Math.min(prev + 1, stepTabs.length - 1));
  };

  const goBack = () => {
    setStepIndex(prev => Math.max(prev - 1, 0));
    setErrors({});
  };

  const skipStep = () => {
    setStepIndex(prev => Math.min(prev + 1, stepTabs.length - 1));
    setErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateStep(0) || !validateStep(1)) {
      setStepIndex(0);
      return;
    }

    // Validate termStartDate format
    const validatedTermStartDate = validateTermStartDate(form.termStartDate);
    if (form.termStartDate && !validatedTermStartDate) {
      setErrors(prev => ({
        ...prev,
        termStartDate: 'Invalid date format. Please use YYYY-MM-DD format.'
      }));
      setStepIndex(1);
      return;
    }

    const next = {
      ...DEFAULT_PROFILE,
      ...form,
      studentId: String(form.studentId || '').trim(),
      name: String(form.name || '').trim(),
      dept: String(form.dept || autoCalculatedDept || '').trim(),
      session: String(form.session || '').trim(),
      batch: autoCalculatedBatch,
      currentTermKey: String(form.currentTermKey || '').trim(),
      currentTerm: form.currentTermKey ? getTermLabelFromKey(form.currentTermKey) : String(form.currentTerm || '').trim(),
      hallName: String(form.hallName || '').trim(),
      roomNo: String(form.roomNo || '').trim(),
      advisorName: String(form.advisorName || '').trim(),
      advisorContact: String(form.advisorContact || '').trim(),
      // Ensure termStartDate is in ISO format (YYYY-MM-DD)
      termStartDate: validatedTermStartDate || null,
      yearStarted: form.yearStarted ? new Date(form.yearStarted).getFullYear() : DEFAULT_PROFILE.yearStarted,
      totalCreditsRequired: Number(form.totalCreditsRequired) || DEFAULT_PROFILE.totalCreditsRequired,
    };
    if (onSave) onSave(next);
  };

  const progressPct = Math.round(((stepIndex + 1) / stepTabs.length) * 100);
  const showOptionalSkip = stepIndex === 2;
  const canSubmit = stepIndex === stepTabs.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 9999, padding: 'clamp(8px, 4vw, 14px)' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', padding: 'clamp(12px, 3vw, 18px)', borderRadius: 18, width: 'clamp(100%, 100%, 920px)', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20 }}>Profile Setup</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>Set it up once. Required fields are kept minimal, and optional pages can be skipped.</p>
          </div>
          <div style={{ minWidth: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
              <span>{stepIndex + 1}/{stepTabs.length}</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', transition: 'width 0.25s ease' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {stepTabs.map((step, idx) => (
            <div
              key={step.key}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: idx === stepIndex ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: idx === stepIndex ? 'rgba(34,197,94,0.12)' : 'var(--surfaceGlassSoft)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {step.title}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {stepIndex === 0 && (
            <div style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Identity</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input placeholder="Your full name" value={form.name} onChange={handleChange('name')} style={fieldStyle} />
                  {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Student ID</label>
                  <input placeholder="e.g. 2313014" value={form.studentId} onChange={handleChange('studentId')} style={fieldStyle} />
                  {errors.studentId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.studentId}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <select value={selectedDept} onChange={(e) => setForm(prev => ({ ...prev, dept: e.target.value }))} style={fieldStyle}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(dept => (
                      <option key={dept.code} value={dept.code}>{dept.code} - {dept.name}</option>
                    ))}
                  </select>
                  {autoCalculatedDept && !form.dept && (
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 700 }}>
                      Auto-detected from ID: {autoCalculatedDept}
                    </div>
                  )}
                  {!autoCalculatedDept && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Department could not be auto-detected from your roll number. Please choose it manually.
                    </div>
                  )}
                  {errors.dept && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.dept}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Academic Session</label>
                  <input placeholder="e.g. 2023-24" value={form.session} onChange={handleChange('session')} style={fieldStyle} />
                  {errors.session && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.session}</div>}
                </div>
              </div>
              {autoCalculatedBatch && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 10, fontWeight: 700 }}>✓ Batch auto-filled: {autoCalculatedBatch}</div>}
            </div>
          )}

          {stepIndex === 1 && (
            <div style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Academic essentials</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Current Term</label>
                  <select value={form.currentTermKey || ''} onChange={handleChange('currentTermKey')} style={fieldStyle}>
                    <option value="">Select current term</option>
                    {TERM_KEYS.map(termKey => (
                      <option key={termKey} value={termKey}>{termKey} - {getTermLabelFromKey(termKey)}</option>
                    ))}
                  </select>
                  {errors.currentTermKey && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.currentTermKey}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Term Start Date</label>
                  <input type="date" value={form.termStartDate || ''} onChange={handleChange('termStartDate')} style={fieldStyle} />
                  {errors.termStartDate && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.termStartDate}</div>}
                  {!errors.termStartDate && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Used for timeline and alert calculations</div>}
                </div>
                <div>
                  <label style={labelStyle}>When Did You Start?</label>
                  <input type="date" value={form.yearStarted || ''} onChange={handleChange('yearStarted')} style={fieldStyle} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Default year is used if you skip this</div>
                </div>
                <div>
                  <label style={labelStyle}>Total Credits Required</label>
                  <input type="number" placeholder="e.g. 160" value={form.totalCreditsRequired} onChange={handleChange('totalCreditsRequired')} min={1} max={300} style={fieldStyle} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Default graduation target if you leave it blank</div>
                </div>
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <div style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Residence & advisor</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Residential Hall</label>
                  <select value={form.hallName || ''} onChange={handleChange('hallName')} style={fieldStyle}>
                    <option value="">Select your hall</option>
                    {HALL_OPTIONS.map(hall => (
                      <option key={hall} value={hall}>{hall}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Optional, but useful for hostel tools</div>
                </div>
                <div>
                  <label style={labelStyle}>Room Number</label>
                  <input placeholder="e.g. 301" value={form.roomNo} onChange={handleChange('roomNo')} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Advisor Name</label>
                  <input placeholder="Your academic advisor" value={form.advisorName} onChange={handleChange('advisorName')} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Advisor Phone Number</label>
                  <input type="tel" placeholder="e.g. 01700000000" value={form.advisorContact} onChange={handleChange('advisorContact')} inputMode="numeric" pattern="[0-9]*" style={fieldStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
                  <div style={{ width: '100%' }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--text)', margin: 0, textTransform: 'none', letterSpacing: 0 }}>
                      <input type="checkbox" checked={!!form.isCR} onChange={handleChange('isCR')} /> Class Representative
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                      Optional. Turns on CR tools in the sidebar.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stepIndex === 3 && (
            <>
              <div style={sectionStyle}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Review</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    ['Name', form.name || '—'],
                    ['Student ID', form.studentId || '—'],
                    ['Department', form.dept || autoCalculatedDept || '—'],
                    ['Session', form.session || '—'],
                    ['Current Term', form.currentTermKey ? `${form.currentTermKey} - ${getTermLabelFromKey(form.currentTermKey)}` : '—'],
                    ['Term Start Date', form.termStartDate || '—'],
                    ['Hall', form.hallName || '—'],
                    ['Room', form.roomNo || '—'],
                    ['Advisor', form.advisorName || '—'],
                    ['Advisor Contact', form.advisorContact || '—'],
                    ['Class Representative', form.isCR ? 'Yes' : 'No'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: 'clamp(100px, 25%, 140px) 1fr', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', alignItems: 'start' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>💡</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Next: Import Previous Terms
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    Import previous term results to calculate CGPA and get better grade predictions.
                  </div>
                  <a 
                    href="/results"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      marginTop: 4,
                      transition: 'all 0.2s ease',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--accent2)';
                      e.currentTarget.style.transform = 'translateX(3px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--accent)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    Go to Results & GPA
                    <span style={{ fontSize: 10, fontWeight: 900 }}>→</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}>Cancel</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}>Back</button>
            )}
            {showOptionalSkip && (
              <button type="button" onClick={skipStep} style={{ padding: '10px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)' }}>Skip this step</button>
            )}
            {!canSubmit ? (
              <button type="button" onClick={goNext} style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>Next</button>
            ) : (
              <button type="submit" style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>Finish Setup</button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
