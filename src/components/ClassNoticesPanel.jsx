import { useEffect, useMemo, useState } from 'react';
import { getProfile, store } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { subscribeGroupNotices, subscribeGlobalNotices, noticeAppliesTo } from '../lib/groupSync';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function ClassNoticesPanel() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);

  const [groupNotices, setGroupNotices] = useState([]);
  const [globalNotices, setGlobalNotices] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => store.get('lastSeenNoticeAt') || 0);

  useEffect(() => subscribeGlobalNotices(setGlobalNotices), []);
  useEffect(() => {
    if (!groupId) return;
    return subscribeGroupNotices(groupId, setGroupNotices);
  }, [groupId]);

  const combined = useMemo(() => {
    const applicableGlobal = globalNotices.filter((n) => noticeAppliesTo(n, profile, groupId));
    const merged = [
      ...groupNotices.map((n) => ({ ...n, _source: 'class', _title: n.title, _body: n.body, _by: n.postedBy, _at: n.createdAt })),
      ...applicableGlobal.map((n) => ({ ...n, _source: 'global', _title: n.title, _body: n.body, _by: n.createdBy, _at: n.createdAt })),
    ];
    return merged.sort((a, b) => toMillis(b._at) - toMillis(a._at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupNotices, globalNotices, groupId]);

  const unreadCount = combined.filter((n) => toMillis(n._at) > lastSeen).length;

  const markAllRead = () => {
    const now = Date.now();
    store.set('lastSeenNoticeAt', now);
    setLastSeen(now);
  };

  if (combined.length === 0) return null;

  return (
    <div style={{
      marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
      boxShadow: '0 10px 28px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
            📢 Notices {unreadCount > 0 && <span style={{ color: 'var(--accent)' }}>({unreadCount} new)</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Admin announcements{groupId ? <> and updates from {groupLabel}</> : ''}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {combined.slice(0, 20).map((n) => (
          <div key={`${n._source}-${n.id}`} style={{
            padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)',
            background: toMillis(n._at) > lastSeen ? 'var(--accentSoft)' : 'var(--surface)', fontSize: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{n._title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                {n._source === 'global' ? 'Admin' : 'Class'}
              </span>
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{n._body}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              — {n._by?.name || 'Unknown'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
