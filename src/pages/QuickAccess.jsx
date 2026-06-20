import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getPageStats, getAllPageStats } from '../hooks/usePageTracker';
import { getProfile } from '../store/store';

// CR-only pages pulled straight from NAV (single source of truth)
const CR_PATHS = NAV.flatMap(s => s.items || [])
  .filter(i => i.requiresCR)
  .map(i => i.path);

/**
 * QuickAccessPanel — the reusable core of the Quick Access experience.
 * Used both as the full `/quick-access` page (desktop/route) and inside the
 * mobile bottom-nav drawer (`inPanel`).
 *
 * @param {boolean} inPanel     - true when rendered inside the mobile drawer (tighter spacing)
 * @param {function} onNavigate - called when a page card is clicked (e.g. to close the drawer)
 */
export function QuickAccessPanel({ inPanel = false, onNavigate } = {}) {
  const [mostUsed, setMostUsed] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { pinnedPages, togglePin, isPinned } = usePinnedPages();
  const [profile, setProfile] = useState(() => getProfile() || {});

  useEffect(() => {
    const syncStats = () => {
      setMostUsed(getPageStats());
      setAllStats(getAllPageStats());
    };
    const syncProfile = () => setProfile(getProfile() || {});
    syncStats();
    syncProfile();
    window.addEventListener('kuetx:store-updated', syncStats);
    window.addEventListener('kuetx:store-updated', syncProfile);
    return () => {
      window.removeEventListener('kuetx:store-updated', syncStats);
      window.removeEventListener('kuetx:store-updated', syncProfile);
    };
  }, []);

  const isCR = !!profile?.isCR;
  const crPages = isCR ? CR_PATHS : [];
  const handleNavigate = () => { if (onNavigate) onNavigate(); };

  const getPageLabel = (path) => {
    for (const section of NAV) {
      const item = section.items.find(i => i.path === path);
      if (item) return item.label;
    }
    return path === '/' ? 'Dashboard' : path;
  };

  const getPageIcon = (path) => {
    for (const section of NAV) {
      const item = section.items.find(i => i.path === path);
      if (item) return Icons[item.icon] || Icons.Circle;
    }
    return Icons.Circle;
  };

  const totalViews = allStats.reduce((sum, s) => sum + s.count, 0);

  // Section header component
  const SectionHead = ({ icon: IconComp, label, count, iconColor, iconBg }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <IconComp size={13} color={iconColor} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: 11, color: 'var(--muted)',
          background: 'var(--bg-tertiary)',
          borderRadius: 10, padding: '2px 8px',
        }}>
          {count}
        </span>
      )}
    </div>
  );

  // Page card — variant controls icon/badge color scheme
  const PageCard = ({ path, count, showCount = false, variant = 'neutral' }) => {
    const Icon = getPageIcon(path);
    const label = getPageLabel(path);
    const favorite = isFavorite(path);
    const pinned = isPinned(path);

    const iconStyles = {
      pin: { bg: 'rgba(var(--accentRGB),0.12)', color: 'var(--accent)' },
      fav: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
      used: { bg: 'rgba(var(--accentRGB),0.08)', color: 'var(--accent)' },
      cr: { bg: 'rgba(167,139,250,0.14)', color: '#a78bfa' },
      neutral: { bg: 'rgba(var(--accentRGB),0.06)', color: 'var(--muted)' },
    };
    const { bg: iconBg, color: iconColor } = iconStyles[variant] || iconStyles.neutral;

    const badgeStyles = {
      pin: { bg: 'rgba(var(--accentRGB),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accentRGB),0.25)' },
      fav: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' },
      used: { bg: 'rgba(var(--accentRGB),0.08)', color: 'var(--accent)', border: '1px solid rgba(var(--accentRGB),0.2)' },
      cr: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' },
      neutral: { bg: 'rgba(var(--accentRGB),0.06)', color: 'var(--accent)', border: '1px solid rgba(var(--accentRGB),0.15)' },
    };
    const badge = badgeStyles[variant] || badgeStyles.neutral;

    return (
      <Link
        to={path}
        onClick={handleNavigate}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          textDecoration: 'none',
          color: 'var(--text)',
          transition: 'border-color 0.15s, background 0.15s',
          minHeight: 52,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-hover, var(--accent))';
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--bg-secondary)';
        }}
      >
        {/* Icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} color={iconColor} />
        </div>

        {/* Label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        </div>

        {/* Count badge */}
        {showCount && count > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: badge.bg, color: badge.color,
            border: badge.border,
            borderRadius: 10, padding: '2px 7px',
            flexShrink: 0,
          }}>
            {count}
          </span>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(path); }}
            title={pinned ? 'Unpin' : 'Pin'}
            style={{
              width: 26, height: 26,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: pinned ? 'var(--accent)' : 'var(--muted)',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(var(--accentRGB),0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = pinned ? 'var(--accent)' : 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {pinned
              ? <Icons.Pin size={14} fill="currentColor" />
              : <Icons.Pin size={14} />}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(path); }}
            title={favorite ? 'Unfavorite' : 'Favorite'}
            style={{
              width: 26, height: 26,
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: favorite ? '#fbbf24' : 'var(--muted)',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = favorite ? '#fbbf24' : 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {favorite
              ? <Icons.Star size={14} fill="currentColor" />
              : <Icons.Star size={14} />}
          </button>
        </div>
      </Link>
    );
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 8,
    width: '100%',
  };

  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 8,
    width: '100%',
  };

  const statItems = [
    { label: 'Pages Visited', value: allStats.length, Icon: Icons.Layers, color: 'var(--accent)', iconBg: 'rgba(var(--accentRGB),0.08)' },
    { label: 'Total Views', value: totalViews, Icon: Icons.BarChart3, color: 'var(--accent)', iconBg: 'rgba(var(--accentRGB),0.08)' },
    { label: 'Favorited', value: favorites.length, Icon: Icons.Star, color: '#fbbf24', iconBg: 'rgba(251,191,36,0.08)' },
    { label: 'Pinned', value: pinnedPages.length, Icon: Icons.Pin, color: 'var(--accent)', iconBg: 'rgba(var(--accentRGB),0.08)' },
  ];

  return (
    <div style={{ padding: inPanel ? '2px 2px 8px' : '16px', width: '100%', margin: '0 auto', minWidth: 0 }}>

      {/* ── HERO CARD (full page only — drawer already has its own header) ── */}
      {!inPanel && (
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(var(--accentRGB),0.25)',
        borderRadius: 16,
        padding: '20px 22px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* subtle accent glow */}
        <div style={{
          position: 'absolute', top: -50, right: -50,
          width: 180, height: 180,
          background: 'radial-gradient(circle, rgba(var(--accentRGB),0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 4 }}>
              Welcome back
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {profile?.name || 'Student'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {profile?.department || 'KUET'} · Quick Access
            </div>
          </div>
          <div style={{
            background: 'rgba(var(--accentRGB),0.08)',
            border: '1px solid rgba(var(--accentRGB),0.2)',
            borderRadius: 24,
            padding: '6px 14px',
            fontSize: 12, color: 'var(--accent)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <Icons.Zap size={13} />
            KUETx
          </div>
        </div>

        {/* stats row */}
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap',
          marginTop: 18, paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}>
          {[
            { val: allStats.length, lbl: 'Pages visited' },
            { val: totalViews, lbl: 'Total views' },
            { val: favorites.length, lbl: 'Favorited', color: '#fbbf24' },
            { val: pinnedPages.length, lbl: 'Pinned', color: 'var(--accent)' },
          ].map(({ val, lbl, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: i > 0 ? 0 : 0 }}>
              {i > 0 && (
                <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', marginRight: 20 }} />
              )}
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginTop: 3 }}>{lbl}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── CR OVERVIEW (only for class representatives) ── */}
      {crPages.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionHead
            icon={Icons.Users}
            label="CR Dashboard"
            count={crPages.length}
            iconColor="#a78bfa"
            iconBg="rgba(167,139,250,0.14)"
          />
          <div style={gridStyle}>
            {crPages.map(path => (
              <PageCard key={path} path={path} variant="cr" />
            ))}
          </div>
        </section>
      )}

      {/* ── PINNED ── */}
      {pinnedPages.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionHead
            icon={Icons.Pin}
            label="Pinned"
            count={pinnedPages.length}
            iconColor="var(--accent)"
            iconBg="rgba(var(--accentRGB),0.1)"
          />
          <div style={gridStyle}>
            {pinnedPages.map(path => (
              <PageCard key={path} path={path} variant="pin" />
            ))}
          </div>
        </section>
      )}

      {/* ── FAVORITES ── */}
      {favorites.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionHead
            icon={Icons.Star}
            label="Favorites"
            count={favorites.length}
            iconColor="#fbbf24"
            iconBg="rgba(251,191,36,0.1)"
          />
          <div style={gridStyle}>
            {favorites.map(path => {
              const stat = allStats.find(s => s.path === path);
              return (
                <PageCard
                  key={path}
                  path={path}
                  count={stat?.count}
                  showCount={true}
                  variant="fav"
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── MOST USED ── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHead
          icon={Icons.TrendingUp}
          label="Most Used"
          count="Top 10"
          iconColor="var(--accent)"
          iconBg="rgba(var(--accentRGB),0.1)"
        />
        {mostUsed.length === 0 ? (
          <div style={{
            padding: '28px 24px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 10,
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
          }}>
            <Icons.BarChart2 size={26} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 12 }}>No page views yet. Start exploring KUETx!</p>
          </div>
        ) : (
          <div style={gridStyle}>
            {mostUsed.map((stat) => (
              <PageCard
                key={stat.path}
                path={stat.path}
                count={stat.count}
                showCount={true}
                variant="used"
              />
            ))}
          </div>
        )}
      </section>

      {/* ── STATS (full page only) ── */}
      {!inPanel && allStats.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Statistics</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Your usage snapshot</span>
          </div>
          <div style={statsGridStyle}>
            {statItems.map(({ label, value, Icon, color, iconBg }) => (
              <div key={label} style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                padding: '14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Default export: the full `/quick-access` route page
export default function QuickAccess() {
  return <QuickAccessPanel />;
}