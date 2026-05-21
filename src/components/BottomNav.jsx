import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { store, getProfile } from '../store/store';
import { computeAlerts } from '../pages/Alerts';

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_TABS = 3; // Max pinned tabs (excluding Dashboard). Dashboard always slot 1.
const DEFAULT_TABS = [
  { type: 'page', id: 'attendance' },
  { type: 'page', id: 'marks' },
  { type: 'page', id: 'schedule' },
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

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useBottomNavTabs() {
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = store.get('bottomnav_tabs_v2');
      if (Array.isArray(saved) && saved.length > 0) return saved;
      // migrate old favourites format
      const old = store.get('bottomnav_favourites');
      if (Array.isArray(old) && old.length > 0) {
        return old.filter(id => id !== 'dashboard').map(id => ({ type: 'page', id }));
      }
      return DEFAULT_TABS;
    } catch {
      return DEFAULT_TABS;
    }
  });

  const saveTabs = (newTabs) => {
    setTabs(newTabs);
    try { store.set('bottomnav_tabs_v2', newTabs); } catch {}
  };

  return [tabs, saveTabs];
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
  const [pinnedTabs] = useBottomNavTabs();
  const [alertCount, setAlertCount] = useState(0);
  const [profile, setProfile] = useState(() => store.get('profile') || {});

  useEffect(() => {
    const sync = () => setProfile(store.get('profile') || {});
    window.addEventListener('kuetx:store-updated', sync);
    sync();
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  useEffect(() => {
    try {
      const counts = computeAlerts(getProfile());
      setAlertCount((counts.critical?.length || 0) + (counts.warnings?.length || 0));
    } catch {}
  }, [location.pathname]);

  const allItems = getAllNavItems(profile);
  const sections = getVisibleSections(profile);

  // Resolve pinned tabs into renderable items
  const resolvedTabs = pinnedTabs
    .filter(t => t.id !== 'dashboard')
    .map(t => {
      if (t.type === 'group') {
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

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {/* Dashboard — always first */}
      {dashboardItem && (
        <Link
          to={dashboardItem.path}
          className={`bottom-nav-tab${dashActive ? ' active' : ''}`}
          aria-label="Dashboard"
          aria-current={dashActive ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <Icons.Grid size={22} strokeWidth={dashActive ? 2.5 : 1.8} />
          </div>
          <span>Dashboard</span>
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
                <Icon size={22} strokeWidth={tab.isActive ? 2.5 : 1.8} />
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
              <Icon size={22} strokeWidth={tab.isActive ? 2.5 : 1.8} />
            </div>
            <span>{tab.label}</span>
          </Link>
        );
      })}

      {/* More button */}
      <button
        className="bottom-nav-tab"
        onClick={onOpenMore}
        aria-label="All pages"
      >
        <div className="bottom-nav-icon-wrap" style={{ position: 'relative' }}>
          <Icons.LayoutGrid size={22} strokeWidth={1.8} />
          {alertCount > 0 && (
            <span className="bottom-nav-badge">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </div>
        <span>More</span>
      </button>
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
export function AllPagesDrawer({ open, onClose }) {
  const location = useLocation();
  const [pinnedTabs, setPinnedTabs] = useBottomNavTabs();
  const [editMode, setEditMode] = useState(false);
  const [profile] = useState(() => store.get('profile') || {});
  const drawerRef = useRef(null);
  const dragStartY = useRef(null);
  const dragCurrentY = useRef(0);

  useEffect(() => { if (open) onClose(); }, [location.pathname]);
  useEffect(() => { if (!open) setEditMode(false); }, [open]);

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

  const togglePin = (type, id) => {
    if (id === 'dashboard') return;
    if (isPinned(type, id)) {
      setPinnedTabs(pinnedTabs.filter(t => !(t.type === type && t.id === id)));
    } else {
      if (tabCount >= MAX_TABS) return;
      setPinnedTabs([...pinnedTabs, { type, id }]);
    }
  };

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
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditMode(e => !e)}
              className={`drawer-edit-btn${editMode ? ' active' : ''}`}
            >
              {editMode
                ? <><Icons.Check size={14} /> Done</>
                : <><Icons.Star size={14} /> Edit Tabs</>}
            </button>
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

        {/* Nav sections */}
        <div className="drawer-scroll">
          {sections.map(section => {
            const isDashOnlySection = section.group === 'Overview';
            const groupPinned = isPinned('group', section.group);
            const groupIconName = GROUP_ICONS[section.group] || 'Folder';
            const GroupIcon = Icons[groupIconName] || Icons.Folder;
            const canAdd = tabCount < MAX_TABS;

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
                  {section.items.map(item => {
                    const Icon = Icons[item.icon] || Icons.Circle;
                    const active = location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));
                    const isDashboard = item.id === 'dashboard';
                    const pagePinned = isPinned('page', item.id);
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
                            (!canAddPage && !pagePinned && !isDashboard && !groupPinned) ? 'disabled' : '',
                          ].filter(Boolean).join(' ')}
                          aria-pressed={pagePinned || groupPinned}
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
                          {groupPinned && !isDashboard && (
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
    </>
  );
}
