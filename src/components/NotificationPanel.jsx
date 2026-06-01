import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { getProfile } from '../store/store';

const tone = (color) => {
  if (color === 'var(--danger)') return { bg: 'var(--dangerBg)', border: 'color-mix(in srgb, var(--danger) 28%, var(--border))', iconBg: 'rgba(248, 113, 113, 0.14)' };
  if (color === 'var(--warning)') return { bg: 'var(--warningBg)', border: 'color-mix(in srgb, var(--warning) 28%, var(--border))', iconBg: 'rgba(251, 191, 36, 0.14)' };
  return { bg: 'var(--successBg)', border: 'color-mix(in srgb, var(--success) 28%, var(--border))', iconBg: 'rgba(74, 222, 128, 0.14)' };
};

export function NotificationPanel({ isOpen, onClose }) {
  const profile = getProfile();
  const [refreshTick, setRefreshTick] = useState(0);
  const [alertApi, setAlertApi] = useState(null);

  useEffect(() => {
    const handle = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handle);
    return () => window.removeEventListener('kuetx:store-updated', handle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    import('../lib/alertUtils').then(module => {
      if (!cancelled) setAlertApi(module);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissedIds = useMemo(() => (alertApi ? alertApi.getDismissedAlertIds() : new Set()), [alertApi, refreshTick]);
  const grouped = useMemo(() => (
    alertApi
      ? alertApi.decorateAlerts(alertApi.computeAlerts(profile), dismissedIds)
      : { critical: [], warnings: [], positives: [], assignmentAlerts: [] }
  ), [profile, refreshTick, dismissedIds, alertApi]);
  const critical = alertApi ? alertApi.filterUnreadAlerts(grouped.critical, dismissedIds) : [];
  const warnings = alertApi ? alertApi.filterUnreadAlerts(grouped.warnings, dismissedIds) : [];
  const positives = alertApi ? alertApi.filterUnreadAlerts(grouped.positives, dismissedIds) : [];
  const assignmentAlerts = alertApi ? alertApi.filterUnreadAlerts(grouped.assignmentAlerts, dismissedIds) : [];

  const assignmentCounts = {
    overdue: assignmentAlerts.filter(a => a.priority === 'overdue').length,
    today: assignmentAlerts.filter(a => a.priority === 'today').length,
    soon: assignmentAlerts.filter(a => a.priority === 'soon').length,
  };

  const markRead = (id) => alertApi?.setAlertDismissed(id, true);

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

  const Section = ({ title, items, color, emoji }) => (
    <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: `1px solid ${tone(color).border}`, background: tone(color).bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: tone(color).iconBg, border: `1px solid ${tone(color).border}`, fontSize: 14 }}>{emoji}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 2px' }}>None ✓</div>
      ) : items.map((a, i) => (
        <div key={a.id || i} style={{ display: 'flex', alignItems: 'stretch', gap: 8, padding: '8px 10px', borderRadius: 10, marginBottom: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Link to={a.link || '#'} onClick={() => { markRead(a.id); onClose(); }} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, textDecoration: 'none', color: 'var(--text)', fontSize: 11, lineHeight: 1.4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
            <span style={{ flex: 1 }}>{a.msg}</span>
          </Link>
          <button type="button" onClick={() => markRead(a.id)} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', alignSelf: 'center' }}>Read</button>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', zIndex: 999 }} />
      <div id="notification-panel" style={{ position: 'fixed', top: 60, right: 16, width: 'min(360px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 100px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'slideDown 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Notifications</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'color 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.color='var(--text)'} onMouseLeave={(e)=>e.currentTarget.style.color='var(--muted)'}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {assignmentAlerts.length === 0 && critical.length === 0 && warnings.length === 0 && positives.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>All clear!</div>
              <div style={{ fontSize: 12 }}>No notifications at the moment.</div>
            </div>
          ) : (
            <>
              {assignmentAlerts.length > 0 && <Section title="Assignments" items={assignmentAlerts} color="var(--accent)" emoji="📌" />}
              {critical.length > 0 && <Section title="Critical" items={critical} color="var(--danger)" emoji="🔴" />}
              {warnings.length > 0 && <Section title="Warnings" items={warnings} color="var(--warning)" emoji="🟡" />}
              {positives.length > 0 && <Section title="Positive" items={positives} color="var(--success)" emoji="🟢" />}
            </>
          )}
        </div>

        {(assignmentAlerts.length > 0 || critical.length > 0 || warnings.length > 0 || positives.length > 0) && (
          <div style={{ borderTop: '1px solid var(--border)', padding: 10 }}>
            <Link to="/alerts" onClick={onClose} style={{ display: 'block', textAlign: 'center', fontSize: 12, color: 'var(--accent)', textDecoration: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }} onMouseEnter={(e)=>e.currentTarget.style.background='var(--accentBg)'} onMouseLeave={(e)=>e.currentTarget.style.background='transparent'}>
              View all alerts
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
