import { useState } from 'react';
import { DEPARTMENTS, DEFAULT_PROFILE, getTermLabelFromKey, TERM_KEYS, getTermCreditsFromCurriculum } from '../store/store';

export default function ProfileSetupModal({ isOpen, onClose, onSave, initialProfile }) {
  const [form, setForm] = useState(initialProfile || DEFAULT_PROFILE);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setDept = (deptCode) => {
    let totalCr = 160;
    if (deptCode) {
      totalCr = TERM_KEYS.reduce((sum, termKey) => sum + getTermCreditsFromCurriculum(deptCode, termKey), 0);
    }
    setForm(f => ({ ...f, dept: deptCode, totalCreditsRequired: totalCr }));
  };

  const setTerm = (termKey) => {
    const label = termKey ? getTermLabelFromKey(termKey) : '';
    setForm(f => ({ ...f, currentTermKey: termKey, currentTerm: label }));
  };

  const handleSave = () => {
    onSave(form);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 14,
        padding: 32,
        maxWidth: 700,
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>Setup Your Profile</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Fill in your details to get started</p>
          </div>
          <button onClick={onClose} style={{
            border: 'none',
            background: 'none',
            fontSize: 28,
            cursor: 'pointer',
            color: 'var(--muted)',
            padding: 0,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.background = 'var(--inputBg)'; e.target.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--muted)'; }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Personal Information */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16, letterSpacing: 0.7 }}>👤 Personal Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Md. Rahim Islam"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Student ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={form.studentId || ''}
                  onChange={e => set('studentId', e.target.value)}
                  placeholder="2003001"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16, letterSpacing: 0.7 }}>📚 Academic Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Department <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select
                  value={form.dept || ''}
                  onChange={e => setDept(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Session <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={form.session || ''}
                  onChange={e => set('session', e.target.value)}
                  placeholder="2023-24"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Batch</label>
                <input
                  type="text"
                  value={form.batch || ''}
                  onChange={e => set('batch', e.target.value)}
                  placeholder="23"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Year Started</label>
                <input
                  type="number"
                  value={form.yearStarted || new Date().getFullYear()}
                  onChange={e => set('yearStarted', +e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Current Term</label>
                <select
                  value={form.currentTermKey || ''}
                  onChange={e => setTerm(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                >
                  <option value="">Select term</option>
                  {TERM_KEYS.map(k => (
                    <option key={k} value={k}>{getTermLabelFromKey(k)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Term Start Date</label>
                <input
                  type="date"
                  value={form.termStartDate || ''}
                  onChange={e => set('termStartDate', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Credits Required</label>
              <input
                type="number"
                value={form.totalCreditsRequired || 160}
                onChange={e => set('totalCreditsRequired', +e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
              />
            </div>
          </div>

          {/* Accommodation Information */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16, letterSpacing: 0.7 }}>🏠 Accommodation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Hall Name</label>
                <select
                  value={form.hallName || ''}
                  onChange={e => set('hallName', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                >
                  <option value="">Select hall</option>
                  <option>Fazlul Haque Hall</option>
                  <option>Lalan Shah Hall</option>
                  <option>Khan Jahan Ali Hall</option>
                  <option>Dr. M.A Rashid Hall</option>
                  <option>Rokeya Hall (Female)</option>
                  <option>Amar Ekushey Hall</option>
                  <option>Shaheed Smriti Hall</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Room No.</label>
                <input
                  type="text"
                  value={form.roomNo || ''}
                  onChange={e => set('roomNo', e.target.value)}
                  placeholder="205"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
            </div>
          </div>

          {/* Advisor Information */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16, letterSpacing: 0.7 }}>👨‍🏫 Advisor (Art. 10.2)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Advisor Name</label>
                <input
                  type="text"
                  value={form.advisorName || ''}
                  onChange={e => set('advisorName', e.target.value)}
                  placeholder="Dr. Kamal Hossain"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text)' }}>Advisor Contact</label>
                <input
                  type="tel"
                  value={form.advisorContact || ''}
                  onChange={e => set('advisorContact', e.target.value)}
                  placeholder="017XXXXXXXX"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--inputBg)', color: 'var(--text)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--inputBg)'; }}
                />
              </div>
            </div>
          </div>

          {/* Role */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16, letterSpacing: 0.7 }}>🎓 Role</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <input
                type="checkbox"
                id="isCR"
                checked={!!form.isCR}
                onChange={e => set('isCR', e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="isCR" style={{ fontSize: 14, cursor: 'pointer', margin: 0, color: 'var(--text)', fontWeight: 500 }}>
                I am a Class Representative (CR)
              </label>
            </div>
          </div>

        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '11px 24px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.background = 'var(--inputBg)'; e.target.style.borderColor = 'var(--muted)'; }}
          onMouseLeave={e => { e.target.style.background = 'var(--surface)'; e.target.style.borderColor = 'var(--border)'; }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{
            padding: '11px 28px',
            border: 'none',
            borderRadius: 8,
            background: 'var(--accent)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.opacity = '0.9'; }}
          onMouseLeave={e => { e.target.style.opacity = '1'; }}>
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
