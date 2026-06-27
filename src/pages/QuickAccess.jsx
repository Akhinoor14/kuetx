import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../nav';
import { useFavorites } from '../hooks/useFavorites';
import { usePinnedPages } from '../hooks/usePinnedPages';
import { getPageStats, getAllPageStats } from '../hooks/usePageTracker';
import { getProfile } from '../store/store';
import { filterNav, getAppMode } from '../lib/modeFilter';
import heroBg from '../assets/profile-hero-bg.svg';

const CR_PATHS = NAV.flatMap(s => s.items || []).filter(i => i.requiresCR).map(i => i.path);
const MOBILE_QUERY = '(max-width: 767.98px)';

const GROUP_META = {
  'Overview':   { icon: 'LayoutDashboard', color: '#0f9b77' },
  'Class Rep':  { icon: 'Shield',          color: '#a78bfa' },
  'Academics':  { icon: 'GraduationCap',   color: '#3b82f6' },
  'Daily Life': { icon: 'Sunrise',         color: '#f59e0b' },
  'Wellbeing':  { icon: 'Heart',           color: '#ec4899' },
  'Finance':    { icon: 'Wallet',          color: '#10b981' },
  'Activities': { icon: 'Layers',          color: '#f97316' },
  'Tools':      { icon: 'Wrench',          color: '#64748b' },
};

// Get the group meta for a given path
function getPathMeta(path) {
  for (const s of NAV) {
    if (s.items.find(i => i.path === path)) return GROUP_META[s.group] || null;
  }
  return null;
}

