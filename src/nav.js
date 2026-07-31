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
    group: 'Today',
    isSubgroup: true,
    hubPath: '/today',
    hubIcon: 'Sunrise',
    items: [
      { id: 'today', label: 'Today', icon: 'Sunrise', path: '/today' },
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
  // Class Rep hub — ONE sidebar row (hubPath /class-rep, same convention
  // as Dashboard/Profile/Notice), with 6 items (Routine, Class Planner,
  // CT & Quiz Planner, Roster, Class Announcements, My Role) — each its
  // own standalone page now (previously 2 pages with internal tab-
  // switches). Kept as a single group (not split into 6 single-item
  // groups) so the Sidebar still shows exactly one "Class Rep" row
  // linking to the /class-rep hub, matching every other isSubgroup
  // entry, while the topbar still shows all 6 as a sibling pill row —
  // same pattern as Academics' Daily Academics / Academic Core
  // subgroups, so switching between CR pages works exactly like
  // switching between Attendance/Schedule/Assignments/etc does.
  {
    group: 'Class Rep',
    requiresCR: true,
    isSubgroup: true,
    hubPath: '/class-rep',
    hubIcon: 'Shield',
    items: [
      { id: 'class-setup',       label: 'Class Setup',       shortLabel: 'Setup',        icon: 'CalendarClock', path: '/class-setup',      requiresCR: true },
      { id: 'class-routine',     label: 'Routine',           shortLabel: 'Routine',      icon: 'CalendarDays',  path: '/class-routine',    requiresCR: true },
      { id: 'class-planner',     label: 'Class Planner',     shortLabel: 'Planner',      icon: 'CalendarCheck', path: '/class-planner',    requiresCR: true },
      { id: 'ct-quiz-planning',  label: 'CT & Quiz Planner', shortLabel: 'CT & Quiz',    icon: 'CalendarClock', path: '/ct-quiz-planning', requiresCR: true },
      { id: 'class-roster',      label: 'Roster',            shortLabel: 'Roster',       icon: 'Users',         path: '/class-roster',     requiresCR: true },
      { id: 'class-notices',     label: 'Class Announcements', shortLabel: 'Announcements', icon: 'Megaphone', path: '/class-notices',    requiresCR: true },
      { id: 'class-my-role',     label: 'My Role',           shortLabel: 'My Role',      icon: 'Shield',        path: '/class-my-role',    requiresCR: true },
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
          { id: 'attendance',  label: 'Attendance',     shortLabel: 'Attendance', icon: 'CheckSquare',   accent: 'blue',   path: '/attendance' },
          { id: 'schedule',    label: 'Class Schedule', shortLabel: 'Schedule',   icon: 'Clock',         accent: 'amber',  path: '/schedule' },
          { id: 'assignments', label: 'Assignments',    shortLabel: 'Assignments',icon: 'FileText',      accent: 'red',    path: '/assignments' },
          { id: 'teachers',    label: 'Teachers',       shortLabel: 'Teachers',   icon: 'GraduationCap', accent: 'purple', path: '/teachers' },
          { id: 'classmates',  label: 'Classmates',     shortLabel: 'Classmates', icon: 'Users2',        accent: 'green',  path: '/classmates' },
          { id: 'diary',       label: 'Class Diary',    shortLabel: 'Diary',      icon: 'BookOpenCheck', accent: 'blue',   path: '/diary' },
        ]
      },
      {
        name: 'Academic Core',
        hubPath: '/academic-core',
        hubIcon: 'BookOpen',
        items: [
          { id: 'courses',   label: 'Courses',       shortLabel: 'Courses',   icon: 'BookOpen',      accent: 'blue',   path: '/courses' },
          { id: 'syllabus',  label: 'Syllabus',      shortLabel: 'Syllabus',  icon: 'List',          accent: 'green',  path: '/syllabus' },
          { id: 'qbank',     label: 'Question Bank', shortLabel: 'Questions', icon: 'BookMarked',    accent: 'amber',  path: '/question-bank' },
          { id: 'solutions', label: 'Solution Bank', shortLabel: 'Solutions', icon: 'Lightbulb',     accent: 'purple', path: '/solutions' },
          { id: 'marks',     label: 'Term Planner',  shortLabel: 'Planner',   icon: 'ClipboardList', accent: 'red',    path: '/marks' },
          { id: 'results',   label: 'Results & GPA', shortLabel: 'Results',   icon: 'TrendingUp',    accent: 'blue',   path: '/results' },
          { id: 'warnings',  label: 'Alerts',        shortLabel: 'Alerts',    icon: 'BellRing',      accent: 'amber',  path: '/alerts' },
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
          { id: 'clubs',    label: 'Clubs',   shortLabel: 'Clubs',   icon: 'Star',     accent: 'blue',   path: '/clubs' },
          { id: 'projects', label: 'Projects',shortLabel: 'Projects',icon: 'Cpu',      accent: 'purple', path: '/projects' },
          { id: 'tours',    label: 'Tours',   shortLabel: 'Tours',   icon: 'MapPin',   accent: 'green',  path: '/tours' },
          { id: 'money',    label: 'Money',   shortLabel: 'Money',   icon: 'Wallet',   accent: 'amber',  path: '/money' },
          { id: 'tuition',  label: 'Tuition', shortLabel: 'Tuition', icon: 'UserCog',  accent: 'red',    path: '/tuition' },
          { id: 'notes',    label: 'Notes',         shortLabel: 'Notes',  icon: 'StickyNote', accent: 'green',  path: '/notes' },
          { id: 'time',     label: 'Time Tracker',  shortLabel: 'Timer',  icon: 'Timer',    accent: 'amber',  path: '/time' },
          { id: 'namaz',    label: 'Namaz Tracker', shortLabel: 'Namaz',  icon: 'Moon',     accent: 'purple', path: '/namaz' },
        ]
      },
      {
        // Services/Provider marketplace — SERVICES_PROVIDER_PLAN.md §1.
        // Rendered as its own titled section on the /campus-life page
        // (see App.jsx's sections={[...]} usage), separate from the base
        // Campus Life cards above — was previously mixed into the same
        // flat grid with no visual grouping, which read as one big
        // undifferentiated list. Each category (salon/hotel/medicine/
        // bookstore/onlinemart) still goes straight to
        // /services/category/:type (Services.jsx's Level 2 route) on tap.
        // Labels/icons intentionally hardcoded (not read from
        // serviceSync.js's SERVICE_TYPE_LABELS) since nav.js is plain
        // static config with no imports from app code elsewhere.
        name: 'Services',
        hubPath: '/campus-life',
        hubIcon: 'ShoppingBag',
        items: [
          { id: 'services-salon',      label: 'সেলুন',                 shortLabel: 'সেলুন',    icon: 'Scissors',       accent: 'blue',   path: '/services/category/salon' },
          { id: 'services-hotel',      label: 'হোটেল/খাবার',           shortLabel: 'হোটেল',    icon: 'UtensilsCrossed',accent: 'amber',  path: '/services/category/hotel' },
          { id: 'services-medicine',   label: 'মেডিসিন শপ',            shortLabel: 'মেডিসিন',  icon: 'Cross',          accent: 'red',    path: '/services/category/medicine' },
          { id: 'services-bookstore',  label: 'স্টেশনারি',   shortLabel: 'স্টেশনারি', icon: 'BookOpen',  accent: 'purple', path: '/services/category/bookstore' },
          { id: 'services-onlinemart', label: 'Online Mart',           shortLabel: 'Online Mart', icon: 'ShoppingBag', accent: 'green',  path: '/services/category/onlinemart' },
        ]
      },
      {
        name: 'Self Study',
        hubPath: '/self-study',
        hubIcon: 'Activity',
        items: [
          { id: 'self-study-academic',   label: 'Academic',    shortLabel: 'Academic',  icon: 'NotebookText', path: '/self-study/academic' },
          { id: 'self-study-deep-focus', label: 'Deep Focus',  shortLabel: 'Focus',     icon: 'Zap',      path: '/self-study/deep-focus' },
        ]
      },
    ]
  },
  {
    group: 'Tools',
    isSubgroup: true,
    hubPath: '/tools',
    hubIcon: 'Wrench',
    items: [
      { id: 'reports',  label: 'Reports',     shortLabel: 'Reports',  icon: 'BarChart2', path: '/reports' },
      { id: 'settings', label: 'Settings',    shortLabel: 'Settings', icon: 'Settings',  path: '/settings' },
      { id: 'about',    label: 'About KUETx', shortLabel: 'About',    icon: 'Info',      path: '/about' },
    ]
  },
];

// ── Mobile variant ──────────────────────────────────────────────────────────
// Daily Life and Self Study were folded into the Campus Life subgroup above,
// so mobile no longer needs a separate transform — it shares NAV as-is.
export const NAV_MOBILE = NAV;

/** Pick the right NAV structure for the current viewport. */
export function getStudentNav(isMobileNav) {
  return isMobileNav ? NAV_MOBILE : NAV;
}