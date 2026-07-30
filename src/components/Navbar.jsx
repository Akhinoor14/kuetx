import { Sun, Moon, Droplets, Bell, Download, ChevronRight, BookOpen, CloudOff, Cloud, LogOut, User, Settings, ExternalLink, X, Menu, RefreshCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { useLocation, Link } from 'react-router-dom';
import { confirmDialog } from '../lib/dialog';
import { NAV } from '../nav';
import { Wordmark } from './Logo';
import * as noticeApi from '../lib/noticeUtils';
import * as alertApi from '../lib/alertUtils';
import { computeAlerts } from '../lib/alertUtils';
import { getProfile } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import { NotificationPanel } from './NotificationPanel';
import GuideModal from './GuideModal';
import { preloadRoute, preloadSiblings } from '../routePreload';

function getPageMeta(pathname) {
  for (const section of NAV) {
    const pools = section.subgroups
      ? section.subgroups.map(sub => ({ items: sub.items, groupLabel: sub.name, hubPath: sub.hubPath, hubIcon: sub.hubIcon }))
      : [{ items: section.items, groupLabel: section.group, hubPath: section.hubPath, hubIcon: section.hubIcon }];

    for (const pool of pools) {
      for (const item of pool.items) {
        if (item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path)))
          return { label: item.label, group: pool.groupLabel, siblings: pool.items };
      }
      // Hub landing page itself (e.g. /class-rep) — no single item matches
      // it directly since it's the multi-card index, not a leaf page. Show
      // the group name as the title instead of falling through to blank.
      if (pool.hubPath && pool.hubPath === pathname) {
        return { label: pool.groupLabel, group: pool.groupLabel, siblings: [] };
      }
    }
  }
  return { label: 'KUETx', group: '', siblings: [] };
}

