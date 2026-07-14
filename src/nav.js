// All navigation sections and pages for KUETx
// Using only icons confirmed in lucide-react 0.383
export const NAV = [
  {
    group: 'Dashboard',
    isSubgroup: true,
    hubPath: '/',
    hubIcon: 'Grid',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'Grid', path: '/' },
    ]
  },
  {
    group: 'Profile',
    isSubgroup: true,
    hubPath: '/profile',
    hubIcon: 'User',
    items: [
      { id: 'profile', label: 'Profile', icon: 'User', path: '/profile' },
    ]
  },
  {
    group: 'Notice',
    isSubgroup: true,
    hubPath: '/notice',
    hubIcon: 'Bell',
    items: [
      { id: 'notice', label: 'Notice', icon: 'Bell', path: '/notice' },
    ]
  },
  {
    group: 'Class Rep',
    requiresCR: true,
    isSubgroup: true,
    hubPath: '/class-rep',
    hubIcon: 'Shield',
    items: [
      { id: 'class-management', label: 'Class Management',  icon: 'Users',         path: '/class-management', requiresCR: true },
      { id: 'ct-quiz-planning', label: 'CT & Quiz Planner', icon: 'CalendarCheck', path: '/ct-quiz-planning', requiresCR: true },
      { id: 'class-roster',     label: 'Class Roster',      icon: 'Users',         path: '/class-roster',     requiresCR: true },
    ]
  },
  {
    group: 'Admin',
    requiresAdmin: true,
    isSubgroup: true,
    hubPath: '/team',
    hubIcon: 'Briefcase',
    // Single destination — /team already renders the right content for
    // whatever role(s) this uid actually holds (Founder / Head of Ops /
    // Campus Lead / etc, see TeamDashboard.jsx + StaffDashboard.jsx). The
    // visible label for this row is set dynamically per-user in Sidebar.jsx
    // (their actual role name), not this static 'Admin' string.
    items: [
      { id: 'team', label: 'Team & Administration', icon: 'Briefcase', path: '/team', requiresAdmin: true },
    ]
  },
  {
    group: 'Academics',
    subgroups: [
      {
        name: 'Daily Academics',
        hubPath: '/daily-academics',
        hubIcon: 'CalendarCheck',
        items: [
          { id: 'attendance',  label: 'Attendance',     icon: 'CalendarCheck', path: '/attendance' },
          { id: 'schedule',    label: 'Class Schedule', icon: 'Clock',         path: '/schedule' },
          { id: 'assignments', label: 'Assignments',    icon: 'FileText',      path: '/assignments' },
          { id: 'teachers',    label: 'Teachers',       icon: 'Users',         path: '/teachers' },
          { id: 'classmates',  label: 'Classmates',     icon: 'Users2',        path: '/classmates' },
          { id: 'diary',       label: 'Class Diary',    icon: 'BookOpen',      path: '/diary' },
        ]
      },
      {
        name: 'Academic Core',
        hubPath: '/academic-core',
        hubIcon: 'BookOpen',
        items: [
          { id: 'courses',   label: 'Courses',       icon: 'BookOpen',      path: '/courses' },
          { id: 'syllabus',  label: 'Syllabus',      icon: 'List',          path: '/syllabus' },
          { id: 'qbank',     label: 'Question Bank', icon: 'BookMarked',    path: '/question-bank' },
          { id: 'solutions', label: 'Solution Bank', icon: 'BookOpen',      path: '/solutions' },
          { id: 'marks',     label: 'Term Planner',  icon: 'ClipboardList', path: '/marks' },
          { id: 'results',   label: 'Results & GPA', icon: 'TrendingUp',    path: '/results' },
          { id: 'warnings',  label: 'Alerts',        icon: 'Bell',          path: '/alerts' },
        ]
      },
    ]
  },
  {
    group: 'Campus Life',
    subgroups: [
      {
        name: 'Campus Life',
        hubPath: '/campus-life',
        hubIcon: 'Layers',
        items: [
          { id: 'clubs',    label: 'Clubs',   icon: 'Layers', path: '/clubs' },
          { id: 'projects', label: 'Projects',icon: 'Cpu',    path: '/projects' },
          { id: 'tours',    label: 'Tours',   icon: 'MapPin', path: '/tours' },
          { id: 'money',    label: 'Money',   icon: 'Wallet', path: '/money' },
          { id: 'tuition',  label: 'Tuition', icon: 'Users',  path: '/tuition' },
        ]
      },
      {
        name: 'Daily Life',
        hubPath: '/daily-life',
        hubIcon: 'Sunrise',
        items: [
          { id: 'notes',      label: 'Notes',         icon: 'FileText', path: '/notes' },
          { id: 'time',       label: 'Time Tracker',  icon: 'Timer',    path: '/time' },
          { id: 'namaz',      label: 'Namaz Tracker', icon: 'Moon',     path: '/namaz' },
        ]
      },
    ]
  },
  {
    group: 'Self Study',
    isSubgroup: true,
    hubPath: '/self-study',
    hubIcon: 'Activity',
    items: [
      { id: 'self-study-academic',   label: 'Academic',    icon: 'BookOpen', path: '/self-study/academic' },
      { id: 'self-study-deep-focus', label: 'Deep Focus',  icon: 'Zap',      path: '/self-study/deep-focus' },
    ]
  },
  {
    group: 'Tools',
    isSubgroup: true,
    hubPath: '/tools',
    hubIcon: 'Wrench',
    items: [
      { id: 'reports',  label: 'Reports',     icon: 'BarChart2', path: '/reports' },
      { id: 'settings', label: 'Settings',    icon: 'Settings',  path: '/settings' },
      { id: 'about',    label: 'About KUETx', icon: 'Info',      path: '/about' },
    ]
  },
];

// ── Mobile variant ──────────────────────────────────────────────────────────
// Same NAV, except 'Self Study' (desktop: standalone top-level group) is
// nested as a third subgroup inside 'Academics' next to Daily Academics /
// Academic Core. Everything else — including the Daily Life -> Campus Life
// move above, which applies on BOTH desktop and mobile — is shared as-is.
// Built by transformation (not hand-duplicated) so the two can never drift
// out of sync when items are added/renamed in NAV later.
const SELF_STUDY_SECTION = NAV.find((s) => s.group === 'Self Study');
const SELF_STUDY_AS_SUBGROUP = {
  name: 'Self Study',
  hubPath: SELF_STUDY_SECTION.hubPath,
  hubIcon: SELF_STUDY_SECTION.hubIcon,
  items: SELF_STUDY_SECTION.items,
};

export const NAV_MOBILE = NAV
  .filter((s) => s.group !== 'Self Study')
  .map((s) =>
    s.group === 'Academics'
      ? { ...s, subgroups: [...s.subgroups, SELF_STUDY_AS_SUBGROUP] }
      : s
  );

/** Pick the right NAV structure for the current viewport. */
export function getStudentNav(isMobileNav) {
  return isMobileNav ? NAV_MOBILE : NAV;
}