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
import { useSidebarResize } from '../hooks/useSidebarResize';

const GROUP_ICONS = {
  'Overview':   'LayoutDashboard',
  'Class Rep':  'Shield',
  'Academics':  'GraduationCap',
  'Daily Life': 'Sunrise',
  'Wellbeing':  'Heart',
  'Activities': 'Layers',
  'Finance':    'Wallet',
  'Tools':      'Wrench',
};

const GROUP_COLORS = {
  'Overview':   '#3b82f6',
  'Class Rep':  '#a78bfa',
  'Academics':  '#3b82f6',
  'Daily Life': '#f59e0b',
  'Wellbeing':  '#ec4899',
  'Activities': '#f97316',
  'Finance':    '#10b981',
  'Tools':      '#64748b',
};

// Short labels for grid cells (tight space)
const SHORT_LABELS = {
  'dashboard':        'Dashboard',
  'quick-access':     'Quick Access',
  'profile':          'Profile',
  'notes':            'Notes',
  'class-management': 'Class Mgmt',
  'ct-quiz-planning': 'CT Planner',
  'courses':          'Courses',
  'attendance':       'Attendance',
  'schedule':         'Schedule',
  'assignments':      'Assignments',
  'syllabus':         'Syllabus',
  'qbank':            'Q. Bank',
  'solutions':        'Sol. Bank',
  'marks':            'Planner',
  'results':          'Results',
  'teachers':         'Teachers',
  'diary':            'Diary',
  'self-study':       'Self Study',
  'time':             'Time',
  'namaz':            'Namaz',
  'self-eval':        'Self Eval',
  'smart-score':      'Sm. Score',
  'clubs':            'Clubs',
  'projects':         'Projects',
  'tours':            'Tours',
  'social':           'Social',
  'money':            'Money',
  'tuition':          'Tuition',
  'food':             'Food',
  'warnings':         'Alerts',
  'reports':          'Reports',
  'settings':         'Settings',
  'about':            'About',
};

// SyncBadge
function SyncBadge({ status }) {
  const cfg = {
    synced:  { color: '#10b981', label: 'Synced',   icon: <Icons.CheckCircle2 size={11} /> },
    syncing: { color: '#f59e0b', label: 'Syncing…', icon: <Icons.RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> },
    pending: { color: '#f59e0b', label: 'Pending',  icon: <Icons.Clock size={11} /> },
    error:   { color: '#ef4444', label: 'Error',    icon: <Icons.WifiOff size={11} /> },
    idle:    { color: 'var(--muted)', label: 'Idle', icon: <Icons.Cloud size={11} /> },
  }[status] || { color: 'var(--muted)', label: status, icon: <Icons.Cloud size={11} /> };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// Step button icon based on cols
function StepIcon({ cols }) {
  if (cols === 0) return <Icons.PanelLeftClose size={14} />;
  if (cols === 1) return <Icons.List size={14} />;
  if (cols === 2) return <Icons.LayoutGrid size={14} />;
  if (cols === 3) return <Icons.Grid3x3 size={14} />;
  return <Icons.Grid size={14} />;
}

// Floating drag handle pill
function DragHandle({ onMouseDown }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Drag to resize"
      className="hidden md:flex"
      style={{
        position: 'absolute',
        right: -6,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 12,
        height: 40,
        borderRadius: 6,
        background: hovered ? 'color-mix(in srgb, var(--accent) 15%, var(--surface))' : 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'col-resize',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 3,
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 2, height: 2, borderRadius: '50%',
          background: hovered ? 'var(--accent)' : 'var(--muted)',
          transition: 'background 0.15s',
        }} />
      ))}
    </div>
  );
}

