import { Sun, Moon, Droplets, Bell, Download, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useLocation, Link } from 'react-router-dom';
import { NAV } from '../nav';
import { Wordmark } from './Logo';
import { getProfile } from '../store/store';
import * as alertApi from '../lib/alertUtils';
import { NotificationPanel } from './NotificationPanel';

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
  const [guideOpen, setGuideOpen] = useState(() => !localStorage.getItem('kuetx_guide_seen'));

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

      {/* Backup shortcut — hidden on mobile (accessible via Settings in More drawer) */}
      <Link to="/settings" title="Backup data" className="hidden md:flex" style={{
        alignItems: 'center', padding: '7px 10px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)',
        textDecoration: 'none',
      }}>
        <Download size={17} />
      </Link>

      {/* Notification Panel */}
      <NotificationPanel isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* KUETx Guide — first-visit popup */}
      {guideOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(10, 15, 28, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={closeGuide}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(640px, 100vw - 24px)',
              maxHeight: '90vh',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>👋 Welcome to KUETx!</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Here's a quick guide to get you started.</div>
              </div>
              <button
                onClick={closeGuide}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6, borderRadius: 8, fontSize: 20, lineHeight: 1 }}
                aria-label="Close"
              >×</button>
            </div>

            {/* PDF Viewer */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <iframe
                src="/KUETx_Guide .pdf"
                title="KUETx Guide"
                style={{ width: '100%', height: '100%', minHeight: 380, border: 'none' }}
              />
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap', flexShrink: 0,
              background: 'var(--bg)',
            }}>
              <a
                href="https://www.facebook.com/kuetx"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 14px', borderRadius: 9, textDecoration: 'none',
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                  color: 'var(--accent)', fontWeight: 700, fontSize: 13,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9v-2.89h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.89h-2.33V21.9C18.34 21.12 22 17 22 12z"/></svg>
                Follow us on Facebook
              </a>
              <button
                onClick={closeGuide}
                className="btn btn-primary"
                style={{ fontSize: 13 }}
              >
                Got it, let's go →
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}