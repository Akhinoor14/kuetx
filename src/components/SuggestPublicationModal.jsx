// SuggestPublicationModal.jsx
//
// "Suggest a publication" form for the public /publications browse page
// (student side only — see canEdit=false in PublicationsBrowse.jsx).
// Lets any signed-in user submit a publication on a teacher's behalf;
// this NEVER writes to facultyPublications directly — it always goes
// through pendingPublicationsSync.js's submitPublicationForReview,
// landing in the Founder/Admin Approvals queue first. Contrast with
// PublicationEditModal.jsx, which a teacher uses on their OWN profile to
// add/edit unmoderated (that's the teacher asserting authorship of their
// own record; this is a third party proposing an addition).

import { useState } from 'react';
import Modal from './Modal';
import { submitPublicationForReview } from '../lib/pendingPublicationsSync';
import { notify } from '../lib/notify';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };
const fieldWrap = { marginBottom: 14 };

const EMPTY_FORM = {
  teacherEmail: '', teacherName: '', title: '', authors: '', venue: '', year: '', link: '',
};

export default function SuggestPublicationModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.teacherEmail.trim() || !form.title.trim()) {
      notify('Teacher email and title are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await submitPublicationForReview(form);
      notify('Thanks! Sent to the Founder for review — it will appear once approved.', 'success');
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      notify(err?.message || 'Could not submit — please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={saving ? () => {} : onClose} closeOnOverlayClick={!saving} contentStyle={{ maxWidth: 480, width: '92vw' }}>
      <form onSubmit={handleSubmit} style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Suggest a publication</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Know a teacher's publication that's missing? Add the details below — it'll be reviewed by the Founder before it appears here.
        </p>

        <div style={fieldWrap}>
          <label style={labelStyle}>Teacher's KUET email *</label>
          <input
            type="email"
            value={form.teacherEmail}
            onChange={(e) => setField('teacherEmail', e.target.value)}
            placeholder="teacher@dept.kuet.ac.bd"
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Teacher's name</label>
          <input
            value={form.teacherName}
            onChange={(e) => setField('teacherName', e.target.value)}
            placeholder="Dr. ..."
            style={inputStyle}
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Publication title *</label>
          <input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Authors</label>
          <input
            value={form.authors}
            onChange={(e) => setField('authors', e.target.value)}
            placeholder="Comma-separated"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Venue</label>
            <input
              value={form.venue}
              onChange={(e) => setField('venue', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ width: 100 }}>
            <label style={labelStyle}>Year</label>
            <input
              value={form.year}
              onChange={(e) => setField('year', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Link (optional)</label>
          <input
            value={form.link}
            onChange={(e) => setField('link', e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
