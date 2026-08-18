// PublicationsBrowse.jsx
//
// Standalone "all publications, every teacher" browse page. Mounted at
// TWO routes with one `canEdit` prop difference:
//   /publications          (student side, Academic Core subgroup) — canEdit=false
//   /faculty/publications  (faculty side, Resources subgroup)     — canEdit=true
//
// canEdit only controls whether the "Suggest a publication" button
// shows (student-side entry point into SuggestPublicationModal — see
// below). Edit/delete controls on a row are governed separately by
// isMine (pub.teacherEmail === the viewer's own signed-in email),
// regardless of route or canEdit — a student who self-submitted their
// own publication (SuggestPublicationModal's "own publication" toggle)
// owns that doc exactly the way a teacher owns their own, and needs
// the same edit/delete affordance to manage it afterward. firestore.rules
// enforces the same ownership boundary server-side regardless, this is
// just the UI reflecting it. Browsing everyone else's publications stays
// read-only for everyone.
//
// Search is client-side over the already-subscribed collection (see
// facultyPublicationsSync.js's subscribeToAllPublications header for why
// this is fine at KUET's scale) — filters by title, author, teacher name,
// or department in one free-text box, plus a department dropdown.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../lib/firebase';
import { DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS } from '../store/store';
import {
  subscribeToAllPublications,
  deletePublication,
} from '../lib/facultyPublicationsSync';
import { notify } from '../lib/notify';
import PublicationEditModal from '../components/PublicationEditModal';
import SuggestPublicationModal from '../components/SuggestPublicationModal';
import PaperViewerPanel from '../components/PaperViewerPanel';

// Includes Institutes (IICT/IDM/IEPT) and Basic Science/Humanities depts
// (MATH/CHEM/PHY/HUM) alongside the 16 engineering Departments — without
// this, teachers in those units (e.g. Dr. Jamali in MATH) show a blank
// department name and can't be filtered to.
const DEPT_NAME_BY_CODE = Object.fromEntries(
  [...DEPARTMENTS, ...INSTITUTES, ...BASIC_SCIENCE_DEPTS].map((d) => [d.code, d.name])
);

export default function PublicationsBrowse({ canEdit = false }) {
  const navigate = useNavigate();
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);

  // In-app paper viewer for the "Paper" button on each list row — same
  // in-app-first / external-tab-fallback pattern as TeacherDetail.jsx's
  // "View paper" link, via the shared PaperViewerPanel.jsx component.
  const [viewingPaper, setViewingPaper] = useState(null);
  function openPaperInApp(pub) {
    setViewingPaper({ title: pub.title || pub.raw_citation, link: pub.link });
  }
  function closePaperPanel() {
    setViewingPaper(null);
  }

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
      if (mineOnly && (!myEmail || pub.teacherEmail !== myEmail)) return false;
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
  }, [pubs, searchText, deptFilter, mineOnly, myEmail]);

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
          <optgroup label="Departments">
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </optgroup>
          <optgroup label="Institutes">
            {INSTITUTES.map((i) => (
              <option key={i.code} value={i.code}>{i.name}</option>
            ))}
          </optgroup>
          <optgroup label="Basic Sciences">
            {BASIC_SCIENCE_DEPTS.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </optgroup>
        </select>
        {myEmail && (
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            title="Show only publications under your own account"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 10,
              border: mineOnly ? 'none' : '1px solid var(--border)',
              background: mineOnly ? 'var(--accent)' : 'var(--bg)',
              color: mineOnly ? '#fff' : 'var(--text)',
              fontSize: 13, fontWeight: 700, height: 40, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Icons.User size={14} /> আমার publications
          </button>
        )}
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading publications…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', padding: '30px 0', textAlign: 'center' }}>
          {mineOnly
            ? "You don't have any publications under your account yet."
            : 'No publications match your search.'}
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
          // "Mine" now means "I own this doc" (teacherEmail matches my
          // signed-in email), independent of the canEdit route prop.
          // canEdit historically gated this to the faculty route only,
          // but a student can now own a doc too (self-submitted via
          // SuggestPublicationModal's "own publication" path) and needs
          // the same edit/delete controls to manage what they published
          // — not just faculty managing their own scraped/added entries.
          const isMine = myEmail && pub.teacherEmail === myEmail;
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
                  {/* "View" — navigates to /teachers/:email (TeacherDetail.jsx),
                      on-site: teacher's photo/education/experience plus
                      every publication of theirs. Never navigates away
                      from our site. Disabled (not hidden) when a doc has
                      no teacherEmail, so the row still explains why. */}
                  <button
                    onClick={() => pub.teacherEmail && navigate(`/teachers/${pub.teacherEmail}`)}
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
                  {/* "Paper" — opens in-app first (same PaperViewerPanel
                      used by TeacherDetail.jsx's "View paper" link),
                      falling back to an external tab only if embedding
                      is blocked. Only a real button when pub.link
                      exists; most scraped citations don't have one
                      because the original KUET page didn't hyperlink the
                      title — not a bug, just missing source data. Shown
                      faded/disabled rather than hidden so the two-button
                      layout stays consistent row to row. */}
                  {pub.link ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openPaperInApp(pub); }}
                      style={{
                        fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, display: 'inline-flex',
                        alignItems: 'center', gap: 5, textDecoration: 'none', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px', background: 'transparent', cursor: 'pointer',
                      }}
                      title="Open the original publication page"
                    >
                      <Icons.ExternalLink size={12} /> Paper
                    </button>
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

      <PublicationEditModal
        teacherEmail={myEmail}
        existing={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <SuggestPublicationModal
        open={suggestModalOpen}
        onClose={() => setSuggestModalOpen(false)}
      />

      <PaperViewerPanel paper={viewingPaper} onClose={closePaperPanel} />
    </div>
  );
}
