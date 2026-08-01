// SidebarNavProvider.jsx
//
// BUGFIX: Sidebar.jsx used to decide student-vs-faculty shell purely via
// useViewMode() (isFaculty ? 'teacher' : 'student') with no third option,
// so a provider account — pending, rejected, or verified — always fell
// into the 'student' branch and got the full SidebarNavStudent list
// (Dashboard, Academic Core, Class Rep tools, Campus Life, everything).
// RequireProvider only ever gated the single /provider route itself; the
// sidebar had no idea the signed-in account wasn't a student at all. This
// is the minimal dedicated nav for that case: just a link back to
// /provider (RequireProvider there handles pending/rejected/verified
// presentation) plus Settings/About, nothing student-shaped.
//
// Phase 1 of PROVIDER_NAV_RESTRUCTURE_PROMPT.md: updated to the new
// 3-link target structure (Dashboard, My Shop, Settings), mirroring
// PROVIDER_FIXED_BUTTONS + the /settings profile button in BottomNav.jsx.
// /provider/shop doesn't have a route yet (Phase 2) — same "wire now,
// route later" approach as the bottom nav. The standalone "About" link is
// dropped from its own row and folded into the Account group's Settings
// destination isn't right either, so instead it's kept as a link but
// grouped under Account still — simplest option that satisfies "keep it
// reachable from somewhere" without inventing a 4th top-level item.

import { NavList } from './SidebarNavShared';
import { useProviderLang } from '../../hooks/useProviderLang';
import { store } from '../../store/store';
import { providerStrings } from '../../lib/providerStrings';

// Was a module-level constant; now a function of `t` since labels must
// respond to the provider language toggle. Keys/paths/icons are static,
// only `label`/`group` are translated per-call.
//
// PHASE 1 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): this is now also the
// dedicated provider nav source Navbar.jsx's getPageMeta() reads from for
// an `isProvider` viewer, replacing the old fallthrough into the student
// `Tools` group for /settings and /about. Every entry below is
// deliberately its own single-item group — same "must never produce a
// topbar chip strip" convention already used by the 4 provider-only stub
// groups in nav.js — so getPageMeta's `siblings.length > 1` check
// naturally suppresses the chip strip on every provider page (Dashboard,
// My Shop, Settings, About all feel like 4 separate destinations, not
// siblings you flip between via chips).
export function getNavProvider(t) {
  return [
    {
      group: t('nav.dashboard'),
      hubPath: '/provider',
      items: [
        { id: 'provider-dashboard', path: '/provider', label: t('nav.dashboard'), icon: 'Grid' },
      ],
    },
    {
      group: t('nav.myShop'),
      hubPath: '/provider/shop',
      items: [
        { id: 'provider-shop', path: '/provider/shop', label: t('nav.myShop'), icon: 'Store', matchPrefix: true },
      ],
    },
    {
      group: t('nav.profile'),
      hubPath: '/provider/profile',
      items: [
        { id: 'provider-profile', path: '/provider/profile', label: t('nav.profile'), icon: 'User' },
      ],
    },
    {
      group: t('nav.settings'),
      hubPath: '/settings',
      items: [
        { id: 'provider-settings', path: '/settings', label: t('nav.settings'), icon: 'Settings' },
      ],
    },
    {
      group: t('nav.about'),
      hubPath: '/about',
      items: [
        { id: 'provider-about', path: '/about', label: t('nav.about'), icon: 'Info' },
      ],
    },
  ];
}

// SidebarNavProvider's own on-screen grouping (Provider / Account section
// headers) is a separate, presentational concern from getPageMeta's
// topbar resolution above — NavList here still wants the original 2-group
// visual layout, so that shape is built locally instead of reusing
// getNavProvider(t)'s now-flattened 4-group shape (which exists purely
// for Navbar.jsx's topbar/chip-strip resolution).
function getSidebarSections(t) {
  return [
    {
      group: t('nav.groupProvider'),
      items: [
        { id: 'provider-dashboard', path: '/provider', label: t('nav.dashboard'), icon: 'Grid' },
        { id: 'provider-shop', path: '/provider/shop', label: t('nav.myShop'), icon: 'Store', matchPrefix: true },
        { id: 'provider-profile', path: '/provider/profile', label: t('nav.profile'), icon: 'User' },
      ],
    },
    {
      group: t('nav.groupAccount'),
      items: [
        { id: 'provider-settings', path: '/settings', label: t('nav.settings'), icon: 'Settings' },
        { id: 'provider-about', path: '/about', label: t('nav.about'), icon: 'Info' },
      ],
    },
  ];
}

export default function SidebarNavProvider({ location, onClose }) {
  const { t } = useProviderLang();
  return (
    <NavList
      filteredNav={getSidebarSections(t)}
      location={location}
      onClose={onClose}
    />
  );
}

export function findProviderNavItem(path) {
  // This is a plain exported function (not a component), so it can't call
  // useProviderLang() directly. Matching is purely path-based (see
  // Sidebar.jsx's getPageLabel/getPageIcon), so reading the current lang
  // straight from `store` here — same source useProviderLang() itself
  // persists to — gives an up-to-date label/icon without needing a hook.
  const saved = store.get('providerLang');
  const lang = saved === 'en' || saved === 'bn' ? saved : 'bn';
  const dict = providerStrings[lang] || providerStrings.bn;
  const t = (key) => dict[key] ?? providerStrings.bn[key] ?? key;

  for (const s of getNavProvider(t)) {
    const i = s.items.find(i => i.path === path);
    if (i) return i;
  }
  return null;
}
