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
function getNavProvider(t) {
  return [
    {
      group: t('nav.groupProvider'),
      items: [
        { id: 'provider-dashboard', path: '/provider', label: t('nav.dashboard'), icon: 'Grid' },
        { id: 'provider-shop', path: '/provider/shop', label: t('nav.myShop'), icon: 'Store', matchPrefix: true },
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
      filteredNav={getNavProvider(t)}
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
