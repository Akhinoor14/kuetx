// TeacherDetailModal.jsx
//
// "View Details" popup opened from a publication row in
// PublicationsBrowse.jsx. Shows the author's full facultyDirectory
// record (designation, department, photo, education, experience) plus
// every publication of theirs in facultyPublications — all rendered
// from our own site, no outside navigation. This is read-only: no
// edit/delete controls live here even for the viewer's own account,
// because PublicationsBrowse.jsx already owns that via its own
// edit/delete buttons on rows where canEdit && isMine.
//
// Data source notes:
//   - facultyDirectory/{email} is scraper-owned (see
//     scripts/kuet_faculty_scraper.py), read-only from the client.
//   - subscribeToTeacherPublications (facultyPublicationsSync.js)
//     already exists and is reused as-is here.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subscribeToTeacherPublications } from '../lib/facultyPublicationsSync';
import Modal from './Modal';

const sectionTitle = {
  fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
};

/**
 * @param {string} teacherEmail - facultyDirectory doc id (normalized lowercase email)
 * @param {boolean} open
 * @param {() => void} onClose
 */
export default function TeacherDetailModal({ teacherEmail, open, onClose }) {
  const [directoryEntry, setDirectoryEntry] = useState(null);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [pubs, setPubs] = useState([]);
  const [loadingPubs, setLoadingPubs] = useState(true);

  useEffect(() => {
    if (!open || !teacherEmail) return;
    let cancelled = false;
    setLoadingDirectory(true);
    setDirectoryEntry(null);

    const normalizedEmail = String(teacherEmail).trim().toLowerCase();
    getDoc(doc(db, 'facultyDirectory', normalizedEmail))
      .then((snap) => {
        if (cancelled) return;
        setDirectoryEntry(snap.exists() ? snap.data() : null);
      })
      .catch(() => { if (!cancelled) setDirectoryEntry(null); })
      .finally(() => { if (!cancelled) setLoadingDirectory(false); });

    return () => { cancelled = true; };
  }, [open, teacherEmail]);

  useEffect(() => {
    if (!open || !teacherEmail) return;
    setLoadingPubs(true);
    const unsub = subscribeToTeacherPublications(
      teacherEmail,
      (list) => { setPubs(list); setLoadingPubs(false); },
      () => setLoadingPubs(false)
    );
    return unsub;
  }, [open, teacherEmail]);

  if (!open) return null;

  const profile = directoryEntry?.profileDetails || {};
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];

  return (
    <Modal onClose={onClose} contentStyle={{ maxWidth: 560, width: '92vw', maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', padding: 6, borderRadius: 8,
          }}
          aria-label="Close"
        >
          <Icons.X size={18} />
        </button>

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
                      <a
                        href={pub.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Icons.ExternalLink size={11} /> View publication link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