// Single nav cell (grid mode)
function NavCell({ item, active, groupColor, onClose, cols }) {
  const Icon = Icons[item.icon] || Icons.Circle;
  const label = SHORT_LABELS[item.id] || item.label;
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={item.path}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        padding: cols >= 3 ? '6px 2px' : '7px 4px',
        borderRadius: 8,
        textDecoration: 'none',
        background: active
          ? `color-mix(in srgb, ${groupColor} 12%, var(--surface))`
          : hovered
          ? `color-mix(in srgb, ${groupColor} 7%, var(--surface))`
          : 'transparent',
        outline: active ? `1.5px solid color-mix(in srgb, ${groupColor} 40%, transparent)` : 'none',
        transition: 'background 0.12s, outline 0.12s',
        minHeight: 52,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: active
          ? `color-mix(in srgb, ${groupColor} 22%, var(--surface))`
          : `color-mix(in srgb, ${groupColor} 13%, var(--surface))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s',
      }}>
        <Icon size={14} strokeWidth={active ? 2.5 : 1.8} color={active ? groupColor : `color-mix(in srgb, ${groupColor} 80%, var(--muted))`} />
      </div>
      <span style={{
        fontSize: 9.5,
        fontWeight: active ? 700 : 500,
        color: active ? groupColor : 'var(--text)',
        textAlign: 'center',
        lineHeight: 1.3,
        wordBreak: 'break-word',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        width: '100%',
        transition: 'color 0.12s',
      }}>
        {label}
      </span>
    </Link>
  );
}

// Single nav item (1-col list mode)
function NavListItem({ item, active, groupColor, onClose }) {
  const Icon = Icons[item.icon] || Icons.Circle;
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={item.path}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.label}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 8, textDecoration: 'none',
        fontSize: 12, fontWeight: active ? 700 : 500,
        color: active ? groupColor : 'var(--text)',
        background: active
          ? `color-mix(in srgb, ${groupColor} 10%, var(--surface))`
          : hovered ? 'var(--inputBg)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <Icon size={14} strokeWidth={active ? 2.5 : 1.8}
        style={{ flexShrink: 0, color: active ? groupColor : 'var(--muted)' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
    </Link>
  );
}

export function Sidebar({ open, onClose, authState }) {
  const location = useLocation();
  const [profile, setProfile] = useState(() => store.get('profile') || DEFAULT_PROFILE);
  const [navConfig] = useNavConfig();
  const { favorites } = useFavorites();
  const { pinnedPages } = usePinnedPages();
  const [mode, setMode] = useState(getAppMode);
  const { width, cols, isUltraCompact, onMouseDown, stepCols } = useSidebarResize();

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

  const getPageLabel = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return i.label; }
    return path === '/' ? 'Dashboard' : path;
  };
  const getPageIcon = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return Icons[i.icon] || Icons.Circle; }
    return Icons.Circle;
  };

  const quickItems = [...new Set([...pinnedPages, ...favorites])].slice(0, 5);
  const isAnonymous = authState?.isAnonymous ?? true;
  const syncStatus = authState?.syncStatus ?? 'idle';
  const displayName = authState?.displayName || null;

  // CSS variable so main-content can follow
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  }, [width]);

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          className="md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar ${open ? 'open' : ''}`}
        style={{ width, minWidth: width, transition: 'none', position: 'relative' }}
      >

        {/* Logo header */}
        <div style={{
          padding: isUltraCompact ? '16px 10px 12px' : '16px 14px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isUltraCompact ? 'center' : 'space-between', gap: 8 }}>
            {isUltraCompact ? (
              // Ultra-compact: logo click expands the sidebar (intentional — confirmed)
              <button onClick={stepCols} className="hidden md:flex"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, alignItems: 'center', justifyContent: 'center' }}
                title="Expand sidebar">
                <Logo size={36} />
              </button>
            ) : (
              // Normal state: logo click goes to Quick Access
              <Link to="/quick-access" onClick={onClose}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', minWidth: 0, flex: 1 }}>
                <Wordmark height={30} />
              </Link>
            )}
            {!isUltraCompact && (
              <button
                onClick={stepCols}
                className="hidden md:flex"
                title={`Columns: ${cols} — click to cycle`}
                style={{
                  width: 28, height: 28,
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  flexShrink: 0,
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--inputBg)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
              >
                <StepIcon cols={cols} />
              </button>
            )}
          </div>
          {!isUltraCompact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Student Life OS · KUET</div>
              {mode === 'jr' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JR</span>
              )}
            </div>
          )}
        </div>

        {/* Quick strip — only in list/grid modes */}
        {!isUltraCompact && quickItems.length > 0 && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icons.Zap size={10} color="var(--accent)" /> Quick
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {quickItems.map(path => {
                const Icon = getPageIcon(path);
                const active = location.pathname === path;
                return (
                  <Link key={path} to={path} onClick={onClose}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '5px 7px', borderRadius: 7, textDecoration: 'none',
                      fontSize: 11, fontWeight: active ? 700 : 500,
                      color: active ? 'var(--accent)' : 'var(--text)',
                      background: active ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--inputBg)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon size={12} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--muted)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPageLabel(path)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: isUltraCompact ? '8px 6px 16px' : '6px 8px 16px', overscrollBehavior: 'contain' }}>
          {filteredNav.map((section, idx) => {
            const GroupIcon = Icons[GROUP_ICONS[section.group]] || Icons.Circle;
            const groupColor = GROUP_COLORS[section.group] || 'var(--muted)';

            // Ultra compact: icon-only column
            if (isUltraCompact) {
              return (
                <div key={section.group}>
                  {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 8px', opacity: 0.5 }} />}
                  {section.items.map(item => {
                    const Icon = Icons[item.icon] || Icons.Circle;
                    const active = location.pathname === item.path;
                    return (
                      <Link key={item.id} to={item.path} onClick={onClose}
                        title={item.label}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '8px 0', borderRadius: 8, textDecoration: 'none',
                          color: active ? groupColor : 'var(--muted)',
                          background: active ? `color-mix(in srgb, ${groupColor} 12%, var(--surface))` : 'transparent',
                          margin: '1px 0',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--inputBg)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
                      </Link>
                    );
                  })}
                </div>
              );
            }

            // 1-col list mode
            if (cols === 1) {
              return (
                <div key={section.group} style={{ marginBottom: 6 }}>
                  {/* Group header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px 4px',
                    borderLeft: `3px solid ${groupColor}`,
                    background: `color-mix(in srgb, ${groupColor} 7%, var(--surface))`,
                    borderRadius: '0 7px 7px 0',
                    marginBottom: 2,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      background: `color-mix(in srgb, ${groupColor} 18%, var(--surface))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GroupIcon size={10} color={groupColor} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: groupColor, textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 }}>
                      {section.group}
                    </span>
                    <span style={{ fontSize: 9, color: `color-mix(in srgb, ${groupColor} 60%, var(--muted))`, fontWeight: 600 }}>
                      {section.items.length}
                    </span>
                  </div>
                  <div style={{ paddingLeft: 4, marginLeft: 10, borderLeft: `2px solid color-mix(in srgb, ${groupColor} 20%, transparent)` }}>
                    {section.items.map(item => (
                      <NavListItem
                        key={item.id}
                        item={item}
                        active={location.pathname === item.path}
                        groupColor={groupColor}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            // Grid mode (2, 3, 4 cols)
            return (
              <div key={section.group} style={{ marginBottom: 8 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 6px 4px',
                  borderLeft: `3px solid ${groupColor}`,
                  background: `color-mix(in srgb, ${groupColor} 6%, var(--surface))`,
                  borderRadius: '0 6px 6px 0',
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: `color-mix(in srgb, ${groupColor} 18%, var(--surface))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <GroupIcon size={9} color={groupColor} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: groupColor, textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 }}>
                    {section.group}
                  </span>
                  <span style={{ fontSize: 9, color: `color-mix(in srgb, ${groupColor} 55%, var(--muted))`, fontWeight: 600 }}>
                    {section.items.length}
                  </span>
                </div>
                {/* Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 3,
                  padding: '0 2px',
                }}>
                  {section.items.map(item => (
                    <NavCell
                      key={item.id}
                      item={item}
                      active={location.pathname === item.path}
                      groupColor={groupColor}
                      onClose={onClose}
                      cols={cols}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom auth strip */}
        <div style={{ padding: isUltraCompact ? '10px 8px' : '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {isUltraCompact ? (
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: isAnonymous ? 'var(--inputBg)' : 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
                    border: `1.5px solid ${isAnonymous ? 'var(--border)' : 'var(--accent)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isAnonymous ? <Icons.UserX size={10} color="var(--muted)" /> : <Icons.User size={10} color="var(--accent)" />}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
                    {isAnonymous ? 'No account' : (displayName || 'Signed in')}
                  </span>
                </div>
                {isAnonymous ? (
                  <button onClick={() => window.__kuetxShowUpgrade?.()}
                    style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
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

        {/* Drag handle pill */}
        <DragHandle onMouseDown={onMouseDown} />

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </aside>
    </>
  );
}
