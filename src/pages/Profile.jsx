import { useState } from 'react';
import { store, DEPARTMENTS, DEFAULT_PROFILE } from '../store/store';

export default function Profile() {
  const [form, setForm] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    store.set('profile', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page-enter" style={{ padding: 20, maxWidth: 580 }}>
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
            <select value={form.dept || 'CSE'} onChange={e => set('dept', e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div>
            <label>Session</label>
            <input value={form.session || ''} onChange={e => set('session', e.target.value)} placeholder="2023-24" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label>Batch</label>
            <input value={form.batch || ''} onChange={e => set('batch', e.target.value)} placeholder="23" />
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
            <input value={form.hallName || ''} onChange={e => set('hallName', e.target.value)} placeholder="Khanjahan Ali Hall" />
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
