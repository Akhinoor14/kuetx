import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, X } from 'lucide-react';
import { subscribeGroupNotices, subscribeMyRole } from '../lib/groupSync';
import { getReadNoticeIds, setNoticeRead, filterStudentFacingNotices } from '../lib/noticeUtils';
import { auth } from '../lib/firebase';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatDateTime(ts) {
  const ms = toMillis(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Same relative-time formatting as Notice.jsx ("5m ago", "2h ago", ...)
// so a notice reads the same whether it's seen here or on the main
// Notice page.
function timeAgo(ts) {
  const ms = toMillis(ts);
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

/**
 * Class-only (CR/ACR-posted) notice feed for Classmates.jsx — deliberately
 * separate from ClassNoticesPanel.jsx (which lives on Alerts.jsx and mixes
 * in global/admin announcements too). This one shows ONLY this class's own
 * notices: the latest one as a headline card up top, older ones as a
 * clickable headline list below it — clicking ANY headline (latest or
 * older) opens a modal panel with that notice's full text, sender, and
 * timestamp. Nothing expands in place; the list only ever shows headlines.
 *
 * Visual language matches Notice.jsx (src/pages/Notice.jsx): accent-tinted
 * background + left unread dot for unread cards, "sender · Xm ago" meta
 * row, same card radius/border treatment — so a notice looks the same
 * whether it's read here or on the main Notice page. Read state is shared
 * with Notice.jsx via the same localStorage-backed getReadNoticeIds /
 * setNoticeRead helpers, so marking a notice read here also marks it read
 * there (and vice versa).
 */
export default function ClassNoticeFeed({ groupId }) {
  const [notices, setNotices] = useState([]);
  const [isViewerCR, setIsViewerCR] = useState(false);
  const [openNotice, setOpenNotice] = useState(null);
  // Bumped whenever a notice gets marked read, purely to force a re-read
  // of getReadNoticeIds() (which itself reads localStorage synchronously,
  // so there's nothing async to await here).
  const [readTick, setReadTick] = useState(0);

  useEffect(() => {
    if (!groupId) return;
    return subscribeGroupNotices(groupId, setNotices);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsViewerCR(false); return; }
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsViewerCR(role === 'cr' || role === 'acr');
    });
  }, [groupId]);

  const visibleNotices = useMemo(
    () => filterStudentFacingNotices(notices, isViewerCR),
    [notices, isViewerCR],
  );

  const readIds = useMemo(() => getReadNoticeIds(), [readTick]);
  const isUnread = (id) => !readIds.includes(id);

  const markRead = (n) => {
    setNoticeRead(n.id, true);
    setReadTick((t) => t + 1);
    setOpenNotice(n);
  };

  const sorted = useMemo(
    () => (visibleNotices || []).slice().sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [visibleNotices],
  );

  if (sorted.length === 0) return null;

  const [latest, ...older] = sorted;
  const latestUnread = isUnread(latest.id);

  const modal = openNotice ? createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100001, padding: 16,
      }}
      onClick={() => setOpenNotice(null)}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          padding: 20, background: 'var(--bg)', borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={16} color="var(--accent)" />
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{openNotice.title}</div>
          </div>
          <button
            onClick={() => setOpenNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
          {openNotice.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>— {openNotice.postedBy?.name || 'Unknown'}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateTime(openNotice.createdAt)}</span>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div style={{
      marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Megaphone size={16} color="var(--accent)" />
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Class Notices</div>
      </div>

      {/* Latest — headline card, always visible, click to read full.
          Accent-tinted background + left unread dot when unread, matching
          NoticeCard's isUnread treatment in Notice.jsx. */}
      <button
        onClick={() => markRead(latest)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '13px 14px', borderRadius: 14, font: 'inherit',
          border: `1px solid ${latestUnread ? 'color-mix(in srgb, var(--accent) 30%, var(--border))' : 'var(--border)'}`,
          background: latestUnread ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
        }}
      >
        {latestUnread && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{latest.title}</div>
          <div style={{
            fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {latest.body}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            <span>{latest.postedBy?.name || 'Unknown'}</span>
            <span>·</span>
            <span>{timeAgo(latest.createdAt)}</span>
          </div>
        </div>
      </button>

      {/* Older — headline-only list, click any row to open it in the same
          modal. Unread rows get the same left dot + accent-tinted title
          as the latest card, just at a more compact row height. */}
      {older.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {older.map((n) => {
            const unread = isUnread(n.id);
            return (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  padding: '8px 10px', borderRadius: 8, border: '1px solid transparent',
                  background: unread ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
                  color: 'var(--text)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = unread ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                {unread && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontSize: 12, fontWeight: unread ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                }}>
                  {n.title}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
              </button>
            );
          })}
        </div>
      )}

      {modal}
    </div>
  );
}