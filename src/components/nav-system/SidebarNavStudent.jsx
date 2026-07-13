// SidebarNavStudent.jsx
//
// Student-only sidebar nav list. This file imports NAV (nav.js) and
// nothing from the faculty side — it has no way to accidentally render a
// faculty row even by mistake, because NAV_FACULTY is never imported here.
// Sibling: SidebarNavFaculty.jsx, which is the mirror image for /faculty/*.

import { NAV } from '../../nav';
import { filterNav } from '../../lib/modeFilter';
import { NavList } from './SidebarNavShared';

export default function SidebarNavStudent({
  location, onClose, canSeeCrBoard, isRealAdmin, adminLabel, unreadNoticeCount,
}) {
  const filteredNav = filterNav(NAV, canSeeCrBoard, isRealAdmin).map((section) =>
    section.group === 'Admin'
      ? { ...section, group: adminLabel }
      : section
  );

  return (
    <NavList
      filteredNav={filteredNav}
      location={location}
      onClose={onClose}
      unreadNoticeCount={unreadNoticeCount}
    />
  );
}

// Exposed for callers (Sidebar.jsx quick-strip lookups) that need to
// resolve a path to its label/icon without duplicating NAV traversal.
export function findStudentNavItem(path) {
  for (const s of NAV) {
    const pools = s.subgroups ? s.subgroups.map(sub => sub.items) : [s.items];
    for (const pool of pools) {
      const i = pool.find(i => i.path === path);
      if (i) return i;
    }
  }
  return null;
}
