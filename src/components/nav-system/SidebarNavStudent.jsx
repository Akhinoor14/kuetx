// SidebarNavStudent.jsx
//
// Student-only sidebar nav list. This file imports NAV (nav.js) and
// nothing from the faculty side — it has no way to accidentally render a
// faculty row even by mistake, because NAV_FACULTY is never imported here.
// Sibling: SidebarNavFaculty.jsx, which is the mirror image for /faculty/*.

import { NAV, getStudentNav } from '../../nav';
import { filterNav } from '../../lib/modeFilter';
import { NavList } from './SidebarNavShared';
import { useIsMobileNav } from '../BottomNav';

export default function SidebarNavStudent({
  location, onClose, canSeeCrBoard, isRealAdmin, adminLabel, unreadNoticeCount,
}) {
  // Desktop keeps 'Self Study' as its own standalone group; on mobile it
  // nests inside 'Academics' next to Daily Academics / Academic Core (see
  // getStudentNav() in nav.js). Same breakpoint the sidebar's own overlay
  // and BottomNav already use, so this switches at exactly the same width
  // the layout itself switches to the mobile shell.
  const isMobileNav = useIsMobileNav();
  const activeNav = getStudentNav(isMobileNav);

  const filteredNav = filterNav(activeNav, canSeeCrBoard, isRealAdmin).map((section) =>
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
// Always searches the desktop NAV — item objects (label/icon/path) are
// identical in NAV_MOBILE, only grouping differs, so one canonical source
// is enough here regardless of current viewport.
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
