// ── useNavConfig & useAdaptiveNav ────────────────────────────────────────────────
// Navigation configuration and adaptive visibility logic

import { useState, useEffect, useCallback, useMemo } from 'react';
import { store } from '../../store/store';

const shallowEqual = (left, right) => {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

// Initialize nav config with defaults
const DEFAULT_NAV_CONFIG = {
  mode: 'adaptive', // 'adaptive' or 'manual' or 'preset'
  context_aware: true,
  gesture_enabled: true,
  adaptive_learning: true,
  show_suggestions: true,
  cr_board_enabled: true,
};

export function useNavConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = store.get('nav_config_v1');
      if (saved && typeof saved === 'object') return { ...DEFAULT_NAV_CONFIG, ...saved };
    } catch {}
    return DEFAULT_NAV_CONFIG;
  });

  useEffect(() => {
    const sync = () => {
      try {
        const saved = store.get('nav_config_v1');
        if (saved && typeof saved === 'object') {
          const nextConfig = { ...DEFAULT_NAV_CONFIG, ...saved };
          setConfig(prev => shallowEqual(prev, nextConfig) ? prev : nextConfig);
        }
      } catch {}
    };
    window.addEventListener('kuetx:store-updated', sync);
    return () => window.removeEventListener('kuetx:store-updated', sync);
  }, []);

  const updateConfig = useCallback((updates) => {
    try {
      const newConfig = { ...config, ...updates };
      if (!shallowEqual(config, newConfig)) {
        setConfig(newConfig);
        store.set('nav_config_v1', newConfig);
      }
    } catch {}
  }, [config]);

  const result = useMemo(() => [config, updateConfig], [config, updateConfig]);

  return result;
}

// Adaptive nav logic: determine which pages should be hidden based on usage
export function useAdaptiveNav(allItems, usageData) {
  const [config] = useNavConfig();
  const [hiddenPages, setHiddenPages] = useState(new Set());

  useEffect(() => {
    if (!config.adaptive_learning) {
      setHiddenPages(new Set());
      return;
    }

    // Calculate which pages should be hidden based on low usage
    const counts = usageData?.counts || {};
    const hidden = new Set();

    // If adaptive mode, hide items that are rarely used (count < 2)
    // Keep frequently used items visible
    allItems.forEach(item => {
      const count = counts[item.id] || 0;
      // Hide if: count is 0 and there are other items with usage
      const hasUsage = Object.values(counts).some(c => c > 0);
      if (count === 0 && hasUsage && allItems.length > 5) {
        hidden.add(item.id);
      }
    });

    setHiddenPages(hidden);
  }, [config.adaptive_learning, allItems, usageData]);

  return hiddenPages;
}

const buildAdaptiveScore = (item, counts, activePath, defaultTabIds, defaultOrder) => {
  const count = counts[item.id] || 0;
  // Segment-boundary match, not raw string prefix — plain startsWith would
  // wrongly count e.g. '/faculty/profile' as "active" for the '/faculty'
  // Dashboard item too, since it's a literal string prefix. Same bug/fix
  // as SidebarNavShared.jsx's isActiveItem.
  const isActive = activePath
    && (activePath === item.path
      || (item.path !== '/' && activePath.startsWith(item.path.endsWith('/') ? item.path : `${item.path}/`)));
  const isDefault = defaultOrder.has(item.id);

  return (count * 100)
    + (isActive ? 1000 : 0)
    + (isDefault ? 25 : 0)
    + (isDefault ? (defaultTabIds.length - defaultOrder.get(item.id)) : 0);
};

export function getAdaptiveTabs({ pinnedTabs, allItems, usageData, activePath, maxTabs = 4, defaultTabIds = [] }) {
  if (!Array.isArray(pinnedTabs) || pinnedTabs.length === 0) return pinnedTabs || [];

  const isDefaultTabs = pinnedTabs.length === defaultTabIds.length
    && pinnedTabs.every((tab, index) => tab?.type === 'page' && tab.id === defaultTabIds[index]);

  if (!isDefaultTabs) return pinnedTabs;

  const counts = usageData?.counts || {};
  const hasUsage = Object.values(counts).some(count => count > 0);
  if (!hasUsage) return pinnedTabs;

  const defaultOrder = new Map(defaultTabIds.map((id, index) => [id, index]));

  return allItems
    .filter(item => item.id !== 'dashboard')
    .map(item => ({ item, score: buildAdaptiveScore(item, counts, activePath, defaultTabIds, defaultOrder) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTabs)
    .map(({ item }) => ({ type: 'page', id: item.id }));
}

// Get usage display label for a page
export function getUsageLabel(count) {
  if (!count) return 'New page';
  if (count === 1) return 'Used 1x';
  if (count >= 7) return `Used ${count}x/week`;
  return `Used ${count}x`;
}

// Get adaptive reason tooltip
export function getAdaptiveReason(pageId, usageData) {
  const counts = usageData?.counts || {};
  const count = counts[pageId] || 0;
  
  if (count === 0) return 'New, not yet used';
  if (count === 1) return 'Used once this week';
  if (count >= 7) return `You use this ${count}x per week`;
  return `You used this ${count}x this week`;
}
