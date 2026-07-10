import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Crown, Megaphone, Users } from 'lucide-react';
import * as noticeApi from '../lib/noticeUtils';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';

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

function NoticeCard({ n, isUnread, onOpen }) {
  const isFounder = n.isFounder;
  const content = (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: isFounder ? '16px 16px' : '13px 14px',
      borderRadius: 14,
      position: 'relative',
      border: isFounder
        ? '1.5px solid color-mix(in srgb, var(--accent) 55%, var(--border))'
        : `1px solid ${isUnread ? 'color-mix(in srgb, var(--accent) 30%, var(--border))' : 'var(--border)'}`,
      background: isFounder
        ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--surface)), var(--surface))'
        : isUnread ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
      boxShadow: isFounder ? '0 2px 10px color-mix(in srgb, var(--accent) 18%, transparent)' : 'none',
    }}>
      {isUnread && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isFounder && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
            color: '#fff', background: 'var(--accent)',
            borderRadius: 999, padding: '2px 8px', marginBottom: 6,
          }}>
            <Crown size={11} /> Founder
          </div>
        )}
        <div style={{
          fontSize: isFounder ? 15 : 13,
          fontWeight: isFounder ? 800 : 700,
          color: isFounder ? 'var(--accent)' : 'var(--text)',
        }}>
          {n.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.45 }}>{n.body}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          <span>{n.from}</span>
          <span>·</span>
          <span>{timeAgo(n.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  return n.link ? (
    <Link to={n.link} onClick={onOpen} style={{ textDecoration: 'none', display: 'block' }}>
      {content}
    </Link>
  ) : (
    <div onClick={onOpen} style={{ cursor: 'pointer' }}>
      {content}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
        <Icon size={14} color="var(--muted)" />
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
          {title}
        </span>
        {count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>({count})</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

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
  const isUnread = (id) => unread.some(u => u.id === id);

  const markRead = (id) => noticeApi.setNoticeRead(id, true);

  // Founder notices always float to the top of the Admin section, then
  // remaining admin notices, then class (CR/ACR) notices — each section
  // keeps its own newest-first order.
  const founderNotices = notices.filter(n => n.section === 'admin' && n.isFounder);
  const adminNotices = notices.filter(n => n.section === 'admin' && !n.isFounder);
  const classNotices = notices.filter(n => n.section === 'class');

  return (
    <div className="content-page-bg" style={{ padding: '20px 20px 48px', width: '100%', boxSizing: 'border-box' }}>
      <div className="content-page-hero" style={{ marginBottom: 6 }}>
        <div className="content-page-hero-icon">
          <Bell size={18} color="var(--accent)" />
        </div>
        <h1 className="content-page-hero-title">Notice</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>
        Announcements from Founder/Admin, and CR/ACR land here.
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0 24px',
          maxWidth: 1400,
        }}>
          <div>
            <Section icon={Crown} title="Founder" count={founderNotices.length}>
              {founderNotices.map(n => (
                <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} />
              ))}
            </Section>

            <Section icon={Megaphone} title="Admin" count={adminNotices.length}>
              {adminNotices.map(n => (
                <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} />
              ))}
            </Section>
          </div>

          <Section icon={Users} title="Class (CR / ACR)" count={classNotices.length}>
            {classNotices.map(n => (
              <NoticeCard key={n.id} n={n} isUnread={isUnread(n.id)} onOpen={() => markRead(n.id)} />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
