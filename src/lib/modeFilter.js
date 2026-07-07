/**
 * KUETx App Mode Filter
 * 'full' — all pages visible
 * 'jr'   — academic/campus focused only (hides fullOnly groups/items)
 */

const MODE_KEY          = 'kuetx_app_mode';
const ONBOARDING_KEY    = 'kuetx_mode_chosen';

export const getAppMode = () => {
  try { return localStorage.getItem(MODE_KEY) || 'full'; } catch { return 'full'; }
};

export const setAppMode = (mode) => {
  try {
    localStorage.setItem(MODE_KEY, mode);
    window.dispatchEvent(new CustomEvent('kuetx:mode-changed', { detail: { mode } }));
  } catch {}
};

export const isModeChosen = () => {
  try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
};

export const markModeChosen = () => {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
};

/**
 * Filter NAV sections based on current mode + CR status.
 * Returns filtered NAV — same shape, sections/items removed where appropriate.
 */
const filterItems = (items, section, mode, isCR) => items.filter(item => {
  if (item.requiresCR && !isCR) return false;
  if (mode === 'jr') {
    if (section.fullOnly) return false;
    if (item.fullOnly) return false;
  }
  return true;
});

export const filterNav = (nav, mode, isCR = false) => {
  return nav
    .map(section => {
      // CR-only sections
      if (section.requiresCR && !isCR) {
        return section.subgroups ? { ...section, subgroups: [] } : { ...section, items: [] };
      }

      if (section.subgroups) {
        const subgroups = section.subgroups
          .map(sub => ({ ...sub, items: filterItems(sub.items, section, mode, isCR) }))
          .filter(sub => sub.items.length > 0);
        return { ...section, subgroups };
      }

      const items = filterItems(section.items, section, mode, isCR);
      return { ...section, items };
    })
    .filter(section => section.subgroups ? section.subgroups.length > 0 : section.items.length > 0);
};

// Kept for Sidebar backward compat (stubs)
export const getJrCustomHidden = () => [];
export const getJrCustomShown  = () => [];
