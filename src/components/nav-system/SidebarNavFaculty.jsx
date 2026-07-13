// SidebarNavFaculty.jsx
//
// Faculty-only sidebar nav list. This file imports NAV_FACULTY
// (nav-faculty.js) and nothing from the student side — it has no way to
// accidentally render a student row even by mistake, because NAV is never
// imported here. Sibling: SidebarNavStudent.jsx, the mirror image for the
// main student shell.
//
// Faculty currently has no CR-board or admin-row concept, so filterNav's
// cr/admin gates are intentionally not applied here (unlike the student
// list) — keep it that way unless the faculty nav actually grows an
// equivalent gated row.

import { NAV_FACULTY } from '../../nav-faculty';
import { NavList } from './SidebarNavShared';

export default function SidebarNavFaculty({ location, onClose }) {
  return (
    <NavList
      filteredNav={NAV_FACULTY}
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
