// Sidebar.jsx
//
// Thin shell only: decides student vs faculty via useViewMode() (the
// single shared source of truth — see hooks/useViewMode.js) and renders
// exactly one of SidebarNavStudent / SidebarNavFaculty. This file no
// longer contains any nav-row rendering or NAV/NAV_FACULTY selection logic
// itself, so there is no way for student and faculty nav code to end up
// tangled in here again.

import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Clock, Cloud, RefreshCw, User, UserX, WifiOff, Zap } from 'lucide-react';
import { ICONS } from '../lib/iconRegistry';
import { Logo, Wordmark } from './Logo';
import { APP_VERSION_SHORT } from '../version';
import { store, DEFAULT_PROFILE } from '../store/store';
import { useNavConfig } from './nav-system/useNavConfig';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMembers } from '../lib/groupSync';
import { auth } from '../lib/firebase';
import { useIsStaff } from '../hooks/useIsStaff';
import { useViewMode } from '../hooks/useViewMode';
import { useIsProvider } from '../hooks/useIsProvider';
import { preloadRoute } from '../lib/routePreload';
import * as noticeApi from '../lib/noticeUtils';
import SidebarNavStudent, { findStudentNavItem } from './nav-system/SidebarNavStudent';
import SidebarNavFaculty, { findFacultyNavItem } from './nav-system/SidebarNavFaculty';
import SidebarNavProvider, { findProviderNavItem } from './nav-system/SidebarNavProvider';

