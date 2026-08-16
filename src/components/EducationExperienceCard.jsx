// EducationExperienceCard.jsx
//
// Shows the SIGNED-IN teacher's own scraped education/experience on
// FacultyProfile.jsx — this data (facultyDirectory/{institutionalEmail}
// .profileDetails.education / .experience) has existed since the
// scraper session but was never surfaced anywhere on the profile page
// itself (only TeacherDetailModal.jsx, opened from the public
// /publications browse page, showed it for OTHER teachers). Same data
// source, same read-only display, just mounted where the owner can
// actually see their own scraped info.
//
// Looked up by INSTITUTIONAL email, not the Google login email —
// facultyDirectory is keyed by the official *.kuet.ac.bd address the
// scraper found on KUET's own site (see facultyDirectoryMatch.js), which
// is stored on the private faculty/{uid}/private/verification sub-doc,
// not on auth.currentUser.email. A teacher who hasn't set an
// institutional email yet (or whose scrape hasn't run/matched) simply
// sees nothing — this card renders null rather than an empty-state card,
// since "not scraped yet" isn't something the owner needs to act on here
// (Publications already has its own manual "Add Publication" escape
// hatch for exactly that situation).
//
// Read-only: no edit controls, matching TeacherDetailModal's philosophy
// that this is officially-sourced KUET data, not something to fork state
// on inside the app. If an entry is wrong/outdated, that's a KUET
// website correction, not an in-app edit.

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getFacultyInstitutionalEmail } from '../lib/facultySync';

const sectionTitle = {
  fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: 0.4, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
};

/** @param {string} uid - signed-in faculty account's own uid */
export default function EducationExperienceCard({ uid }) {
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let cancelled = false;

    getFacultyInstitutionalEmail(uid)
      .then((institutionalEmail) => {
        const normalizedEmail = String(institutionalEmail || '').trim().toLowerCase();
        if (!normalizedEmail) return null;
        return getDoc(doc(db, 'facultyDirectory', normalizedEmail));
      })
      .then((snap) => {
        if (cancelled) return;
        const profile = snap?.exists() ? (snap.data()?.profileDetails || {}) : {};
        setEducation(Array.isArray(profile.education) ? profile.education : []);
        setExperience(Array.isArray(profile.experience) ? profile.experience : []);
      })
      .catch(() => { if (!cancelled) { setEducation([]); setExperience([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid]);

  // Nothing scraped/matched yet — render nothing rather than an empty
  // card (see file header for why).
  if (loading || (education.length === 0 && experience.length === 0)) return null;

  return (
    <div className="card" style={{ padding: 16, borderRadius: 12, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icons.GraduationCap size={18} color="var(--accent)" />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
          Education & Experience
        </h3>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
        Pulled from your official KUET department profile page. If anything here is out of date,
        it needs to be corrected on the KUET website itself — this app only mirrors it.
      </div>

      {education.length > 0 && (
        <div style={{ marginBottom: experience.length > 0 ? 18 : 0 }}>
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

      {experience.length > 0 && (
        <div>
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
    </div>
  );
}
