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

// Short labels for 2-col grid (tight space)
const SHORT_LABELS = {
  'Quick Access':      'Quick',
  'Class Management':  'CR Board',
  'CT & Quiz Planner': 'CT Plan',
  'Attendance':        'Attend.',
  'Class Schedule':    'Schedule',
  'Assignments':       'Assign.',
  'Question Bank':     'Q. Bank',
  'Solution Bank':     'Sol. Bank',
  'Term Planner':      'Planner',
  'Results & GPA':     'Results',
  'Class Diary':       'Diary',
  'Self Study':        'Study',
  'Time Tracker':      'Time',
  'Namaz Tracker':     'Namaz',
  'Self Eval':         'Self Eval',
  'Smart Score':       'Score',
  'Social Time':       'Social',
  'Food & Health':     'Food',
  'About KUETx':       'About',
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

// ── 2-col grid cell ───────────────────────────────────────────────────────────
function NavCell({ item, groupColor, active, onClose, is3col }) {
  const Icon = Icons[item.icon] || Icons.Circle;
  const shortLabel = SHORT_LABELS[item.label] || item.label;
  const [hovered, setHovered] = useState(false);
  const iconSize = is3col ? 12 : 14;
  const labelSize = is3col ? 9 : 10;

  return (
    <Link
      to={item.path}
      onClick={onClose}
      title={item.label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 5,
        padding: '8px 4px',
        borderRadius: 8,
        textDecoration: 'none',
        minHeight: 58,
        transition: 'background 0.12s, outline 0.12s',
        background: active
          ? `color-mix(in srgb, ${groupColor} 12%, var(--surface))`
          : hovered
          ? `color-mix(in srgb, ${groupColor} 8%, var(--surface))`
          : 'transparent',
        outline: active ? `1.5px solid color-mix(in srgb, ${groupColor} 40%, transparent)` : 'none',
        outlineOffset: '-1px',
      }}
    >
      {/* Icon wrapper */}
      <div style={{
        width: 28, height: 28,
        borderRadius: 7,
        flexShrink: 0,
        background: `color-mix(in srgb, ${groupColor} 15%, var(--surface))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon
          size={iconSize}
          strokeWidth={active ? 2.5 : 1.8}
          color={active ? groupColor : `color-mix(in srgb, ${groupColor} 70%, var(--muted))`}
        />
      </div>
      {/* Label */}
      <span style={{
        fontSize: labelSize,
        fontWeight: active ? 700 : 500,
        color: active ? groupColor : 'var(--text)',
        textAlign: 'center',
        lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-word',
        width: '100%',
      }}>
        {shortLabel}
      </span>
    </Link>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────
function GroupHeader({ group, groupColor, itemCount }) {
  const GroupIcon = Icons[GROUP_ICONS[group]] || Icons.Circle;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 8px',
      marginBottom: 4,
      marginTop: 2,
      background: `color-mix(in srgb, ${groupColor} 5%, var(--surface))`,
      borderLeft: `3px solid ${groupColor}`,
      borderRadius: '0 6px 6px 0',
    }}>
      {/* Color dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: groupColor,
      }} />
      <span style={{
        flex: 1,
        fontSize: 10, fontWeight: 700,
        color: groupColor,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>
        {group}
      </span>
      <span style={{
        fontSize: 9, fontWeight: 600,
        color: 'var(--muted)',
        background: 'var(--inputBg)',
        borderRadius: 4,
        padding: '1px 5px',
      }}>
        {itemCount}
      </span>
    </div>
  );
}

export function Sidebar({ open, onClose, mode = '2col', onCycleMode, authState }) {
  const location = useLocation();
  const [profile, setProfile] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [navConfig] = useNavConfig();
  const { favorites } = useFavorites();
  const { pinnedPages } = usePinnedPages();
  const [appMode, setAppMode] = useState(getAppMode);
  const compact = mode === 'compact';
  const [logoHovered, setLogoHovered] = useState(false);
  const canSeeCrBoard = !!profile.isCR && navConfig.cr_board_enabled;

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

      <aside className={`sidebar ${open ? 'open' : ''} mode-${mode}`}>

        {/* ── Logo header ── */}
        <div style={{ padding: compact ? '16px 10px 12px' : '16px 14px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between', gap: 8 }}>
            {compact ? (
              /* Compact: logo doubles as expand button */
              <button onClick={onCycleMode}
                onMouseEnter={() => setLogoHovered(true)}
                onMouseLeave={() => setLogoHovered(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                title="Expand sidebar">
                {logoHovered
                  ? <Icons.PanelLeftOpen size={28} color="var(--accent)" />
                  : <Logo size={38} />}
              </button>
            ) : (
              <Link to="/quick-access" onClick={onClose}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', minWidth: 0, overflow: 'hidden', flexShrink: 1 }}>
                <Logo size={mode === '2col' ? 24 : 30} />
                <Wordmark height={mode === '2col' ? 18 : 26} />
              </Link>
            )}
            {/* Cycle button — always visible on desktop (no Tailwind hidden/flex) */}
            {!compact && (
              <button onClick={onCycleMode}
                title={mode === '2col' ? 'Switch to 3-col' : 'Switch to compact'}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
                {mode === '2col'
                  ? <Icons.LayoutGrid size={14} />
                  : <Icons.PanelLeftClose size={14} />}
              </button>
            )}
          </div>
          {!compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Student Life OS · KUET</div>
              {appMode === 'jr' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JR</span>
              )}
            </div>
          )}
        </div>

        {/* ── Quick strip ── */}
        {!compact && quickItems.length > 0 && (
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

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: compact ? '8px 6px 16px' : '6px 6px 16px' }}>
          {filteredNav.map((section, idx) => {
            const groupColor = GROUP_COLORS[section.group] || 'var(--muted)';

            /* ── Compact mode: icon-only list ── */
            if (compact) {
              return (
                <div key={section.group}>
                  {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 10px', opacity: 0.5 }} />}
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

            /* ── 2-col / 3-col grid with group header ── */
            return (
              <div key={section.group} style={{ marginBottom: 8 }}>
                <GroupHeader
                  group={section.group}
                  groupColor={groupColor}
                  itemCount={section.items.length}
                />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: mode === '3col' ? '1fr 1fr 1fr' : '1fr 1fr',
                  gap: 3,
                  padding: '0 2px',
                }}>
                  {section.items.map(item => (
                    <NavCell
                      key={item.id}
                      item={item}
                      groupColor={groupColor}
                      active={location.pathname === item.path}
                      onClose={onClose}
                      is3col={mode === '3col'}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Bottom — Firebase status + account ── */}
        <div style={{ padding: compact ? '10px 8px' : '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {compact ? (
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
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>KUETx v3.4 · Firebase sync</div>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </aside>
    </>
  );
}