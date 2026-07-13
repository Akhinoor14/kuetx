// FacultyProfile.jsx
//
// §8.3 of the merged prompt. Redesigned to match the section/card visual
// language used on the student Profile.jsx page — hero card (avatar +
// name, click-through subtitle), a proper `Section` component with an
// accent-bar header, badge chips, InfoRow display state that flips into
// an edit form, instead of one long always-open form. Department picker
// still offers all THREE KUET academic-unit categories — Departments (16),
// Institutes (3), and Basic Science & Humanities depts (4) — grouped
// under <optgroup>s, sourced from store.js's ACADEMIC_UNITS-backing lists.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS } from '../../store/store';
import { getFacultyDoc, saveFacultyProfile } from '../../lib/facultySync';
import { guessDeptFromFacultyEmail } from '../../lib/facultyEmailVerify';
import { notify } from '../../lib/notify';
import { getProfilePhotoURL } from '../../lib/profilePicture';
import { AvatarUploadModal } from '../../components/AvatarUploadModal';

// ─── Shared field styles (used only inside the edit form) ─────────────────
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
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

// ─── Mini components (same visual pattern as student Profile.jsx) ─────────

// Section: bordered card, thin accent bar + icon + uppercase title header,
// optional action slot (top-right) — identical language to Profile.jsx's
// Section component so Faculty Profile "matches" Student Profile.
const Section = ({ title, icon, children, action }) => (
  <div style={{
    background: 'var(--surface, var(--card))', border: '1px solid var(--border)', borderRadius: 16,
    overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
  }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(var(--accent), var(--accent2, var(--accent)))' }} />
      {icon && <span style={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text)', flex: 1 }}>{title}</span>
      {action}
    </div>
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
    </div>
  </div>
);

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, alignItems: 'flex-start' }}>
    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 1 }}>{label}</span>
    <span style={{ fontSize: 14, color: accent ? 'var(--accent)' : 'var(--text)', fontWeight: accent ? 700 : 500, wordBreak: 'break-word' }}>{value || '—'}</span>
  </div>
);

const Divider = () => <div style={{ height: 1, background: 'var(--border)' }} />;

const Badge = ({ label, color = 'var(--accent)', bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    background: bg || `${color}18`, color,
    border: `1px solid ${color}30`,
  }}>{label}</span>
);

