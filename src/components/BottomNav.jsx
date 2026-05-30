import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { store, getProfile } from '../store/store';
import { computeAlerts } from '../pages/Alerts';

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_TABS = 3; // Middle slots only. Dashboard and Menu stay fixed.
const DEFAULT_GROUPS = [
  { id: 'most-used', label: 'Most used', items: [], icon: 'Sparkles', isDefault: true, isSynthetic: true },
  { id: 'academics-daily-default', label: 'Academics & Daily', items: ['courses', 'syllabus', 'qbank', 'teachers', 'diary', 'self-study', 'namaz', 'self-eval'], icon: 'BookOpen', isDefault: true },
  { id: 'finance-activity-default', label: 'Finance & Activities', items: ['payments', 'fees', 'scholarships', 'clubs', 'events'], icon: 'Wallet', isDefault: true },
];
const DEFAULT_TABS = [
  { type: 'group', id: 'most-used' },
  { type: 'group', id: 'academics-daily-default' },
  { type: 'group', id: 'finance-activity-default' },
];

// Group icon map — pick a representative icon per section group
const GROUP_ICONS = {
  'Overview':     'Grid',
  'Class Rep':    'Users',
  'Academics':    'BookOpen',
  'Daily Life':   'Activity',
  'Finance':      'Wallet',
  'Activities':   'Layers',
  'Tools':        'Settings',
  'Information':  'Info',
};

const CUSTOM_GROUP_ICONS = [
  'Folder',
  'Sparkles',
  'Star',
  'BookOpen',
  'CalendarCheck',
  'Clock',
  'Layers',
  'Wallet',
  'MessageCircle',
  'Activity',
  'ShieldCheck',
  'Heart',
  'MapPin',
  'Settings',
];

const USAGE_KEY = 'nav_usage_v1';
const MAX_RECENT = 8;

const COMPACT_BOTTOM_NAV_LABELS = {
  'Class Schedule': 'Schedule',
  'Assignments': 'Tasks',
  'Term Planner': 'Planner',
};

const MOBILE_NAV_QUERY = '(max-width: 767.98px)';

const getBottomNavLabel = (label) => COMPACT_BOTTOM_NAV_LABELS[label] || label;

export function useIsMobileNav() {
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_NAV_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(MOBILE_NAV_QUERY);
    const sync = (event) => setIsMobileNav(event.matches);

    setIsMobileNav(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return isMobileNav;
}

const getUsageState = () => {
  try {
    const saved = store.get(USAGE_KEY);
    if (saved && typeof saved === 'object') return saved;
  } catch {}
  return { counts: {}, recent: [] };
};

const saveUsageState = (next) => {
  try { store.set(USAGE_KEY, next); } catch {}
};

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useBottomNavTabs() {
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = store.get('bottomnav_tabs_v2');
      if (Array.isArray(saved) && saved.length > 0) return saved.slice(0, MAX_TABS);
      // migrate old favourites format
      const old = store.get('bottomnav_favourites');
      if (Array.isArray(old) && old.length > 0) {
        return old.filter(id => id !== 'dashboard').map(id => ({ type: 'page', id })).slice(0, MAX_TABS);
      }
      return DEFAULT_TABS;
    } catch {
      return DEFAULT_TABS;
    }
  });

  const saveTabs = (newTabs) => {
    const nextTabs = Array.isArray(newTabs) ? newTabs.slice(0, MAX_TABS) : [];
    setTabs(nextTabs);
    try { store.set('bottomnav_tabs_v2', nextTabs); } catch {}
  };

  return [tabs, saveTabs];
}

// Custom user groups for the bottom nav (and More drawer)
export function useBottomNavGroups() {
  const [groups, setGroups] = useState(() => {
    try {
      const saved = store.get('bottomnav_groups_v1');
      if (Array.isArray(saved) && saved.length > 0) return saved;
      return DEFAULT_GROUPS;
    } catch {
      return DEFAULT_GROUPS;
    }
  });

  const saveGroups = (next) => {
    setGroups(next);
    try { store.set('bottomnav_groups_v1', next); } catch {}
  };

  return [groups, saveGroups];
}

