// FacultyProfileSetupModal.jsx
//
// Mandatory, full-screen Faculty Profile step — the faculty equivalent of
// ProfileSetupModal's `mandatory` mode. Wraps FacultyProfile.jsx's fields
// (name, title, dept, optional phone/office/preferredName) in the same
// no-skip, opaque-background onboarding shell used by RoleSelectScreen and
// ProfileSetupModal(mandatory), instead of sending a freshly-verified
// faculty account to the STUDENT ProfileSetupModal (studentId/hall/
// advisor fields, none of which apply to a faculty account).
//
// Name is NOT re-asked here if it was already collected at Register —
// AuthModal's Register form has an optional "Your name" field; if that
// was filled in, it's pre-filled below (still editable, never re-required
// from scratch). Institutional email is shown read-only (it's already
// fixed from sign-up + verification, never re-entered).
//
// Wired into App.jsx's onboarding queue as 'faculty-profile', pushed by
// buildQueue() only when isFacultyProfileComplete(fdoc) is false for a
// verified faculty account — see App.jsx buildQueue() comments.

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { auth } from '../lib/firebase';
import { DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS } from '../store/store';
import { getFacultyDoc, saveFacultyProfile } from '../lib/facultySync';
import { guessDeptFromFacultyEmail } from '../lib/facultyEmailVerify';

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surfaceGlassStrong, var(--bg))',
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

export default function FacultyProfileSetupModal({ onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', dept: '', phone: '', officeRoom: '', preferredName: '' });
  const [officialEmail, setOfficialEmail] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    getFacultyDoc(uid).then((fdoc) => {
      if (fdoc) {
        setOfficialEmail(fdoc.officialEmail || '');
        setForm({
          name: fdoc.name || '',
          title: fdoc.title || '',
          // Best-effort pre-fill only — cross-department teaching
          // assignments are common, so this is a starting guess, not
          // authoritative; the dropdown stays fully editable.
          dept: fdoc.dept || guessDeptFromFacultyEmail(fdoc.officialEmail) || '',
          phone: fdoc.phone || '',
          officeRoom: fdoc.officeRoom || '',
          preferredName: fdoc.preferredName || '',
        });
      }
      setLoading(false);
    });
  }, []);

  const handleChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!form.title.trim()) next.title = 'Title / designation is required';
    if (!form.dept.trim()) next.dept = 'Department is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await saveFacultyProfile(auth.currentUser.uid, form);
      onSave?.();
    } catch (err) {
      setErrors((prev) => ({ ...prev, _general: err.message || 'Could not save profile. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      // Fully opaque, matching RoleSelectScreen / mandatory ProfileSetupModal
      // — no dashboard visible behind it, dimmed or otherwise.
      background: `
        radial-gradient(1200px 600px at 15% -10%, var(--accentSoft), transparent 60%),
        radial-gradient(900px 500px at 110% 110%, var(--accentSoft), transparent 55%),
        var(--bg)
      `,
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--surfaceGlassStrong, var(--card))',
          backdropFilter: 'blur(6px)',
          borderRadius: 22,
          padding: '32px 28px',
          width: '100%', maxWidth: 560,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.16)',
          maxHeight: '94vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
            background: 'var(--accentSoft)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={24} color="var(--accent)" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: 'var(--text)' }}>
            Complete your Faculty Profile
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            One-time setup. This is what students and staff will see for you across KUETx.
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Institutional email: <strong style={{ color: 'var(--text)' }}>{officialEmail}</strong>
            </div>

            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={fieldStyle} value={form.name} onChange={handleChange('name')} placeholder="Your full name" />
              {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.name}</div>}
            </div>

            <div>
              <label style={labelStyle}>Title / Designation</label>
              <input style={fieldStyle} value={form.title} onChange={handleChange('title')} placeholder="e.g. Assistant Professor" />
              {errors.title && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.title}</div>}
            </div>

            <div>
              <label style={labelStyle}>Department</label>
              <select style={fieldStyle} value={form.dept} onChange={handleChange('dept')}>
                <option value="">Select department / institute</option>
                <optgroup label="Departments">
                  {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                </optgroup>
                <optgroup label="Institutes">
                  {INSTITUTES.map((i) => <option key={i.code} value={i.code}>{i.name} ({i.code})</option>)}
                </optgroup>
                <optgroup label="Basic Science & Humanities">
                  {BASIC_SCIENCE_DEPTS.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
                </optgroup>
              </select>
              {errors.dept && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>{errors.dept}</div>}
            </div>

            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input style={fieldStyle} value={form.phone} onChange={handleChange('phone')} placeholder="e.g. 01700000000" />
            </div>

            <div>
              <label style={labelStyle}>Office Room (optional)</label>
              <input style={fieldStyle} value={form.officeRoom} onChange={handleChange('officeRoom')} />
            </div>

            <div>
              <label style={labelStyle}>Preferred display name (optional, self-facing only)</label>
              <input style={fieldStyle} value={form.preferredName} onChange={handleChange('preferredName')} />
            </div>

            {errors._general && (
              <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 10px', background: 'rgba(220,38,38,0.08)', borderRadius: 6 }}>
                {errors._general}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 6, padding: '12px 18px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Finish Setup'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
