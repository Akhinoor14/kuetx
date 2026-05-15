import { useState } from 'react';
import { store, DEPARTMENTS, DEFAULT_PROFILE, getProfile, getTermLabelFromKey, TERM_KEYS } from '../store/store';

export default function Profile() {
  const [form, setForm] = useState(() => getProfile() || DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setTerm = (termKey) => {
    const label = termKey ? getTermLabelFromKey(termKey) : '';
    setForm(f => ({ ...f, currentTermKey: termKey, currentTerm: label }));
  };

  const save = () => {
    store.set('profile', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page-enter page-container">
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Your basic info — used across all modules</p>

      {saved && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#dcfce7', color: '#166534', fontSize: 13, marginBottom: 14, border: '1px solid #bbf7d0' }}>
          ✓ Profile saved!
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Full Name</label>
            <input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Md. Rahim Islam" />
          </div>
          <div>
            <label>Student ID</label>
            <input value={form.studentId || ''} onChange={e => set('studentId', e.target.value)} placeholder="2003001" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Department</label>
            <select value={form.dept || ''} onChange={e => set('dept', e.target.value)}>
              <option value="">Select department</option>
              {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div>
            <label>Session</label>
            <input value={form.session || ''} onChange={e => set('session', e.target.value)} placeholder="2023-24" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div>
            <label>Batch</label>
            <input value={form.batch || ''} onChange={e => set('batch', e.target.value)} placeholder="23" />
          </div>
          <div>
            <label>Current Term</label>
            <select value={form.currentTermKey || ''} onChange={e => setTerm(e.target.value)}>
              <option value="">Select term</option>
              {TERM_KEYS.map(k => (
                <option key={k} value={k}>{getTermLabelFromKey(k)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Year Started</label>
            <input type="number" value={form.yearStarted || new Date().getFullYear()} onChange={e => set('yearStarted', +e.target.value)} />
          </div>
          <div>
            <label>Credits Required</label>
            <input type="number" value={form.totalCreditsRequired || 160} onChange={e => set('totalCreditsRequired', +e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Hall Name</label>
            <select value={form.hallName || ''} onChange={e => set('hallName', e.target.value)}>
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
            <label>Room No.</label>
            <input value={form.roomNo || ''} onChange={e => set('roomNo', e.target.value)} placeholder="205" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Advisor Name (Art. 10.2)</label>
            <input value={form.advisorName || ''} onChange={e => set('advisorName', e.target.value)} placeholder="Dr. Kamal Hossain" />
          </div>
          <div>
            <label>Advisor Contact</label>
            <input value={form.advisorContact || ''} onChange={e => set('advisorContact', e.target.value)} placeholder="017XXXXXXXX" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="isCR" checked={!!form.isCR} onChange={e => set('isCR', e.target.checked)} style={{ width: 'auto' }} />
          <label htmlFor="isCR" style={{ marginBottom: 0, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            I am a Class Representative (CR)
          </label>
        </div>

        <button className="btn btn-primary" onClick={save} style={{ marginTop: 4 }}>
          Save Profile
        </button>
      </div>
    </div>
  );
}
