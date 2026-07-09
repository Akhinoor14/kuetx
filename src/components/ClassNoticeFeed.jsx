import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, X } from 'lucide-react';
import { subscribeGroupNotices } from '../lib/groupSync';

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

/**
 * Class-only (CR/ACR-posted) notice feed for Classmates.jsx — deliberately
 * separate from ClassNoticesPanel.jsx (which lives on Alerts.jsx and mixes
 * in global/admin announcements too). This one shows ONLY this class's own
 * notices: the latest one as a headline card up top, older ones as a
 * clickable headline list below it — clicking ANY headline (latest or
 * older) opens a modal panel with that notice's full text, sender, and
 * timestamp. Nothing expands in place; the list only ever shows headlines.
 */
export default function ClassNoticeFeed({ groupId }) {
  const [notices, setNotices] = useState([]);
  const [openNotice, setOpenNotice] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    return subscribeGroupNotices(groupId, setNotices);
  }, [groupId]);

  const sorted = useMemo(
    () => (notices || []).slice().sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [notices],
  );

  if (sorted.length === 0) return null;

  const [latest, ...older] = sorted;

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

      {/* Latest — headline card, always visible, click to read full */}
      <button
        onClick={() => setOpenNotice(latest)}
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '12px 14px', borderRadius: 12, border: '1px solid var(--accent)',
          background: 'var(--accentSoft)', font: 'inherit',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{latest.title}</div>
        <div style={{
          fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {latest.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>— {latest.postedBy?.name || 'Unknown'}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateTime(latest.createdAt)}</span>
        </div>
      </button>

      {/* Older — headline-only list, click any row to open it in the same modal */}
      {older.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {older.map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenNotice(n)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                padding: '8px 10px', borderRadius: 8, border: '1px solid transparent',
                background: 'transparent', color: 'var(--text)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{formatDateTime(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}

      {modal}
    </div>
  );
}
