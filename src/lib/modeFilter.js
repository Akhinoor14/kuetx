/**
 * KUETx NAV filter
 * JR/Full app-mode was removed — every user now sees the full app.
 * Filters CR-only sections/items based on real CR/ACR status, and
 * Admin/staff-only sections based on real admin/staff-panel status
 * (see Sidebar.jsx for how both are derived — always from a live,
 * server-verified source, never a self-ticked profile flag).
 */

const filterItems = (items, isCR, isAdmin) => items.filter(item => {
  if (item.requiresCR && !isCR) return false;
  if (item.requiresAdmin && !isAdmin) return false;
  return true;
});

export const filterNav = (nav, isCR = false, isAdmin = false) => {
  return nav
    .map(section => {
      // CR-only sections
      if (section.requiresCR && !isCR) {
        return section.subgroups ? { ...section, subgroups: [] } : { ...section, items: [] };
      }
      // Admin/staff-only sections
      if (section.requiresAdmin && !isAdmin) {
        return section.subgroups ? { ...section, subgroups: [] } : { ...section, items: [] };
      }

      if (section.subgroups) {
        const subgroups = section.subgroups
          .map(sub => ({ ...sub, items: filterItems(sub.items, isCR, isAdmin) }))
          .filter(sub => sub.items.length > 0);
        return { ...section, subgroups };
      }

      const items = filterItems(section.items, isCR, isAdmin);
      return { ...section, items };
    })
    .filter(section => section.subgroups ? section.subgroups.length > 0 : section.items.length > 0);
};
