// BottomNavProvider.js
//
// Provider-only bottom-nav fixed button set. Sibling: BottomNavStudent.js,
// BottomNavFaculty.js.
//
// Phase 1 of PROVIDER_NAV_RESTRUCTURE_PROMPT.md: only 2 fixed buttons wired
// here — Dashboard (/provider) and My Shop (/provider/shop). My Shop's
// route doesn't exist yet (that's Phase 2); the button is wired now so
// Phase 2 only has to add the route, not touch nav config again. The 3rd
// visible tab (Profile) is rendered directly in BottomNav.jsx as a plain
// link to /settings — NOT routed through ProfileButton's CR/staff logic,
// since none of that applies to a provider account.
// Was a module-level constant; now a function of `t` so labels respond to
// the provider language toggle. Called from BottomNav.jsx where
// useProviderLang() is already available.
export function getProviderFixedButtons(t) {
  return [
    { id: 'p-dashboard', label: t('bottomNav.dashboard'), icon: 'Grid',  path: '/provider',       match: (p) => p === '/provider' },
    { id: 'p-shop',      label: t('bottomNav.myShop'),   icon: 'Store', path: '/provider/shop',  match: (p) => p === '/provider/shop' || p.startsWith('/provider/shop/') },
  ];
}
