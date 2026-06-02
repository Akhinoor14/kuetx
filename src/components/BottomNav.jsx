import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { getProfile, store } from '../store/store';

const MOBILE_NAV_QUERY = '(max-width: 767.98px)';
const USAGE_KEY = 'nav_usage_v1';
const MAX_MOST_USED = 8;

const PINNED_BUTTONS = [
  { id: 'dashboard', label: 'Home', icon: 'Home', kind: 'route', path: '/' },
  { id: 'most-used', label: 'Quick', icon: 'Star', kind: 'panel', panel: 'most-used' },
  { id: 'study', label: 'Study', icon: 'BookOpen', kind: 'panel', panel: 'study' },
  { id: 'money', label: 'Wallet', icon: 'Wallet', kind: 'panel', panel: 'money' },
  { id: 'menu', label: 'Menu', icon: 'Menu', kind: 'panel', panel: 'menu' },
];

const PANEL_TITLES = {
  'most-used': 'Most used',
  'quick-cr': 'Quick',
  study: 'Study',
  money: 'Wallet',
  menu: 'Menu',
  cr: 'Class Rep',
};

const PANEL_SUBTITLES = {
  'most-used': 'Eight shortcuts tuned to your habits',
  'quick-cr': 'CR tools above your shortcuts',
  study: 'Academics & daily tools',
  money: 'Money & activities',
  menu: 'Tools, notes, settings, and more',
  cr: 'CR tools & pages',
};

const PANEL_SECTION_GROUPS = {
  study: ['Academics', 'Daily Life'],
  money: ['Finance', 'Activities'],
  menu: ['Overview', 'Class Rep', 'Tools', 'Information'],
  cr: ['Class Rep'],
};

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
  try {
    store.set(USAGE_KEY, next);
  } catch {}
};

const getVisibleSections = (profile) => NAV
  .map(section => ({
    ...section,
    items: section.items.filter(item => !item.requiresCR || profile?.isCR),
  }))
  .filter(section => section.items.length > 0);

const getAllNavItems = (profile) => getVisibleSections(profile).flatMap(section => section.items);

const getItemMap = (profile) => new Map(getAllNavItems(profile).map(item => [item.id, item]));

const resolveMostUsedItems = (profile, usage) => {
  const allItems = getAllNavItems(profile).filter(item => item.id !== 'dashboard');
  const counts = usage?.counts || {};
  const recent = usage?.recent || [];
  const recentIndex = new Map(recent.map((id, index) => [id, index]));

  return allItems
    .map(item => ({
      item,
      score: (counts[item.id] || 0) * 1000
        + (recentIndex.has(item.id) ? (MAX_MOST_USED - recentIndex.get(item.id)) * 10 : 0),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_MOST_USED)
    .map(entry => entry.item);
};

const buildPanelSections = (profile, panel, itemMap, mostUsedItems) => {
  if (panel === 'most-used') {
    return [{ group: 'Most used', items: mostUsedItems }];
  }

  if (panel === 'quick-cr') {
    const crItems = NAV.flatMap(s => s.items || [])
      .filter(i => i.requiresCR && profile?.isCR)
      .map(i => itemMap.get(i.id) || i)
      .filter(Boolean);

    const sections = [];
    if (crItems.length) sections.push({ group: 'CR', items: crItems });
    sections.push({ group: 'Most used', items: mostUsedItems });
    return sections;
  }

  const groups = PANEL_SECTION_GROUPS[panel] || [];
  const sections = [];

  groups.forEach(groupName => {
    const sourceSection = NAV.find(candidate => candidate.group === groupName);
    if (!sourceSection) return;

    const items = sourceSection.items
      .filter(item => !item.requiresCR || profile?.isCR)
      .filter(item => item.id !== 'dashboard')
      .map(item => itemMap.get(item.id) || item)
      .filter(Boolean);

    if (items.length > 0) {
      sections.push({ group: sourceSection.group, items });
    }
  });

  return sections;
};

const recordUsage = (allItems, pathname) => {
  const match = allItems.find(item => pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)));
  if (!match || match.id === 'quick-access') return;

  const usage = getUsageState();
  const counts = { ...(usage.counts || {}) };
  counts[match.id] = (counts[match.id] || 0) + 1;
  const recent = [match.id, ...((usage.recent || []).filter(id => id !== match.id))].slice(0, MAX_MOST_USED);
  saveUsageState({ counts, recent });

  try {
    window.dispatchEvent(new Event('kuetx:store-updated'));
  } catch {}
};

