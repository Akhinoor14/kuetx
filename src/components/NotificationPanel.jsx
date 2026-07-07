import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import * as noticeApi from '../lib/noticeUtils';
import * as alertApi from '../lib/alertUtils';
import { computeAlerts } from '../lib/alertUtils';
import { getProfile } from '../store/store';

/**
 * Top-bar bell dropdown. Single time-sorted list (newest first) mixing:
 *  - Notice items (admin/CR/ACR/Campus Lead broadcasts) — real createdAt.
 *  - Alert items (Critical + Warnings + Assignments only — Positives are
 *    not actionable and stay off this panel) — real "first seen" time,
 *    stamped once per alert id and persisted (see
 *    alertUtils.getOrStampAlertFirstSeenAt), since alerts are computed
 *    live from current state and have no inherent event timestamp.
 *
 * Notice is the higher-priority channel: it wins ties/near-ties in the
 * time sort, and its rows get a slightly bolder visual treatment (accent
 * left border, larger tag, semi-bold title) so it reads as more
 * important even inside a fully mixed, time-ordered list.
 */

const ALERT_TAGS = {
  critical: { label: 'Critical', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  warnings: { label: 'Warning', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  assignmentAlerts: { label: 'Assignment', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
};
const NOTICE_TAG = { label: 'Notice', color: 'var(--accent)', bg: 'var(--accentBg)' };

function buildMergedItems(profile, dismissedAlertIds, readNoticeIds, firstSeenMap) {
  const notices = noticeApi.getNotices();
  const noticeItems = notices.map(n => ({
    id: `notice:${n.id}`,
    kind: 'notice',
    tag: NOTICE_TAG,
    title: n.title,
    link: n.link || '/notice',
    isUnread: !readNoticeIds.has(n.id),
    at: n.createdAt || 0,
    markRead: () => noticeApi.setNoticeRead(n.id, true),
  }));

  const rawAlerts = computeAlerts(profile);
  const decorated = alertApi.decorateAlerts(rawAlerts, dismissedAlertIds);
  const alertGroups = ['critical', 'warnings', 'assignmentAlerts'];
  const allAlertItems = alertGroups.flatMap(group => decorated[group].map(item => ({ group, item })));

  const alertItems = allAlertItems.map(({ group, item }) => ({
    id: `alert:${item.id}`,
    kind: 'alert',
    tag: ALERT_TAGS[group],
    title: item.msg,
    link: item.link || '/alerts',
    isUnread: !dismissedAlertIds.has(item.id),
    at: firstSeenMap.get(item.id) || 0,
    markRead: () => alertApi.setAlertDismissed(item.id, true),
  }));

  // Single time-sorted list (newest first) using real timestamps for both:
  // Notice uses its real createdAt, Alert uses its real first-seen-at
  // (stamped once, persisted, reused on later renders). On a tie or when
  // timestamps land close together, Notice wins — it's the higher-priority
  // channel (admin/CR/CL broadcasts vs. auto-computed academic flags).
  return [...noticeItems, ...alertItems].sort((a, b) => {
    if (b.at !== a.at) return b.at - a.at;
    if (a.kind !== b.kind) return a.kind === 'notice' ? -1 : 1;
    return 0;
  });
}

export function NotificationPanel({ isOpen, onClose }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handle);
    return () => window.removeEventListener('kuetx:store-updated', handle);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // mount on next frame so the CSS transition actually plays
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
    setMounted(false);
  }, [isOpen]);

  const profile = useMemo(() => getProfile() || {}, [refreshTick]);
  const dismissedAlertIds = useMemo(() => alertApi.getDismissedAlertIds(), [refreshTick]);
  const readNoticeIds = useMemo(() => noticeApi.getReadNoticeIds(), [refreshTick]);

  // Stamping (a write) happens here, in an effect, not during the render-time
  // useMemo below — store.set() dispatches kuetx:store-updated, which this
  // panel also listens to, so doing it at render time would trigger an
  // avoidable extra render cycle.
  const [firstSeenMap, setFirstSeenMap] = useState(() => new Map());
  useEffect(() => {
    const profile = getProfile() || {};
    const decorated = alertApi.decorateAlerts(computeAlerts(profile), dismissedAlertIds);
    const ids = ['critical', 'warnings', 'assignmentAlerts']
      .flatMap(group => decorated[group].map(item => item.id));
    setFirstSeenMap(alertApi.getOrStampAlertFirstSeenAt(ids));
  }, [dismissedAlertIds, refreshTick]);

  const items = useMemo(
    () => buildMergedItems(profile, dismissedAlertIds, readNoticeIds, firstSeenMap),
    [profile, dismissedAlertIds, readNoticeIds, firstSeenMap]
  );

  const visibleItems = filter === 'unread' ? items.filter(i => i.isUnread) : items;
  const unreadCount = items.filter(i => i.isUnread).length;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e) => {
      const panel = document.getElementById('notification-panel');
      const bell = document.getElementById('notification-bell');
      if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes notifPanelIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', zIndex: 999 }} />
      <div
        id="notification-panel"
        style={{
          position: 'fixed', top: 60, right: 16,
          width: 'min(360px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 100px)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.20)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          transformOrigin: 'top right',
          animation: mounted ? 'notifPanelIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Notifications</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'color 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.color='var(--text)'} onMouseLeave={(e)=>e.currentTarget.style.color='var(--muted)'}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          {['all', 'unread'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                border: '1px solid var(--border)',
                background: filter === f ? 'var(--accent)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--muted)',
                borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'All'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {visibleItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>All clear!</div>
              <div style={{ fontSize: 12 }}>{filter === 'unread' ? 'No unread items.' : 'Nothing to review right now.'}</div>
            </div>
          ) : (
            visibleItems.map(item => {
              const isNotice = item.kind === 'notice';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'stretch', gap: 8, padding: '8px 10px',
                    borderRadius: 10, marginBottom: 6, background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderLeft: isNotice ? '3px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <Link
                    to={item.link}
                    onClick={() => { item.markRead(); onClose(); }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, textDecoration: 'none', color: 'var(--text)', fontSize: 11, lineHeight: 1.4 }}
                  >
                    {item.isUnread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: isNotice ? 10 : 9,
                          fontWeight: 800, letterSpacing: 0.3,
                          textTransform: 'uppercase', color: item.tag.color, background: item.tag.bg,
                          borderRadius: 6, padding: isNotice ? '2px 8px' : '2px 6px',
                        }}
                      >
                        {item.tag.label}
                      </span>
                      <span style={{ fontWeight: isNotice ? 600 : 400 }}>{item.title}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => item.markRead()}
                    style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', alignSelf: 'center' }}
                  >
                    Read
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: 10 }}>
          <Link to="/notice" onClick={onClose} style={{ display: 'block', textAlign: 'center', fontSize: 12, color: 'var(--accent)', textDecoration: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }} onMouseEnter={(e)=>e.currentTarget.style.background='var(--accentBg)'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
            View all notices
          </Link>
        </div>
      </div>
    </>
  );
}
