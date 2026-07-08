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
    ]
  },
  {
    group: 'Campus Life',
    isSubgroup: true,
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
    group: 'Daily Life',
    isSubgroup: true,
    hubPath: '/daily-life',
    hubIcon: 'Sunrise',
    items: [
      { id: 'notes',      label: 'Notes',         icon: 'FileText', path: '/notes' },
      { id: 'self-study', label: 'Self Study',    icon: 'Activity', path: '/self-study' },
      { id: 'time',       label: 'Time Tracker',  icon: 'Timer',    path: '/time' },
      { id: 'namaz',      label: 'Namaz Tracker', icon: 'Moon',     path: '/namaz' },
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