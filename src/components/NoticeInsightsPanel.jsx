import { useEffect, useState } from 'react';
import { subscribeNoticeReadStats } from '../lib/noticeUtils';

/**
 * NoticeInsightsPanel — Phase 2 of the Notice upgrade, extended in
 * Phase 6.
 *
 * Small "reach vs read (vs acknowledged)" widget shown under a sender's
 * own notice card in ClassRoster.jsx / FacultyNoticeBroadcast.jsx /
 * AdminDashboard.jsx's "Sent notices" lists. Live-subscribes to the
 * notice's reads/{uid} subcollection via subscribeNoticeReadStats() and
 * renders:
 *   - a read-count vs audienceSize progress bar (when audienceSize is
 *     known — see AdminDashboard's computeAudienceSize comment; older
 *     notices sent before Phase 1 may not have it, in which case we just
 *     show the raw read count with no bar/percentage)
 *   - Phase 6: an "X read, Y acknowledged" secondary line — only shown
 *     when at least one reader has acknowledged, since most notices
 *     (Admin broadcasts especially) never show the "Got it" button at
 *     all and acknowledgedCount will always be 0 for those; no reason to
 *     clutter every card with "0 acknowledged"
 *   - a collapsible list of readers (name, roll, relative read time,
 *     a small ✅ mark next to anyone who's acknowledged)
 *
 * Firestore rules restrict reads/{uid} reads to the notice's own sender
 * (or Admin/CL) — subscribeNoticeReadStats() already fails quietly
 * (empty stats) for anyone else, so this component never needs to know
 * or check who's allowed to see it; it just renders whatever comes back.
 *
 * Props:
 *   noticeId      {string}         required
 *   groupId       {string|null}    null/undefined for a global/root notice
 *   audienceSize  {number|null}    total intended recipients, if known
 *   title         {string}         notice title, only used for the
 *                                   reader-list toggle's aria-label
 */
export default function NoticeInsightsPanel({ noticeId, groupId = null, audienceSize = null, title = '' }) {
  const [stats, setStats] = useState({ count: 0, acknowledgedCount: 0, readers: [] });
  const [expanded, setExpanded] = useState(false);

  // NOTE (audit finding, not fixed here — needs a decision): this file's
  // own doc-comment above, and the original plan's Phase 2/6 completion
  // notes, both claim the subscription is "gated by `expanded`" so a
  // listener only opens once a sender clicks "Details". That was never
  // actually true — this subscribes unconditionally on mount. Since this
  // component is rendered once per item inside a .map() over EVERY sent
  // notice (ClassRoster.jsx, FacultyNoticeBroadcast.jsx,
  // AdminDashboard.jsx), a sender with e.g. 30 sent notices has 30 live
  // Firestore listeners open the moment that page loads, not 0-1. Two
  // real options, trading off differently:
  //   (a) gate on `expanded` (true "only while Details is open") — cheap,
  //       but the collapsed summary line ("Read by X of Y") can no longer
  //       show a live number; it'd have to read 0 or "—" until expanded.
  //   (b) keep it live for the summary line, but only fetch the FULL
  //       reader list (name/roll/timestamps) when expanded — via a
  //       one-time getDocs() on expand instead of onSnapshot, or a
  //       lighter always-on counter doc if send volume ever gets large.
  // Left as-is (always-on) pending that product decision — flagging here
  // rather than silently picking one, since it changes what a sender
  // sees before they've clicked anything.
  useEffect(() => {
    const unsub = subscribeNoticeReadStats(noticeId, groupId, setStats);
    return unsub;
  }, [noticeId, groupId]);

  const hasAudience = typeof audienceSize === 'number' && audienceSize > 0;
  const pct = hasAudience ? Math.min(100, Math.round((stats.count / audienceSize) * 100)) : null;
  const hasAcknowledgements = stats.acknowledgedCount > 0;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={`${expanded ? 'Hide' : 'Show'} read receipts for: ${title}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', gap: 8,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>
            {hasAudience
              ? `Read by ${stats.count} of ${audienceSize} (${pct}%)`
              : `Read by ${stats.count} · Reach data not available`}
          </span>
          {hasAcknowledgements && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent)' }}>
              {stats.count} read, {stats.acknowledgedCount} acknowledged
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>
          {expanded ? 'Hide' : 'Details'}
        </span>
      </button>

      {hasAudience && (
        <div
          style={{
            marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%', width: `${pct}%`, borderRadius: 2,
              background: 'var(--accent)', transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {stats.readers.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No one has read this yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
              {stats.readers.map((r) => (
                <div
                  key={r.uid}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    fontSize: 11.5, padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                  }}
                >
                  <span style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {r.name}{r.roll ? ` · ${r.roll}` : ''}
                    {r.acknowledged && (
                      <span title="Acknowledged" style={{ fontSize: 10.5, flexShrink: 0 }}>✅</span>
                    )}
                  </span>
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{formatRelativeTime(r.readAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}
