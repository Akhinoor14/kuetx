import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { Logo, Wordmark } from './Logo';
import { APP_VERSION_SHORT } from '../version';
import { store, DEFAULT_PROFILE } from '../store/store';
import { useNavConfig } from './nav-system/useNavConfig';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getAppMode, filterNav, getJrCustomHidden, getJrCustomShown } from '../lib/modeFilter';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMembers } from '../lib/groupSync';
import { auth } from '../lib/firebase';

const GROUP_ICONS = {
  'Overview':    'LayoutDashboard',
  'Class Rep':   'Shield',
  'Academics':   'GraduationCap',
  'Daily Life':  'Sunrise',
  'Campus Life': 'Layers',
  'Tools':       'Wrench',
};

// ── Firebase sync status pill ─────────────────────────────────────────────────
function SyncBadge({ status }) {
  const cfg = {
    synced:   { color: '#10b981', label: 'Synced',   icon: <Icons.CheckCircle2 size={11} /> },
    syncing:  { color: '#f59e0b', label: 'Syncing…', icon: <Icons.RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> },
    pending:  { color: '#f59e0b', label: 'Pending',  icon: <Icons.Clock size={11} /> },
    error:    { color: '#ef4444', label: 'Error',    icon: <Icons.WifiOff size={11} /> },
    idle:     { color: 'var(--muted)', label: 'Idle', icon: <Icons.Cloud size={11} /> },
  }[status] || { color: 'var(--muted)', label: status, icon: <Icons.Cloud size={11} /> };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, color: cfg.color,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Nav row: shared for both hub rows and leaf item rows ─────────────────────
// Neutral/synchronized style: default state is muted gray for every group,
// a single accent color takes over on hover/active. No per-group hues.
function NavRow({ to, label, iconName, active, onClose, count }) {
  const Icon = Icons[iconName] || Icons.Circle;
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        textDecoration: 'none',
        marginBottom: 1,
        transition: 'background 0.12s, color 0.12s',
        background: active
          ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))'
          : hovered
          ? 'var(--inputBg)'
          : 'transparent',
      }}
    >
      <Icon
        size={16}
        strokeWidth={active ? 2.4 : 1.8}
        style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--muted)' }}
      />
      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--accent)' : 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {typeof count === 'number' && (
        <span style={{
          fontSize: 9, fontWeight: 600,
          color: active ? 'var(--accent)' : 'var(--muted)',
          background: active
            ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))'
            : 'var(--inputBg)',
          borderRadius: 4,
          padding: '1px 5px',
          flexShrink: 0,
        }}>
          {count}
        </span>
      )}
    </Link>
  );
}

// ── Section label (small uppercase divider, no color-coding) ─────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      padding: '10px 10px 4px',
    }}>
      {children}
    </div>
  );
}

export function Sidebar({ open, onClose, authState }) {
  const location = useLocation();
  const [profile, setProfile] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [navConfig] = useNavConfig();
  const { favorites } = useFavorites();
  const { pinnedPages } = usePinnedPages();
  const [appMode, setAppMode] = useState(getAppMode);
  const [isRealCR, setIsRealCR] = useState(false);
  // profile.isCR is just a self-ticked checkbox from Profile Setup with no
  // verification behind it — showing the CR tools link based on it alone
  // let anyone tick the box and see (and, before RequireCR existed, even
  // open) CR-only pages. isRealCR is the only trustworthy signal here.
  const canSeeCrBoard = isRealCR && navConfig.cr_board_enabled;

  useEffect(() => {
    const groupId = getGroupId(profile);
    if (!groupId) { setIsRealCR(false); return; }
    return subscribeMembers(groupId, (members) => {
      const me = members.find((m) => m.id === auth.currentUser?.uid);
      setIsRealCR(me?.role === 'cr' || me?.role === 'acr');
    });
  }, [profile.dept, profile.batch]);

  useEffect(() => {
    const handler = (e) => setAppMode(e.detail?.mode || getAppMode());
    window.addEventListener('kuetx:mode-changed', handler);
    return () => window.removeEventListener('kuetx:mode-changed', handler);
  }, []);

  useEffect(() => {
    const syncProfile = () => setProfile(store.get('profile') || DEFAULT_PROFILE);
    window.addEventListener('kuetx:store-updated', syncProfile);
    syncProfile();
    return () => window.removeEventListener('kuetx:store-updated', syncProfile);
  }, []);

  const filteredNav = filterNav(NAV, appMode, canSeeCrBoard, getJrCustomHidden(), getJrCustomShown());

  const findNavItem = (path) => {
    for (const s of NAV) {
      const pools = s.subgroups ? s.subgroups.map(sub => sub.items) : [s.items];
      for (const pool of pools) {
        const i = pool.find(i => i.path === path);
        if (i) return i;
      }
    }
    return null;
  };
  const getPageLabel = (path) => {
    const i = findNavItem(path);
    return i ? i.label : (path === '/' ? 'Dashboard' : path);
  };
  const getPageIcon = (path) => {
    const i = findNavItem(path);
    return i ? (Icons[i.icon] || Icons.Circle) : Icons.Circle;
  };

  const quickItems = [...new Set([...pinnedPages, ...favorites])].slice(0, 5);

  // Auth info from authState prop
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
              <Wordmark height={26} />
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Student Life OS · KUET</div>
            {appMode === 'jr' && (
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JR</span>
            )}
          </div>
        </div>

        {/* ── Quick strip ── */}
        {quickItems.length > 0 && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icons.Zap size={10} color="var(--accent)" /> Quick
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

        {/* ── Nav: flat hub list — every group renders as one row ── */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 16px' }}>
          {filteredNav.map((section, idx) => {
            const isHub = section.isSubgroup && !section.subgroups;

            // Whole-group hub row (Overview, Class Rep, Campus Life, Daily Life, Tools)
            if (isHub) {
              const active = location.pathname === section.hubPath;
              return (
                <div key={section.group}>
                  {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
                  <NavRow
                    to={section.hubPath}
                    label={section.group}
                    iconName={section.hubIcon || GROUP_ICONS[section.group] || 'Circle'}
                    active={active}
                    onClose={onClose}
                    count={section.items.length}
                  />
                </div>
              );
            }

            // Group split into subgroups (Academics): one row per subgroup hub
            if (section.subgroups) {
              return (
                <div key={section.group}>
                  {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
                  <SectionLabel>{section.group}</SectionLabel>
                  {section.subgroups.map(sub => (
                    <NavRow
                      key={sub.name}
                      to={sub.hubPath}
                      label={sub.name}
                      iconName={sub.hubIcon || 'Circle'}
                      active={location.pathname === sub.hubPath}
                      onClose={onClose}
                      count={sub.items.length}
                    />
                  ))}
                </div>
              );
            }

            // Fallback: direct flat group (shouldn't normally hit since all
            // groups are hubs/subgroups now, but keep for safety)
            return (
              <div key={section.group}>
                {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
                <SectionLabel>{section.group}</SectionLabel>
                {section.items.map(item => (
                  <NavRow
                    key={item.id}
                    to={item.path}
                    label={item.label}
                    iconName={item.icon}
                    active={location.pathname === item.path}
                    onClose={onClose}
                  />
                ))}
              </div>
            );
          })}
        </nav>

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
                    ? <Icons.UserX size={11} color="var(--muted)" />
                    : <Icons.User size={11} color="var(--accent)" />}
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

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </aside>
    </>
  );
}
