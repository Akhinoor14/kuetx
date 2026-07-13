// SidebarNavFaculty.jsx
//
// Faculty-only sidebar nav list. This file imports NAV_FACULTY
// (nav-faculty.js) and nothing from the student side — it has no way to
// accidentally render a student row even by mistake, because NAV is never
// imported here. Sibling: SidebarNavStudent.jsx, the mirror image for the
// main student shell.
//
// The Admin/"Team & Administration" row carries requiresAdmin: true (see
// nav-faculty.js), so it's gated here the same way the student list gates
// its Admin row — via filterNav — rather than left to render for everyone.

import { NAV_FACULTY } from '../../nav-faculty';
import { filterNav } from '../../lib/modeFilter';
import { NavList } from './SidebarNavShared';

export default function SidebarNavFaculty({ location, onClose, isRealAdmin = false }) {
  const filteredNav = filterNav(NAV_FACULTY, false, isRealAdmin);

  return (
    <NavList
      filteredNav={filteredNav}
      location={location}
      onClose={onClose}
    />
  );
}

export function findFacultyNavItem(path) {
  for (const s of NAV_FACULTY) {
    const pools = s.subgroups ? s.subgroups.map(sub => sub.items) : [s.items];
    for (const pool of pools) {
      const i = pool.find(i => i.path === path);
      if (i) return i;
    }
  }
  return null;
}
