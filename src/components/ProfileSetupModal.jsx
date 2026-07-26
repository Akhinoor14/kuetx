import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Lightbulb, Crown, Gem } from 'lucide-react';
import Modal from './Modal';
import ManualVerifyFallback from './ManualVerifyFallback';
import { isKuetEmailFormat, emailRollMatchesProfile } from '../lib/kuetEmailVerify';
import { DEPARTMENTS, DEPT_CODES, DEFAULT_PROFILE, TERM_KEYS, getTermLabelFromKey, extractBatchFromRoll, normalizeProfileForSave } from '../store/store';
import { getBatchStartDates } from '../lib/appConfigSync';
import { claimRoll, requestRollUnlock } from '../lib/rollOwnership';
import { subscribeGroupTermStartDate } from '../lib/termStartDateSync';
import { getGroupId, isMultiSectionDept } from '../lib/groupUtils';

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

// Optional, collected right at first-run onboarding (step 0, both minimal
// and full mode) so the Founder's Blood Bank search has data from day
// one instead of depending on students going back to fill it in later.
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const extractDeptCodeFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (r.length < 5) return '';
  if (!extractBatchFromRoll(r)) return '';
  const deptDigits = r.slice(2, 4);
  return ROLL_DEPT_MAP[deptDigits] || '';
};

const isRollValid = (roll) => {
  const r = String(roll || '').trim();
  return /^\d{7}$/.test(r) && Boolean(extractBatchFromRoll(r));
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
  // BUGFIX: bloodGroup and currentTermKey are now required at first-run
  // onboarding too (previously deferred as optional — see history below).
  // Dept still auto-derives from studentId and stays out of this list.
  0: ['name', 'studentId', 'kuetEmail', 'currentTermKey', 'bloodGroup'],
};

const toDateInputValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && value.includes('-')) return value;
  const year = Number(value);
  return Number.isFinite(year) ? `${year}-01-01` : '';
};

const getCanonicalDeptCode = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = DEPT_CODES.find((code) => code.toLowerCase() === raw.toLowerCase());
  return match || '';
};

const isAllowedDeptCode = (value) => Boolean(getCanonicalDeptCode(value));

