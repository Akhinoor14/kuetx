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
    '--accentRGB':'22, 163, 74',
    '--accent':   '#16a34a',
    '--accentFg': '#ffffff',
    '--danger':   '#dc2626',
    '--warning':  '#d97706',
    '--success':  '#16a34a',
    '--inputBg':  '#f8f8f6',
    '--surfaceGlassStrong': 'rgba(255, 255, 255, 0.96)',
    '--surfaceGlass': 'rgba(255, 255, 255, 0.78)',
    '--surfaceGlassSoft': 'rgba(255, 255, 255, 0.56)',
    '--dangerBg': '#fff1f1',
    '--warningBg': '#fffbeb',
    '--successBg': '#f0fdf4',
  },
  milky: {
    id: 'milky', label: 'Milky',
    '--bg':       '#faf6ef',
    '--surface':  '#fff8f0',
    '--card':     '#fffaf4',
    '--border':   '#e5d9c8',
    '--text':     '#2d1f0e',
    '--muted':    '#8c7355',
    '--accentRGB':'22, 163, 74',
    '--accent':   '#16a34a',
    '--accentFg': '#ffffff',
    '--danger':   '#b91c1c',
    '--warning':  '#92400e',
    '--success':  '#166534',
    '--inputBg':  '#fff5e6',
    '--surfaceGlassStrong': 'rgba(255, 248, 240, 0.96)',
    '--surfaceGlass': 'rgba(255, 248, 240, 0.78)',
    '--surfaceGlassSoft': 'rgba(255, 248, 240, 0.56)',
    '--dangerBg': '#fff1f1',
    '--warningBg': '#fffbeb',
    '--successBg': '#f0fdf4',
  },
  dark: {
    id: 'dark', label: 'Dark',
    '--bg':       '#0a0a0c',
    '--surface':  '#14141a',
    '--card':     '#1a1a21',
    '--border':   '#27272f',
    '--text':     '#e5e5eb',
    '--muted':    '#7a7a8a',
    '--accentRGB':'99, 205, 209',
    '--accent':   '#63cdd1',
    '--accentFg': '#0f1419',
    '--danger':   '#ff6b6b',
    '--warning':  '#ffa94d',
    '--success':  '#51cf66',
    '--inputBg':  '#0f0f14',
    '--surfaceGlassStrong': 'rgba(20, 20, 26, 0.92)',
    '--surfaceGlass': 'rgba(20, 20, 26, 0.80)',
    '--surfaceGlassSoft': 'rgba(20, 20, 26, 0.60)',
    '--dangerBg': 'rgba(139, 32, 32, 0.18)',
    '--warningBg': 'rgba(140, 75, 25, 0.18)',
    '--successBg': 'rgba(31, 101, 45, 0.18)',
  },
};

const ThemeCtx = createContext({});

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => store.get('theme') || 'light');
  const theme = THEMES[themeId] || THEMES.light;

  useEffect(() => {
    store.set('theme', themeId);
    const root = document.documentElement;
    root.dataset.theme = themeId;
    // Apply CSS variables
    Object.entries(theme).forEach(([k, v]) => {
      if (k.startsWith('--')) root.style.setProperty(k, v);
    });
    root.style.colorScheme = themeId === 'dark' ? 'dark' : 'light';
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