export function QuickAccessPanel({ inPanel = false, onNavigate } = {}) {
  const [mostUsed, setMostUsed] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'browse'
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
  const totalViews = allStats.reduce((sum, s) => sum + s.count, 0);

  const getPageLabel = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return i.label; }
    return path === '/' ? 'Dashboard' : path;
  };
  const getPageIcon = (path) => {
    for (const s of NAV) { const i = s.items.find(i => i.path === path); if (i) return Icons[i.icon] || Icons.Circle; }
    return Icons.Circle;
  };

  // ── Page tile — icon on top, label below (bKash-style grid tile), used everywhere
  const PageTile = ({ path, count, accent, showPin = true }) => {
    const Icon = getPageIcon(path);
    const label = getPageLabel(path);
    const favorite = isFavorite(path);
    const pinned = isPinned(path);
    const meta = getPathMeta(path);
    const color = accent || meta?.color || 'var(--accent)';
    return (
      <Link to={path} onClick={handleNavigate}
        className="qa-tile"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          padding: '14px 6px 10px', borderRadius: 16,
          border: '1px solid var(--border)', background: 'var(--surface)',
          textDecoration: 'none', color: 'var(--text)',
          minHeight: 92, position: 'relative',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 16px ${color}20`; e.currentTarget.style.borderColor = `${color}40`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {/* Top-right controls */}
        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 1 }}>
          {showPin && (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); togglePin(path); }}
              style={{ width: 20, height: 20, borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pinned ? color : 'var(--muted)', opacity: pinned ? 1 : 0.45 }}>
              <Icons.Pin size={10} fill={pinned ? 'currentColor' : 'none'} />
            </button>
          )}
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(path); }}
            style={{ width: 20, height: 20, borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: favorite ? '#fbbf24' : 'var(--muted)', opacity: favorite ? 1 : 0.45 }}>
            <Icons.Star size={10} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Icon size={18} color={color} strokeWidth={1.8} />
          {count > 0 && (
            <span style={{ position: 'absolute', bottom: -6, right: -6, fontSize: 9, fontWeight: 700, color: '#fff', background: color, borderRadius: 20, padding: '1px 5px', border: '1.5px solid var(--surface)', lineHeight: 1.3 }}>{count}</span>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%' }}>
          {label}
        </div>
      </Link>
    );
  };

  // ── Section label
  const SectionLabel = ({ icon: LIcon, label, color, count, extra }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <LIcon size={11} color={color} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 20, padding: '1px 7px' }}>{count}</span>
      )}
      {extra && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>{extra}</span>}
    </div>
  );

  const tileGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 };

  // ── HOME TAB
  const HomeTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* CR Section */}
      {isCR && CR_PATHS.length > 0 && (
        <section>
          <SectionLabel icon={Icons.Shield} label="CR Dashboard" color="#a78bfa" count={CR_PATHS.length} />
          <div style={tileGrid}>
            {CR_PATHS.map(path => <PageTile key={path} path={path} accent="#a78bfa" />)}
          </div>
        </section>
      )}

      {/* Pinned */}
      {pinnedPages.length > 0 && (
        <section>
          <SectionLabel icon={Icons.Pin} label="Pinned" color="var(--accent)" count={pinnedPages.length} />
          <div style={tileGrid}>
            {pinnedPages.map(path => <PageTile key={path} path={path} />)}
          </div>
        </section>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <section>
          <SectionLabel icon={Icons.Star} label="Favorites" color="#f59e0b" count={favorites.length} />
          <div style={tileGrid}>
            {favorites.map(path => {
              const stat = allStats.find(s => s.path === path);
              return <PageTile key={path} path={path} count={stat?.count || 0} accent="#f59e0b" />;
            })}
          </div>
        </section>
      )}

      {/* Most Used */}
      <section>
        <SectionLabel icon={Icons.TrendingUp} label="Most Used" color="var(--accent)" extra="Top 10" />
        {mostUsed.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: 'var(--inputBg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
            <Icons.BarChart2 size={22} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3, color: 'var(--muted)' }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>No page views yet. Start exploring KUETx!</p>
          </div>
        ) : (
          <div style={tileGrid}>
            {mostUsed.map(stat => <PageTile key={stat.path} path={stat.path} count={stat.count} />)}
          </div>
        )}
      </section>

      {/* Browse all CTA */}
      {!inPanel && (
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <button onClick={() => setActiveTab('browse')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 99, background: 'var(--inputBg)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--inputBg)'; e.currentTarget.style.color = 'var(--muted)'; }}
          >
            <Icons.Grid size={13} />
            Browse all pages
            <Icons.ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );

  // ── BROWSE TAB (All Pages — group boxes)
  const BrowseTab = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {filterNav(NAV, getAppMode(), isCR).map(section => {
          const meta = GROUP_META[section.group] || { icon: 'Circle', color: '#64748b' };
          const GroupIcon = Icons[meta.icon] || Icons.Circle;
          return (
            <div key={section.group} style={{ border: `1.5px solid ${meta.color}22`, borderRadius: 14, overflow: 'hidden', background: 'var(--surface)' }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: `${meta.color}0d`, borderBottom: `1px solid ${meta.color}1a` }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GroupIcon size={12} color={meta.color} />
                </div>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{section.group}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}28`, borderRadius: 20, padding: '1px 7px' }}>{section.items.length}</span>
              </div>
              {/* Items */}
              <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))', gap: 8 }}>
                {section.items.map(item => {
                  const stat = allStats.find(s => s.path === item.path);
                  return (
                    <PageTile key={item.id} path={item.path} count={stat?.count || 0} accent={meta.color} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', minWidth: 0 }}>

      {/* Hero (full page only) */}
      {!inPanel && (
        <div style={{
          backgroundImage: `linear-gradient(135deg, rgba(22,163,74,0.6) 0%, rgba(14,165,233,0.45) 100%), url(${heroBg})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          padding: isMobile ? '16px 18px 14px' : '18px 24px 16px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>Quick Access · KUETx</div>
              <div style={{ fontSize: isMobile ? 19 : 23, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 2, fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>{profile?.name || 'Student'}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>{profile?.department || 'KUET'} · {profile?.year ? `Year ${profile.year}` : 'Student'}</div>
            </div>
            <div style={{ display: 'flex', gap: 0, background: 'rgba(0,0,0,0.18)', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
              {[
                { val: allStats.length, lbl: 'Visited' },
                { val: totalViews,      lbl: 'Views' },
                { val: favorites.length,lbl: 'Favs' },
                { val: pinnedPages.length, lbl: 'Pinned' },
              ].map(({ val, lbl }, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 13px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.12)' : 'none', minWidth: 50 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>{val}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar (full page only) */}
      {!inPanel && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 20px', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
          {[
            { id: 'home',   label: 'My Pages',    icon: Icons.Zap },
            { id: 'browse', label: 'Browse All',  icon: Icons.Grid },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.15s', marginBottom: '-1px' }}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: inPanel ? '4px 2px 8px' : '20px 20px 32px' }}>
        {!inPanel && activeTab === 'browse' ? <BrowseTab /> : <HomeTab />}
        {inPanel && <HomeTab />}
      </div>
    </div>
  );
}

export default function QuickAccess() {
  return <QuickAccessPanel />;
}