import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import * as noticeApi from '../lib/noticeUtils';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';

export default function Notice() {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handle = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handle);
    return () => window.removeEventListener('kuetx:store-updated', handle);
  }, []);

  const profile = useMemo(() => getProfile() || {}, [refreshTick]);
  const groupId = useMemo(() => getGroupId(profile), [profile]);

  const readIds = useMemo(() => noticeApi.getReadNoticeIds(), [refreshTick]);

  // Live notice feed (global admin broadcasts + group CR/ACR notices).
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    return noticeApi.subscribeAllNotices(profile, groupId, setNotices);
  }, [profile, groupId]);

  const unread = noticeApi.getUnreadNotices(notices, readIds);

  const markRead = (id) => noticeApi.setNoticeRead(id, true);

  return (
    <div className="content-page-bg" style={{ padding: '20px 16px 40px', maxWidth: 720, margin: '0 auto' }}>
      <div className="content-page-hero" style={{ marginBottom: 6 }}>
        <div className="content-page-hero-icon">
          <Bell size={18} color="var(--accent)" />
        </div>
        <h1 className="content-page-hero-title">Notice</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>
        Announcements from Admin, CR/ACR, and Campus Lead land here.
      </p>

      {notices.length === 0 ? (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>All clear!</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No notices yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notices.map(n => {
            const isUnread = unread.some(u => u.id === n.id);
            const content = (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 12,
                border: `1px solid ${isUnread ? 'color-mix(in srgb, var(--accent) 30%, var(--border))' : 'var(--border)'}`,
                background: isUnread ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
              }}>
                {isUnread && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{n.from}</div>
                </div>
              </div>
            );

            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => markRead(n.id)} style={{ textDecoration: 'none' }}>
                {content}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markRead(n.id)} style={{ cursor: 'pointer' }}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
