// FacultyProfile.jsx
//
// §8.3 of the merged prompt. Redesigned from the original flat single-form
// layout to match the card/section language already used across
// FacultyDashboard.jsx and AdminDashboard.jsx (hero header, avatar,
// sectioned cards with uppercase-label sub-headers, color-mix accents)
// instead of one long undifferentiated form.
//
// Department picker now offers all THREE KUET academic-unit categories —
// Departments (16), Institutes (3), and Basic Science & Humanities depts
// (4) — grouped under <optgroup>s, sourced from store.js's ACADEMIC_UNITS-
// backing lists. Previously this only imported DEPARTMENTS (16), so an
// IICT/IDM/IEPT or MATH/CHEM/PHY/HUM faculty account had no correct option
// to select at all.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS } from '../../store/store';
import { getFacultyDoc, saveFacultyProfile } from '../../lib/facultySync';
import { guessDeptFromFacultyEmail } from '../../lib/facultyEmailVerify';
import { notify } from '../../lib/notify';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
// Same as inputStyle but strips native <select> chrome and adds a custom
// chevron, so the CLOSED control matches the app's card language. Note:
// the OPEN dropdown popup (the list itself) is rendered by the OS/browser
// and can't be restyled with CSS in any browser — this is a platform
// limitation, not something fixable from the app side.
const selectStyle = {
  ...inputStyle,
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  paddingRight: 34, cursor: 'pointer',
};
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const sectionCardStyle = {
  padding: 18, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)',
};
const sectionTitleStyle = {
  fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
};

// Finds the currently-selected unit's display name to show in the avatar/
// subtitle — checked across all three lists since dept can now be a code
// from any of them.
function findUnitName(code) {
  if (!code) return '';
  return (
    DEPARTMENTS.find((d) => d.code === code)?.name ||
    INSTITUTES.find((i) => i.code === code)?.name ||
    BASIC_SCIENCE_DEPTS.find((d) => d.code === code)?.name ||
    code
  );
}

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
    return (
      <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
        <div style={{ padding: '20px 24px 40px', maxWidth: 720, margin: '0 auto', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const displayName = form.preferredName || form.name || 'Faculty';
  const unitName = findUnitName(form.dept);

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', maxWidth: 720, margin: '0 auto' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Icons.User size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Faculty Profile</h1>
        </div>

        {/* Identity summary card — avatar initial + name/title/dept at a
            glance, so the page doesn't open straight into a bare form. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16,
          border: '1px solid var(--border)', background: 'var(--card)', marginBottom: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: 'color-mix(in srgb, var(--accent) 15%, var(--surface, var(--card)))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, color: 'var(--accent)',
          }}>
            {displayName.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>{displayName}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              {form.title || 'No title set'}{unitName ? ` · ${unitName}` : ''}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{officialEmail}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>
              <Icons.IdCard size={14} color="var(--accent)" />
              Identity
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <label style={labelStyle}>Title / Designation</label>
                <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Assistant Professor" />
              </div>
              <div>
                <label style={labelStyle}>Department / Institute</label>
                <select style={selectStyle} value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}>
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
              </div>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>
              <Icons.Contact size={14} color="var(--accent)" />
              Contact & Display
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle}>Phone (optional)</label>
                <input style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 01700000000" />
              </div>
              <div>
                <label style={labelStyle}>Office Room (optional)</label>
                <input style={inputStyle} value={form.officeRoom} onChange={(e) => setForm((f) => ({ ...f, officeRoom: e.target.value }))} placeholder="e.g. Building A, 301" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Preferred display name (optional, self-facing only)</label>
                <input style={inputStyle} value={form.preferredName} onChange={(e) => setForm((f) => ({ ...f, preferredName: e.target.value }))} placeholder="Shown to you only, not students" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '13px 18px', borderRadius: 12, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {saving ? 'Saving…' : (<><Icons.Check size={16} /> Save Profile</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
