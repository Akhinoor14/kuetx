// TeacherClaimBanner.jsx — §8.7 of the merged Faculty Module prompt
//
// Standalone banner, NOT wired into Schedule.jsx's own render tree (that
// file was deliberately left untouched — see facultyDisambiguation.js's
// header for the full corrected reasoning). This component can be dropped
// onto any page a CR visits (Schedule, ClassManagement, etc.) via a plain
// import + one render call, the same "additive, not invasive" pattern
// used throughout this module (e.g. TeacherVerifiedCard.jsx on Marks.jsx).
//
// UX pattern deliberately mirrors ClaimCRCard.jsx per §8.7's own
// instruction: shows nothing until a match resolves, offers a lightweight
// "link"/"not now" choice, and declining leaves everything exactly as it
// was (free-text teacherName keeps working normally either way).

import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { subscribeRoutine } from '../lib/groupSync';
import { findMatchingFacultyForSchedule } from '../lib/facultyDisambiguation';

const DISMISSED_KEY_PREFIX = 'kuetx_teacherClaimDismissed_';

export default function TeacherClaimBanner({ groupId }) {
  const [matches, setMatches] = useState(new Map());
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY_PREFIX + groupId);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!groupId) return;
    return subscribeRoutine(groupId, (entries) => {
      findMatchingFacultyForSchedule(groupId, entries || []).then(setMatches);
    });
  }, [groupId]);

  const dismiss = (entryId) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(entryId);
      try { localStorage.setItem(DISMISSED_KEY_PREFIX + groupId, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const visibleMatches = [...matches.entries()].filter(([entryId]) => !dismissedIds.has(entryId));
  if (visibleMatches.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
      {visibleMatches.map(([entryId, assignment]) => (
        <div key={entryId} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          padding: '10px 12px', borderRadius: 10,
          background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
            <Link2 size={14} color="var(--accent)" />
            <span>
              <strong>{assignment.gridAlias || assignment.displayName}</strong> matches a verified faculty account for {assignment.courseCode} — attendance/marks from them will now show up automatically.
            </span>
          </div>
          <button
            onClick={() => dismiss(entryId)}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, flexShrink: 0 }}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
