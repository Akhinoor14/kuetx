// PublicationsCard.jsx
//
// Preview card for the SIGNED-IN teacher's own publications, mounted
// inside FacultyProfile.jsx. Shows a short list (newest year first) with
// inline edit/delete, an "Add Publication" action, and a link through to
// the full /faculty/publications view for everything beyond the preview
// count. Data + manual-wins semantics come from facultyPublicationsSync.js
// — every add/edit here flags the doc isManuallyEdited so the daily
// scraper (kuet_faculty_scraper.py) never overwrites it again.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  subscribeToTeacherPublications,
  deletePublication,
} from '../lib/facultyPublicationsSync';
import { notify } from '../lib/notify';
import PublicationEditModal from './PublicationEditModal';

const PREVIEW_COUNT = 4;

export default function PublicationsCard({ teacherEmail }) {
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = add mode
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (!teacherEmail) return undefined;
    const unsub = subscribeToTeacherPublications(
      teacherEmail,
      (list) => { setPubs(list); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [teacherEmail]);

  async function handleDelete(id) {
    try {
      await deletePublication(id);
      notify('Publication removed', 'success');
    } catch (err) {
      notify(err?.message || 'Could not remove publication', 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const visible = pubs.slice(0, PREVIEW_COUNT);
  const remaining = pubs.length - visible.length;

  return (
    <div className="card" style={{ padding: 16, borderRadius: 14, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.BookMarked size={18} color="var(--accent)" />
          <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>Publications</h4>
          {pubs.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>({pubs.length})</span>
          )}
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Icons.Plus size={14} /> Add
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</div>
      )}

      {!loading && pubs.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          No publications yet. They'll appear here automatically once KUET's site is scraped, or add one yourself.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((pub) => (
          <div
            key={pub.id}
            style={{
              padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'rgba(var(--accentRGB), 0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {pub.link ? (
                    <a href={pub.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                      {pub.title || pub.raw_citation}
                    </a>
                  ) : (
                    pub.title || pub.raw_citation
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {[pub.venue, pub.year].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => { setEditing(pub); setModalOpen(true); }}
                  title="Edit"
                  style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  <Icons.Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(pub.id)}
                  title="Delete"
                  style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  <Icons.Trash2 size={14} />
                </button>
              </div>
            </div>

            {confirmDeleteId === pub.id && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Remove this publication?</span>
                <button
                  onClick={() => handleDelete(pub.id)}
                  style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', background: '#e53e3e', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                >
                  Yes, remove
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <Link
          to="/faculty/publications"
          style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}
        >
          View all {pubs.length} publications →
        </Link>
      )}

      <PublicationEditModal
        teacherEmail={teacherEmail}
        existing={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
