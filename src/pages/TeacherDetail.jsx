// TeacherDetail.jsx
//
// PHASE 3: routed version of TeacherDetailModal.jsx. Full teacher profile
// (facultyDirectory record: designation, department, photo, education,
// experience) plus every publication of theirs (facultyPublications) —
// all rendered from our own site, no outside navigation. Read-only: no
// edit/delete controls live here even for the viewer's own account,
// same as the modal it replaces (PublicationsBrowse.jsx already owns
// that via its own edit/delete buttons on rows where canEdit && isMine).
//
// Mounted at /teachers/:email. Takes `email` from useParams() instead of
// a teacherEmail prop, and is a normal routed page instead of a
// full-viewport Modal hack — uses the same page-container/hero pattern
// as Teachers.jsx for visual consistency.
//
// Directory fetch: getFacultyDirectoryEntry (facultyDirectoryCache.js) —
// near-instant on a warm cache, and it ALREADY falls back to a direct
// single-doc getDoc() internally when an email isn't in the cached set
// (e.g. deep-linked before the first cache warm, or a stale cache
// missing a brand-new teacher), so a shared/bookmarked link never
// dead-ends. No separate fallback needed here — just call it.
//
// Publications: subscribeToTeacherPublications, unchanged from the modal
// — small, per-teacher live query, no cost concern.
// Paper viewing: PaperViewerPanel, unchanged from the modal.
//
// Back navigation: navigate(-1) so it returns to wherever the visitor
// came from (the directory list, a publication row, a course page),
// falling back to /teachers only if there's no history entry (e.g. a
// fresh deep link with nothing to go back to).

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { getFacultyDirectoryEntry } from '../lib/facultyDirectoryCache';
import { subscribeToTeacherPublications } from '../lib/facultyPublicationsSync';
import PaperViewerPanel from '../components/PaperViewerPanel';

const sectionTitle = {
  fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
};

export default function TeacherDetail() {
  const { email } = useParams();
  const navigate = useNavigate();

  const [directoryEntry, setDirectoryEntry] = useState(null);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [pubs, setPubs] = useState([]);
  const [loadingPubs, setLoadingPubs] = useState(true);

  // In-app paper viewer panel — same {title, link} shape and mechanics
  // as the modal it replaces; PaperViewerPanel.jsx itself is unchanged.
  const [viewingPaper, setViewingPaper] = useState(null);
  function openPaperInApp(pub) {
    setViewingPaper({ title: pub.title || pub.raw_citation, link: pub.link });
  }
  function closePaperPanel() {
    setViewingPaper(null);
  }

  function goBack() {
    // navigate(-1) returns to wherever the visitor came from; if there's
    // no history entry (fresh deep link), history.state.idx is 0 in
    // react-router's browser history and there's nothing to go back to,
    // so fall back to the /teachers list instead of leaving the app.
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/teachers');
  }

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    setLoadingDirectory(true);
    setDirectoryEntry(null);

    const normalizedEmail = String(email).trim().toLowerCase();

    getFacultyDirectoryEntry(normalizedEmail)
      .then((entry) => { if (!cancelled) setDirectoryEntry(entry); })
      .catch(() => { if (!cancelled) setDirectoryEntry(null); })
      .finally(() => { if (!cancelled) setLoadingDirectory(false); });

    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    if (!email) return undefined;
    setLoadingPubs(true);
    const unsub = subscribeToTeacherPublications(
      email,
      (list) => { setPubs(list); setLoadingPubs(false); },
      () => setLoadingPubs(false)
    );
    return unsub;
  }, [email]);

  const profile = directoryEntry?.profileDetails || {};
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <button
              onClick={goBack}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--muted)', cursor: 'pointer', padding: 8, borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', marginRight: 4,
              }}
              aria-label="Back"
            >
              <Icons.ArrowLeft size={18} />
            </button>
            <div className="content-page-hero-icon">
              <Icons.User size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Teacher Profile</h1>
          </div>
          <p className="content-page-hero-subtitle">Directory info and publications, all on-site</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {loadingDirectory && (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0' }}>Loading teacher info…</div>
        )}

        {!loadingDirectory && !directoryEntry && (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0' }}>
            Couldn't find this teacher's directory record.
          </div>
        )}

        {!loadingDirectory && directoryEntry && (
          <>
            {/* Identity header */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
              {directoryEntry.photo_url ? (
                <img
                  src={directoryEntry.photo_url}
                  alt={directoryEntry.name}
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0, background: 'var(--card)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icons.User size={24} color="var(--muted)" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{directoryEntry.name}</div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>
                  {directoryEntry.designation}
                  {directoryEntry.department ? ` · ${directoryEntry.department}` : ''}
                </div>
                {directoryEntry.email && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{directoryEntry.email}</div>
                )}
              </div>
            </div>

            {/* Education */}
            {education.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}><Icons.GraduationCap size={13} /> Education</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {education.map((entry, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {experience.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}><Icons.Briefcase size={13} /> Experience</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {experience.map((entry, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Publications */}
            <div>
              <div style={sectionTitle}>
                <Icons.BookMarked size={13} /> Publications {!loadingPubs ? `(${pubs.length})` : ''}
              </div>
              {loadingPubs && (
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading publications…</div>
              )}
              {!loadingPubs && pubs.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No publications on record.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pubs.map((pub) => (
                  <div key={pub.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                      {pub.title || pub.raw_citation}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                      {[pub.venue, pub.year].filter(Boolean).join(' · ')}
                    </div>
                    {pub.link && (
                      <button
                        type="button"
                        onClick={() => openPaperInApp(pub)}
                        style={{
                          fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginTop: 4, display: 'inline-flex',
                          alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                        }}
                      >
                        <Icons.FileText size={11} /> View paper
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* In-app paper panel — same shared component as before. */}
        <PaperViewerPanel paper={viewingPaper} onClose={closePaperPanel} />
      </div>
    </div>
  );
}