const getFieldError = (key, form, autoCalculatedDept) => {
  const value = key === 'dept' ? (form.dept || autoCalculatedDept) : form[key];
  if (key === 'name' && !String(value || '').trim()) return 'Name is required';
  if (key === 'studentId') {
    const v = String(value || '').trim();
    if (!v) return 'Student ID is required';
    if (!/^\d{7}$/.test(v)) return 'Student ID must be a 7-digit number';
    if (!extractBatchFromRoll(v)) return 'Student ID must be from a current or past batch (no future batch allowed)';
  }
  if (key === 'dept') {
    const normalized = getCanonicalDeptCode(value);
    if (!normalized) return 'Department must be one of KUET’s 16 approved department codes';
  }
  if (key === 'kuetEmail') {
    const v = String(value || '').trim();
    if (!v) return 'KUET email is required';
    if (!isKuetEmailFormat(v)) return 'Must be a valid KUET student email (e.g. john2313014@stud.kuet.ac.bd)';
    if (!emailRollMatchesProfile(v, form)) return 'This KUET email\u2019s roll number doesn\u2019t match your Student ID above';
  }
  if (key === 'session' && !String(value || '').trim()) return 'Academic session is required';
  if (key === 'currentTermKey' && !String(value || '').trim()) return 'Current term is required';
  if (key === 'bloodGroup' && !String(value || '').trim()) return 'Blood group is required';
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

export default function ProfileSetupModal({ isOpen, onClose, onSave, initialProfile = {}, mandatory = false, minimal = false }) {
  const initial = useMemo(() => ({ ...DEFAULT_PROFILE, ...initialProfile }), [initialProfile]);
  const [form, setForm] = useState(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [rollClaimBusy, setRollClaimBusy] = useState(false);
  const [rollLocked, setRollLocked] = useState(null); // { roll } when claim blocked by another account
  const [unlockRequestState, setUnlockRequestState] = useState('idle'); // idle | sending | sent | error
  // Founder-WhatsApp manual verify — a simple opt-in button on Review,
  // separate from the (removed) automatic OTP/link flow. Nothing gates
  // on this; it's purely a self-service option for anyone who wants their
  // Blue Tick sooner than waiting on their CL/CR to approve a join/CR
  // request (which is what actually sets member.verified).
  const [showManualVerify, setShowManualVerify] = useState(false);
  // BUGFIX(B): map of field key -> DOM node, so a failed validateStep()
  // can scrollIntoView + focus the first invalid field instead of relying
  // on the user spotting a small red error string on their own.
  const fieldRefs = useRef({});
  const registerFieldRef = (key) => (el) => { fieldRefs.current[key] = el; };

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

  // Live batch start-date map (Firestore config/batches, merged over the
  // static seed in store.js) — loaded once on mount. Founder-added batches
  // (via Manage Batches) now carry their own date without a code deploy,
  // so this can't stay a static import.
  const [batchStartDates, setBatchStartDates] = useState({});
  useEffect(() => {
    getBatchStartDates().then(setBatchStartDates);
  }, []);

  // BUGFIX(F): Term Start Date is now CR/ACR-set once per dept+batch
  // class rather than typed in by each student — see
  // src/lib/termStartDateSync.js. Derive the group id from roll+dept as
  // they're typed (same as autoCalculatedBatch/autoCalculatedDept below)
  // so this works even before the profile itself has ever been saved.
  const liveBatch = extractBatchFromRoll(form.studentId);
  const liveDept = form.dept || extractDeptCodeFromRoll(form.studentId);
  const liveGroupId = liveBatch && liveDept ? getGroupId({ batch: liveBatch, dept: liveDept }) : null;
  const [groupTermStartDate, setGroupTermStartDate] = useState(null);
  useEffect(() => {
    return subscribeGroupTermStartDate(liveGroupId, setGroupTermStartDate);
  }, [liveGroupId]);

  // Keep form.termStartDate mirroring the CR-set date once it arrives, so
  // Review and normalizeProfileForSave both see the current shared value
  // without the student ever having to touch this field themselves.
  useEffect(() => {
    if (groupTermStartDate) {
      setForm(prev => (prev.termStartDate === groupTermStartDate ? prev : { ...prev, termStartDate: groupTermStartDate }));
    }
  }, [groupTermStartDate]);

  // Auto-fill university start date from batch (only if user hasn't manually set it)
  useEffect(() => {
    const batch = extractBatchFromRoll(form.studentId);
    if (!batch) return;
    const batchStart = batchStartDates[batch];
    if (!batchStart) return;
    setForm(prev => {
      // Don't overwrite if user already manually entered something different
      const existingBatchDates = Object.values(batchStartDates);
      const alreadyManual = prev.yearStarted && !existingBatchDates.includes(prev.yearStarted);
      if (alreadyManual) return prev;
      return prev.yearStarted === batchStart ? prev : { ...prev, yearStarted: batchStart };
    });
  }, [form.studentId, batchStartDates]);
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

    const rollDept = getCanonicalDeptCode(autoCalculatedDept);
    const selectedDept = getCanonicalDeptCode(form.dept);
    const effectiveDept = selectedDept || rollDept;

    if (!effectiveDept && String(form.studentId || '').trim()) {
      nextErrors.dept = 'Department must be one of KUET’s 16 approved department codes';
    } else if (form.dept && !selectedDept) {
      nextErrors.dept = 'Department must be one of KUET’s 16 approved department codes';
    }

    if (isMultiSectionDept(effectiveDept) && !String(form.section || '').trim()) {
      nextErrors.section = 'Your department has two sections — please select yours (A or B)';
    }

    setErrors(nextErrors);

    const errorKeys = Object.keys(nextErrors);
    if (errorKeys.length) {
      // Prefer the field order the step actually renders in
      // (stepFields first, then 'dept' which isn't in requiredFieldMap).
      const firstKey = stepFields.find((k) => nextErrors[k]) || errorKeys[0];
      const node = fieldRefs.current[firstKey];
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus after the scroll starts so the browser doesn't jump
        // straight there without the smooth animation.
        setTimeout(() => node.focus?.(), 150);
      }
    }

    return errorKeys.length === 0;
  };

  const goNext = (e) => {
    // HARDENING: explicitly stop this click/keypress from ever being able
    // to bubble into a native form submit. This button is type="button"
    // so it shouldn't submit anyway, but stopping propagation here removes
    // any possibility of a parent handler (or a future refactor that
    // accidentally changes this to type="submit") turning "Next" into
    // "Finish Setup" and saving before Review is ever shown.
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!validateStep(stepIndex)) return;
    setStepIndex(prev => Math.min(prev + 1, stepTabs.length - 1));
  };

  const goBack = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setStepIndex(prev => Math.max(prev - 1, 0));
    setErrors({});
  };

  const skipStep = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
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
    // BUGFIX: the whole modal is one <form>, and browsers submit a form on
    // Enter-in-a-text-input even when no type="submit" button is present
    // in the DOM yet (that only renders on the Review step). Without this
    // guard, pressing Enter while typing e.g. Room Number or Advisor Name
    // on the Residence step called handleSubmit directly — which re-runs
    // validateStep(0)+validateStep(1) (already valid, since you can't have
    // reached step 1 otherwise) and finishes the ENTIRE setup right there,
    // silently skipping past Review. Enter should behave like clicking
    // Next: advance one step, same validation as goNext().
    if (!minimal && stepIndex < stepTabs.length - 1) {
      goNext();
      return;
    }

    // HARDENING (final gate): no matter how handleSubmit got invoked
    // (Next click, Enter key, Skip, a future code change), it must never
    // actually persist the profile unless we are truly on the last step
    // (Review) — or minimal mode, which has no step tabs at all. This is
    // a redundant check on top of the guard above, on purpose: if the
    // guard above is ever bypassed for any reason, this stops the save
    // from happening instead of silently finishing setup early.
    if (!minimal && stepIndex !== stepTabs.length - 1) {
      setStepIndex(stepTabs.length - 1);
      return;
    }

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
    const rollDept = getCanonicalDeptCode(autoCalculatedDept);
    const selectedDept = getCanonicalDeptCode(form.dept);
    const effectiveDept = selectedDept || rollDept;

    if (!effectiveDept) {
      setErrors(prev => ({
        ...prev,
        dept: 'Only KUET’s 16 department codes are allowed. Please use a valid roll number or choose a listed department.',
      }));
      setStepIndex(0);
      return;
    }

    if (isMultiSectionDept(effectiveDept) && !String(form.section || '').trim()) {
      setErrors(prev => ({
        ...prev,
        section: 'Your department has two sections — please select yours (A or B)',
      }));
      setStepIndex(0);
      return;
    }

    // Block if this exact roll number is already claimed by a DIFFERENT
    // Firebase account — stops the same student ending up with two
    // separate accounts (e.g. one via Google, one via Email/Password).
    setRollClaimBusy(true);
    let claim;
    try {
      claim = await claimRoll(studentIdTrimmed);
    } catch (err) {
      setRollClaimBusy(false);
      setErrors(prev => ({ ...prev, studentId: 'There was a problem checking the roll. Try again.' }));
      setStepIndex(0);
      return;
    }
    setRollClaimBusy(false);

    if (!claim.ok) {
      setRollLocked({ roll: studentIdTrimmed });
      setErrors(prev => ({
        ...prev,
        studentId: 'An account already uses this roll number. Verify your KUET email below to reclaim it yourself, or send a request to admin.',
      }));
      setStepIndex(0);
      return;
    }
    setRollLocked(null);

    const next = normalizeProfileForSave({
      ...DEFAULT_PROFILE,
      ...form,
      studentId: studentIdTrimmed,
      kuetEmail: String(form.kuetEmail || '').trim(),
      name: String(form.name || '').trim(),
      dept: effectiveDept,
      section: isMultiSectionDept(effectiveDept) ? String(form.section || '').trim().toUpperCase() : '',
      bloodGroup: String(form.bloodGroup || '').trim(),
      session: String(form.session || '').trim(),
      batch: autoCalculatedBatch,
      currentTermKey: String(form.currentTermKey || '').trim(),
      currentTerm: form.currentTermKey ? getTermLabelFromKey(form.currentTermKey) : String(form.currentTerm || '').trim(),
      hallName: String(form.hallName || '').trim(),
      roomNo: String(form.roomNo || '').trim(),
      advisorName: String(form.advisorName || '').trim(),
      advisorContact: String(form.advisorContact || '').trim(),
      termStartDate: validatedTermStartDate || null,
      yearStarted: form.yearStarted || null,
      totalCreditsRequired: DEFAULT_PROFILE.totalCreditsRequired,
    });
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
    .kuetx-profile-modal .actions .left {
      width: 100%;
      margin-left: 0;
      /* BUGFIX(D): was flex-wrap, giving each button its own full-width
         row (up to 4 rows: Cancel/Back/Skip/Next stacked). Grid with
         auto-fit collapses secondary buttons (Back/Skip/"Finish now,
         add rest later") two-to-a-row, with the primary action
         (Next/Finish Setup) spanning the full width on its own row via
         .primary-action below — 2 rows total in the common case instead
         of up to 4. */
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .kuetx-profile-modal .actions button { width: 100%; }
    .kuetx-profile-modal .actions .primary-action { order: -1; grid-column: 1 / -1; }
  }

  @media (max-width: 640px) {
    .kuetx-profile-modal form { padding: 14px; border-radius: 12px; }
    .kuetx-profile-modal .field-grid { grid-template-columns: 1fr; }
    .kuetx-profile-modal .actions button { font-size: 14px; padding: 12px 16px; }
    .kuetx-profile-modal .step-tabs { gap: 6px; }
    .kuetx-profile-modal h3 { font-size: 18px; }
  }
  `;

  const modalContentStyle = minimal ? {
    background: '#ffffff',
    padding: '18px',
    borderRadius: 12,
    width: 'min(820px, 98vw)',
    maxWidth: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
    pointerEvents: 'auto',
  } : { background: 'var(--surface)', padding: 'clamp(12px, 6vw, 20px)', borderRadius: 16, width: 'min(920px, 98vw)', maxWidth: '100%', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 14px 40px rgba(0,0,0,0.24)', pointerEvents: 'auto' };

  return (
    <Modal
      onClose={mandatory ? () => {} : onClose}
      closeOnOverlayClick={!mandatory}
      contentClassName={minimal ? "kuetx-profile-modal minimal" : "kuetx-profile-modal"}
      contentStyle={modalContentStyle}
      // BUGFIX: mandatory (onboarding, no-skip) mode now uses an opaque
      // background instead of Modal's default translucent
      // rgba(0,0,0,0.5) — same reasoning as RoleSelectScreen/
      // FacultyVerifyHoldingScreen: this is a "no real dashboard yet"
      // state, not a dismissable overlay on top of one, so nothing
      // should show through, even dimmed. Optional/dismissable uses of
      // this same component (editing profile later from Settings, etc.)
      // are unaffected — they still get Modal's normal translucent look.
      overlayStyle={mandatory ? { background: 'var(--bg)' } : undefined}
    >
      <style>{modalCss}</style>
      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: minimal ? 18 : 20, color: minimal ? '#111' : undefined }}>Profile Setup</h3>
            {!minimal && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>Set it up once. Required fields are kept minimal, and optional pages can be skipped.</p>}
          </div>
          {!minimal && (
            <div style={{ minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
                <span>{stepIndex + 1}/{stepTabs.length}</span>
                <span>{progressPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', transition: 'width 0.25s ease' }} />
              </div>
            </div>
          )}

        </div>

        {!mandatory && !minimal && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {stepTabs.map((step, idx) => (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  // Going backward (or clicking the current step) is always
                  // allowed. Going forward re-runs the same validateStep()
                  // used by "Next" — same error UI, same scroll/focus — so
                  // jumping ahead can't skip required fields.
                  if (idx <= stepIndex) {
                    setStepIndex(idx);
                    setErrors({});
                    return;
                  }
                  if (validateStep(stepIndex)) setStepIndex(idx);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: idx === stepIndex ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: idx === stepIndex ? 'rgba(34,197,94,0.12)' : 'var(--surfaceGlassSoft)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {step.title}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {stepIndex === 0 && (
            <div className="section" style={sectionStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Academic & Identity</div>
              <div className="field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {minimal ? (
                  <>
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input ref={registerFieldRef('name')} placeholder="Your full name" value={form.name} onChange={handleChange('name')} style={fieldStyle} />
                      {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Student ID</label>
                      <input ref={registerFieldRef('studentId')} placeholder="e.g. 2313014" value={form.studentId} onChange={handleChange('studentId')} style={fieldStyle} />
                      {errors.studentId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.studentId}</div>}
                      {rollLocked?.roll === String(form.studentId || '').trim() && (
                        <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-alt, #f9fafb)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>This roll number is already used by someone else.</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                            Send a direct request to admin and they'll review and resolve it manually.
                          </div>
                          {unlockRequestState === 'sent' ? (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Request sent. Admin will review and resolve it.</div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={handleRequestUnlock}
                              disabled={unlockRequestState === 'sending'}
                            >
                              {unlockRequestState === 'sending' ? 'Sending…' : 'Send request to admin'}
                            </button>
                          )}
                          {unlockRequestState === 'error' && (
                            <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 6 }}>There was a problem sending the request. Try again.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>KUET Email</label>
                      <input
                        ref={registerFieldRef('kuetEmail')}
                        type="email"
                        placeholder="e.g. john2313014@stud.kuet.ac.bd"
                        value={form.kuetEmail || ''}
                        onChange={handleChange('kuetEmail')}
                        style={fieldStyle}
                      />
                      {errors.kuetEmail && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.kuetEmail}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Must be your @stud.kuet.ac.bd address with a roll matching Student ID above</div>
                    </div>
                    {/* BUGFIX: Current Term used to be hidden entirely during
                        first-run (minimal) onboarding — only shown later in
                        the full Settings/"Complete Profile" version of this
                        modal, or via ProfileCompleteReminder's later,
                        snoozable nudge. But 16+ pages (Schedule, Dashboard,
                        Marks, Courses, Results, etc.) read currentTermKey,
                        and a student could go through their entire first
                        session with it unset — courses not filtered by
                        term, dashboard timeline unable to render, and no
                        prompt to fix it until a later app reopen. Now
                        mandatory and shown right after Student ID (3rd
                        field). Session and Term Start Date stay deferred
                        to the full form since those need more thought/
                        typing and aren't blocking as many pages. */}
                    <div>
                      <label style={labelStyle}>Current Term</label>
                      <select ref={registerFieldRef('currentTermKey')} value={form.currentTermKey || ''} onChange={handleChange('currentTermKey')} style={fieldStyle}>
                        <option value="">Select current term</option>
                        {TERM_KEYS.map(termKey => (
                          <option key={termKey} value={termKey}>{termKey} - {getTermLabelFromKey(termKey)}</option>
                        ))}
                      </select>
                      {errors.currentTermKey && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.currentTermKey}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Blood Group</label>
                      <select ref={registerFieldRef('bloodGroup')} value={form.bloodGroup || ''} onChange={handleChange('bloodGroup')} style={fieldStyle}>
                        <option value="">Select blood group</option>
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                      {errors.bloodGroup && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.bloodGroup}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Helps the Blood Bank directory find donors in an emergency</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)' }}>
                      {autoCalculatedDept && isRollValid(form.studentId) ? (
                        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>✓ Auto-selected: {autoCalculatedDept}</div>
                      ) : autoCalculatedDept ? (
                        <div>Detected department: {autoCalculatedDept} — fix roll to auto-select.</div>
                      ) : (
                        <div>Enter a 7-digit roll number to auto-select department.</div>
                      )}
                      {autoCalculatedBatch ? (
                        <div style={{ marginTop: 6 }}>✓ Batch auto-filled: {autoCalculatedBatch}</div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input ref={registerFieldRef('name')} placeholder="Your full name" value={form.name} onChange={handleChange('name')} style={fieldStyle} />
                      {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Student ID</label>
                      <input ref={registerFieldRef('studentId')} placeholder="e.g. 2313014" value={form.studentId} onChange={handleChange('studentId')} style={fieldStyle} />
                      {errors.studentId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.studentId}</div>}
                      {rollLocked?.roll === String(form.studentId || '').trim() && (
                        <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-alt, #f9fafb)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>This roll number is already used by someone else.</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                            Send a direct request to admin and they'll review and resolve it manually.
                          </div>
                          {unlockRequestState === 'sent' ? (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Request sent. Admin will review and resolve it.</div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={handleRequestUnlock}
                              disabled={unlockRequestState === 'sending'}
                            >
                              {unlockRequestState === 'sending' ? 'Sending…' : 'Send request to admin'}
                            </button>
                          )}
                          {unlockRequestState === 'error' && (
                            <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 6 }}>There was a problem sending the request. Try again.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>KUET Email</label>
                      <input
                        ref={registerFieldRef('kuetEmail')}
                        type="email"
                        placeholder="e.g. john2313014@stud.kuet.ac.bd"
                        value={form.kuetEmail || ''}
                        onChange={handleChange('kuetEmail')}
                        style={fieldStyle}
                      />
                      {errors.kuetEmail && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.kuetEmail}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Must be your @stud.kuet.ac.bd address with a roll matching Student ID above</div>
                    </div>
                    <div>
                      <label style={labelStyle}>Department</label>
                      <select
                        ref={registerFieldRef('dept')}
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
                    {/* Section — only shown for the 4 multi-section depts
                        (CE/EEE/ME/CSE, 120 seats/batch, split into ~60-
                        student Section A / B by the department itself).
                        Not derivable from the roll number — KUET rolls
                        encode batch + dept + roll-in-dept only, no section
                        — so this has to be a manual pick. Required for
                        these depts because getGroupId() returns null
                        without it, disabling all class features. */}
                    {isMultiSectionDept(form.dept || autoCalculatedDept) && (
                      <div>
                        <label style={labelStyle}>Section</label>
                        <select
                          ref={registerFieldRef('section')}
                          value={form.section || ''}
                          onChange={(e) => setForm(prev => ({ ...prev, section: e.target.value }))}
                          style={fieldStyle}
                        >
                          <option value="">Select section</option>
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                        </select>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                          Your department runs two sections. This determines your class group, CR/routine, and roster.
                        </div>
                        {errors.section && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.section}</div>}
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Blood Group</label>
                      <select ref={registerFieldRef('bloodGroup')} value={form.bloodGroup || ''} onChange={handleChange('bloodGroup')} style={fieldStyle}>
                        <option value="">Select blood group</option>
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Helps the Blood Bank directory find donors in an emergency</div>
                    </div>
                  </>
                )}
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
                      <select ref={registerFieldRef('currentTermKey')} value={form.currentTermKey || ''} onChange={handleChange('currentTermKey')} style={fieldStyle}>
                        <option value="">Select current term</option>
                        {TERM_KEYS.map(termKey => (
                          <option key={termKey} value={termKey}>{termKey} - {getTermLabelFromKey(termKey)}</option>
                        ))}
                      </select>
                      {errors.currentTermKey && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.currentTermKey}</div>}
                    </div>
                    <div>
                      <label style={labelStyle}>Current Term Start Date</label>
                      {/* BUGFIX(F): no longer a free-typed input — this is
                          now set once by the CR/ACR for the whole
                          dept+batch class and just displayed here. */}
                      <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', color: form.termStartDate ? 'var(--text)' : 'var(--muted)' }}>
                        {form.termStartDate
                          ? new Date(form.termStartDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Your CR hasn\u2019t set a term start date yet'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                        {form.termStartDate ? 'Set by your CR for your whole class' : 'Optional — used for timeline and alert calculations once set'}
                      </div>
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
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Short Bio <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                <textarea
                  placeholder="A short line about yourself… shown on your Profile page"
                  value={form.bio || ''}
                  onChange={e => handleChange('bio')({ target: { value: e.target.value.slice(0, 160) } })}
                  rows={2}
                  style={{ ...fieldStyle, resize: 'none', fontFamily: 'inherit' }}
                />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{(form.bio || '').length}/160</div>
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
                    ['KUET Email', form.kuetEmail || '—'],
                    ['Department', form.dept || autoCalculatedDept || '—'],
                    ['Blood Group', form.bloodGroup || '—'],
                    ['Session', form.session || '—'],
                    ['Current Term', form.currentTermKey ? `${form.currentTermKey} - ${getTermLabelFromKey(form.currentTermKey)}` : '—'],
                    ['Term Start Date', form.termStartDate || '—'],
                    ['Hall', form.hallName || '—'],
                    ['Room', form.roomNo || '—'],
                    ['Advisor', form.advisorName || '—'],
                    ['Advisor Contact', form.advisorContact || '—'],
                  ]
                    // BUGFIX(E): mandatory first-run onboarding hides Session/
                    // Current Term/Term Start Date/Hall/Room/Advisor fields
                    // entirely (see `!mandatory &&` guards on stepIndex 0/1
                    // above), so they always render as "—" here and take up
                    // review-step height for nothing the user could have
                    // filled in yet. Skip empty rows so review only shows
                    // what's actually been entered; padding/gap unchanged.
                    .filter(([, value]) => value !== '—')
                    .map(([label, value]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: 'clamp(100px, 25%, 140px) 1fr', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', alignItems: 'start' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BUGFIX(E): "Import Previous Terms" and "Want to be CR?"
                  cards point at pages (Results, Classmates/Profile) the
                  user hasn't seen yet during mandatory first-run onboarding
                  — they're shown once dashboard exists, i.e. only in the
                  non-mandatory (Settings/"Complete Profile") version of
                  this modal, to keep first-run review compact. */}
              {!mandatory && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                <div style={{ flexShrink: 0 }}><Lightbulb size={18} color="#3b82f6" /></div>
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
              )}

              {!mandatory && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.08) 100%)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                <div style={{ flexShrink: 0 }}><Crown size={18} color="#22c55e" /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Want to be your Class Representative?
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    Once you finish setup, you can claim CR for your class from your Profile or Classmates page — it goes to your Campus Lead for approval.
                  </div>
                </div>
              </div>
              )}
              {!mandatory && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(29,155,240,0.08) 0%, rgba(59,130,246,0.08) 100%)',
                border: '1px solid rgba(29,155,240,0.25)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0 }}><Gem size={18} color="#1d9bf0" /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      Verify your KUET roll with the Founder
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      Optional — your Blue Tick already comes from your CL/CR approving you into your class. This is a separate, faster manual check if you want it sooner: send your info to the Founder over WhatsApp and they'll confirm it by hand.
                    </div>
                  </div>
                </div>
                {!showManualVerify ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowManualVerify(true)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Verify manually
                  </button>
                ) : (
                  <ManualVerifyFallback
                    role="student"
                    details={{ name: form.name, email: form.kuetEmail, roll: form.studentId }}
                    onDone={() => {}}
                  />
                )}
              </div>
              )}
            </>
          )}
        </div>

        <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(!mandatory && !minimal) ? (
            <button type="button" onClick={onClose} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600 }}>Cancel</button>
          ) : <div />}
          <div className="left" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {!minimal && stepIndex > 0 && (
              <button type="button" onClick={goBack} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600 }}>Back</button>
            )}
            {!minimal && showOptionalSkip && (
              <button type="button" onClick={skipStep} style={{ padding: '12px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600 }}>Skip</button>
            )}
            {/* Only name + studentId are actually required (see
                requiredFieldMap) — everything past step 0 is optional and
                can be added later from Profile. This lets someone land in
                the app right after step 0 instead of clicking through
                Residence and Review just to reach a "Finish" button. */}
            {!minimal && !canSubmit && stepIndex === 0 && !mandatory && (
              <button
                type="button"
                onClick={() => { if (validateStep(0)) handleSubmit({ preventDefault: () => {} }); }}
                disabled={rollClaimBusy}
                style={{ padding: '12px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600 }}
              >
                {rollClaimBusy ? 'Checking…' : 'Finish now, add rest later'}
              </button>
            )}
            {!minimal && (!canSubmit && !(mandatory && stepIndex === 0)) ? (
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