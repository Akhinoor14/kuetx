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
import * as noticeApi from '../lib/noticeUtils';
import SidebarNavStudent, { findStudentNavItem } from './nav-system/SidebarNavStudent';
import SidebarNavFaculty, { findFacultyNavItem } from './nav-system/SidebarNavFaculty';

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

  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const latestNoticesRef = useRef([]);
  useEffect(() => {
    const groupId = getGroupId(profile);
    const recompute = () => {
      const readIds = noticeApi.getReadNoticeIds();
      setUnreadNoticeCount(noticeApi.getUnreadNotices(latestNoticesRef.current, readIds).length);
    };
    const unsub = noticeApi.subscribeAllNotices(profile, groupId, (notices) => {
      latestNoticesRef.current = notices;
      recompute();
    }, 'student', { isViewerCR: isRealCR });
    window.addEventListener('kuetx:store-updated', recompute);
    return () => {
      unsub();
      window.removeEventListener('kuetx:store-updated', recompute);
    };
  }, [profile.dept, profile.batch, isRealCR]);

  useEffect(() => {
    const groupId = getGroupId(profile);
    if (!groupId) { setIsRealCR(false); return; }
    return subscribeMembers(groupId, (members) => {
      const me = members.find((m) => m.id === auth.currentUser?.uid);
      const value = me?.role === 'cr' || me?.role === 'acr';
      setIsRealCR(value);
      try { sessionStorage.setItem('kuetx:lastKnownIsRealCR', value ? '1' : '0'); } catch { /* ignore */ }
    });
  }, [profile.dept, profile.batch]);

  useEffect(() => {
    const syncProfile = () => setProfile(store.get('profile') || DEFAULT_PROFILE);
    window.addEventListener('kuetx:store-updated', syncProfile);
    syncProfile();
    return () => window.removeEventListener('kuetx:store-updated', syncProfile);
  }, []);

  // Quick-strip lookups: resolve against whichever shell is active, using
  // that shell's own (never the other's) nav-item finder.
  const findNavItem = viewMode === 'teacher' ? findFacultyNavItem : findStudentNavItem;
  const getPageLabel = (path) => {
    const i = findNavItem(path);
    return i ? i.label : (path === '/' ? 'Dashboard' : path);
  };
  const getPageIcon = (path) => {
    const i = findNavItem(path);
    return i ? (Icons[i.icon] || Circle) : Circle;
  };

  const quickItems = [...new Set([...pinnedPages, ...favorites])].slice(0, 5);

  const isAnonymous = authState?.isAnonymous ?? true;
  const syncStatus = authState?.syncStatus ?? 'idle';
  const displayName = authState?.displayName || null;

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
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
              {viewMode === 'teacher' ? 'Faculty Portal · KUET' : 'Student Life OS · KUET'}
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
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--inputBg)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon size={13} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--muted)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPageLabel(path)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Nav: exactly one of the two shells renders, never both ── */}
        {viewMode === 'teacher' ? (
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
