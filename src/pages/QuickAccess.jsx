import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getPageStats, getAllPageStats } from '../hooks/usePageTracker';
import { store } from '../store/store';

export default function QuickAccess() {
  const [mostUsed, setMostUsed] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { pinnedPages, togglePin, isPinned } = usePinnedPages();
  const [profile] = useState(() => store.get('profile') || {});

  useEffect(() => {
    // Sync with store updates
    const syncStats = () => {
      setMostUsed(getPageStats());
      setAllStats(getAllPageStats());
    };
    syncStats();
    window.addEventListener('kuetx:store-updated', syncStats);
    return () => window.removeEventListener('kuetx:store-updated', syncStats);
  }, []);

  // Get page label from NAV
  const getPageLabel = (path) => {
    for (const section of NAV) {
      const item = section.items.find(i => i.path === path);
      if (item) return item.label;
    }
    return path === '/' ? 'Dashboard' : path;
  };

  // Get page icon from NAV
  const getPageIcon = (path) => {
    for (const section of NAV) {
      const item = section.items.find(i => i.path === path);
      if (item) return Icons[item.icon] || Icons.Circle;
    }
    return Icons.Circle;
  };

  const PageCard = ({ path, count, isMostUsed = false }) => {
    const Icon = getPageIcon(path);
    const label = getPageLabel(path);
    const favorite = isFavorite(path);
    const pinned = isPinned(path);

    return (
      <Link
        to={path}
        className="page-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 10px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          textDecoration: 'none',
          color: 'var(--text)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          minHeight: 48,
          gap: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--bg-secondary)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(var(--accentRGB),0.08)', display: 'grid', placeItems: 'center' }}>
            <Icon size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </div>
            {count && isMostUsed && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: '1.2' }}>
                {count} views
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              togglePin(path);
            }}
            title={pinned ? 'Unpin' : 'Pin page'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pinned ? 'var(--accent)' : 'var(--muted)',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--accent)'}
            onMouseLeave={(e) => e.target.style.color = pinned ? 'var(--accent)' : 'var(--muted)'}
          >
            {pinned ? <Icons.Pin size={16} fill="currentColor" /> : <Icons.Pin size={16} />}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(path);
            }}
            title={favorite ? 'Remove favorite' : 'Add favorite'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: favorite ? '#fbbf24' : 'var(--muted)',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.color = '#fbbf24'}
            onMouseLeave={(e) => e.target.style.color = favorite ? '#fbbf24' : 'var(--muted)'}
          >
            {favorite ? <Icons.Star size={16} fill="currentColor" /> : <Icons.Star size={16} />}
          </button>
        </div>
      </Link>
    );
  };

  return (
    <div style={{ padding: '16px', maxWidth: 940, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Quick Access</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 18, fontSize: 13 }}>
        Your most used pages, favorites, and pinned shortcuts
      </p>

      {/* Pinned Pages */}
      {pinnedPages.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Pin size={16} style={{ color: 'var(--accent)' }} />
            Pinned Pages
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {pinnedPages.map(path => (
              <PageCard key={path} path={path} />
            ))}
          </div>
        </section>
      )}

      {/* Favorite Pages */}
      {favorites.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Star size={16} style={{ color: '#fbbf24' }} />
            Favorites
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {favorites.map(path => {
              const stat = allStats.find(s => s.path === path);
              return (
                <PageCard 
                  key={path} 
                  path={path}
                  count={stat?.count}
                  isMostUsed={true}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Most Used Pages */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icons.TrendingUp size={16} style={{ color: 'var(--accent)' }} />
          Most Used (Top 10)
        </h2>
        {mostUsed.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 8,
              border: '1px dashed var(--border)',
              color: 'var(--muted)',
            }}
          >
            <Icons.BarChart2 size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No page views tracked yet. Start exploring to see your most used pages!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {mostUsed.map((stat) => (
              <PageCard 
                key={stat.path} 
                path={stat.path} 
                count={stat.count}
                isMostUsed={true}
              />
            ))}
          </div>
        )}
      </section>

      {/* Stats */}
      {allStats.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Statistics</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Quick snapshot of your usage</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[
              {
                label: 'Total Pages Visited',
                value: allStats.length,
                icon: <Icons.Layers size={18} color="var(--accent)" />,
                color: 'var(--accent)',
              },
              {
                label: 'Total Page Views',
                value: allStats.reduce((sum, s) => sum + s.count, 0),
                icon: <Icons.BarChart3 size={18} color="var(--accent)" />,
                color: 'var(--accent)',
              },
              {
                label: 'Favorited Pages',
                value: favorites.length,
                icon: <Icons.Star size={18} color="#fbbf24" />,
                color: '#fbbf24',
              },
              {
                label: 'Pinned Pages',
                value: pinnedPages.length,
                icon: <Icons.Pin size={18} color="var(--accent)" />,
                color: 'var(--accent)',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 12px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(var(--accentRGB), 0.08)', display: 'grid', placeItems: 'center' }}>
                  {stat.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
