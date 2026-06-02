import { useState, useCallback, useEffect } from 'react';
import { store } from '../store/store';

const PINNED_KEY = 'kuetx_pinned_pages';

export function usePinnedPages() {
  const [pinnedPages, setPinnedPages] = useState([]);

  useEffect(() => {
    const stored = store.get(PINNED_KEY) || [];
    setPinnedPages(stored);
  }, []);

  const togglePin = useCallback((path) => {
    setPinnedPages(prev => {
      const updated = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path];
      store.set(PINNED_KEY, updated);
      return updated;
    });
  }, []);

  const isPinned = useCallback((path) => {
    return pinnedPages.includes(path);
  }, [pinnedPages]);

  const addPin = useCallback((path) => {
    if (!pinnedPages.includes(path)) {
      const updated = [...pinnedPages, path];
      setPinnedPages(updated);
      store.set(PINNED_KEY, updated);
    }
  }, [pinnedPages]);

  const removePin = useCallback((path) => {
    const updated = pinnedPages.filter(p => p !== path);
    setPinnedPages(updated);
    store.set(PINNED_KEY, updated);
  }, [pinnedPages]);

  return {
    pinnedPages,
    togglePin,
    isPinned,
    addPin,
    removePin,
  };
}
