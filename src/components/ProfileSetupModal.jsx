import React, { useEffect, useMemo, useState } from 'react';
import { DEPARTMENTS, DEFAULT_PROFILE, TERM_KEYS, getTermLabelFromKey } from '../store/store';

// Map dept codes: roll middle 2 digits -> dept code
const ROLL_DEPT_MAP = {
  '13': 'ESE', // Energy Science & Engineering
  '07': 'CSE', // Computer Science & Engineering
  // Add more as needed
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

export default function ProfileSetupModal({ isOpen, onClose, onSave, initialProfile = {} }) {
  const initial = useMemo(() => ({ ...DEFAULT_PROFILE, ...initialProfile }), [initialProfile]);
  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [initial]);

  if (!isOpen) return null;

  const handleChange = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const autoCalculatedBatch = extractBatchFromRoll(form.studentId);
  const autoCalculatedDept = extractDeptCodeFromRoll(form.studentId);

  const handleSubmit = (e) => {
    e.preventDefault();
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
      termStartDate: form.termStartDate || null,
      yearStarted: form.yearStarted ? new Date(form.yearStarted).getFullYear() : DEFAULT_PROFILE.yearStarted,
      totalCreditsRequired: Number(form.totalCreditsRequired) || DEFAULT_PROFILE.totalCreditsRequired,
    };
    if (onSave) onSave(next);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 9999, padding: 14 }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', padding: 18, borderRadius: 18, width: 840, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20 }}>Profile Setup</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>Fill this once. The values will be used across dashboard, syllabus, results, and term tools.</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Required fields first</div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={sectionStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Personal</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input placeholder="Your full name" value={form.name} onChange={handleChange('name')} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Student ID</label>
                <input placeholder="e.g. 2313014" value={form.studentId} onChange={handleChange('studentId')} style={fieldStyle} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Academic</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Department</label>
                <select value={form.dept || autoCalculatedDept} onChange={handleChange('dept')} style={fieldStyle}>
                  <option value="">Select your department</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept.code} value={dept.code}>{dept.code} - {dept.name}</option>
                  ))}
                </select>
                {autoCalculatedDept && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4 }}>Detected: {autoCalculatedDept}</div>}
              </div>
              <div>
                <label style={labelStyle}>Academic Session</label>
                <input placeholder="e.g. 2023-24" value={form.session} onChange={handleChange('session')} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Total Credits Required</label>
                <input type="number" placeholder="e.g. 160" value={form.totalCreditsRequired} onChange={handleChange('totalCreditsRequired')} min={1} max={300} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>When Did You Start?</label>
                <input type="date" value={form.yearStarted} onChange={handleChange('yearStarted')} style={fieldStyle} />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Your first day at KUET</div>
              </div>
              <div>
                <label style={labelStyle}>Current Term</label>
                <select value={form.currentTermKey || ''} onChange={handleChange('currentTermKey')} style={fieldStyle}>
                  <option value="">Select current term</option>
                  {TERM_KEYS.map(termKey => (
                    <option key={termKey} value={termKey}>{termKey} - {getTermLabelFromKey(termKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Term Start Date</label>
                <input type="date" value={form.termStartDate || ''} onChange={handleChange('termStartDate')} style={fieldStyle} />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>When this term started</div>
              </div>
            </div>
            {autoCalculatedBatch && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 10, fontWeight: 700 }}>✓ Batch auto-filled: {autoCalculatedBatch}</div>}
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Residence & Advisor</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Residential Hall</label>
                <select value={form.hallName || ''} onChange={handleChange('hallName')} style={fieldStyle}>
                  <option value="">Select your hall</option>
                  {HALL_OPTIONS.map(hall => (
                    <option key={hall} value={hall}>{hall}</option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Your student accommodation</div>
              </div>
              <div>
                <label style={labelStyle}>Room Number</label>
                <input placeholder="e.g. 301" value={form.roomNo} onChange={handleChange('roomNo')} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Advisor Name</label>
                <input placeholder="Your academic advisor" value={form.advisorName} onChange={handleChange('advisorName')} style={fieldStyle} />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Faculty member assigned to you</div>
              </div>
              <div>
                <label style={labelStyle}>Advisor Phone Number</label>
                <input type="tel" placeholder="e.g. 01700000000" value={form.advisorContact} onChange={handleChange('advisorContact')} inputMode="numeric" pattern="[0-9]*" style={fieldStyle} />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Advisor's contact number</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surfaceGlassSoft)' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--text)', margin: 0, textTransform: 'none', letterSpacing: 0 }}>
                    <input type="checkbox" checked={!!form.isCR} onChange={handleChange('isCR')} /> Class Representative
                  </label>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                    If you select this, the CR section will appear in the sidebar and open the dedicated Class Management page.
                    {form.isCR && ' Your CR tools will stay visible while this profile is active.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}>Cancel</button>
          <button type="submit" style={{ padding: '10px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>Save Profile</button>
        </div>
      </form>
    </div>
  );
}
