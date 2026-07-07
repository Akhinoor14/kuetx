// All navigation sections and pages for KUETx
// Using only icons confirmed in lucide-react 0.383
export const NAV = [
  {
    group: 'Overview',
    isSubgroup: true,
    hubPath: '/overview',
    hubIcon: 'LayoutDashboard',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: 'Grid',     path: '/' },
      { id: 'quick-access', label: 'Quick Access', icon: 'Zap',      path: '/quick-access' },
      { id: 'profile',      label: 'Profile',      icon: 'User',     path: '/profile' },
      { id: 'notes',        label: 'Notes',        icon: 'FileText', path: '/notes' },
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
      { id: 'diary',      label: 'Class Diary',   icon: 'BookOpen', path: '/diary' },
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
      { id: 'warnings', label: 'Alerts',      icon: 'Bell',      path: '/alerts' },
      { id: 'reports',  label: 'Reports',     icon: 'BarChart2', path: '/reports' },
      { id: 'settings', label: 'Settings',    icon: 'Settings',  path: '/settings' },
      { id: 'about',    label: 'About KUETx', icon: 'Info',      path: '/about' },
    ]
  },
];