// ── Firebase sync status pill ─────────────────────────────────────────────────
function SyncBadge({ status }) {
  const cfg = {
    synced:   { color: '#10b981', label: 'Synced',   icon: <CheckCircle2 size={11} /> },
    syncing:  { color: '#f59e0b', label: 'Syncing…', icon: <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> },
    pending:  { color: '#f59e0b', label: 'Pending',  icon: <Clock size={11} /> },
    error:    { color: '#ef4444', label: 'Error',    icon: <WifiOff size={11} /> },
    idle:     { color: 'var(--muted)', label: 'Idle', icon: <Cloud size={11} /> },
  }[status] || { color: 'var(--muted)', label: status, icon: <Cloud size={11} /> };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, color: cfg.color,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export function Sidebar({ open, onClose, authState }) {
  const location = useLocation();
  const [profile, setProfile] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [navConfig] = useNavConfig();
  const { favorites } = useFavorites();
  const { pinnedPages } = usePinnedPages();
  const [isRealCR, setIsRealCR] = useState(() => {
    try {
      return sessionStorage.getItem('kuetx:lastKnownIsRealCR') === '1';
    } catch {
      return false;
    }
  });
  const canSeeCrBoard = isRealCR && navConfig.cr_board_enabled;
  const { isRealAdmin, adminLabel } = useIsStaff();

  // Single shared source of truth for student-vs-faculty shell — see
  // hooks/useViewMode.js. No inline viewMode derivation lives here anymore.
  const { viewMode } = useViewMode();

  // BUGFIX: useViewMode() only ever resolves to 'teacher' or 'student' —
  // it has no concept of provider accounts (see useViewMode.js's own doc
  // comment, written before SERVICES_PROVIDER_PLAN.md existed). That left
  // every provider account, pending/rejected/verified alike, rendering
  // the full SidebarNavStudent list below, with real links into
  // student-only pages. isProvider here is checked BEFORE viewMode is
  // used for nav selection, and wins regardless of status — same
  // "account isn't a student account at all, not a status question"
  // stance as RequireStudentMode's isProvider check.
  const { isProvider, isResolved: isProviderResolved } = useIsProvider();

  // BUGFIX (unread-count subscription ran for provider accounts too):
  // this unconditionally subscribed to 'student' notices regardless of
  // isProvider/viewMode — it never affected which nav renders (that part
  // was already gated), but it meant a provider account with stale
  // student profile data cached locally (see NoCRBanner.jsx's doc
  // comment for the root cause) still opened a student notice
  // subscription in the background. Gated the same way as the nav
  // render above: skip entirely until isProviderResolved, and skip for
  // provider/faculty shells once resolved — unread notice count is a
  // student-only concept, same as the CR banner.
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const latestNoticesRef = useRef([]);
  useEffect(() => {
    if (!isProviderResolved || isProvider || viewMode === 'teacher') { setUnreadNoticeCount(0); return; }
    const groupId = getGroupId(profile);
    const recompute = () => {
      const readIds = noticeApi.getReadNoticeIds();
      setUnreadNoticeCount(noticeApi.getUnreadNotices(latestNoticesRef.current, readIds).length);
    };
    const unsub = noticeApi.subscribeAllNotices(profile, groupId, (notices) => {
      latestNoticesRef.current = notices;
      recompute();
    }, 'student', { isViewerCR: isRealCR, uid: auth.currentUser?.uid });
    window.addEventListener('kuetx:store-updated', recompute);
    return () => {
      unsub();
      window.removeEventListener('kuetx:store-updated', recompute);
    };
  }, [profile.dept, profile.batch, isRealCR, isProviderResolved, isProvider, viewMode]);

  useEffect(() => {
    if (!isProviderResolved || isProvider || viewMode === 'teacher') { setIsRealCR(false); return; }
    const groupId = getGroupId(profile);
    if (!groupId) { setIsRealCR(false); return; }
    return subscribeMembers(groupId, (members) => {
      const me = members.find((m) => m.id === auth.currentUser?.uid);
      const value = me?.role === 'cr' || me?.role === 'acr';
      setIsRealCR(value);
      try { sessionStorage.setItem('kuetx:lastKnownIsRealCR', value ? '1' : '0'); } catch { /* ignore */ }
    });
  }, [profile.dept, profile.batch, isProviderResolved, isProvider, viewMode]);

  useEffect(() => {
    const syncProfile = () => setProfile(store.get('profile') || DEFAULT_PROFILE);
    window.addEventListener('kuetx:store-updated', syncProfile);
    syncProfile();
    return () => window.removeEventListener('kuetx:store-updated', syncProfile);
  }, []);

  // Quick-strip lookups: resolve against whichever shell is active, using
  // that shell's own (never the others') nav-item finder. isProvider
  // takes priority over viewMode's teacher/student split — see the
  // isProvider doc comment above.
  // BUGFIX (student-nav flash for provider accounts): isProvider defaults
  // to false (see useIsProvider.js) until its own async
  // onAuthStateChanged + Firestore check resolves — sessionStorage gives
  // an optimistic same-tab value, but that cache is never cleared on
  // sign-out/account-switch (see NoCRBanner.jsx's doc comment for the
  // same root cause elsewhere), so a fresh tab or a switched account can
  // start with isProvider=false even for a real provider account. Since
  // isProvider used to be checked with no isResolved guard at all, a
  // provider account would render the full Student sidebar for one paint
  // before flipping to the Provider sidebar the instant the real check
  // resolved a moment later — same flash class as the root-route
  // Dashboard flash, just in Sidebar instead. Fix: gate findNavItem
  // (and the nav render below) on isProviderResolved the same way
  // RootRouteResolver gates its own redirect — never assume "not
  // provider" while unresolved.
  const findNavItem = !isProviderResolved
    ? (() => null)
    : isProvider
    ? findProviderNavItem
    : (viewMode === 'teacher' ? findFacultyNavItem : findStudentNavItem);
  const getPageLabel = (path) => {
    const i = findNavItem(path);
    return i ? i.label : (path === '/' ? 'Dashboard' : path);
  };
  const getPageIcon = (path) => {
    const i = findNavItem(path);
    return i ? (ICONS[i.icon] || Circle) : Circle;
  };

  const quickItems = [...new Set([...pinnedPages, ...favorites])].slice(0, 5);

  const isAnonymous = authState?.isAnonymous ?? true;
  const syncStatus = authState?.syncStatus ?? 'idle';
  const displayName = authState?.displayName || null;

  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 30,
            // Slightly darker flat overlay instead of a live backdrop-filter blur.
            // blur(2px) forced a full-viewport composite recalculation on every
            // open/close and on every tap that passed through this layer on
            // mobile; a plain rgba background is visually close enough and is
            // effectively free to paint/composite.
            background: 'rgba(0,0,0,0.5)',
            transform: 'translateZ(0)',
            willChange: 'opacity',
          }}
          className="md:hidden" onClick={onClose} />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>

        {/* ── Logo header ── */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Link to="/" onClick={onClose}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', minWidth: 0, overflow: 'hidden', flexShrink: 1 }}>
              <Wordmark height={32} />
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              {viewMode === 'teacher' ? 'Faculty Portal · KUET' : 'The KUET Ecosystem'}
            </div>
          </div>
          {/* The Founder's student/faculty switch button lives on the
              Admin/Founder dashboard (AdminDashboard.jsx), not here — see
              useViewMode.js for the toggle itself. */}
        </div>

        {/* ── Quick strip ── */}
        {quickItems.length > 0 && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={10} color="var(--accent)" /> Quick
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {quickItems.map(path => {
                const Icon = getPageIcon(path);
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} onClick={onClose}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 7px', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text)', background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--inputBg)'; preloadRoute(path); }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    onTouchStart={() => preloadRoute(path)}
                  >
                    <Icon size={13} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--muted)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPageLabel(path)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Nav: exactly one of the three shells renders, never more than one ──
            isProviderResolved gate: see the findNavItem doc comment above —
            render nothing here (rather than defaulting to Student) until
            the server-verified provider check has actually settled. */}
        {!isProviderResolved ? null : isProvider ? (
          <SidebarNavProvider location={location} onClose={onClose} />
        ) : viewMode === 'teacher' ? (
          <SidebarNavFaculty location={location} onClose={onClose} isRealAdmin={isRealAdmin} />
        ) : (
          <SidebarNavStudent
            location={location}
            onClose={onClose}
            canSeeCrBoard={canSeeCrBoard}
            isRealAdmin={isRealAdmin}
            adminLabel={adminLabel}
            unreadNoticeCount={unreadNoticeCount}
          />
        )}

        {/* ── Bottom — Firebase status + account ── */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: isAnonymous ? 'var(--inputBg)' : 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                  border: `1.5px solid ${isAnonymous ? 'var(--border)' : 'var(--accent)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isAnonymous
                    ? <UserX size={11} color="var(--muted)" />
                    : <User size={11} color="var(--accent)" />}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                  {isAnonymous ? 'No account' : (displayName || 'Signed in')}
                </span>
              </div>
              {isAnonymous ? (
                <button
                  onClick={() => window.__kuetxShowUpgrade?.()}
                  style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Connect
                </button>
              ) : (
                <SyncBadge status={syncStatus} />
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>KUETx v{APP_VERSION_SHORT} · Firebase sync</div>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes sidebarNoticePulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.35); opacity: 0.65; }
          }
          .sidebar-notice-dot { animation: sidebarNoticePulse 1.8s ease-in-out infinite; }
        `}</style>
      </aside>
    </>
  );
}
