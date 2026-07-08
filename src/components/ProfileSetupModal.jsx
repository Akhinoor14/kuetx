import React, { useEffect, useMemo, useState, useRef } from 'react';
import Modal from './Modal';
import KuetEmailVerifyWidget from './KuetEmailVerifyWidget';
import { isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { DEPARTMENTS, DEFAULT_PROFILE, TERM_KEYS, getTermLabelFromKey, BATCH_START_DATES, extractBatchFromRoll } from '../store/store';
import { claimRoll, requestRollUnlock } from '../lib/rollOwnership';

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

const extractDeptCodeFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (r.length < 5) return '';
  const deptDigits = r.slice(2, 4);
  return ROLL_DEPT_MAP[deptDigits] || '';
};

const isRollValid = (roll) => {
  const r = String(roll || '').trim();
  return /^\d{7}$/.test(r);
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
  height: 48,
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
  { key: 'academic', title: 'Academic & Identity' },
  { key: 'residence', title: 'Residence' },
  { key: 'review', title: 'Review' },
];

const requiredFieldMap = {
  // Deliberately minimal: dept auto-derives from studentId (see
  // extractDeptCodeFromRoll below), and session/currentTermKey are now
  // optional here — they can be filled in later from the Profile page.
  // This step used to require 5 fields before someone could even open
  // the app; now it's just the two things that are actually load-bearing
  // (identity + roll number, which everything else derives from).
  0: ['name', 'studentId'],
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
    if (!/^\d{7}$/.test(v)) return 'Student ID must be a 7-digit number';
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
      return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`; // Convert to local ISO
    }
  } catch (e) {}
  
  return null; // Invalid date
};

export default function ProfileSetupModal({ isOpen, onClose, onSave, initialProfile = {}, mandatory = false }) {
  const initial = useMemo(() => ({ ...DEFAULT_PROFILE, ...initialProfile }), [initialProfile]);
  const [form, setForm] = useState(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [rollClaimBusy, setRollClaimBusy] = useState(false);
  const [rollLocked, setRollLocked] = useState(null); // { roll } when claim blocked by another account
  const [unlockRequestState, setUnlockRequestState] = useState('idle'); // idle | sending | sent | error
  const [verifiedJustNow, setVerifiedJustNow] = useState(false);
  const [verifySkipped, setVerifySkipped] = useState(false);

  // If this profile's roll was already verified in a past session (e.g.
  // they clicked the email link while on a different page entirely), don't
  // show the "verify now" form again just because this modal instance has
  // never seen it happen — check the real record, same fix as Classmates.
  useEffect(() => {
    let cancelled = false;
    const roll = String(form?.studentId || '').trim();
    if (isOpen && roll) {
      isRollInstitutionallyVerified(roll).then((ok) => {
        if (!cancelled && ok) setVerifiedJustNow(true);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isOpen, form?.studentId]);

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

  // Auto-select department when a valid student ID is entered.
  // Overwrite the department field to match the roll when the detected
  // department differs from the current value (keeps manual choice only
  // until the roll changes).
  useEffect(() => {
    setForm(prev => {
      const dept = extractDeptCodeFromRoll(prev.studentId);
      if (dept && prev.dept !== dept) {
        return { ...prev, dept };
      }
      return prev;
    });
    // clear any dept validation error when studentId changes
    setErrors(prev => ({ ...prev, dept: '' }));
  }, [form.studentId]);

  // Auto-fill university start date from batch (only if user hasn't manually set it)
  useEffect(() => {
    const batch = extractBatchFromRoll(form.studentId);
    if (!batch) return;
    const batchStart = BATCH_START_DATES[batch];
    if (!batchStart) return;
    setForm(prev => {
      // Don't overwrite if user already manually entered something different
      const existingBatchDates = Object.values(BATCH_START_DATES);
      const alreadyManual = prev.yearStarted && !existingBatchDates.includes(prev.yearStarted);
      if (alreadyManual) return prev;
      return prev.yearStarted === batchStart ? prev : { ...prev, yearStarted: batchStart };
    });
  }, [form.studentId]);
  const [deptHighlight, setDeptHighlight] = useState(false);
  const deptHighlightTimeout = useRef(null);
  useEffect(() => {
    const detected = extractDeptCodeFromRoll(form.studentId);
    if (detected && form.dept === detected) {
      // trigger highlight
      setDeptHighlight(true);
      if (deptHighlightTimeout.current) clearTimeout(deptHighlightTimeout.current);
      deptHighlightTimeout.current = setTimeout(() => setDeptHighlight(false), 700);
    }
    return () => {
      if (deptHighlightTimeout.current) {
        clearTimeout(deptHighlightTimeout.current);
        deptHighlightTimeout.current = null;
      }
    };
  }, [form.dept, form.studentId]);

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

  const validateStep = (index) => {
    const stepFields = requiredFieldMap[index] || [];
    const nextErrors = {};

    stepFields.forEach((field) => {
      const error = getFieldError(field, form, autoCalculatedDept);
      if (error) nextErrors[field] = error;
    });

    // dept is no longer a hard requirement to finish onboarding — it's
    // auto-derived from the roll number in almost all cases, and the
    // person can pick/fix it manually later from Profile if their roll
    // doesn't map to a known dept code. Blocking here just added a wall
    // in front of using the app at all for an edge case that's rare and
    // self-correctable later.

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

  const handleRequestUnlock = async () => {
    if (!rollLocked?.roll) return;
    setUnlockRequestState('sending');
    const res = await requestRollUnlock(rollLocked.roll, `Profile setup: roll ${rollLocked.roll} already claimed by another account.`);
    setUnlockRequestState(res.ok ? 'sent' : 'error');
  };

  const handleSubmit = async (e) => {
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

    const studentIdTrimmed = String(form.studentId || '').trim();

    // Block if this exact roll number is already claimed by a DIFFERENT
    // Firebase account — stops the same student ending up with two
    // separate accounts (e.g. one via Google, one via Email/Password).
    setRollClaimBusy(true);
    let claim;
    try {
      claim = await claimRoll(studentIdTrimmed);
    } catch (err) {
      setRollClaimBusy(false);
      setErrors(prev => ({ ...prev, studentId: 'Roll check করতে সমস্যা হয়েছে, আবার চেষ্টা করো।' }));
      setStepIndex(0);
      return;
    }
    setRollClaimBusy(false);

    if (!claim.ok) {
      setRollLocked({ roll: studentIdTrimmed });
      setErrors(prev => ({
        ...prev,
        studentId: 'এই roll number দিয়ে আগেই একটা account আছে। নিচে KUET email verify করে নিজে নিজে reclaim করতে পারো, অথবা admin-কে request পাঠাতে পারো।',
      }));
      setStepIndex(0);
      return;
    }
    setRollLocked(null);

    const next = {
      ...DEFAULT_PROFILE,
      ...form,
      studentId: studentIdTrimmed,
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
      // Store full ISO date (YYYY-MM-DD) for kuetStart
      yearStarted: form.yearStarted || null,
      totalCreditsRequired: DEFAULT_PROFILE.totalCreditsRequired,
    };
    if (onSave) onSave(next);
  };

  const progressPct = Math.round(((stepIndex + 1) / stepTabs.length) * 100);
  const showOptionalSkip = stepIndex === 1;
  const canSubmit = stepIndex === stepTabs.length - 1;

  const modalCss = `
  .kuetx-profile-modal form { max-width: 920px; width: min(98vw, 920px); }
  .kuetx-profile-modal .field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .kuetx-profile-modal .section { padding: 14px; border-radius: 12px; }
  .kuetx-profile-modal .actions { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .kuetx-profile-modal .actions .left { margin-left: auto; display: flex; gap: 12px; flex-wrap: wrap; }
  .kuetx-profile-modal button { transition: all 0.2s ease; min-height: 44px; display: flex; align-items: center; justify-content: center; }
  .kuetx-profile-modal button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  .kuetx-profile-modal button:active { transform: translateY(0); }

  @media (max-width: 768px) {
    .kuetx-profile-modal .actions { flex-direction: column; }
    .kuetx-profile-modal .actions .left { width: 100%; margin-left: 0; }
    .kuetx-profile-modal .actions button { width: 100%; }
    .kuetx-profile-modal .actions .primary-action { order: -1; }
  }

  @media (max-width: 640px) {
    .kuetx-profile-modal form { padding: 14px; border-radius: 12px; }
    .kuetx-profile-modal .field-grid { grid-template-columns: 1fr; }
    .kuetx-profile-modal .actions button { font-size: 14px; padding: 12px 16px; }
    .kuetx-profile-modal .step-tabs { gap: 6px; }
    .kuetx-profile-modal h3 { font-size: 18px; }
  }
  `;

  return (
    <Modal onClose={mandatory ? () => {} : onClose} closeOnOverlayClick={!mandatory} contentClassName="kuetx-profile-modal" contentStyle={{ background: 'var(--surface)', padding: 'clamp(12px, 6vw, 20px)', borderRadius: 16, width: 'min(920px, 98vw)', maxWidth: '100%', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 14px 40px rgba(0,0,0,0.24)', pointerEvents: 'auto' }}>
      <style>{modalCss}</style>
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
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

        {!mandatory && (
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
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {stepIndex === 0 && (
            <div className="section" style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Academic & Identity</div>
              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input placeholder="Your full name" value={form.name} onChange={handleChange('name')} style={fieldStyle} />
                  {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Student ID</label>
                  <input placeholder="e.g. 2313014" value={form.studentId} onChange={handleChange('studentId')} style={fieldStyle} />
                  {errors.studentId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.studentId}</div>}
                  {rollLocked?.roll === String(form.studentId || '').trim() && (
                    <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-alt, #f9fafb)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>নিজে নিজে ঠিক করো</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                        তোমার KUET email (@stud.kuet.ac.bd) verify করলে এই roll number automatically তোমার account-এ চলে আসবে।
                      </div>
                      <KuetEmailVerifyWidget
                        overrideRoll={rollLocked.roll}
                        onVerified={() => {
                          setRollLocked(null);
                          setErrors(prev => ({ ...prev, studentId: '' }));
                          handleSubmit({ preventDefault: () => {} });
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 6px' }}>
                        KUET email verify করতে না পারলে, admin-কে সরাসরি request পাঠাও:
                      </div>
                      {unlockRequestState === 'sent' ? (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Request পাঠানো হয়েছে। Admin দেখে resolve করবে।</div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={handleRequestUnlock}
                          disabled={unlockRequestState === 'sending'}
                        >
                          {unlockRequestState === 'sending' ? 'Sending…' : 'Admin-কে request পাঠাও'}
                        </button>
                      )}
                      {unlockRequestState === 'error' && (
                        <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 6 }}>Request পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করো।</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <select
                    value={form.dept || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, dept: e.target.value }))}
                    disabled={isRollValid(form.studentId) && autoCalculatedDept ? true : false}
                    style={{
                      ...fieldStyle,
                      opacity: isRollValid(form.studentId) && autoCalculatedDept ? 0.6 : 1,
                      cursor: isRollValid(form.studentId) && autoCalculatedDept ? 'not-allowed' : 'pointer',
                      transition: 'box-shadow 0.28s ease, transform 0.18s ease, border-color 0.18s ease, opacity 0.2s ease',
                      boxShadow: deptHighlight ? '0 10px 30px rgba(59,130,246,0.14)' : 'none',
                      transform: deptHighlight ? 'translateY(-3px)' : 'none',
                      borderColor: deptHighlight ? 'rgba(59,130,246,0.9)' : undefined,
                    }}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(dept => (
                      <option key={dept.code} value={dept.code}>{dept.code} - {dept.name}</option>
                    ))}
                  </select>
                  {autoCalculatedDept && isRollValid(form.studentId) ? (
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontWeight: 700 }}>
                      ✓ Auto-selected from roll: {autoCalculatedDept}
                    </div>
                  ) : autoCalculatedDept ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Detected: {autoCalculatedDept}. Please fix your roll number to auto-select.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Enter a 7-digit roll number to auto-select, or choose manually.
                    </div>
                  )}
                  {errors.dept && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.dept}</div>}
                </div>
                {/* Session / Current Term / Term Start Date are optional —
                    hidden entirely during mandatory first-launch onboarding
                    so the very first thing a new user sees is just Name +
                    Roll. They stay visible in the non-mandatory (Settings/
                    "Complete Profile" reminder) version of this same modal. */}
                {!mandatory && (
                  <>
                    <div>
                      <label style={labelStyle}>Academic Session</label>
                      <input placeholder="e.g. 2023-24" value={form.session} onChange={handleChange('session')} style={fieldStyle} />
                      {errors.session && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.session}</div>}
                    </div>
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
                      <label style={labelStyle}>Current Term Start Date</label>
                      <input type="date" value={form.termStartDate || ''} onChange={handleChange('termStartDate')} style={fieldStyle} />
                      {errors.termStartDate && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.termStartDate}</div>}
                      {!errors.termStartDate && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Used for timeline and alert calculations</div>}
                    </div>
                  </>
                )}
              </div>
              {autoCalculatedBatch && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 10, fontWeight: 700 }}>✓ Batch auto-filled: {autoCalculatedBatch}</div>}
            </div>
          )}

          {stepIndex === 1 && (
            <div className="section" style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Residence & advisor</div>
              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
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
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <>
              <div className="section" style={sectionStyle}>
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
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: 'clamp(100px, 25%, 140px) 1fr', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', alignItems: 'start' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!verifiedJustNow && !verifySkipped && (
                <KuetEmailVerifyWidget
                  onVerified={() => setVerifiedJustNow(true)}
                  onSkip={() => setVerifySkipped(true)}
                />
              )}
              {verifiedJustNow && (
                <div style={{
                  background: 'rgba(29,155,240,0.08)', border: '1px solid rgba(29,155,240,0.25)',
                  borderRadius: 12, padding: 12, fontSize: 12.5, color: 'var(--text)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  ✅ KUET email verified হয়ে গেছে — তোমার নামের পাশে blue tick দেখাবে।
                </div>
              )}

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

        <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {mandatory ? <div /> : (
            <button type="button" onClick={onClose} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600 }}>Cancel</button>
          )}
          <div className="left" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600 }}>Back</button>
            )}
            {showOptionalSkip && (
              <button type="button" onClick={skipStep} style={{ padding: '12px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600 }}>Skip</button>
            )}
            {/* Only name + studentId are actually required (see
                requiredFieldMap) — everything past step 0 is optional and
                can be added later from Profile. This lets someone land in
                the app right after step 0 instead of clicking through
                Residence and Review just to reach a "Finish" button. */}
            {!canSubmit && stepIndex === 0 && !mandatory && (
              <button
                type="button"
                onClick={() => { if (validateStep(0)) handleSubmit({ preventDefault: () => {} }); }}
                disabled={rollClaimBusy}
                style={{ padding: '12px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600 }}
              >
                {rollClaimBusy ? 'Checking…' : 'Finish now, add rest later'}
              </button>
            )}
            {!canSubmit && !(mandatory && stepIndex === 0) ? (
              <button type="button" onClick={goNext} className="primary-action" style={{ padding: '12px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, minWidth: 100 }}>Next</button>
            ) : (mandatory && stepIndex === 0) ? (
              <button
                type="button"
                onClick={() => { if (validateStep(0)) handleSubmit({ preventDefault: () => {} }); }}
                disabled={rollClaimBusy}
                className="primary-action"
                style={{ padding: '12px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, minWidth: 120, opacity: rollClaimBusy ? 0.7 : 1, cursor: rollClaimBusy ? 'wait' : 'pointer' }}
              >
                {rollClaimBusy ? 'Checking…' : 'Finish Setup'}
              </button>
            ) : (
              <button type="submit" disabled={rollClaimBusy} className="primary-action" style={{ padding: '12px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, minWidth: 120, opacity: rollClaimBusy ? 0.7 : 1, cursor: rollClaimBusy ? 'wait' : 'pointer' }}>{rollClaimBusy ? 'Checking…' : 'Finish Setup'}</button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}