export function Navbar({ onMenuClick }) {
  const { themeId, setTheme } = useTheme();
  const location = useLocation();
  const { label, group, siblings } = getPageMeta(location.pathname);

  // Warm the JS chunk for every sibling page (Attendance/Schedule/etc, or
  // whichever group is active) the moment this bar renders for a page that
  // has siblings — by the time the user actually taps a chip, its chunk is
  // usually already cached, so <Suspense>'s "Loading…" fallback (the
  // visible pause on first switch) rarely shows. Re-runs (cheaply — see
  // routePreload.js's dedup) whenever the sibling group changes.
  useEffect(() => {
    preloadSiblings(siblings);
  }, [siblings]);

  // Mobile chip-strip pages: the topbar scrolls away naturally with the
  // page (position: static, see index.css's body.has-mobile-chip-strip
  // rule) instead of staying pinned, and the chip strip below it
  // (always position: sticky; top: 0) catches itself at the very top
  // the moment the topbar has scrolled past. Scrolling back up reverses
  // for free once the page nears its own top again. This is plain CSS
  // sticky-positioning behavior — the only thing JS needs to do is flag
  // which pages are in this mode, via a body class the CSS can key off.
  const hasChipStrip = siblings && siblings.length > 1;
  useEffect(() => {
    document.body.classList.toggle('has-mobile-chip-strip', !!hasChipStrip);
    return () => document.body.classList.remove('has-mobile-chip-strip');
  }, [hasChipStrip]);

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

  const profileForNotices = useMemo(() => getProfile() || {}, [refreshTick]);
  const groupId = useMemo(() => getGroupId(profileForNotices), [profileForNotices]);
  const readNoticeIds = useMemo(() => noticeApi.getReadNoticeIds(), [refreshTick]);

  // Whether the signed-in student is CR/ACR — gates whether a Teacher's
  // cr_only notice counts toward the unread badge at all (see
  // filterStudentFacingNotices in noticeUtils.js). Without this the badge
  // undercounted for a CR/ACR: a cr_only notice sent specifically to them
  // never incremented the number they see on the bell icon.
  const [isViewerCR, setIsViewerCR] = useState(false);
  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) { setIsViewerCR(false); return; }
    return subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsViewerCR(role === 'cr' || role === 'acr');
    });
  }, [groupId]);

  // Live notice feed — was previously the dead getNotices() stub (always
  // returned []), so the bell badge never reflected real notices. Now
  // subscribes the same way NotificationPanel does, so a new notice
  // updates the badge count immediately.
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    return noticeApi.subscribeAllNotices(profileForNotices, groupId, setNotices, 'student', { isViewerCR, uid: auth.currentUser?.uid });
  }, [profileForNotices, groupId, isViewerCR]);

  const unreadNoticeCount = noticeApi.getUnreadNotices(notices, readNoticeIds).length;

  // Badge reflects the same merged set shown in NotificationPanel:
  // unread notices + actionable alerts (critical, warnings, assignments —
  // positives excluded, same as the panel).
  const dismissedAlertIds = useMemo(() => alertApi.getDismissedAlertIds(), [refreshTick]);
  const unreadAlertCount = useMemo(() => {
    const profile = getProfile() || {};
    const decorated = alertApi.decorateAlerts(computeAlerts(profile), dismissedAlertIds);
    return ['critical', 'warnings', 'assignmentAlerts']
      .reduce((sum, group) => sum + decorated[group].filter(item => !dismissedAlertIds.has(item.id)).length, 0);
  }, [dismissedAlertIds, refreshTick]);

  const alertCount = unreadNoticeCount + unreadAlertCount;

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

  const handleSignOut = async () => {
    if (!(await confirmDialog('Sign out? This device will be cleared — log back in anytime and everything comes right back from the cloud.'))) return;
    setLoggingOut(true);
    try {
      const { logout } = await import('../lib/firebaseAuth');
      await logout();
      // BUGFIX (design change after review): see accountLifecycle.js's
      // clearLocalDataOnLogout() doc comment — logout used to leave
      // local data untouched, which a different person's brand-new
      // account on this same device would silently clear anyway,
      // breaking the promise made above. Clearing here instead makes it
      // simple and always true.
      const { clearLocalDataOnLogout } = await import('../lib/accountLifecycle');
      await clearLocalDataOnLogout();
      setDrawerOpen(false);
      // Full reload after sign-out clears any stale cached React state
      // (roles, faculty/staff status, profile, etc.) that was loaded for
      // the previous session — same pattern used in Settings.jsx. Without
      // this, a signed-out user keeps seeing faculty/staff-gated UI until
      // they manually refresh.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
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

  return (
    <>
      <header className="topbar">
        {/* Logo — mobile */}
        <Link to="/" className="topbar-logo" style={{ alignItems: 'center', textDecoration: 'none' }}>
          <Wordmark height={28} />
        </Link>

        {/* Page title — mobile center. Hidden when the mobile sub-nav chip
            strip below is showing (siblings.length > 1), since that strip
            already highlights the active page — showing both would be a
            redundant "current page name" in two places. Pages with no
            siblings (chip strip absent) still need this as their only
            mobile page indicator, so it stays for those. */}
        {!(siblings && siblings.length > 1) && (
          <div className="topbar-page-title">
            {label !== 'KUETx' ? label : ''}
          </div>
        )}

        {/* Desktop: centered sibling pills (or page title if no siblings).
            Sidebar already shows which group/subgroup is active, so we
            don't repeat the group name here — just the current page tabs,
            centered in the bar. */}
        <div className="hidden md:flex" style={{ position: 'absolute', left: 96, right: 160, justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', minWidth: 0, maxWidth: '100%' }}>
            {siblings && siblings.length > 1 ? (
              <div className="filter-tab-row topbar-tabs" style={{ marginBottom: 0, justifyContent: 'center' }}>
                {siblings.map(item => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`filter-tab ${location.pathname === item.path ? 'active' : ''}`}
                    style={{ textDecoration: 'none' }}
                    onMouseEnter={() => preloadRoute(item.path)}
                    onTouchStart={() => preloadRoute(item.path)}
                  >
                    {item.shortLabel || item.label}
                  </Link>
                ))}
              </div>
            ) : (
              label !== 'KUETx' && (
                <div className="filter-tab-row topbar-tabs" style={{ marginBottom: 0, justifyContent: 'center' }}>
                  <span className="filter-tab active" style={{ cursor: 'default' }}>
                    {label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* ── Theme toggle — standalone, desktop only. Cycles light → milky
            → dark on each click, reusing the same cycleTheme/ThemeIcon
            logic already used by the drawer's theme picker cards, so this
            is just a second, always-visible entry point to the same
            setTheme() call — not a separate theme system. ── */}
        <button
          onClick={cycleTheme}
          aria-label={`Switch theme (current: ${THEMES[themeId]?.label || 'Light'})`}
          title={`Theme: ${THEMES[themeId]?.label || 'Light'} — click to switch`}
          className="hidden md:flex"
          style={{
            alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer', color: 'var(--text)',
            transition: 'background 0.15s',
            marginRight: 8,
          }}
        >
          <ThemeIcon size={17} />
        </button>

        {/* ── Notification bell — standalone, always visible.
            Unread state is shown two ways: (1) the numeric badge, same
            as before, and (2) the bell itself changes color + gets a
            soft pulsing ring when there's anything unread, so it's
            obvious at a glance even before you count the badge. ── */}
        <button
          onClick={() => setNotificationOpen(true)}
          aria-label="Notice"
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 10,
            border: alertCount > 0 ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
            background: alertCount > 0 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
            cursor: 'pointer', color: alertCount > 0 ? 'var(--accent)' : 'var(--text)',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            marginRight: 8,
          }}
        >
          <Bell size={17} fill={alertCount > 0 ? 'var(--accent)' : 'none'} style={{ animation: alertCount > 0 ? 'bellRing 2.4s ease-in-out infinite' : 'none' }} />
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 14, height: 14, padding: '0 3px',
              borderRadius: 999,
              background: 'var(--danger)',
              border: '2px solid var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#fff',
              boxShadow: '0 0 6px var(--danger)88',
              animation: 'bellBadgePulse 1.8s ease-in-out infinite',
            }}>
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
        <style>{`
          @keyframes bellRing {
            0%, 92%, 100% { transform: rotate(0deg); }
            94% { transform: rotate(-12deg); }
            96% { transform: rotate(10deg); }
            98% { transform: rotate(-6deg); }
          }
          @keyframes bellBadgePulse {
            0%, 100% { box-shadow: 0 0 6px var(--danger)88; }
            50% { box-shadow: 0 0 12px var(--danger); }
          }
        `}</style>

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
          {/* Badge: sync-status dot only — alert count now lives on the bell */}
          {!drawerOpen && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 10, height: 10,
              borderRadius: '50%',
              background: dotColor,
              border: '2px solid var(--surface)',
              boxShadow: `0 0 6px ${dotColor}88`,
            }} />
          )}
        </button>
      </header>

      {/* Mobile sub-navigation tab strip — lets mobile users swap between
          sibling pages in the same nav group, since the desktop version
          (centered pills inside the topbar) has no room on mobile. Own
          sticky strip below the topbar, not merged into it. Renders only
          when siblings.length > 1 for the current page. */}
      {siblings && siblings.length > 1 && (
        <div className="topbar-mobile-tabs md:hidden">
          <div className="filter-tab-row topbar-tabs">
            {siblings.map(item => (
              <Link
                key={item.id}
                to={item.path}
                className={`filter-tab ${location.pathname === item.path ? 'active' : ''}`}
                style={{ textDecoration: 'none' }}
                onTouchStart={() => preloadRoute(item.path)}
              >
                {item.shortLabel || item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Slide-in Drawer ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3600 }}>
          {/* Scrim */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(2px)',
              animation: 'drawerScrimIn 0.18s ease',
            }}
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
              transformOrigin: 'top right',
              animation: 'drawerSlideIn 0.24s cubic-bezier(0.16,1,0.3,1)',
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
              <Link to="/" onClick={() => setDrawerOpen(false)} style={{ textDecoration: "none" }}>
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
                        Sign in with Google
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
                            {getProfile()?.name || firebaseUser.displayName || 'User'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(firebaseUser.email || '').toLowerCase().endsWith('@users.kuetx.internal')
                              ? 'KUETx account'
                              : firebaseUser.email}
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
                      {t.id === 'light' ? <Sun size={16} /> : t.id === 'milky' ? <Droplets size={16} /> : <Moon size={16} />}
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

                {/* Guide */}
                <button
                  onClick={() => { setDrawerOpen(false); setGuideOpen(true); }}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    textAlign: 'left',
                  }}
                >
                  <BookOpen size={15} color="var(--text)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>KUETx Guide</span>
                </button>

                {/* Team & Administration link removed from here — it now
                    lives in the Sidebar as a role-gated "Admin" nav row,
                    visible only to verified Founder/staff, instead of this
                    always-visible drawer link that every user could see
                    and open regardless of role. */}

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

              {/* ── Data safety note ──
                  Previously said "Data is always locally safe — it works
                  without internet" AND "Firestore real-time backup is on"
                  side by side, which read as two contradictory claims
                  (nothing is purely local once it's synced to Firestore).
                  Replaced with one accurate sentence, plus a Privacy
                  Policy link placeholder — swap the href once the policy
                  page (with the manifesto) exists. */}
              <div style={{
                borderRadius: 10,
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--success) 7%, var(--bg))',
                border: '1px solid color-mix(in srgb, var(--success) 20%, var(--border))',
                fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
              }}>
                <Save size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />
                {isAnon
                  ? <>Your data is saved on this device only right now — <strong style={{ color: 'var(--text)' }}>sign in to back it up</strong> so it's safe if you switch devices.</>
                  : <>Your data is <strong style={{ color: 'var(--text)' }}>securely backed up</strong> to your account and syncs automatically.</>}
                {' '}
                <a href="/privacy" style={{ color: 'var(--success)', fontWeight: 600, textDecoration: 'none' }}>See our privacy policy →</a>
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