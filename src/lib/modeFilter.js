/**
 * KUETx NAV filter
 * JR/Full app-mode was removed — every user now sees the full app.
 * This module now only filters CR-only sections/items based on real
 * CR/ACR status (see Sidebar.jsx / BottomNav.jsx for how isCR is derived).
 */

const filterItems = (items, isCR) => items.filter(item => {
  if (item.requiresCR && !isCR) return false;
  return true;
});

export const filterNav = (nav, isCR = false) => {
  return nav
    .map(section => {
      // CR-only sections
      if (section.requiresCR && !isCR) {
        return section.subgroups ? { ...section, subgroups: [] } : { ...section, items: [] };
      }

      if (section.subgroups) {
        const subgroups = section.subgroups
          .map(sub => ({ ...sub, items: filterItems(sub.items, isCR) }))
          .filter(sub => sub.items.length > 0);
        return { ...section, subgroups };
      }

      const items = filterItems(section.items, isCR);
      return { ...section, items };
    })
    .filter(section => section.subgroups ? section.subgroups.length > 0 : section.items.length > 0);
};