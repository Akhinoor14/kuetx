import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { Logo, Wordmark } from './Logo';
import { store, DEFAULT_PROFILE } from '../store/store';
import { useNavConfig } from './nav-system/useNavConfig';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getAppMode, filterNav, getJrCustomHidden, getJrCustomShown } from '../lib/modeFilter';

const GROUP_ICONS = {
  'Overview':    'LayoutDashboard',
  'Class Rep':   'Shield',
  'Academics':   'GraduationCap',
  'Daily Life':  'Sunrise',
  'Wellbeing':   'Heart',
  'Activities':  'Layers',
  'Finance':     'Wallet',
  'Tools':       'Wrench',
};

const GROUP_COLORS = {
  'Overview':    'var(--accent)',
  'Class Rep':   '#a78bfa',
  'Academics':   '#3b82f6',
  'Daily Life':  '#f59e0b',
  'Wellbeing':   '#ec4899',
  'Activities':  '#f97316',
  'Finance':     '#10b981',
  'Tools':       '#64748b',
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

export function Sidebar({ open, onClose, compact = false, onToggleCompact, authState }) {
  const location = useLocation();
  const [profile, setProfile] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [navConfig] = useNavConfig();
  const { favorites } = useFavorites();
  const { pinnedPages } = usePinnedPages();
  const [mode, setMode] = useState(getAppMode);
  const canSeeCrBoard = !!profile.isCR && navConfig.cr_board_enabled;

  useEffect(() => {
    const handler = (e) => setMode(e.detail?.mode || getAppMode());
    window.addEventListener('kuetx:mode-changed', handler);
    return () => window.removeEventListener('kuetx:mode-changed', handler);
  }, []);

  useEffect(() => {
    const syncProfile = () => setProfile(store.get('profile') || DEFAULT_PROFILE);
    window.addEventListener('kuetx:store-updated', syncProfile);
    syncProfile();
    return () => window.removeEventListener('kuetx:store-updated', syncProfile);
  }, []);

  const filteredNav = filterNav(NAV, mode, canSeeCrBoard, getJrCustomHidden(), getJrCustomShown());

  const activeGroup = (() => {
    for (const section of filteredNav) {
      if (section.items.some(i => i.path === location.pathname)) return section.group;
    }
    return null;
  })();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kuetx_sidebar_collapsed') || '{}');
      const init = {};
      NAV.forEach(s => { init[s.group] = saved[s.group] !== undefined ? saved[s.group] : true; });
      if (activeGroup) init[activeGroup] = false;
      return init;
    } catch {
      const init = {};
      NAV.forEach(s => { init[s.group] = true; });
      if (activeGroup) init[activeGroup] = false;
      return init;
    }
  });

  useEffect(() => {
    if (!activeGroup) return;
    setCollapsed(prev => {
      if (!prev[activeGroup]) return prev;
      const next = { ...prev, [activeGroup]: false };
      try { localStorage.setItem('kuetx_sidebar_collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeGroup]);

  const toggleGroup = (group) => {
    setCollapsed(prev => {
      const next = { ...prev, [group]: !prev[group] };
      try { localStorage.setItem('kuetx_sidebar_collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const getPageLabel = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return i.label; }
    return path === '/' ? 'Dashboard' : path;
  };
  const getPageIcon = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return Icons[i.icon] || Icons.Circle; }
    return Icons.Circle;
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

      <aside className={`sidebar ${open ? 'open' : ''} ${compact ? 'compact' : ''}`}>

        {/* Logo */}
        <div style={{ padding: compact ? '16px 10px 12px' : '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between', gap: 8 }}>
            {compact ? (
              <button onClick={onToggleCompact} className="hidden md:flex"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, alignItems: 'center', justifyContent: 'center' }} title="Expand">
                <Logo size={40} />
              </button>
            ) : (
              <Link to="/about" onClick={onClose}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                <Wordmark height={32} />
              </Link>
            )}
            {!compact && (
              <button onClick={onToggleCompact} className="hidden md:flex"
                style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }} title="Compact">
                <Icons.PanelLeftClose size={14} />
              </button>
            )}
          </div>
          {!compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Student Life OS · KUET</div>
              {mode === 'jr' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JR</span>
              )}
            </div>
          )}
        </div>

        {/* Quick strip */}
        {!compact && quickItems.length > 0 && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icons.Zap size={10} color="var(--accent)" /> Quick
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {quickItems.map(path => {
                const Icon = getPageIcon(path);
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} onClick={onClose}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text)', background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'transparent', transition: 'background 0.1s' }}
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

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: compact ? '8px 6px 16px' : '6px 8px 16px' }}>
          {filteredNav.map((section, idx) => {
            const GroupIcon = Icons[GROUP_ICONS[section.group]] || Icons.Circle;
            const groupColor = GROUP_COLORS[section.group] || 'var(--muted)';
            const isCollapsed = collapsed[section.group];
            const isActive = section.group === activeGroup;

            if (compact) {
              return (
                <div key={section.group}>
                  {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '8px 10px', opacity: 0.5 }} />}
                  {section.items.map(item => {
                    const Icon = Icons[item.icon] || Icons.Circle;
                    const active = location.pathname === item.path;
                    return (
                      <Link key={item.id} to={item.path} onClick={onClose}
                        className={`nav-item ${active ? 'active' : ''}`}
                        title={item.label}
                        style={{ justifyContent: 'center', padding: '9px 0' }}>
                        <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={section.group} style={{ marginBottom: isCollapsed ? 2 : 4 }}>
                <button onClick={() => toggleGroup(section.group)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                    padding: isCollapsed ? '5px 8px' : '6px 8px 5px',
                    background: isCollapsed
                      ? `color-mix(in srgb, ${groupColor} 9%, var(--surface))`
                      : 'transparent',
                    border: 'none',
                    borderLeft: isCollapsed ? `3px solid ${groupColor}` : '3px solid transparent',
                    cursor: 'pointer',
                    borderRadius: isCollapsed ? '0 8px 8px 0' : 8,
                    transition: 'all 0.15s ease',
                    marginLeft: isCollapsed ? 0 : 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isCollapsed
                      ? `color-mix(in srgb, ${groupColor} 15%, var(--surface))`
                      : 'var(--inputBg)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isCollapsed
                      ? `color-mix(in srgb, ${groupColor} 9%, var(--surface))`
                      : 'transparent';
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: isCollapsed
                      ? `color-mix(in srgb, ${groupColor} 20%, var(--surface))`
                      : isActive
                        ? `color-mix(in srgb, ${groupColor} 15%, var(--surface))`
                        : 'var(--inputBg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                    <GroupIcon size={11} color={isCollapsed ? groupColor : isActive ? groupColor : 'var(--muted)'} />
                  </div>
                  <span style={{
                    flex: 1, textAlign: 'left', fontSize: 11,
                    fontWeight: isCollapsed ? 700 : isActive ? 700 : 600,
                    color: isCollapsed ? groupColor : isActive ? groupColor : 'var(--muted)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    transition: 'color 0.15s',
                  }}>
                    {section.group}
                  </span>
                  <Icons.ChevronDown size={12}
                    color={isCollapsed ? groupColor : 'var(--muted)'}
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease, color 0.15s', flexShrink: 0 }} />
                </button>

                {!isCollapsed && (
                  <div style={{ paddingLeft: 4, borderLeft: `2px solid color-mix(in srgb, ${groupColor} 20%, transparent)`, marginLeft: 10, marginTop: 2 }}>
                    {section.items.map(item => {
                      const Icon = Icons[item.icon] || Icons.Circle;
                      const active = location.pathname === item.path;
                      return (
                        <Link key={item.id} to={item.path} onClick={onClose}
                          className={`nav-item ${active ? 'active' : ''}`}
                          title={item.label}
                          style={active ? { color: groupColor, background: `color-mix(in srgb, ${groupColor} 10%, var(--surface))` } : {}}>
                          <Icon size={15} strokeWidth={active ? 2.5 : 1.8}
                            style={{ flexShrink: 0, color: active ? groupColor : undefined }} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom — Firebase status + account */}
        <div style={{ padding: compact ? '10px 8px' : '10px 14px', borderTop: '1px solid var(--border)' }}>
          {compact ? (
            // Compact: just a colored dot
            <div style={{ display: 'flex', justifyContent: 'center' }} title={isAnonymous ? 'No account' : `Signed in · ${syncStatus}`}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isAnonymous ? 'var(--muted)' :
                  syncStatus === 'synced' ? '#10b981' :
                  syncStatus === 'error' ? '#ef4444' : '#f59e0b',
              }} />
            </div>
          ) : (
            <div>
              {/* Account row */}
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

                {/* Connect / sync status */}
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

              {/* Version line */}
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>KUETx v3.4 · Firebase sync</div>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </aside>
    </>
  );
}