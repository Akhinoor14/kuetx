// ── useNavLayout: Default and custom bottom nav layouts ──────────────────────
// Manages predefined groups, customization, and reset logic

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store } from '../../store/store';

const normalizeLayout = (input) => {
  const source = input && typeof input === 'object' ? input : {};

  const pinnedTabs = Array.isArray(source.pinnedTabs)
    ? source.pinnedTabs.filter((tab, index, tabs) => {
        if (!tab || !tab.id) return false;
        return tabs.findIndex(candidate => candidate?.type === tab.type && candidate?.id === tab.id) === index;
      }).slice(0, 3)
    : DEFAULT_NAV_LAYOUT.pinnedTabs;

  const customGroups = Array.isArray(source.customGroups)
    ? source.customGroups.filter((group, index, groups) => {
        if (!group || !group.id) return false;
        return groups.findIndex(candidate => candidate?.id === group.id) === index;
      }).map(group => ({
        ...group,
        items: Array.isArray(group.items)
          ? group.items.filter((item, index, items) => item && items.indexOf(item) === index)
          : [],
      }))
    : DEFAULT_NAV_LAYOUT.customGroups;

  return { pinnedTabs, customGroups };
};

// Default layout: predefined groups with their assigned pages
export const DEFAULT_NAV_LAYOUT = {
  // Order: Most-used (dynamic synthetic group), Academics+Daily (merged), Finance+Activity (merged)
  pinnedTabs: [
    { type: 'group', id: 'most-used' },
    { type: 'group', id: 'academics-daily-default' },
    { type: 'group', id: 'finance-activity-default' },
  ],
  customGroups: [
    // Synthetic placeholder for most-used - resolved at runtime from usage
    {
      id: 'most-used',
      label: 'Most used',
      items: [],
      icon: 'Sparkles',
      isDefault: true,
      isSynthetic: true,
    },
    {
      id: 'academics-daily-default',
      label: 'Academics & Daily',
      items: ['courses', 'syllabus', 'qbank', 'teachers', 'diary', 'self-study', 'namaz', 'self-eval'],
      icon: 'BookOpen',
      isDefault: true,
    },
    {
      id: 'finance-activity-default',
      label: 'Finance & Activities',
      items: ['payments', 'fees', 'scholarships', 'clubs', 'events'],
      icon: 'Wallet',
      isDefault: true,
    },
  ],
};

export function useNavLayout() {
  const [layout, setLayout] = useState(() => {
    try {
      const saved = store.get('bottomnav_layout_v1');
      if (saved && typeof saved === 'object') {
        return normalizeLayout(saved);
      }
    } catch {}
    return normalizeLayout({
      pinnedTabs: store.get('bottomnav_tabs_v2') || DEFAULT_NAV_LAYOUT.pinnedTabs,
      customGroups: store.get('bottomnav_groups_v1') || DEFAULT_NAV_LAYOUT.customGroups,
    });
  });

  useEffect(() => {
    const sync = () => {
      try {
        const saved = store.get('bottomnav_layout_v1');
        if (saved && typeof saved === 'object') {
          setLayout(normalizeLayout(saved));
        }
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const saveLayout = useCallback((newLayout) => {
    try {
      const normalized = normalizeLayout(newLayout);
      setLayout(normalized);
      store.set('bottomnav_layout_v1', normalized);
      store.set('bottomnav_tabs_v2', normalized.pinnedTabs);
      store.set('bottomnav_groups_v1', normalized.customGroups);
    } catch (err) {
      console.error('Error saving layout:', err);
    }
  }, []);

  const updatePinnedTabs = useCallback((tabs) => {
    const newLayout = { ...layout, pinnedTabs: tabs };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const updateCustomGroups = useCallback((groups) => {
    const newLayout = { ...layout, customGroups: groups };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const resetToDefaults = useCallback(() => {
    saveLayout(DEFAULT_NAV_LAYOUT);
  }, [saveLayout]);

  const addGroup = useCallback((label, items = [], icon = 'Folder') => {
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}`;
    const newGroup = { id, label, items, icon, isDefault: false };
    const newLayout = {
      ...layout,
      customGroups: [...layout.customGroups, newGroup],
    };
    saveLayout(newLayout);
    return newGroup;
  }, [layout, saveLayout]);

  const updateGroup = useCallback((groupId, updates) => {
    const newLayout = {
      ...layout,
      customGroups: layout.customGroups.map(g =>
        g.id === groupId ? { ...g, ...updates } : g
      ),
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const deleteGroup = useCallback((groupId) => {
    const newLayout = {
      ...layout,
      pinnedTabs: layout.pinnedTabs.filter(t => !(t.type === 'group' && t.id === groupId)),
      customGroups: layout.customGroups.filter(g => g.id !== groupId),
    };
    saveLayout(newLayout);
  }, [layout, saveLayout]);

  const summary = useMemo(() => {
    const pinnedPages = layout.pinnedTabs.filter(t => t.type === 'page').length;
    const pinnedGroups = layout.pinnedTabs.filter(t => t.type === 'group').length;
    const totalPages = layout.customGroups.reduce((sum, g) => sum + (g.items?.length || 0), 0) + pinnedPages;
    return { pinnedPages, pinnedGroups, totalPages, totalGroups: layout.customGroups.length };
  }, [layout]);

  return {
    layout,
    pinnedTabs: layout.pinnedTabs,
    customGroups: layout.customGroups,
    updatePinnedTabs,
    updateCustomGroups,
    updateGroup,
    addGroup,
    deleteGroup,
    resetToDefaults,
    summary,
  };
}
