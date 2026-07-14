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
    // "More" — communication (Meetings, Broadcast Notice) and reference/
    // settings pages (Question Bank, Contact, Settings, About) that don't
    // need their own bottom-nav slot but were previously unreachable on
    // mobile (only visible via the desktop sidebar's separate Meetings/
    // Notices/Tools groups, which the 4-button mobile bottom nav has no
    // room for). Grouped into two subgroups by type — communication tools
    // together, resource/settings tools together — rather than one flat
    // list, so Meetings and Broadcast Notice (frequent, time-sensitive)
    // don't get visually buried under Settings/About (rare, set-once).
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
        // wrapping on narrow cards. Question Bank + Contact/Settings/About
        // deliberately share one subgroup rather than splitting further —
        // Question Bank alone in its own subgroup would leave a
        // single-item section with awkward leftover space; grouped
        // together they read as "everything else you reach for
        // occasionally," which is accurate enough for both.
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