function NavGridItem({ item, onSelect }) {
  const Icon = Icons[item.icon] || Icons.Circle;

  const SHORT_LABELS = {
    'dashboard': 'Dash',
    'profile': 'Profile',
    'smart-score': 'Score',
    'notes': 'Notes',
    'class-management': 'Class Management',
    'courses': 'Courses',
    'attendance': 'Attend',
    'schedule': 'Sched',
    'assignments': 'Tasks',
    'syllabus': 'Syllabus',
    'qbank': 'QBank',
    'marks': 'Planner',
    'results': 'GPA',
    'teachers': 'Tchr',
    'diary': 'Diary',
    'self-study': 'Self',
    'time': 'Time',
    'namaz': 'Namaz',
    'self-eval': 'Self-Eval',
    'money': 'Money',
    'tuition': 'Tuition',
    'food': 'Food',
    'clubs': 'Clubs',
    'projects': 'Projects',
    'tours': 'Tours',
    'social': 'Social',
    'warnings': 'Alerts',
    'reports': 'Reports',
    'settings': 'Settings',
    'about': 'About',
  };

  const displayLabel = SHORT_LABELS[item.id] || item.label;

  return (
    <Link to={item.path} onClick={onSelect} className="mobile-bottom-nav-panel-item">
      <span className="mobile-bottom-nav-panel-icon">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="mobile-bottom-nav-panel-label">{displayLabel}</span>
    </Link>
  );
}

