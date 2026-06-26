import { Sun, Moon, Droplets, Bell, Download, ChevronRight, BookOpen, CloudOff, Cloud, Loader } from 'lucide-react';
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
  const [syncStatus, setSyncStatus] = useState('idle');
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [syncPopover, setSyncPopover] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

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

  // Firebase sync status listener
  useEffect(() => {
    const handleSync = (e) => {
      const s = e.detail?.status || 'idle';
      setSyncStatus(s);
      if (s === 'synced' && e.detail?.at) setLastSyncedAt(e.detail.at);
    };
    window.addEventListener('kuetx:firebase-sync', handleSync);
    return () => window.removeEventListener('kuetx:firebase-sync', handleSync);
  }, []);

  // Firebase auth state — track if user is anonymous or real
  useEffect(() => {
    let unsub = () => {};
    import('../lib/firebaseAuth').then(({ onAuthChange }) => {
      unsub = onAuthChange((u) => setFirebaseUser(u));
    }).catch(() => {});
    return () => unsub();
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

      {/* Firebase sync dot — clickable popover */}
      {(() => {
        const isAnon = !firebaseUser || firebaseUser.isAnonymous;
        const dotColor = isAnon
          ? '#9ca3af'
          : syncStatus === 'synced' ? '#22c55e'
          : syncStatus === 'syncing' || syncStatus === 'pending' ? '#f59e0b'
          : syncStatus === 'error' ? '#ef4444'
          : '#9ca3af';
        const shortName = isAnon ? 'Offline' : (firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0] || 'Synced');
        const statusLabel = isAnon ? 'Not logged in' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'pending' ? 'Saving...' : syncStatus === 'error' ? 'Error' : 'Connecting...';
        return (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSyncPopover(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 10px', borderRadius: 9,
                border: '1.5px solid var(--border)',
                background: syncPopover ? 'var(--inputBg)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: dotColor,
                boxShadow: dotColor !== '#9ca3af' ? `0 0 6px ${dotColor}88` : 'none',
                display: 'inline-block', flexShrink: 0,
                animation: (syncStatus === 'syncing' || syncStatus === 'pending') ? 'pulse 1.2s infinite' : 'none',
              }} />
              <span className="hidden md:inline" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortName}
              </span>
            </button>

            {syncPopover && (
              <>
                {/* Backdrop */}
                <div onClick={() => setSyncPopover(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                {/* Popover */}
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 260, background: 'var(--surface)',
                  border: '1.5px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 99,
                  padding: 14, fontFamily: 'Sora, sans-serif',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{statusLabel}</span>
                  </div>

                  {/* User info */}
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
                    {isAnon ? (
                      <>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>👤 Offline Mode</div>
                        <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>তোমার সব data এই device এ safe আছে। Login করলে সব device এ sync হবে।</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {firebaseUser.displayName || firebaseUser.email}
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: 11 }}>{firebaseUser.email}</div>
                        {lastSyncedAt && (
                          <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                            Last synced: {new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Data safety note */}
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, padding: '6px 8px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)' }}>
                    💾 Data সবসময় <strong>locally safe</strong> — internet ছাড়াও কাজ করে।
                    {!isAnon && ' Firestore এ real-time backup চলছে।'}
                  </div>

                  {/* CTA */}
                  {isAnon && (
                    <Link to="/settings" onClick={() => setSyncPopover(false)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 10, padding: '8px', borderRadius: 8,
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      gap: 6,
                    }}>
                      Login করো → সব device এ sync পাও
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Theme toggle — icon only on mobile */}
      <button onClick={cycleTheme} title={`Theme: ${themeLabel}`} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 9,
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