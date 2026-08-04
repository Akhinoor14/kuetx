// nav-faculty.js
//
// Navigation config for the /faculty/* shell — same schema as nav.js
// (group/subgroup/hubPath/hubIcon/items), consumed by the same
// SubgroupHub.jsx (via its navSource prop) and by Sidebar.jsx/BottomNav.jsx
// once viewMode === 'teacher' (see §6.2 of the merged Faculty Module
// prompt). Kept as a fully separate file from nav.js rather than merged
// into it — the two audiences (student vs faculty) never need to see each
// other's rows, and keeping them apart means the Notice-hub / other
// student-side nav.js changes from the parallel Notification track can
// never accidentally collide with this file.
//
// Roster/Attendance/Marks/Syllabus deliberately have NO top-level row here
// — those live as tabs inside Class Detail (§8.5), not as their own nav
// destinations, per §6.1's "intentionally omitted" note.

export const NAV_FACULTY = [
  {
    group: 'Dashboard',
    isSubgroup: true,
    hubPath: '/faculty',
    hubIcon: 'Grid',
    items: [
      { id: 'f-dashboard', label: 'Dashboard', icon: 'Grid', path: '/faculty' },
    ],
  },
  {
    group: 'Profile',
    isSubgroup: true,
    hubPath: '/faculty/profile',
    hubIcon: 'User',
    items: [
      { id: 'f-profile', label: 'Profile', icon: 'User', path: '/faculty/profile' },
    ],
  },
  {
    group: 'My Classes',
    isSubgroup: true,
    hubPath: '/faculty/classes',
    hubIcon: 'BookOpen',
    items: [
      { id: 'f-classes', label: 'My Classes', icon: 'BookOpen', path: '/faculty/classes' },
    ],
  },
  {
    group: 'Schedule',
    isSubgroup: true,
    hubPath: '/faculty/schedule',
    hubIcon: 'Clock',
    items: [
      { id: 'f-schedule', label: 'My Schedule', icon: 'Clock', path: '/faculty/schedule' },
    ],
  },
  {
    // "More" — communication (Meetings, Broadcast Notice), the services
    // marketplace, and reference/settings pages (Question Bank, Contact,
    // Settings, About) that don't need their own bottom-nav slot but were
    // previously unreachable on mobile. Split into THREE subgroups by
    // type — communication tools, the services marketplace, and reference/
    // settings tools — rather than folding Services into Resources: on
    // desktop these subgroups get pulled out into fully independent
    // top-level sidebar sections (see NAV_FACULTY_DESKTOP below), and
    // Services needs to stand on its own there rather than be buried
    // inside a "Resources" row, so it's split out here too rather than
    // in the mobile config and desktop config disagreeing about grouping.
    group: 'More',
    subgroups: [
      {
        name: 'Communication',
        hubPath: '/faculty/meetings',
        hubIcon: 'Video',
        items: [
          { id: 'f-meetings', label: 'Meetings', icon: 'Video', path: '/faculty/meetings' },
          { id: 'f-notices', label: 'Broadcast Notice', icon: 'Bell', path: '/faculty/notices' },
        ],
      },
      {
        // Short, no-symbol name to match nav.js's subgroup naming
        // convention (e.g. 'Daily Academics', 'Academic Core') and avoid
        // wrapping on narrow cards.
        name: 'Resources',
        hubPath: '/faculty/resources',
        hubIcon: 'BookMarked',
        items: [
          { id: 'f-qbank', label: 'Question Bank', icon: 'BookMarked', path: '/faculty/question-bank' },
          { id: 'f-contact', label: 'Contact', icon: 'Mail', path: '/faculty/contact' },
          // Settings/About are shared, role-agnostic routes — same
          // destination as the student nav.js, not faculty-specific pages.
          { id: 'f-settings', label: 'Settings', icon: 'Settings', path: '/settings' },
          { id: 'f-about', label: 'About', icon: 'Info', path: '/about' },
        ],
      },
      {
        // Services marketplace (MULTI_CATEGORY_SERVICES_PLAN.md) — same
        // /services/category/:type routes the student shell uses,
        // unguarded by role in App.jsx. Mirrors nav.js's student-side
        // Services subgroup exactly (5 category items, not one generic
        // "Services" link) so this section shows the real category
        // cards (Salon/Food/Pharmacy/Stationery/Online Mart) directly,
        // the same as the student Campus Life page's Services section.
        // Placed LAST (after Communication, Resources) per explicit
        // request — an occasional-use campus utility, not something
        // that needs top billing in the sidebar order.
        name: 'Services',
        hubPath: '/services',
        hubIcon: 'Store',
        items: [
          { id: 'f-services-salon',      label: 'Salon',       icon: 'Scissors',        path: '/services/category/salon' },
          { id: 'f-services-hotel',      label: 'Food',        icon: 'UtensilsCrossed', path: '/services/category/hotel' },
          { id: 'f-services-medicine',   label: 'Pharmacy',    icon: 'Cross',           path: '/services/category/medicine' },
          { id: 'f-services-bookstore',  label: 'Stationery',  icon: 'BookOpen',        path: '/services/category/bookstore' },
          { id: 'f-services-onlinemart', label: 'Online Mart', icon: 'ShoppingBag',     path: '/services/category/onlinemart' },
          // BUGFIX: mirrors nav.js's student-side services-errand entry,
          // which was missing here — Delivery/Pick-and-drop is a real
          // services category in the data model but had no faculty-side
          // nav row, so faculty viewers could never reach it via the
          // Services chip strip/sidebar (Bike icon already registered in
          // iconRegistry.js by the student-side fix).
          { id: 'f-services-errand',     label: 'Pick and Drop',    icon: 'Bike',            path: '/services/category/errand' },
        ],
      },
    ],
  },
  {
    group: 'Admin',
    requiresAdmin: true,
    isSubgroup: true,
    hubPath: '/team',
    hubIcon: 'Briefcase',
    // Same shared /team destination as nav.js's Admin row — Founder
    // viewing as "teacher" still reaches the one real admin dashboard.
    items: [
      { id: 'f-team', label: 'Team & Administration', icon: 'Briefcase', path: '/team', requiresAdmin: true },
    ],
  },
];

