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
    const matches = pubs.filter((pub) => {
      if (deptFilter && pub.teacherDeptCode !== deptFilter) return false;
      if (!text) return true;
      const haystack = [pub.title, pub.authors, pub.venue, pub.teacherName, pub.raw_citation]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(text);
    });
    // Publications without a link (pub.link falsy) always sort to the
    // bottom, regardless of search/department filter — a stable sort so
    // within each group (has-link / no-link) the original order is kept.
    return [...matches].sort((a, b) => {
      const aHasLink = a.link ? 0 : 1;
      const bHasLink = b.link ? 0 : 1;
      return aHasLink - bHasLink;
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

      {/* pub-actions: desktop → fixed column on the right of the row
          (see .pub-row layout below). Under 560px → drops to a full-width
          row directly under the title/teacher block, buttons split 50/50. */}
      <style>{`
        .pub-row { display: flex; justify-content: space-between; gap: 14px; }
        .pub-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
        .pub-actions button, .pub-actions a, .pub-actions span { justify-content: center; white-space: nowrap; }
        @media (max-width: 560px) {
          .pub-row { flex-direction: column; }
          .pub-actions { flex-direction: row; width: 100%; margin-top: 10px; }
          .pub-actions button, .pub-actions a, .pub-actions span { flex: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((pub) => {
          const isMine = canEdit && myEmail && pub.teacherEmail === myEmail;
          return (
            <div
              key={pub.id}
              className="card"
              style={{ padding: 14, borderRadius: 12 }}
            >
              <div className="pub-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {pub.title || pub.raw_citation}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {[pub.venue, pub.year].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                    {pub.teacherName || pub.teacherEmail}
                    {pub.teacherDeptCode && DEPT_NAME_BY_CODE[pub.teacherDeptCode]
                      ? ` · ${DEPT_NAME_BY_CODE[pub.teacherDeptCode]}` : ''}
                  </div>
                  {isMine && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
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

                {/* Two clearly-labeled actions, always in this order:
                    "View" (on-site teacher profile) then "Paper" (external
                    source link). Desktop: fixed column, right side of the
                    row. Mobile (<560px, see .pub-actions above): drops to
                    a full-width row directly under the text block. */}
                <div className="pub-actions">
                  {/* "View" — opens TeacherDetailModal, on-site: teacher's
                      photo/education/experience plus every publication of
                      theirs (see TeacherDetailModal.jsx). Never navigates
                      away from our site. Disabled (not hidden) when a doc
                      has no teacherEmail, so the row still explains why. */}
                  <button
                    onClick={() => pub.teacherEmail && setDetailTeacherEmail(pub.teacherEmail)}
                    disabled={!pub.teacherEmail}
                    style={{
                      fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5,
                      color: pub.teacherEmail ? 'var(--accent)' : 'var(--muted)',
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '5px 10px', cursor: pub.teacherEmail ? 'pointer' : 'default',
                      opacity: pub.teacherEmail ? 1 : 0.5,
                    }}
                    title={pub.teacherEmail ? "View teacher's profile and publications" : "Teacher record unavailable"}
                  >
                    <Icons.User size={12} /> View
                  </button>
                  {/* "Paper" — direct external link to the source (DOI /
                      publisher page). Only a real link when pub.link
                      exists; most scraped citations don't have one
                      because the original KUET page didn't hyperlink the
                      title — not a bug, just missing source data. Shown
                      faded/disabled rather than hidden so the two-button
                      layout stays consistent row to row. */}
                  {pub.link ? (
                    <a
                      href={pub.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', gap: 5, textDecoration: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px',
                      }}
                      title="Open the original publication page"
                    >
                      <Icons.ExternalLink size={12} /> Paper
                    </a>
                  ) : (
                    <span
                      style={{
                        fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', gap: 5, border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px', opacity: 0.45,
                      }}
                      title="No external link on record for this publication"
                    >
                      <Icons.ExternalLink size={12} /> Paper
                    </span>
                  )}
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
