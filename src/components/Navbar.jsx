import { Sun, Moon, Droplets, Bell, Download, ChevronRight, BookOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useLocation, Link } from 'react-router-dom';
import { NAV } from '../nav';
import { Wordmark } from './Logo';
import { getProfile } from '../store/store';
import * as alertApi from '../lib/alertUtils';
import { NotificationPanel } from './NotificationPanel';
import GuideModal from './GuideModal';

function getPageMeta(pathname) {
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path)))
        return { label: item.label, group: section.group };
    }
  }
  return { label: 'KUETx', group: '' };
}

export function Navbar({ onMenuClick }) {
  const { themeId, setTheme } = useTheme();
  const location = useLocation();
  const { label, group } = getPageMeta(location.pathname);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false); // controlled by App queue now

  useEffect(() => {
    const handleStoreUpdate = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  useEffect(() => {
    const handleOpenGuide = () => setGuideOpen(true);
    window.addEventListener('kuetx:openGuide', handleOpenGuide);
    return () => window.removeEventListener('kuetx:openGuide', handleOpenGuide);
  }, []);

  const cycleTheme = () => {
    const order = ['light', 'milky', 'dark'];
    setTheme(order[(order.indexOf(themeId) + 1) % order.length]);
  };

  const ThemeIcon = themeId === 'dark' ? Moon : themeId === 'milky' ? Droplets : Sun;
  const themeLabel = { light: 'Light', milky: 'Milky', dark: 'Dark' }[themeId];

  const dismissedIds = useMemo(() => alertApi.getDismissedAlertIds(), [refreshTick]);
  const alertCounts = useMemo(() => (
    alertApi.decorateAlerts(alertApi.computeAlerts(getProfile()), dismissedIds)
  ), [dismissedIds, refreshTick]);
  const unreadCritical = alertApi.filterUnreadAlerts(alertCounts.critical, dismissedIds);
  const unreadWarnings = alertApi.filterUnreadAlerts(alertCounts.warnings, dismissedIds);
  const unreadPositives = alertApi.filterUnreadAlerts(alertCounts.positives, dismissedIds);
  const unreadAssignments = alertApi.filterUnreadAlerts(alertCounts.assignmentAlerts, dismissedIds);
  const alertCount = unreadCritical.length + unreadWarnings.length + unreadPositives.length + unreadAssignments.length;

  const closeGuide = () => {
    localStorage.setItem('kuetx_guide_seen', '1');
    setGuideOpen(false);
  };

  return (
    <header className="topbar">
      {/* Mobile: Logo left side */}
      <div className="topbar-logo" style={{ display: 'flex', alignItems: 'center' }}>
        <Wordmark height={28} />
      </div>

      {/* Mobile: Page title center */}
      <div className="topbar-page-title">
        {label !== 'KUETx' ? label : ''}
      </div>

      {/* Desktop breadcrumb */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 6, fontSize: 14 }}>
        {group && <span style={{ color: 'var(--muted)' }}>{group}</span>}
        {group && <ChevronRight size={14} color="var(--muted)" />}
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button onClick={cycleTheme} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Sora, sans-serif',
      }}>
        <ThemeIcon size={15} />
        <span className="hidden md:inline">{themeLabel}</span>
      </button>

      {/* Alerts bell */}
      <button
        id="notification-bell"
        onClick={() => setNotificationOpen(!notificationOpen)}
        aria-label={alertCount ? `${alertCount} alerts` : 'Alerts'}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '7px 10px', borderRadius: 9,
          border: '1.5px solid var(--border)',
          background: 'transparent', color: 'var(--text)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--inputBg)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Bell size={17} />
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: -8, right: -8, minWidth: 18, height: 18, padding: '0 6px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 999, background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            }}>{alertCount}</span>
          )}
        </div>
      </button>

      {/* Guide button — always accessible */}
      <button
        onClick={() => setGuideOpen(true)}
        title="KUETx Guide"
        style={{
          display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 9,
          border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--inputBg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <BookOpen size={17} />
      </button>

      {/* Backup shortcut — hidden on mobile */}
      <Link to="/settings" title="Backup data" className="hidden md:flex" style={{
        alignItems: 'center', padding: '7px 10px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)',
        textDecoration: 'none',
      }}>
        <Download size={17} />
      </Link>

      {/* Notification Panel */}
      <NotificationPanel isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* KUETx Guide — rich in-app guide */}
      <GuideModal open={guideOpen} onClose={closeGuide} />
    </header>
  );
}