function PanelSection({ title, items, onSelect }) {
  if (!items.length) return null;

  return (
    <section className="mobile-bottom-nav-panel-section">
      <div className="mobile-bottom-nav-panel-section-title">{title}</div>
      <div className="mobile-bottom-nav-panel-grid">
        {items.map(item => (
          <NavGridItem key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export function BottomNav() {
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const [profile, setProfile] = useState(() => getProfile() || {});
  const [usage, setUsage] = useState(() => getUsageState());
  const [activePanel, setActivePanel] = useState(null);

  const allItems = useMemo(() => getAllNavItems(profile), [profile]);
  const itemMap = useMemo(() => getItemMap(profile), [profile]);
  const mostUsedItems = useMemo(() => resolveMostUsedItems(profile, usage), [profile, usage]);

  useEffect(() => {
    const syncProfile = () => {
      const next = getProfile() || {};
      setProfile(prev => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        } catch {}
        return next;
      });
    };

    const syncUsage = () => {
      const next = getUsageState();
      setUsage(prev => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        } catch {}
        return next;
      });
    };

    window.addEventListener('kuetx:store-updated', syncProfile);
    window.addEventListener('kuetx:store-updated', syncUsage);
    syncProfile();
    syncUsage();

    return () => {
      window.removeEventListener('kuetx:store-updated', syncProfile);
      window.removeEventListener('kuetx:store-updated', syncUsage);
    };
  }, []);

  useEffect(() => {
    recordUsage(allItems, location.pathname);
  }, [allItems, location.pathname]);

  useEffect(() => {
    setActivePanel(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNav) setActivePanel(null);
  }, [isMobileNav]);

  // build pinned buttons dynamically so we can add CR tab when profile.isCR
  // MUST be BEFORE the conditional return to comply with React Hooks rules
  const pinnedButtons = useMemo(() => {
    const base = [
      { id: 'dashboard', label: 'Home', icon: 'Home', kind: 'route', path: '/' },
      { id: 'most-used', label: profile?.isCR ? 'CR' : 'Quick', icon: profile?.isCR ? 'Users' : 'Star', kind: 'panel', panel: profile?.isCR ? 'quick-cr' : 'most-used' },
      { id: 'study', label: 'Study', icon: 'BookOpen', kind: 'panel', panel: 'study' },
      { id: 'money', label: 'Wallet', icon: 'Wallet', kind: 'panel', panel: 'money' },
      { id: 'menu', label: 'Menu', icon: 'Menu', kind: 'panel', panel: 'menu' },
    ];

    return base;
  }, [profile]);

  const activeRoute = (item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
  const studySections = buildPanelSections(profile, 'study', itemMap, mostUsedItems);
  const moneySections = buildPanelSections(profile, 'money', itemMap, mostUsedItems);
  const menuSections = buildPanelSections(profile, 'menu', itemMap, mostUsedItems);

  const isMostUsedActive = mostUsedItems.some(activeRoute);
  const isStudyActive = studySections.some(section => section.items.some(activeRoute));
  const isMoneyActive = moneySections.some(section => section.items.some(activeRoute));
  const isMenuActive = menuSections.some(section => section.items.some(activeRoute));

  if (!isMobileNav) return null;

  const isButtonActive = (button) => {
    if (button.kind === 'route') return activeRoute(itemMap.get(button.id) || { path: button.path });
    if (button.panel === 'most-used' || button.panel === 'quick-cr') return (activePanel === 'most-used' || activePanel === 'quick-cr') || isMostUsedActive;
    if (button.panel === 'study') return activePanel === 'study' || isStudyActive;
    if (button.panel === 'money') return activePanel === 'money' || isMoneyActive;
    if (button.panel === 'menu') return activePanel === 'menu' || isMenuActive;
    return false;
  };

  const panelSections = activePanel
    ? buildPanelSections(profile, activePanel, itemMap, mostUsedItems)
    : [];

  const panelLayer = activePanel ? createPortal(
    <div className="mobile-bottom-nav-layer">
      <button
        type="button"
        className="mobile-bottom-nav-backdrop"
        aria-label="Close navigation panel"
        onClick={() => setActivePanel(null)}
      />
      <div className="mobile-bottom-nav-panel-wrap">
        <div className="mobile-bottom-nav-panel-container">
          <div className="mobile-bottom-nav-panel" role="dialog" aria-modal="true" aria-label={(activePanel === 'quick-cr' && profile?.isCR) ? 'Class Rep' : PANEL_TITLES[activePanel]}>
            <div className="mobile-bottom-nav-panel-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {(activePanel === 'quick-cr' && profile?.isCR) ? (
                  <span className="mobile-bottom-nav-panel-icon-large"><Icons.Users size={20} /></span>
                ) : null}
                <div>
                  <div className="mobile-bottom-nav-panel-title">{(activePanel === 'quick-cr' && profile?.isCR) ? 'Class Rep' : PANEL_TITLES[activePanel]}</div>
                  <div className="mobile-bottom-nav-panel-subtitle">{(activePanel === 'quick-cr' && profile?.isCR) ? 'CR tools above your shortcuts' : PANEL_SUBTITLES[activePanel]}</div>
                </div>
              </div>
              <button type="button" className="mobile-bottom-nav-close" onClick={() => setActivePanel(null)} aria-label="Close panel">
                <Icons.X size={16} />
              </button>
            </div>

            <div className="mobile-bottom-nav-panel-body">
              {panelSections.map(section => (
                <PanelSection key={section.group} title={section.group} items={section.items} onSelect={() => setActivePanel(null)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {panelLayer}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav-shell">
          {pinnedButtons.map(button => {
            const Icon = Icons[button.icon] || Icons.Circle;
            const active = isButtonActive(button);

            if (button.kind === 'route') {
              return (
                <Link
                  key={button.id}
                  to={button.path}
                  className={`mobile-bottom-nav-button${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="mobile-bottom-nav-button-icon">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="mobile-bottom-nav-button-label">{button.label}</span>
                </Link>
              );
            }

            return (
              <button
                key={button.id}
                type="button"
                className={`mobile-bottom-nav-button${active ? ' active' : ''}`}
                onClick={() => setActivePanel(current => current === button.panel ? null : button.panel)}
                aria-expanded={activePanel === button.panel}
              >
                <span className="mobile-bottom-nav-button-icon">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="mobile-bottom-nav-button-label">{button.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
