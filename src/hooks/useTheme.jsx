import { createContext, useContext, useEffect, useState } from 'react';
import { store } from '../store/store';

export const THEMES = {
  light: {
    id: 'light', label: 'Light',
    '--bg':       '#f5f5f2',
    '--surface':  '#ffffff',
    '--card':     '#ffffff',
    '--border':   '#e2e0db',
    '--text':     '#1c1c1a',
    '--muted':    '#6b6860',
    '--accent':   '#16a34a',
    '--accentFg': '#ffffff',
    '--danger':   '#dc2626',
    '--warning':  '#d97706',
    '--success':  '#16a34a',
    '--inputBg':  '#f8f8f6',
  },
  milky: {
    id: 'milky', label: 'Milky',
    '--bg':       '#faf6ef',
    '--surface':  '#fff8f0',
    '--card':     '#fffaf4',
    '--border':   '#e5d9c8',
    '--text':     '#2d1f0e',
    '--muted':    '#8c7355',
    '--accent':   '#16a34a',
    '--accentFg': '#ffffff',
    '--danger':   '#b91c1c',
    '--warning':  '#92400e',
    '--success':  '#166534',
    '--inputBg':  '#fff5e6',
  },
  dark: {
    id: 'dark', label: 'Dark',
    '--bg':       '#0f0f12',
    '--surface':  '#17171c',
    '--card':     '#1c1c23',
    '--border':   '#2c2c36',
    '--text':     '#e8e8ee',
    '--muted':    '#7070808',
    '--accent':   '#4ade80',
    '--accentFg': '#052e16',
    '--danger':   '#f87171',
    '--warning':  '#fbbf24',
    '--success':  '#4ade80',
    '--inputBg':  '#13131a',
  },
};

// Fix muted color for dark (was wrong hex)
THEMES.dark['--muted'] = '#70708a';

const ThemeCtx = createContext({});

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => store.get('theme') || 'light');
  const theme = THEMES[themeId] || THEMES.light;

  useEffect(() => {
    store.set('theme', themeId);
    const root = document.documentElement;
    // Apply CSS variables
    Object.entries(theme).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v);
    });
    // Dark class for Tailwind
    if (themeId === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [themeId, theme]);

  const setTheme = (id) => {
    if (THEMES[id]) setThemeId(id);
  };

  return (
    <ThemeCtx.Provider value={{ theme, themeId, setTheme, themes: THEMES }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
