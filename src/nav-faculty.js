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
// destinations, per §6.1's "ইচ্ছাকৃতভাবে বাদ" note.

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
    group: 'Meetings',
    isSubgroup: true,
    hubPath: '/faculty/meetings',
    hubIcon: 'Video',
    items: [
      { id: 'f-meetings', label: 'Meetings', icon: 'Video', path: '/faculty/meetings' },
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
    group: 'Notices',
    isSubgroup: true,
    hubPath: '/faculty/notices',
    hubIcon: 'Bell',
    items: [
      { id: 'f-notices', label: 'Broadcast Notice', icon: 'Bell', path: '/faculty/notices' },
    ],
  },
  {
    group: 'Campus',
    subgroups: [
      {
        name: 'Resources',
        hubPath: '/faculty/resources',
        hubIcon: 'BookMarked',
        items: [
          { id: 'f-qbank', label: 'Question Bank', icon: 'BookMarked', path: '/faculty/question-bank' },
        ],
      },
    ],
  },
  {
    group: 'Tools',
    isSubgroup: true,
    hubPath: '/faculty/tools',
    hubIcon: 'Wrench',
    items: [
      { id: 'f-contact', label: 'Contact', icon: 'Mail', path: '/faculty/contact' },
      // Settings/About are shared, role-agnostic routes — same destination
      // as the student nav.js, not faculty-specific pages.
      { id: 'f-settings', label: 'Settings', icon: 'Settings', path: '/settings' },
      { id: 'f-about', label: 'About', icon: 'Info', path: '/about' },
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
