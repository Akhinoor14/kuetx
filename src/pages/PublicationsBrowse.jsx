// PublicationsBrowse.jsx
//
// Standalone "all publications, every teacher" browse page. Mounted at
// TWO routes with one `canEdit` prop difference:
//   /publications          (student side, Academic Core subgroup) — canEdit=false
//   /faculty/publications  (faculty side, Resources subgroup)     — canEdit=true, own-only
//
// canEdit does NOT mean "edit everyone's publications" — a faculty viewer
// only ever sees edit/delete controls on rows where pub.teacherEmail
// matches their own signed-in email (firestore.rules enforces the same
// boundary server-side regardless, this is just the UI reflecting it).
// Browsing every other teacher's publications is read-only for everyone,
// faculty included.
//
// Search is client-side over the already-subscribed collection (see
// facultyPublicationsSync.js's subscribeToAllPublications header for why
// this is fine at KUET's scale) — filters by title, author, teacher name,
// or department in one free-text box, plus a department dropdown.

import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../lib/firebase';
import { DEPARTMENTS } from '../store/store';
import {
  subscribeToAllPublications,
  deletePublication,
} from '../lib/facultyPublicationsSync';
import { notify } from '../lib/notify';
import PublicationEditModal from '../components/PublicationEditModal';
import TeacherDetailModal from '../components/TeacherDetailModal';
import SuggestPublicationModal from '../components/SuggestPublicationModal';

const DEPT_NAME_BY_CODE = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d.name]));

export default function PublicationsBrowse({ canEdit = false }) {
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [detailTeacherEmail, setDetailTeacherEmail] = useState(null);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);

  const myEmail = (auth.currentUser?.email || '').trim().toLowerCase();

  useEffect(() => {
    const unsub = subscribeToAllPublications(
      (list) => { setPubs(list); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return pubs.filter((pub) => {
      if (deptFilter && pub.teacherDeptCode !== deptFilter) return false;
      if (!text) return true;
      const haystack = [pub.title, pub.authors, pub.venue, pub.teacherName, pub.raw_citation]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(text);
    });
  }, [pubs, searchText, deptFilter]);

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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icons.BookMarked size={22} color="var(--accent)" />
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--text)' }}>Publications</h2>
        </div>
        {!canEdit && (
          <button
            onClick={() => setSuggestModalOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
              border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            }}
          >
            <Icons.Plus size={14} /> Suggest a publication
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Icons.Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--muted)' }} />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by title, author, or teacher name…"
            style={{
              width: '100%', padding: '10px 12px 10px 32px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', height: 40,
            }}
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{
            padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: 13, height: 40, minWidth: 160,
          }}
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading publications…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', padding: '30px 0', textAlign: 'center' }}>
          No publications match your search.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((pub) => {
          const isMine = canEdit && myEmail && pub.teacherEmail === myEmail;
          return (
            <div
              key={pub.id}
              className="card"
              style={{ padding: 14, borderRadius: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {pub.link ? (
                      <a href={pub.link} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                        {pub.title || pub.raw_citation}
                      </a>
                    ) : (
                      pub.title || pub.raw_citation
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {[pub.venue, pub.year].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button
                      onClick={() => pub.teacherEmail && setDetailTeacherEmail(pub.teacherEmail)}
                      disabled={!pub.teacherEmail}
                      style={{
                        fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, background: 'transparent',
                        border: 'none', padding: 0, cursor: pub.teacherEmail ? 'pointer' : 'default',
                        textDecoration: pub.teacherEmail ? 'underline' : 'none', textUnderlineOffset: 2,
                      }}
                      title={pub.teacherEmail ? 'View teacher details' : undefined}
                    >
                      {pub.teacherName || pub.teacherEmail}
                      {pub.teacherDeptCode && DEPT_NAME_BY_CODE[pub.teacherDeptCode]
                        ? ` · ${DEPT_NAME_BY_CODE[pub.teacherDeptCode]}` : ''}
                    </button>
                    {pub.link && (
                      <a
                        href={pub.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 11, color: 'var(--muted)', fontWeight: 600, display: 'inline-flex',
                          alignItems: 'center', gap: 3, textDecoration: 'none', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '2px 6px',
                        }}
                        title="Open the original publication link"
                      >
                        <Icons.ExternalLink size={10} /> Link
                      </a>
                    )}
                  </div>
                </div>
                {isMine && (
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
                )}
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
          );
        })}
      </div>

      {canEdit && (
        <PublicationEditModal
          teacherEmail={myEmail}
          existing={editing}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}

      <TeacherDetailModal
        teacherEmail={detailTeacherEmail}
        open={!!detailTeacherEmail}
        onClose={() => setDetailTeacherEmail(null)}
      />

      <SuggestPublicationModal
        open={suggestModalOpen}
        onClose={() => setSuggestModalOpen(false)}
      />
    </div>
  );
}
