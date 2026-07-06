import { Sun, Moon, Droplets, Bell, Download, ChevronRight, BookOpen, CloudOff, Cloud, LogOut, User, Settings, ExternalLink, X, Menu, RefreshCw, Briefcase } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pulling, setPulling] = useState(false);
  const drawerRef = useRef(null);

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

  useEffect(() => {
    const handleSync = (e) => {
      const s = e.detail?.status || 'idle';
      setSyncStatus(s);
      if (s === 'synced' && e.detail?.at) setLastSyncedAt(e.detail.at);
    };
    window.addEventListener('kuetx:firebase-sync', handleSync);
    return () => window.removeEventListener('kuetx:firebase-sync', handleSync);
  }, []);

  useEffect(() => {
    let unsub = () => {};
    import('../lib/firebaseAuth').then(({ onAuthChange }) => {
      unsub = onAuthChange((u) => setFirebaseUser(u));
    }).catch(() => {});
    return () => unsub();
  }, []);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const cycleTheme = () => {
    const order = ['light', 'milky', 'dark'];
    setTheme(order[(order.indexOf(themeId) + 1) % order.length]);
  };

  const ThemeIcon = themeId === 'dark' ? Moon : themeId === 'milky' ? Droplets : Sun;
  const themeLabels = { light: '☀️ Light', milky: '🥛 Milky', dark: '🌙 Dark' };

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

  const handlePullNow = async () => {
    if (pulling) return;
    setPulling(true);
    try {
      const { pullNow } = await import('../lib/firebaseSync');
      await pullNow();
    } catch (e) { console.error(e); }
    finally { setPulling(false); }
  };

  const handleSignOut = async () => {    setLoggingOut(true);
    try {
      const { logout } = await import('../lib/firebaseAuth');
      await logout();
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
      setDrawerOpen(false);
    }
  };

  const isAnon = !firebaseUser || firebaseUser.isAnonymous;
  const dotColor = isAnon
    ? '#9ca3af'
    : syncStatus === 'synced' ? '#22c55e'
    : syncStatus === 'syncing' || syncStatus === 'pending' ? '#f59e0b'
    : syncStatus === 'error' ? '#ef4444'
    : '#9ca3af';

  const syncLabel = isAnon ? 'Offline' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'pending' ? 'Saving…' : syncStatus === 'error' ? 'Sync error' : 'Connecting…';

  // Total badge count for hamburger
  const totalBadge = alertCount;

  return (
    <>
      <header className="topbar">
        {/* Logo — mobile */}
        <Link to="/quick-access" className="topbar-logo" style={{ alignItems: 'center', textDecoration: 'none' }}>
          <Wordmark height={28} />
        </Link>

        {/* Page title — mobile center */}
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

        {/* ── Hamburger button ── */}
        <button
          onClick={() => setDrawerOpen(p => !p)}
          aria-label="Open menu"
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: drawerOpen ? 'var(--inputBg)' : 'transparent',
            cursor: 'pointer', color: 'var(--text)',
            transition: 'background 0.15s',
          }}
        >
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
          {/* Badge: sync dot + alert count */}
          {!drawerOpen && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 14, height: 14,
              borderRadius: '50%',
              background: totalBadge > 0 ? 'var(--danger)' : dotColor,
              border: '2px solid var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff',
              boxShadow: `0 0 6px ${totalBadge > 0 ? 'var(--danger)' : dotColor}88`,
            }}>
              {totalBadge > 0 ? (totalBadge > 9 ? '9+' : totalBadge) : ''}
            </span>
          )}
        </button>
      </header>

      {/* ── Slide-in Drawer ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3600 }}>
          {/* Scrim */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)' }}
          />

          {/* Panel */}
          <div
            ref={drawerRef}
            style={{
              position: 'absolute',
              top: 0, right: 0,
              width: 'min(320px, 92vw)',
              height: '100dvh',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
              animation: 'drawerSlideIn 0.22s cubic-bezier(0.22,1,0.36,1)',
              /* bottom padding clears the floating BottomNav (~80px) + safe area */
              paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* ── Header row ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <Link to="/quick-access" onClick={() => setDrawerOpen(false)} style={{ textDecoration: "none" }}>
                <Wordmark height={24} />
              </Link>
              <button onClick={() => setDrawerOpen(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>

              {/* ── Account card ── */}
              <div style={{
                borderRadius: 12,
                border: '1px solid var(--border)',
                overflow: 'hidden',
                background: 'var(--bg)',
              }}>
                {/* Sync status strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: isAnon
                    ? 'color-mix(in srgb, #9ca3af 8%, var(--bg))'
                    : dotColor === '#22c55e'
                      ? 'color-mix(in srgb, #22c55e 8%, var(--bg))'
                      : 'color-mix(in srgb, #f59e0b 8%, var(--bg))',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: dotColor,
                    boxShadow: dotColor !== '#9ca3af' ? `0 0 5px ${dotColor}` : 'none',
                    animation: (syncStatus === 'syncing' || syncStatus === 'pending') ? 'pulse 1.2s infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{syncLabel}</span>
                  {lastSyncedAt && !isAnon && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                      {new Date(lastSyncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* User info */}
                <div style={{ padding: '10px 12px' }}>
                  {isAnon ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <User size={16} color="var(--muted)" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Offline Mode</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Data locally safe ✓</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const { loginWithGoogle } = await import('../lib/firebaseAuth');
                            await loginWithGoogle();
                            setDrawerOpen(false);
                          } catch (e) { console.error(e); }
                        }}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8,
                          background: 'var(--accent)', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google দিয়ে Sign In
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        {firebaseUser.photoURL ? (
                          <img src={firebaseUser.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <User size={16} color="#fff" />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {firebaseUser.displayName || 'User'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {firebaseUser.email}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={handlePullNow}
                          disabled={pulling}
                          title="Pull latest from cloud"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            cursor: 'pointer', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--muted)',
                          }}
                        >
                          <RefreshCw size={12} style={{ animation: pulling ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                        <a
                          href="https://console.firebase.google.com"
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            flex: 1, padding: '6px 10px', borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            textDecoration: 'none',
                          }}
                        >
                          Data <ExternalLink size={10} />
                        </a>
                        <button
                          onClick={handleSignOut}
                          disabled={loggingOut}
                          style={{
                            flex: 1, padding: '6px 10px', borderRadius: 8,
                            border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))',
                            background: 'transparent', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600, color: 'var(--danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          <LogOut size={11} /> {loggingOut ? '…' : 'Sign Out'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Theme picker ── */}
              <div style={{
                borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg)', padding: '10px 12px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.values(THEMES).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 8,
                        border: `2px solid ${themeId === t.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: themeId === t.id ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'transparent',
                        cursor: 'pointer',
                        fontSize: 11, fontWeight: themeId === t.id ? 700 : 400,
                        color: themeId === t.id ? 'var(--accent)' : 'var(--muted)',
                        fontFamily: 'Sora, sans-serif',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t.id === 'light' ? '☀️' : t.id === 'milky' ? '🥛' : '🌙'}
                      <div style={{ fontSize: 10, marginTop: 2 }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Quick actions ── */}
              <div style={{
                borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg)', overflow: 'hidden',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: '10px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</div>

                {/* Notifications */}
                <button
                  onClick={() => { setDrawerOpen(false); setNotificationOpen(true); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: 'none', borderTop: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Bell size={15} color="var(--text)" />
                    {alertCount > 0 && (
                      <span style={{
                        position: 'absolute', top: -5, right: -5,
                        minWidth: 14, height: 14, padding: '0 3px',
                        borderRadius: 999, background: 'var(--danger)', color: '#fff',
                        fontSize: 8, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{alertCount}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>Alerts</span>
                  {alertCount > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff',
                      background: 'var(--danger)', borderRadius: 6, padding: '2px 6px',
                    }}>{alertCount} new</span>
                  )}
                </button>

                {/* Guide */}
                <button
                  onClick={() => { setDrawerOpen(false); setGuideOpen(true); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: 'none', borderTop: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left',
                  }}
                >
                  <BookOpen size={15} color="var(--text)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>KUETx Guide</span>
                </button>

                {/* Team & Administration — unified entry point for every KUETx
                    role (Head of Ops, Campus Lead, Founder, etc). The page
                    itself gates what's shown; this link is always visible. */}
                <Link
                  to="/team"
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: 'none', borderTop: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left', textDecoration: 'none',
                  }}
                >
                  <Briefcase size={15} color="var(--text)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>Team &amp; Administration</span>
                </Link>

                {/* Settings */}
                <Link
                  to="/settings"
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    borderTop: '1px solid var(--border)',
                    textDecoration: 'none',
                  }}
                >
                  <Settings size={15} color="var(--text)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>Settings & Backup</span>
                  <Download size={12} color="var(--muted)" style={{ marginLeft: 'auto' }} />
                </Link>
              </div>

              {/* ── Data safety note ── */}
              <div style={{
                borderRadius: 10,
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--success) 7%, var(--bg))',
                border: '1px solid color-mix(in srgb, var(--success) 20%, var(--border))',
                fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
              }}>
                💾 Data সবসময় <strong style={{ color: 'var(--text)' }}>locally safe</strong> — internet ছাড়াও কাজ করে।
                {!isAnon && <span style={{ color: 'var(--success)' }}> Firestore real-time backup চলছে।</span>}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Notification Panel */}
      <NotificationPanel isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />

      {/* KUETx Guide */}
      <GuideModal open={guideOpen} onClose={closeGuide} />
    </>
  );
}