// Backwards-compatible favourites hook — returns an array of favourite nav IDs
export function useBottomNavFavourites() {
  const [favourites, setFavourites] = useState(() => {
    try {
      const tabs = store.get('bottomnav_tabs_v2');
      if (Array.isArray(tabs) && tabs.length > 0) return tabs.filter(t => t.type === 'page').map(t => t.id).filter(Boolean);
      const old = store.get('bottomnav_favourites');
      if (Array.isArray(old) && old.length > 0) return old;
      // default quick-access favourites (pages only)
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const tabs = store.get('bottomnav_tabs_v2');
        const next = (Array.isArray(tabs) && tabs.length > 0)
          ? tabs.filter(t => t.type === 'page').map(t => t.id).filter(Boolean)
          : (Array.isArray(store.get('bottomnav_favourites')) ? store.get('bottomnav_favourites') : []);
        setFavourites(prev => {
          try {
            if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          } catch {}
          return next;
        });
      } catch {
        // ignore
      }
    };
    window.addEventListener('kuetx:store-updated', sync);
    sync();
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const toggleFavourite = (id) => {
    try {
      const tabs = store.get('bottomnav_tabs_v2') || (Array.isArray(store.get('bottomnav_favourites')) ? store.get('bottomnav_favourites').map(i => ({ type: 'page', id: i })) : []);
      const exists = tabs.some(t => t.id === id);
      const newTabs = exists ? tabs.filter(t => t.id !== id) : [...tabs, { type: 'page', id }];
      store.set('bottomnav_tabs_v2', newTabs);
      setFavourites(newTabs.filter(t => t.type === 'page').map(t => t.id));
    } catch {}
  };

  return [favourites, toggleFavourite];
}

export function useNavUsageData() {
  const [usage, setUsage] = useState(() => getUsageState());

  useEffect(() => {
    const sync = () => {
      try {
        const next = getUsageState();
        setUsage(prev => {
          try {
            if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          } catch {}
          return next;
        });
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    sync();
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  return usage;
}

// All available nav items (flattened, filtered by CR)
export function getAllNavItems(profile) {
  return NAV.flatMap(section =>
    section.items.filter(item => !item.requiresCR || profile?.isCR)
  );
}

// Get visible NAV sections (filtered by CR)
export function getVisibleSections(profile) {
  return NAV.map(section => ({
    ...section,
    items: section.items.filter(item => !item.requiresCR || profile?.isCR),
  })).filter(section => section.items.length > 0);
}

// ── BottomNav ─────────────────────────────────────────────────────────────────
export function BottomNav({ onOpenMore, onOpenGroup }) {
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const [pinnedTabs] = useBottomNavTabs();
  const [customGroups] = useBottomNavGroups();
  const usage = useNavUsageData();
  const [alertCount, setAlertCount] = useState(0);
  const [alertMap, setAlertMap] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState(() => store.get('profile') || {});
  const longPressTimer = useRef(null);
  const touchDraggingState = useRef(false);
  const touchStartY = useRef(null);
  const touchCurrentY = useRef(0);

  useEffect(() => {
    const sync = () => {
      try {
        const next = store.get('profile') || {};
        setProfile(prev => {
          try {
            if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          } catch {
            // fallthrough
          }
          return next;
        });
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    sync();
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNav) setMenuOpen(false);
  }, [isMobileNav]);

  useEffect(() => {
    try {
      const counts = computeAlerts(getProfile());
      const total = (counts.critical?.length || 0) + (counts.warnings?.length || 0) + (counts.positives?.length || 0) + (counts.assignmentAlerts?.length || 0);
      setAlertCount(total);

      // Build a map of alerts per path for per-tab badges
      const map = {};
      const mapDetail = {};
      ['critical','warnings','positives','assignmentAlerts'].forEach(key => {
        (counts[key] || []).forEach(a => {
          if (a && a.link) {
            map[a.link] = (map[a.link] || 0) + 1;
            // determine highest severity for the link
            const existing = mapDetail[a.link];
            const level = (() => {
              if (key === 'critical') return 'danger';
              if (key === 'assignmentAlerts') {
                if (a.priority === 'overdue') return 'danger';
                if (a.priority === 'today') return 'warning';
                return 'info';
              }
              if (key === 'warnings') return 'warning';
              return 'info';
            })();
            const priorityOrder = { danger: 3, warning: 2, info: 1 };
            if (!existing || priorityOrder[level] > priorityOrder[existing.level]) {
              mapDetail[a.link] = { level, count: map[a.link] };
            } else {
              mapDetail[a.link].count = map[a.link];
            }
          }
        });
      });
      setAlertMap(mapDetail);
    } catch {}
  }, [location.pathname]);

  const allItems = useMemo(() => getAllNavItems(profile), [profile]);
  const sections = useMemo(() => getVisibleSections(profile), [profile]);
  const customGroupMap = useMemo(() => new Map((customGroups || []).map(g => [g.id, g])), [customGroups]);

  // Usage tracking temporarily disabled to avoid render loops while other refactors settle.
  // useEffect(() => {
  //   if (!allItems.length) return;
  //   const match = allItems.find(item =>
  //     location.pathname === item.path ||
  //     (item.path !== '/' && location.pathname.startsWith(item.path))
  //   );
  //   if (!match) return;
  //   const usage = getUsageState();
  //   const counts = { ...usage.counts };
  //   counts[match.id] = (counts[match.id] || 0) + 1;
  //   const recent = [match.id, ...usage.recent.filter(id => id !== match.id)].slice(0, MAX_RECENT);
  //   const countsChanged = Object.keys(counts).some(k => counts[k] !== (usage.counts[k] || 0));
  //   const recentChanged = recent.length !== (usage.recent || []).length || recent.some((v, i) => v !== (usage.recent || [])[i]);
  //   if (countsChanged || recentChanged) {
  //     saveUsageState({ counts, recent });
  //   }
  // }, [location.pathname, allItems]);

  const resolveGroupItems = (group) => {
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    return (group.items || []).map(id => itemMap.get(id)).filter(Boolean);
  };

  // Resolve pinned tabs into renderable items
  const resolvedTabs = pinnedTabs
    .filter(t => t.id !== 'dashboard')
    .map(t => {
      // special synthetic "most-used" group resolved from usage data
      if (t.type === 'group' && t.id === 'most-used') {
        const recentIds = (usage?.recent || []).slice(0, MAX_RECENT);
        const items = recentIds.map(id => allItems.find(i => i.id === id)).filter(Boolean);
        if (items.length === 0) return null;
        const section = { group: 'Most used', items };
        const iconName = 'Sparkles';
        const isActive = items.some(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)));
        return { type: 'group', id: t.id, label: 'Most used', iconName, section, isActive };
      }
      if (t.type === 'group') {
        const custom = customGroupMap.get(t.id);
        if (custom) {
          const section = { group: custom.label, items: resolveGroupItems(custom) };
          if (section.items.length === 0) return null;
          const iconName = custom.icon || 'Folder';
          const isActive = section.items.some(item =>
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          );
          return { type: 'group', id: t.id, label: custom.label, iconName, section, isActive };
        }

        const section = sections.find(s => s.group === t.id);
        if (!section) return null;
        const iconName = GROUP_ICONS[section.group] || 'Folder';
        // group is "active" if current page belongs to this group
        const isActive = section.items.some(item =>
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path))
        );
        return { type: 'group', id: t.id, label: t.id, iconName, section, isActive };
      } else {
        const item = allItems.find(i => i.id === t.id);
        if (!item) return null;
        const isActive = location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path));
        return { type: 'page', id: t.id, label: item.label, iconName: item.icon, item, isActive };
      }
    })
    .filter(Boolean)
    .slice(0, MAX_TABS);

  const dashboardItem = allItems.find(i => i.id === 'dashboard');
  const dashActive = location.pathname === '/';

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = 0;
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY - touchStartY.current;
  };

  const handleTouchEnd = () => {
    // Detect a deliberate swipe-up (negative delta beyond threshold)
    if (touchCurrentY.current < -60) {
      try { onOpenMore(); } catch {}
    }
    touchStartY.current = null;
    touchCurrentY.current = 0;
  };

  if (!isMobileNav) return null;

  return (
    <nav className="bottom-nav" aria-label="Main navigation"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dashboard — always first */}
      {dashboardItem && (
        <Link
          to={dashboardItem.path}
          className={`bottom-nav-tab${dashActive ? ' active' : ''}`}
          aria-label="Dashboard"
          aria-current={dashActive ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <Icons.Grid size={22} strokeWidth={1.8} />
          </div>
          <span>{getBottomNavLabel('Dashboard')}</span>
          {alertMap && alertMap[dashboardItem.path] && (
            <span className={`tab-badge tab-badge--${alertMap[dashboardItem.path].level}`}>{alertMap[dashboardItem.path].count > 9 ? '9+' : alertMap[dashboardItem.path].count}</span>
          )}
        </Link>
      )}

      {/* Pinned tabs */}
      {resolvedTabs.map(tab => {
        const Icon = Icons[tab.iconName] || Icons.Circle;
        if (tab.type === 'group') {
          return (
            <button
              key={`group-${tab.id}`}
              className={`bottom-nav-tab${tab.isActive ? ' active' : ''}`}
              onClick={() => onOpenGroup(tab.section)}
              aria-label={tab.label}
            >
              <div className="bottom-nav-icon-wrap">
                <Icon size={22} strokeWidth={1.8} />
              </div>
              <span>{tab.label}</span>
            </button>
          );
        }
        return (
          <Link
            key={`page-${tab.id}`}
            to={tab.item.path}
            className={`bottom-nav-tab${tab.isActive ? ' active' : ''}`}
            aria-label={tab.item.label}
            aria-current={tab.isActive ? 'page' : undefined}
          >
            <div className="bottom-nav-icon-wrap">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <span>{getBottomNavLabel(tab.label)}</span>
            {alertMap && alertMap[tab.item.path] && (
              <span className={`tab-badge tab-badge--${alertMap[tab.item.path].level}`}>{alertMap[tab.item.path].count > 9 ? '9+' : alertMap[tab.item.path].count}</span>
            )}
          </Link>
        );
      })}

      <button
        className="bottom-nav-menu-button"
        onClick={() => setMenuOpen(v => !v)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
      >
        <Icons.Menu size={16} strokeWidth={1.8} />
        <span className="bottom-nav-label">Menu</span>
        {alertCount > 0 && (
          <span className="bottom-nav-badge">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="bottom-nav-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="bottom-nav-menu-popup" role="menu" aria-label="Quick menu">
            <div className="bottom-nav-menu-title">Quick Menu</div>
            <div className="bottom-nav-menu-grid">
              <Link to="/settings" onClick={() => setMenuOpen(false)} className="bottom-nav-menu-item">
                <Icons.Settings size={14} />
                <span>Settings</span>
              </Link>
              <Link to="/settings/navigation" onClick={() => setMenuOpen(false)} className="bottom-nav-menu-item">
                <Icons.SlidersHorizontal size={14} />
                <span>Bottom Bar Control</span>
              </Link>
              <button type="button" onClick={() => { setMenuOpen(false); onOpenMore?.(); }} className="bottom-nav-menu-item">
                <Icons.LayoutGrid size={14} />
                <span>All Pages</span>
              </button>
            </div>
            <div className="bottom-nav-menu-subtitle">Information tools</div>
            <div className="bottom-nav-menu-links">
              <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
              <Link to="/alerts" onClick={() => setMenuOpen(false)}>Alerts</Link>
              <Link to="/reports" onClick={() => setMenuOpen(false)}>Reports</Link>
              <Link to="/notes" onClick={() => setMenuOpen(false)}>Notes</Link>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

// ── Group Mini Drawer ─────────────────────────────────────────────────────────
// Opens when user taps a group tab in bottom nav
export function GroupMiniDrawer({ section, open, onClose }) {
  const location = useLocation();
  const drawerRef = useRef(null);
  const dragStartY = useRef(null);
  const dragCurrentY = useRef(0);

  useEffect(() => { if (open) onClose(); }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const handleTouchStart = useCallback((e) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && drawerRef.current)
      drawerRef.current.style.transform = `translateY(${delta}px)`;
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (drawerRef.current) {
      drawerRef.current.style.transition = '';
      drawerRef.current.style.transform = '';
    }
    if (dragCurrentY.current > 60) onClose();
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  if (!section) return null;

  return (
    <>
      <div
        className={`all-pages-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`all-pages-drawer group-mini-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={section.group}
      >
        {/* Drag handle */}
        <div
          className="drawer-handle-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="drawer-handle-bar" />
        </div>

        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title">{section.group}</div>
          <button onClick={onClose} className="drawer-close-btn" aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>

        {/* Items grid */}
        <div className="drawer-scroll">
          <div className="drawer-grid">
            {section.items.map(item => {
              const Icon = Icons[item.icon] || Icons.Circle;
              const active = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`drawer-item-link${active ? ' active' : ''}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="drawer-item-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ── All Pages Drawer ──────────────────────────────────────────────────────────
export function AllPagesDrawer({ open, onClose, onOpenGroup }) {
  const location = useLocation();
  const [pinnedTabs, setPinnedTabs] = useBottomNavTabs();
  const [customGroups, setCustomGroups] = useBottomNavGroups();
  const [editMode, setEditMode] = useState(false);
  const [groupDraft, setGroupDraft] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [profile] = useState(() => store.get('profile') || {});
  const drawerRef = useRef(null);
  const dragStartY = useRef(null);
  const dragCurrentY = useRef(0);
  const dragItemId = useRef(null);
  const dragOverId = useRef(null);
  const toastTimer = useRef(null);
  const usage = useNavUsageData();

  useEffect(() => { if (open) onClose(); }, [location.pathname]);
  useEffect(() => { if (!open) setEditMode(false); }, [open]);
  useEffect(() => { if (!open) setGroupDraft(null); }, [open]);
  useEffect(() => { if (!open) { setSearchText(''); setSectionFilter('all'); } }, [open]);
  useEffect(() => {
    if (!open && toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
      setToast(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const handleTouchStart = useCallback((e) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    dragCurrentY.current = delta;
    if (delta > 0 && drawerRef.current)
      drawerRef.current.style.transform = `translateY(${delta}px)`;
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (drawerRef.current) {
      drawerRef.current.style.transition = '';
      drawerRef.current.style.transform = '';
    }
    if (dragCurrentY.current > 80) onClose();
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  const allItems = getAllNavItems(profile);
  const sections = getVisibleSections(profile);
  const nonDashTabs = pinnedTabs.filter(t => t.id !== 'dashboard');
  const tabCount = nonDashTabs.length;

  // Check if a page or group is pinned
  const isPinned = (type, id) => pinnedTabs.some(t => t.type === type && t.id === id);

  const customGroupMap = new Map(customGroups.map(g => [g.id, g]));
  const groupItemMap = new Map(allItems.map(i => [i.id, i]));
  const customGroupItems = (group) => (group.items || []).map(id => groupItemMap.get(id)).filter(Boolean);

  const togglePin = (type, id) => {
    const alreadyPinned = isPinned(type, id);
    if (id === 'dashboard') return;
    if (alreadyPinned) {
      const nextTabs = pinnedTabs.filter(t => !(t.type === type && t.id === id));
      setPinnedTabs(nextTabs);
      showToast({
        message: type === 'group' ? 'Group removed from tabs' : 'Removed from tabs',
        undo: () => setPinnedTabs(pinnedTabs),
      });
      return true;
    }
    if (tabCount >= MAX_TABS) {
      showToast({
        message: type === 'group' ? 'Free a tab first to pin this group' : 'Free a tab first to pin this page',
      });
      return false;
    }
    const nextTabs = [...pinnedTabs, { type, id }];
    setPinnedTabs(nextTabs);
    if (type === 'page') {
      const nextGroups = customGroups.map(group => ({
        ...group,
        items: (group.items || []).filter(itemId => itemId !== id),
      })).filter(group => (group.items || []).length > 0);
      setCustomGroups(nextGroups);
    }
    showToast({
      message: type === 'group' ? 'Group pinned to tabs' : 'Pinned to tabs',
      undo: () => setPinnedTabs(pinnedTabs),
    });
    return true;
  };

  const groupedItemIds = (() => {
    const grouped = new Set();
    customGroups.forEach(group => (group.items || []).forEach(id => grouped.add(id)));
    pinnedTabs.filter(t => t.type === 'group').forEach(t => {
      const custom = customGroupMap.get(t.id);
      if (custom) {
        (custom.items || []).forEach(id => grouped.add(id));
        return;
      }
      const section = sections.find(s => s.group === t.id);
      if (section) section.items.forEach(item => grouped.add(item.id));
    });
    return grouped;
  })();

  const pinnedPageIds = new Set(pinnedTabs.filter(t => t.type === 'page').map(t => t.id));
  const hiddenInMore = new Set(['dashboard', ...groupedItemIds, ...pinnedPageIds]);

  const groupTiles = [
    ...customGroups
      .map(group => ({
        id: group.id,
        label: group.label,
        items: customGroupItems(group),
        icon: group.icon || 'Folder',
        isCustom: true,
        isPinned: isPinned('group', group.id),
      }))
      .filter(group => group.items.length > 0),
    ...pinnedTabs.filter(t => t.type === 'group').map(t => {
      const section = sections.find(s => s.group === t.id);
      if (!section) return null;
      return {
        id: t.id,
        label: section.group,
        items: section.items,
        icon: GROUP_ICONS[section.group] || 'Folder',
        isCustom: false,
        isPinned: true,
      };
    }).filter(Boolean),
  ];

  const suggestedItems = (() => {
    const counts = usage?.counts || {};
    return allItems
      .filter(item => item.id !== 'dashboard')
      .filter(item => !hiddenInMore.has(item.id))
      .map(item => ({ item, score: counts[item.id] || 0 }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(row => row.item);
  })();

  const recentItems = (usage?.recent || [])
    .map(id => allItems.find(item => item.id === id))
    .filter(Boolean)
    .filter(item => !hiddenInMore.has(item.id));

  const startNewGroup = () => {
    setGroupDraft({ id: null, label: '', items: [], icon: 'Folder' });
  };

  const startEditGroup = (group) => {
    setGroupDraft({ id: group.id, label: group.label, items: [...(group.items || [])], icon: group.icon || 'Folder' });
  };

  const saveGroup = () => {
    if (!groupDraft) return;
    const label = groupDraft.label.trim();
    if (!label || groupDraft.items.length === 0) return;
    const id = groupDraft.id || `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
    const nextGroup = { id, label, items: [...groupDraft.items], icon: groupDraft.icon || 'Folder' };
    const nextGroups = groupDraft.id
      ? customGroups.map(g => g.id === groupDraft.id ? nextGroup : g)
      : [...customGroups, nextGroup];
    setCustomGroups(nextGroups);
    setGroupDraft(null);
    showToast({
      message: groupDraft.id ? 'Group updated' : 'Group created',
      undo: () => setCustomGroups(customGroups),
    });
  };

  const removeGroup = (id) => {
    const prevGroups = customGroups;
    const prevTabs = pinnedTabs;
    setCustomGroups(customGroups.filter(g => g.id !== id));
    setPinnedTabs(pinnedTabs.filter(t => !(t.type === 'group' && t.id === id)));
    showToast({
      message: 'Group deleted',
      undo: () => { setCustomGroups(prevGroups); setPinnedTabs(prevTabs); },
    });
  };

  const showToast = ({ message, undo }) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2600);
  };

  const resetToDefaults = () => {
    const prevTabs = pinnedTabs;
    const prevGroups = customGroups;
    setPinnedTabs(DEFAULT_TABS);
    setCustomGroups([]);
    showToast({
      message: 'Reset to recommended defaults',
      undo: () => { setPinnedTabs(prevTabs); setCustomGroups(prevGroups); },
    });
  };

  const reorderPinned = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIndex = pinnedTabs.findIndex(t => t.id === fromId);
    const toIndex = pinnedTabs.findIndex(t => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...pinnedTabs];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPinnedTabs(next);
  };

  const movePinned = (id, dir) => {
    const index = pinnedTabs.findIndex(t => t.id === id);
    if (index === -1) return;
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= pinnedTabs.length) return;
    const next = [...pinnedTabs];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setPinnedTabs(next);
  };

  const resolvePinnedLabel = (tab) => {
    if (tab.type === 'group') {
      const custom = customGroupMap.get(tab.id);
      if (custom) return custom.label;
      const section = sections.find(s => s.group === tab.id);
      return section ? section.group : tab.id;
    }
    const item = allItems.find(i => i.id === tab.id);
    return item ? item.label : tab.id;
  };

  const normalizedQuery = searchText.trim().toLowerCase();
  const filteredGroupTiles = groupTiles.filter(group =>
    normalizedQuery ? group.label.toLowerCase().includes(normalizedQuery) : true
  );
  const filteredSections = sections.filter(section =>
    sectionFilter === 'all' || sectionFilter === 'ungrouped' || section.group === sectionFilter
  );

  return (
    <>
      <div
        className={`all-pages-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={`all-pages-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="All pages"
      >
        {/* Drag handle */}
        <div
          className="drawer-handle-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="drawer-handle-bar" />
        </div>

        {/* Header */}
        <div className="drawer-header">
          <div>
            <div className="drawer-title">All Pages</div>
            {editMode && (
              <div className="drawer-subtitle">
                {tabCount}/{MAX_TABS} pinned{tabCount === 0 ? ' — Dashboard only' : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditMode(e => !e)}
              className={`drawer-edit-btn${editMode ? ' active' : ''}`}
            >
              {editMode
                ? <><Icons.Check size={14} /> Done</>
                : <><Icons.Star size={14} /> Edit Tabs</>}
            </button>
            {editMode && (
              <button onClick={resetToDefaults} className="drawer-edit-btn ghost">
                <Icons.RotateCcw size={14} /> Reset
              </button>
            )}
            <button onClick={onClose} className="drawer-close-btn" aria-label="Close">
              <Icons.X size={16} />
            </button>
          </div>
        </div>

        {/* Edit mode hint */}
        {editMode && (
          <div className="drawer-edit-hint">
            <Icons.Info size={14} />
            <span>
              Pin up to {MAX_TABS} items — individual pages <strong>or</strong> whole groups.
              Tap a group header to pin the entire group as one tab.
            </span>
          </div>
        )}

        {/* Search + filter */}
        <div className="drawer-search">
          <div className="drawer-search-field">
            <Icons.Search size={14} />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search pages or groups"
            />
          </div>
          <select
            className="drawer-search-select"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="all">All sections</option>
            <option value="ungrouped">Ungrouped only</option>
            {sections.map(section => (
              <option key={section.group} value={section.group}>{section.group}</option>
            ))}
          </select>
        </div>

        {/* Nav sections */}
        <div className="drawer-scroll">
          {!editMode && filteredGroupTiles.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-header">
                <span className="drawer-section-label">Groups</span>
              </div>
              <div className="group-card-grid">
                {filteredGroupTiles.map(group => {
                  const Icon = Icons[group.icon] || Icons.Folder;
                  return (
                    <button
                      key={group.id}
                      className="group-card"
                      onClick={() => {
                        if (group.items.length === 0) return;
                        onClose();
                        if (typeof onOpenGroup === 'function') {
                          onOpenGroup({ group: group.label, items: group.items });
                        }
                      }}
                    >
                      <div className="group-card-icon">
                        <Icon size={18} />
                      </div>
                      <div className="group-card-title">{group.label}</div>
                      <div className="group-card-meta">{group.items.length} items</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!editMode && recentItems.length > 0 && (
            <div className="drawer-section">
              <div className="drawer-section-header">
                <span className="drawer-section-label">Recently used</span>
              </div>
              <div className="drawer-recent-row">
                {recentItems.map(item => {
                  const Icon = Icons[item.icon] || Icons.Circle;
                  return (
                    <Link key={item.id} to={item.path} className="drawer-recent-chip">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {!editMode && suggestedItems.length >= 3 && (
            <div className="drawer-section">
              <div className="drawer-section-header">
                <span className="drawer-section-label">Suggested group</span>
              </div>
              <div className="group-suggest-card">
                <div>
                  <div className="group-card-title">Most used</div>
                  <div className="group-card-meta">{suggestedItems.length} items</div>
                </div>
                <button
                  className="group-chip primary"
                  onClick={() => {
                    const id = `custom:most-used-${Date.now().toString(36).slice(-4)}`;
                    const nextGroups = [...customGroups, { id, label: 'Most used', items: suggestedItems.map(i => i.id), icon: 'Sparkles' }];
                    setCustomGroups(nextGroups);
                    showToast({ message: 'Suggested group created', undo: () => setCustomGroups(customGroups) });
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {editMode && (
            <div className="drawer-section">
              <div className="drawer-section-header">
                <span className="drawer-section-label">Custom Groups</span>
              </div>
              <div className="group-card-grid">
                {customGroups.map(group => {
                  const pinned = isPinned('group', group.id);
                  const canAddGroup = tabCount < MAX_TABS || pinned;
                  const Icon = Icons[group.icon || 'Folder'] || Icons.Folder;
                  return (
                    <div
                      key={group.id}
                      className="group-card group-card--edit"
                      onTouchStart={(e) => {
                        const target = e.currentTarget;
                        target._pressTimer = setTimeout(() => startEditGroup(group), 350);
                      }}
                      onTouchMove={(e) => {
                        const timer = e.currentTarget._pressTimer;
                        if (timer) { clearTimeout(timer); e.currentTarget._pressTimer = null; }
                      }}
                      onTouchEnd={(e) => {
                        const timer = e.currentTarget._pressTimer;
                        if (timer) clearTimeout(timer);
                      }}
                    >
                      <div className="group-card-icon">
                        <Icon size={18} />
                      </div>
                      <div className="group-card-title">{group.label}</div>
                      <div className="group-card-meta">{(group.items || []).length} items</div>
                      <div className="group-card-actions">
                        <button
                          className={`group-chip${pinned ? ' active' : ''}${!canAddGroup && !pinned ? ' disabled' : ''}`}
                          onClick={() => { if (canAddGroup || pinned) togglePin('group', group.id); }}
                        >
                          {pinned ? 'Pinned' : 'Pin group'}
                        </button>
                        <button className="group-chip" onClick={() => startEditGroup(group)}>Edit</button>
                        <button className="group-chip danger" onClick={() => removeGroup(group.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
                <button className="group-add-card" onClick={startNewGroup}>
                  <Icons.Plus size={16} /> Create group
                </button>
              </div>

              {groupDraft && (
                <div className="group-editor">
                  <div className="group-editor-header">
                    <div className="group-editor-title">{groupDraft.id ? 'Edit group' : 'Create group'}</div>
                    <button className="drawer-close-btn" onClick={() => setGroupDraft(null)} aria-label="Close">
                      <Icons.X size={14} />
                    </button>
                  </div>
                  <div className="group-editor-body">
                    <label className="group-label">Group name</label>
                    <input
                      className="group-input"
                      value={groupDraft.label}
                      onChange={(e) => setGroupDraft(d => ({ ...d, label: e.target.value }))}
                      placeholder="e.g., Exam Tools"
                    />
                    <div className="group-label" style={{ marginTop: 10 }}>Icon</div>
                    <div className="group-icon-row">
                      {CUSTOM_GROUP_ICONS.map((iconName) => {
                        const Icon = Icons[iconName] || Icons.Folder;
                        const active = groupDraft.icon === iconName;
                        return (
                          <button
                            key={iconName}
                            className={`group-icon-chip${active ? ' active' : ''}`}
                            onClick={() => setGroupDraft(d => ({ ...d, icon: iconName }))}
                            aria-pressed={active}
                            aria-label={`Icon ${iconName}`}
                          >
                            <Icon size={16} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="group-label" style={{ marginTop: 10 }}>Choose pages</div>
                    <div className="group-item-grid">
                      {allItems.filter(item => item.id !== 'dashboard').map(item => {
                        const selected = groupDraft.items.includes(item.id);
                        const reserved = hiddenInMore.has(item.id) && !selected;
                        const Icon = Icons[item.icon] || Icons.Circle;
                        return (
                          <button
                            key={item.id}
                            className={`group-item-chip${selected ? ' selected' : ''}${reserved ? ' disabled' : ''}`}
                            onClick={() => {
                              if (reserved) return;
                              setGroupDraft(d => ({
                                ...d,
                                items: d.items.includes(item.id)
                                  ? d.items.filter(i => i !== item.id)
                                  : [...d.items, item.id],
                              }));
                            }}
                          >
                            <Icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="group-editor-actions">
                      <button className="group-chip" onClick={() => setGroupDraft(null)}>Cancel</button>
                      <button
                        className={`group-chip primary${(!groupDraft.label.trim() || groupDraft.items.length === 0) ? ' disabled' : ''}`}
                        onClick={saveGroup}
                        disabled={!groupDraft.label.trim() || groupDraft.items.length === 0}
                      >
                        Save group
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {editMode && pinnedTabs.length > 1 && (
            <div className="drawer-section">
              <div className="drawer-section-header">
                <span className="drawer-section-label">Pinned order</span>
              </div>
              <div className="drawer-order-list">
                {pinnedTabs.map((tab, index) => (
                  <div key={`${tab.type}-${tab.id}`} className="drawer-order-item">
                    <span>{resolvePinnedLabel(tab)}</span>
                    <div className="drawer-order-actions">
                      <button
                        className="drawer-order-btn"
                        disabled={index === 0}
                        onClick={() => movePinned(tab.id, -1)}
                      >
                        <Icons.ChevronUp size={14} />
                      </button>
                      <button
                        className="drawer-order-btn"
                        disabled={index === pinnedTabs.length - 1}
                        onClick={() => movePinned(tab.id, 1)}
                      >
                        <Icons.ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredSections.map(section => {
            const isDashOnlySection = section.group === 'Overview';
            const groupPinned = isPinned('group', section.group);
            const groupIconName = GROUP_ICONS[section.group] || 'Folder';
            const GroupIcon = Icons[groupIconName] || Icons.Folder;
            const canAdd = tabCount < MAX_TABS;

            const visibleItems = section.items
              .filter(item => editMode || !hiddenInMore.has(item.id))
              .filter(item => {
                if (sectionFilter === 'ungrouped' && hiddenInMore.has(item.id)) return false;
                if (!normalizedQuery) return true;
                return item.label.toLowerCase().includes(normalizedQuery);
              });

            if (visibleItems.length === 0) return null;

            return (
              <div key={section.group} className="drawer-section">
                {/* Section header — tappable in edit mode to pin whole group */}
                <div
                  className={`drawer-section-header${editMode && !isDashOnlySection ? ' editable' : ''}${groupPinned ? ' group-pinned' : ''}`}
                  onClick={() => {
                    if (editMode && !isDashOnlySection) togglePin('group', section.group);
                  }}
                >
                  <span className="drawer-section-label">{section.group}</span>
                  {editMode && !isDashOnlySection && (
                    <div className={`drawer-group-pin-btn${groupPinned ? ' pinned' : ''}${!canAdd && !groupPinned ? ' disabled' : ''}`}>
                      {groupPinned
                        ? <><Icons.Check size={10} /> Pinned</>
                        : <><Icons.Plus size={10} /> Pin group</>
                      }
                    </div>
                  )}
                </div>

                {/* Items grid */}
                <div className="drawer-grid">
                  {visibleItems.map(item => {
                    const Icon = Icons[item.icon] || Icons.Circle;
                    const active = location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));
                    const isDashboard = item.id === 'dashboard';
                    const pagePinned = isPinned('page', item.id);
                    const inCustomGroup = customGroups.some(group => (group.items || []).includes(item.id));
                    const canAddPage = !pagePinned && canAdd && !groupPinned;

                    if (editMode) {
                      return (
                        <button
                          key={item.id}
                          onClick={() => !isDashboard && !groupPinned && togglePin('page', item.id)}
                          disabled={isDashboard || groupPinned || (!canAddPage && !pagePinned)}
                          className={[
                            'drawer-item-btn',
                            pagePinned ? 'fav' : '',
                            isDashboard ? 'pinned' : '',
                            groupPinned ? 'group-member-pinned' : '',
                            inCustomGroup ? 'group-member-pinned' : '',
                            (!canAddPage && !pagePinned && !isDashboard && !groupPinned) ? 'disabled' : '',
                          ].filter(Boolean).join(' ')}
                          aria-pressed={pagePinned || groupPinned}
                          draggable={pagePinned && !isDashboard}
                          onDragStart={(e) => {
                            if (!pagePinned || isDashboard) return;
                            dragItemId.current = item.id;
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.currentTarget.classList.add('dragging');
                          }}
                          onDragOver={(e) => {
                            if (!pagePinned || isDashboard) return;
                            e.preventDefault();
                            dragOverId.current = item.id;
                            e.currentTarget.classList.add('drag-over');
                          }}
                          onDrop={(e) => {
                            if (!pagePinned || isDashboard) return;
                            e.preventDefault();
                            const fromId = dragItemId.current || e.dataTransfer.getData('text/plain');
                            const toId = item.id;
                            reorderPinned(fromId, toId);
                            dragItemId.current = null;
                            dragOverId.current = null;
                            e.currentTarget.classList.remove('drag-over');
                          }}
                          onDragEnd={(e) => { dragItemId.current = null; dragOverId.current = null; e.currentTarget.classList.remove('dragging'); }}
                          onTouchStart={(e) => {
                            if (!pagePinned || isDashboard) return;
                            // start long-press timer to enter drag mode
                            longPressTimer.current = setTimeout(() => {
                              touchDraggingState.current = true;
                              dragItemId.current = item.id;
                              e.currentTarget.classList.add('dragging');
                            }, 280);
                          }}
                          onTouchMove={(e) => {
                            // if user moves before long-press threshold, cancel
                            const touch = e.touches[0];
                            if (!longPressTimer.current) return;
                            // simple movement threshold
                            if (Math.abs(touch.clientY - e.target.getBoundingClientRect().top) > 10) {
                              clearTimeout(longPressTimer.current);
                              longPressTimer.current = null;
                            }
                            if (!touchDraggingState.current) return;
                            const el = document.elementFromPoint(touch.clientX, touch.clientY);
                            if (!el) return;
                            const nearest = el.closest && el.closest('.drawer-item-btn');
                            if (nearest) {
                              const id = nearest.getAttribute('data-page-id');
                              if (id && id !== dragOverId.current) {
                                // remove previous
                                document.querySelectorAll('.drawer-item-btn.drag-over').forEach(n => n.classList.remove('drag-over'));
                                dragOverId.current = id;
                                nearest.classList.add('drag-over');
                              }
                            }
                          }}
                          onTouchEnd={(e) => {
                            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                            if (touchDraggingState.current) {
                              const fromId = dragItemId.current;
                              const toId = dragOverId.current;
                              if (fromId && toId && fromId !== toId) reorderPinned(fromId, toId);
                              touchDraggingState.current = false;
                              dragItemId.current = null; dragOverId.current = null;
                              e.currentTarget.classList.remove('dragging');
                              document.querySelectorAll('.drawer-item-btn.drag-over').forEach(n => n.classList.remove('drag-over'));
                            } else {
                              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                            }
                          }}
                          data-page-id={item.id}
                        >
                          {pagePinned && !isDashboard && (
                            <div className="drawer-item-check">
                              <Icons.Check size={10} color="#fff" />
                            </div>
                          )}
                          {isDashboard && (
                            <div className="drawer-item-lock">
                              <Icons.Lock size={9} color="#fff" />
                            </div>
                          )}
                          {(groupPinned || inCustomGroup) && !isDashboard && (
                            <div className="drawer-item-group-badge">
                              <Icons.Layers size={8} color="#fff" />
                            </div>
                          )}
                          <Icon size={20} strokeWidth={pagePinned || groupPinned ? 2.5 : 1.8} />
                          <span className="drawer-item-label">{item.label}</span>
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`drawer-item-link${active ? ' active' : ''}${pagePinned && !isDashboard ? ' has-dot' : ''}`}
                      >
                        <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                        <span className="drawer-item-label">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {toast && (
        <div className="nav-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="nav-toast-undo"
              onClick={() => {
                toast.undo();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}
