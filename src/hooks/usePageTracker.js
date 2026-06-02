import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { store } from '../store/store';

const STORAGE_KEY = 'kuetx_page_stats';

export function usePageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Skip tracking for certain pages
    const skipPaths = ['/settings', '/about', '/quick-access'];
    if (skipPaths.includes(location.pathname)) return;

    const stats = store.get(STORAGE_KEY) || {};
    const currentPath = location.pathname || '/';

    stats[currentPath] = {
      path: currentPath,
      count: (stats[currentPath]?.count || 0) + 1,
      lastVisit: new Date().toISOString(),
    };

    store.set(STORAGE_KEY, stats);
  }, [location.pathname]);
}

export function getPageStats() {
  const stats = store.get(STORAGE_KEY) || {};
  return Object.values(stats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function getAllPageStats() {
  const stats = store.get(STORAGE_KEY) || {};
  return Object.values(stats).sort((a, b) => b.count - a.count);
}

export function clearPageStats() {
  store.set(STORAGE_KEY, {});
}