// Finds the currently-selected unit's display name to show in the hero
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
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', title: '', dept: '', phone: '', officeRoom: '', preferredName: '' });
  const [officialEmail, setOfficialEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [photoURL, setPhotoURL] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

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
        // First-time setup (no name saved yet) opens straight into edit mode.
        if (!fdoc.name) setIsEditing(true);
      } else {
        setIsEditing(true);
      }
      setLoading(false);
    });
  }, []);

  // Load any previously-uploaded profile photo — same shared storage
  // (keyed by Firebase uid) the student side uses.
  useEffect(() => {
    getProfilePhotoURL().then(setPhotoURL).catch(() => {});
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
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      notify(e.message || 'Could not save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
        <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const displayName = form.preferredName || form.name || 'Faculty';
  const unitName = findUnitName(form.dept);

  return (
    <div className="hub-page-bg page-enter dashboard-page" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Save toast — same pattern as student Profile.jsx ── */}
        {saved && (
          <div style={{
            padding: '12px 18px', borderRadius: 10, background: '#dcfce7', color: '#166534',
            fontSize: 14, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600,
          }}>✓ Profile updated!</div>
        )}

        {/* ── Hero: avatar (top) + name (below), same minimal plain-card
             layout as the student Profile hero. ── */}
        <div className="profile-hero-plain" style={{
          borderRadius: 20, padding: 'clamp(28px,5vw,40px) clamp(20px,4vw,32px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, position: 'relative', overflow: 'hidden', textAlign: 'center',
        }}>
          <div
            onClick={() => setShowAvatarModal(true)}
            title="Click to change profile picture"
            className="profile-hero-avatar"
            style={{
              borderRadius: '50%',
              background: photoURL ? 'transparent' : 'var(--accentSoft, color-mix(in srgb, var(--accent) 15%, var(--surface, var(--card))))',
              border: '3px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: 'var(--accent)', flexShrink: 0, cursor: 'pointer', overflow: 'hidden', position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
          >
            {photoURL
              ? <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span>{displayName.trim().charAt(0).toUpperCase() || <Icons.User size={28} />}</span>
            }
            {/* Camera overlay on hover */}
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
              <Icons.Camera size={22} color="white" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 'clamp(19px,4.5vw,28px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif" }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {form.title && <Badge label={form.title} />}
              {unitName && <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{unitName}</span>}
            </div>
            {officialEmail && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{officialEmail}</div>}
          </div>
        </div>

        {/* ── Setup prompt if nothing saved yet ── */}
        {!form.name && !isEditing && (
          <div style={{ padding: '13px 18px', borderRadius: 12, borderColor: 'var(--accent)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>🎓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Set Up Profile</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add your name, title and department — it'll be used everywhere</div>
            </div>
            <button onClick={() => setIsEditing(true)} style={{
              padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}>Get started →</button>
          </div>
        )}

        {/* ── Two-column layout: Identity+Contact info on the left as
             read/edit sections; a lightweight "About" summary + save
             action on the right — same profile-two-col grid the student
             page uses. ── */}
        <div className="profile-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Identity */}
            <Section title="Identity" icon={<Icons.IdCard size={14} />} action={
              !isEditing && (
                <button onClick={() => setIsEditing(true)} style={{
                  padding: '6px 12px', background: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Icons.Pencil size={12} /> Edit
                </button>
              )
            }>
              {!isEditing ? (
                <>
                  <InfoRow label="Full Name" value={form.name} />
                  <Divider />
                  <InfoRow label="Title / Designation" value={form.title} accent />
                  <Divider />
                  <InfoRow label="Department / Institute" value={unitName} />
                </>
              ) : (
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
              )}
            </Section>

            {/* Contact & Display */}
            <Section title="Contact & Display" icon={<Icons.Contact size={14} />}>
              {!isEditing ? (
                <>
                  <InfoRow label="Phone" value={form.phone} />
                  <Divider />
                  <InfoRow label="Office Room" value={form.officeRoom} />
                  <Divider />
                  <InfoRow label="Preferred Name" value={form.preferredName} />
                  <Divider />
                  <InfoRow label="Official Email" value={officialEmail} />
                </>
              ) : (
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
              )}
            </Section>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* At a glance — small summary card, same visual weight as
                the student page's stat-card language but simplified since
                faculty has no GPA/attendance-style metrics here. */}
            <Section title="At a Glance" icon={<Icons.Sparkles size={14} />}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {form.title && <Badge label={form.title} />}
                {unitName && <Badge label={unitName} color="#0ea5e9" />}
                {!form.title && !unitName && (
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Fill in Identity to see badges here.</span>
                )}
              </div>
            </Section>

            {/* Save action — sits in its own card on the right, out of
                the way of read-mode browsing, only meaningfully "active"
                while editing. */}
            <Section title="Save Changes" icon={<Icons.Check size={14} />}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>
                {isEditing ? 'Review your details, then save.' : 'Click Edit on Identity to make changes.'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {isEditing && (
                  <button
                    onClick={() => setIsEditing(false)}
                    style={{
                      flex: '0 0 auto', padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none',
                    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5,
                    cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {saving ? 'Saving…' : isEditing ? (<><Icons.Check size={15} /> Save Profile</>) : (<><Icons.Pencil size={13} /> Edit Profile</>)}
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>

      {showAvatarModal && (
        <AvatarUploadModal
          currentURL={photoURL}
          isAnon={auth.currentUser?.isAnonymous}
          onClose={() => setShowAvatarModal(false)}
          onUploaded={(url) => setPhotoURL(url)}
          onDeleted={() => setPhotoURL(null)}
        />
      )}
    </div>
  );
}