// ── Desktop variant ──────────────────────────────────────────────────────────
// On mobile, "More" bundles Communication + Services + Resources together
// under one section label — that grouping exists purely because the
// 4-button bottom nav has no room for extra top-level destinations.
// Desktop's sidebar has no such space constraint, so each subgroup gets
// promoted to its own independent top-level sidebar section instead,
// exactly like Dashboard/Profile/My Classes/Schedule already are.
//
// hubPath override for Resources: the base NAV_FACULTY subgroup's
// hubPath ('/faculty/resources') is a legacy redirect straight to the
// combined mobile /faculty/more hub (all three subgroups at once) — fine
// for mobile where that combined page IS the destination, wrong for
// desktop where Resources needs its OWN single-subgroup hub page.
// '/faculty/resources-hub' is that dedicated desktop-only route (see
// App.jsx), keeping '/faculty/resources' itself as the untouched mobile
// redirect so old bookmarks/links still land on the combined page.
export const NAV_FACULTY_DESKTOP = NAV_FACULTY.map((section) => {
  if (section.group !== 'More' || !section.subgroups) return section;

  return section.subgroups.map((sub) => ({
    group: sub.name,
    isSubgroup: true,
    hubPath: sub.name === 'Resources' ? '/faculty/resources-hub' : sub.hubPath,
    hubIcon: sub.hubIcon,
    items: sub.items,
  }));
}).flat();

// ── Mobile variant ──────────────────────────────────────────────────────────
// Mobile keeps the original bundled "More > Communication / Services /
// Resources" structure as-is — no separate transform needed, mirrors
// nav.js's NAV_MOBILE = NAV pattern.
export const NAV_FACULTY_MOBILE = NAV_FACULTY;

/** Pick the right NAV_FACULTY structure for the current viewport — same shape as nav.js's getStudentNav. */
export function getFacultyNav(isMobileNav) {
  return isMobileNav ? NAV_FACULTY_MOBILE : NAV_FACULTY_DESKTOP;
}