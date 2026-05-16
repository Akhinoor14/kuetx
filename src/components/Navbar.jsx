import { Menu, Sun, Moon, Droplets, Bell, Download, ChevronRight } from 'lucide-react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { useLocation, Link } from 'react-router-dom';
import { NAV } from '../nav';
import { Logo, Wordmark } from './Logo';
import { getProfile } from '../store/store';
import { computeAlerts } from '../pages/Alerts';

function getPageMeta(pathname) {
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.path === pathname || (item.path !== '/' && pathname.startsWith(item.path)))
        return { label: item.label, group: section.group };
    }
  }
  return { label: 'KUETx', group: '' };
}

export function Navbar({ onMenuClick }) {
  const { themeId, setTheme } = useTheme();
  const location = useLocation();
  const { label, group } = getPageMeta(location.pathname);

  const cycleTheme = () => {
    const order = ['light', 'milky', 'dark'];
    setTheme(order[(order.indexOf(themeId) + 1) % order.length]);
  };

  const ThemeIcon = themeId === 'dark' ? Moon : themeId === 'milky' ? Droplets : Sun;
  const themeLabel = { light: 'Light', milky: 'Milky', dark: 'Dark' }[themeId];

  // compute alert counts for badge
  const alertCounts = computeAlerts(getProfile());
  const alertCount = (alertCounts.critical?.length || 0) + (alertCounts.warnings?.length || 0);

  return (
    <header className="topbar">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8 }}
        className="md:hidden"
      >
        <Menu size={22} color="var(--text)" />
      </button>

      {/* Mobile logo */}
      <div className="md:hidden">
        <Wordmark height={24} />
      </div>

      {/* Desktop breadcrumb */}
      <div className="hidden md:flex" style={{ alignItems: 'center', gap: 6, fontSize: 14 }}>
        {group && <span style={{ color: 'var(--muted)' }}>{group}</span>}
        {group && <ChevronRight size={14} color="var(--muted)" />}
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button onClick={cycleTheme} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Sora, sans-serif',
      }}>
        <ThemeIcon size={15} />
        <span className="hidden md:inline">{themeLabel}</span>
      </button>

      {/* Alerts bell */}
      <Link to="/alerts" aria-label={alertCount ? `${alertCount} alerts` : 'Alerts'} style={{
        display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)',
        textDecoration: 'none',
      }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Bell size={17} />
          {alertCount > 0 && (
            <span style={{
              position: 'absolute', top: -8, right: -8, minWidth: 18, height: 18, padding: '0 6px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 999, background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
            }}>{alertCount}</span>
          )}
        </div>
      </Link>

      {/* Backup shortcut */}
      <Link to="/settings" title="Backup data" style={{
        display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)',
        textDecoration: 'none',
      }}>
        <Download size={17} />
      </Link>
    </header>
  );
}
