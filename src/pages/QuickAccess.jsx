import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getPageStats, getAllPageStats } from '../hooks/usePageTracker';
import { getProfile } from '../store/store';
import { filterNav, getAppMode } from '../lib/modeFilter';

const CR_PATHS = NAV.flatMap(s => s.items || []).filter(i => i.requiresCR).map(i => i.path);
const MOBILE_QUERY = '(max-width: 767.98px)';

// Group colors matching Sidebar
const GROUP_META = {
  'Overview':    { icon: 'LayoutDashboard', color: '#0f9b77', bg: 'rgba(15,155,119,0.10)' },
  'Class Rep':   { icon: 'Shield',          color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  'Academics':   { icon: 'GraduationCap',   color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
  'Daily Life':  { icon: 'Sunrise',         color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  'Wellbeing':   { icon: 'Heart',           color: '#ec4899', bg: 'rgba(236,72,153,0.10)' },
  'Finance':     { icon: 'Wallet',          color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  'Activities':  { icon: 'Layers',          color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
  'Tools':       { icon: 'Wrench',          color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
};

export function QuickAccessPanel({ inPanel = false, onNavigate } = {}) {
  const [mostUsed, setMostUsed] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { pinnedPages, togglePin, isPinned } = usePinnedPages();
  const [profile, setProfile] = useState(() => getProfile() || {});
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = (e) => setIsMobile(e.matches);
    sync(mq);
    mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', sync) : mq.removeListener(sync); };
  }, []);

  useEffect(() => {
    const syncStats = () => { setMostUsed(getPageStats()); setAllStats(getAllPageStats()); };
    const syncProfile = () => setProfile(getProfile() || {});
    syncStats(); syncProfile();
    window.addEventListener('kuetx:store-updated', syncStats);
    window.addEventListener('kuetx:store-updated', syncProfile);
    return () => {
      window.removeEventListener('kuetx:store-updated', syncStats);
      window.removeEventListener('kuetx:store-updated', syncProfile);
    };
  }, []);

  const isCR = !!profile?.isCR;
  const handleNavigate = () => { if (onNavigate) onNavigate(); };

  const getPageLabel = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return i.label; }
    return path === '/' ? 'Dashboard' : path;
  };
  const getPageIcon = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return Icons[i.icon] || Icons.Circle; }
    return Icons.Circle;
  };

  const totalViews = allStats.reduce((sum, s) => sum + s.count, 0);

  // ── Page card (desktop list row)
  const PageCard = ({ path, count, showCount = false, accent }) => {
    const Icon = getPageIcon(path);
    const label = getPageLabel(path);
    const favorite = isFavorite(path);
    const pinned = isPinned(path);
    const cardColor = accent || 'var(--accent)';
    const cardBg = accent ? `${accent}14` : 'rgba(var(--accentRGB),0.08)';

    if (isMobile) {
      return (
        <Link to={path} onClick={handleNavigate}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 6, padding: '12px 4px 8px',
            borderRadius: 14, border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', textDecoration: 'none',
            color: 'var(--text)', minHeight: 82, position: 'relative',
            WebkitTapHighlightColor: 'transparent', userSelect: 'none',
          }}
        >
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(path); }}
            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, background: favorite ? 'rgba(251,191,36,0.14)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favorite ? '#fbbf24' : 'var(--muted)' }}
          >
            <Icons.Star size={11} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Icon size={17} color={cardColor} />
            {pinned && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg-secondary)' }} />}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word', maxWidth: '100%' }}>
            {label}
          </div>
        </Link>
      );
    }

    return (
      <Link to={path} onClick={handleNavigate}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', textDecoration: 'none', color: 'var(--text)', transition: 'border-color 0.12s, background 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cardColor; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 9, background: cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} color={cardColor} />
        </div>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {showCount && count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, background: cardBg, color: cardColor, border: `1px solid ${cardColor}30`, borderRadius: 8, padding: '1px 6px', flexShrink: 0 }}>{count}</span>
        )}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); togglePin(path); }}
            title={pinned ? 'Unpin' : 'Pin'}
            style={{ width: 26, height: 26, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pinned ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(var(--accentRGB),0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = pinned ? 'var(--accent)' : 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {pinned ? <Icons.Pin size={13} fill="currentColor" /> : <Icons.Pin size={13} />}
          </button>
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(path); }}
            title={favorite ? 'Unfavorite' : 'Favorite'}
            style={{ width: 26, height: 26, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: favorite ? '#fbbf24' : 'var(--muted)', transition: 'color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = favorite ? '#fbbf24' : 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {favorite ? <Icons.Star size={13} fill="currentColor" /> : <Icons.Star size={13} />}
          </button>
        </div>
      </Link>
    );
  };

  const listGrid = { display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(84px,1fr))' : 'repeat(auto-fill, minmax(230px,1fr))', gap: 8 };

  return (
    <div style={{ padding: inPanel ? '2px 2px 8px' : '0', width: '100%', minWidth: 0 }}>

      {/* ── HERO (full page only) ── */}
      {!inPanel && (
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #1e40af) 100%)',
          borderRadius: 0,
          padding: isMobile ? '28px 20px 24px' : '36px 32px 30px',
          marginBottom: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* BG decoration */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: '30%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              Quick Access · KUETx
            </div>
            <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 6, fontFamily: 'Sora, sans-serif' }}>
              {profile?.name || 'Student'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 22 }}>
              {profile?.department || 'KUET'} · {profile?.year ? `Year ${profile.year}` : 'Student'}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', background: 'rgba(0,0,0,0.15)', borderRadius: 12, overflow: 'hidden', width: 'fit-content' }}>
              {[
                { val: allStats.length, lbl: 'Visited', icon: Icons.Layers },
                { val: totalViews, lbl: 'Views', icon: Icons.BarChart3 },
                { val: favorites.length, lbl: 'Favs', icon: Icons.Star },
                { val: pinnedPages.length, lbl: 'Pinned', icon: Icons.Pin },
              ].map(({ val, lbl, icon: StatIcon }, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 18px',
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                  minWidth: 64,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: inPanel ? '0' : '20px 20px 32px' }}>

        {/* ── CR SECTION ── */}
        {isCR && CR_PATHS.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(167,139,250,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Shield size={12} color="#a78bfa" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>CR Dashboard</span>
              <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8, padding: '1px 7px' }}>{CR_PATHS.length}</span>
            </div>
            <div style={listGrid}>
              {CR_PATHS.map(path => <PageCard key={path} path={path} accent="#a78bfa" />)}
            </div>
          </section>
        )}

        {/* ── PINNED ── */}
        {pinnedPages.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(var(--accentRGB),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Pin size={12} color="var(--accent)" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pinned</span>
              <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(var(--accentRGB),0.1)', border: '1px solid rgba(var(--accentRGB),0.2)', borderRadius: 8, padding: '1px 7px' }}>{pinnedPages.length}</span>
            </div>
            <div style={listGrid}>
              {pinnedPages.map(path => <PageCard key={path} path={path} />)}
            </div>
          </section>
        )}

        {/* ── FAVORITES ── */}
        {favorites.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(251,191,36,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Star size={12} color="#fbbf24" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Favorites</span>
              <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '1px 7px' }}>{favorites.length}</span>
            </div>
            <div style={listGrid}>
              {favorites.map(path => {
                const stat = allStats.find(s => s.path === path);
                return <PageCard key={path} path={path} count={stat?.count} showCount accent="#fbbf24" />;
              })}
            </div>
          </section>
        )}

        {/* ── MOST USED ── */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(var(--accentRGB),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.TrendingUp size={12} color="var(--accent)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Most Used</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Top 10</span>
          </div>
          {mostUsed.length === 0 ? (
            <div style={{ padding: '28px 24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px dashed var(--border)', color: 'var(--muted)' }}>
              <Icons.BarChart2 size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.35 }} />
              <p style={{ margin: 0, fontSize: 12 }}>No page views yet. Start exploring KUETx!</p>
            </div>
          ) : (
            <div style={listGrid}>
              {mostUsed.map(stat => <PageCard key={stat.path} path={stat.path} count={stat.count} showCount />)}
            </div>
          )}
        </section>

        {/* ── ALL PAGES (grouped) ── */}
        {!inPanel && (
          <section>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 20, paddingBottom: 14,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(var(--accentRGB),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Grid size={14} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'Sora, sans-serif' }}>All Pages</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Every page in KUETx · tap to pin or favorite</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {filterNav(NAV, getAppMode(), isCR).map(section => {
                const meta = GROUP_META[section.group] || { icon: 'Circle', color: 'var(--muted)', bg: 'var(--inputBg)' };
                const GroupIcon = Icons[meta.icon] || Icons.Circle;
                const visibleItems = section.items;

                return (
                  <div key={section.group}>
                    {/* Group label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GroupIcon size={11} color={meta.color} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {section.group}
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
                    </div>

                    {/* Items */}
                    <div style={listGrid}>
                      {visibleItems.map(item => {
                        const stat = allStats.find(s => s.path === item.path);
                        return (
                          <PageCard
                            key={item.id}
                            path={item.path}
                            count={stat?.count}
                            showCount={!!stat?.count}
                            accent={meta.color}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function QuickAccess() {
  return <QuickAccessPanel />;
}
