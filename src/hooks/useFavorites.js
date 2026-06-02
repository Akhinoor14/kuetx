import { useState, useCallback, useEffect } from 'react';
import { store } from '../store/store';

const FAVORITES_KEY = 'kuetx_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const stored = store.get(FAVORITES_KEY) || [];
    setFavorites(stored);
  }, []);

  const toggleFavorite = useCallback((path) => {
    setFavorites(prev => {
      const updated = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path];
      store.set(FAVORITES_KEY, updated);
      return updated;
    });
  }, []);

  const isFavorite = useCallback((path) => {
    return favorites.includes(path);
  }, [favorites]);

  const addFavorite = useCallback((path) => {
    if (!favorites.includes(path)) {
      const updated = [...favorites, path];
      setFavorites(updated);
      store.set(FAVORITES_KEY, updated);
    }
  }, [favorites]);

  const removeFavorite = useCallback((path) => {
    const updated = favorites.filter(p => p !== path);
    setFavorites(updated);
    store.set(FAVORITES_KEY, updated);
  }, [favorites]);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    addFavorite,
    removeFavorite,
  };
}
