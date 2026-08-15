// PublicationEditModal.jsx
//
// Add/edit form for a single publication, used from both
// PublicationsCard.jsx (teacher's own profile preview) and
// PublicationsBrowse.jsx (the /faculty/publications full edit view).
// Every save through this modal routes through facultyPublicationsSync.js,
// which always sets isManuallyEdited: true — see that file's header for
// why that flag permanently excludes the doc from future scraper writes.

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { addPublication, updatePublication } from '../lib/facultyPublicationsSync';
import { notify } from '../lib/notify';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };
const fieldWrap = { marginBottom: 14 };

const EMPTY_FORM = {
  title: '', authors: '', venue: '', year: '', link: '',
  volume: '', issue: '', pages: '', category: 'Journal',
};

/**
 * @param {string} teacherEmail - required for a new (add) publication.
 * @param {object|null} existing - the publication doc being edited, or
 *   null when adding a brand-new one. Must include `id` when editing.
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {() => void} [onSaved] - called after a successful save, so the
 *   caller can close + refresh without duplicating that logic here (the
 *   live subscriptions in facultyPublicationsSync.js update the list
 *   automatically, so onSaved is only needed for UI like closing the modal).
 */
export default function PublicationEditModal({ teacherEmail, existing, open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        title: existing.title || '',
        authors: existing.authors || '',
        venue: existing.venue || '',
        year: existing.year || '',
        link: existing.link || '',
        volume: existing.volume || '',
        issue: existing.issue || '',
        pages: existing.pages || '',
        category: existing.category || 'Journal',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, existing]);

  if (!open) return null;

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSave() {
    if (!form.title.trim()) {
      notify('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updatePublication(existing.id, { ...form, raw_citation: existing.raw_citation || form.title });
        notify('Publication updated', 'success');
      } else {
        await addPublication(teacherEmail, form);
        notify('Publication added', 'success');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      notify(err?.message || 'Could not save publication', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={saving ? undefined : onClose} closeOnOverlayClick={!saving}>
      <div style={{ padding: 20, width: 'min(92vw, 480px)', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          {existing ? 'Edit Publication' : 'Add Publication'}
        </h3>

        <div style={fieldWrap}>
          <label style={labelStyle}>Title *</label>
          <input style={inputStyle} value={form.title} onChange={setField('title')} placeholder="Paper / article title" />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Authors</label>
          <input style={inputStyle} value={form.authors} onChange={setField('authors')} placeholder="A. Rahman, B. Islam, ..." />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Journal / Conference</label>
          <input style={inputStyle} value={form.venue} onChange={setField('venue')} placeholder="e.g. IEEE Transactions on ..." />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Year</label>
            <input style={inputStyle} value={form.year} onChange={setField('year')} placeholder="2025" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={setField('category')}>
              <option value="Journal">Journal</option>
              <option value="Conference">Conference</option>
              <option value="Book Chapter">Book Chapter</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Volume</label>
            <input style={inputStyle} value={form.volume} onChange={setField('volume')} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Issue</label>
            <input style={inputStyle} value={form.issue} onChange={setField('issue')} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Pages</label>
            <input style={inputStyle} value={form.pages} onChange={setField('pages')} />
          </div>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>DOI / Link</label>
          <input style={inputStyle} value={form.link} onChange={setField('link')} placeholder="https://doi.org/..." />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
