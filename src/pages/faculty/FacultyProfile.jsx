// FacultyProfile.jsx
//
// §8.3 of the merged prompt. A functional (not wizard-styled) profile form
// for now — Name, Title, Department, optional Phone/Office/preferredName —
// wired to real facultySync.js reads/writes. The full multi-step wizard UX
// matching ProfileSetupModal.jsx's exact step-index pattern is explicitly
// still open (flagged in PROGRESS.md); this page is the functional
// placeholder App.jsx's onboarding queue currently points to as "coming
// soon", now upgraded to something real and usable rather than a dead end,
// since the underlying read/write plumbing (facultySync.js) already
// existed from Phase 1 and this page's own effort is small relative to a
// dedicated wizard modal.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { DEPARTMENTS } from '../../store/store';
import { getFacultyDoc, saveFacultyProfile } from '../../lib/facultySync';
import { guessDeptFromFacultyEmail } from '../../lib/facultyEmailVerify';
import { notify } from '../../lib/notify';

const inputStyle = {
  width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };

export default function FacultyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', dept: '', phone: '', officeRoom: '', preferredName: '' });
  const [officialEmail, setOfficialEmail] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    getFacultyDoc(uid).then((fdoc) => {
      if (fdoc) {
        setOfficialEmail(fdoc.officialEmail || '');
        setForm({
          name: fdoc.name || '',
          title: fdoc.title || '',
          // Best-effort pre-fill only (§5 Step 3 — NOT authoritative, since
          // cross-department teaching assignments are common per Deviation 1).
          dept: fdoc.dept || guessDeptFromFacultyEmail(fdoc.officialEmail) || '',
          phone: fdoc.phone || '',
          officeRoom: fdoc.officeRoom || '',
          preferredName: fdoc.preferredName || '',
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.dept.trim()) {
      notify('Name, Title, and Department are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveFacultyProfile(auth.currentUser.uid, form);
      notify('Profile saved.', 'success');
    } catch (e) {
      notify(e.message || 'Could not save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', maxWidth: 560, margin: '0 auto' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Icons.User size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Faculty Profile</h1>
        </div>

        <div style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Institutional email: <strong style={{ color: 'var(--text)' }}>{officialEmail}</strong>
          </div>

          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
          </div>
          <div>
            <label style={labelStyle}>Title / Designation</label>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Assistant Professor" />
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phone (optional)</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Office Room (optional)</label>
            <input style={inputStyle} value={form.officeRoom} onChange={(e) => setForm((f) => ({ ...f, officeRoom: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Preferred display name (optional, self-facing only)</label>
            <input style={inputStyle} value={form.preferredName} onChange={(e) => setForm((f) => ({ ...f, preferredName: e.target.value }))} />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 6, padding: '11px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
