import { flattenNoticePreview } from '../lib/noticeFormat';
import { roleAccentFor } from './NoticeReader';

function timeAgo(ms) {
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

function TimelineItem({ n, isUnread, isActive, onClick }) {
  const accent = roleAccentFor(n);
  const preview = flattenNoticePreview(n.body || '');

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 13px 12px 12px', borderRadius: 10,
        border: 'none', borderLeft: `3.5px solid ${accent}`,
        background: isActive
          ? 'color-mix(in srgb, ' + accent + ' 12%, var(--surface))'
          : 'var(--surface)',
        cursor: 'pointer', marginBottom: 6,
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        {isUnread && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 12.5, fontWeight: isUnread ? 800 : 700, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {n.title}
        </span>
      </div>
      <div style={{
        fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {preview}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: accent }}>{n.from}</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>·</span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{timeAgo(n.createdAt)}</span>
      </div>
    </button>
  );
}

export default function NoticeTimeline({ notices, activeId, isUnread, onSelect }) {
  if (notices.length === 0) {
    return (
      <div style={{ padding: '32px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No notices to show.</div>
      </div>
    );
  }
  return (
    <div>
      {notices.map((n) => (
        <TimelineItem
          key={n.id}
          n={n}
          isUnread={isUnread(n.id)}
          isActive={n.id === activeId}
          onClick={() => onSelect(n)}
        />
      ))}
    </div>
  );
}
