// All navigation sections and pages for KUETx
// Using only icons confirmed in lucide-react 0.383
export const NAV = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard',   label: 'Dashboard',      icon: 'Grid',         path: '/' },
      { id: 'quick-access', label: 'Quick Access',  icon: 'Zap',         path: '/quick-access' },
      { id: 'profile',     label: 'Profile',        icon: 'User',         path: '/profile' },
      { id: 'smart-score', label: 'Smart Score',    icon: 'Star',         path: '/smart-score' },
      { id: 'notes',       label: 'Notes',          icon: 'FileText',     path: '/notes' },
    ]
  },
  {
    group: 'Class Rep',
    items: [
      { id: 'class-management', label: 'Class Management', icon: 'Users', path: '/class-management', requiresCR: true, showInDashboard: false },
      { id: 'ct-quiz-planning', label: 'CT & Quiz Planner', icon: 'CalendarCheck', path: '/ct-quiz-planning', requiresCR: true, showInDashboard: false },
    ]
  },
  {
    group: 'Academics',
    items: [
      { id: 'courses',    label: 'Courses',              icon: 'BookOpen',     path: '/courses' },
      { id: 'attendance', label: 'Attendance',           icon: 'CalendarCheck',path: '/attendance' },
      { id: 'schedule',   label: 'Class Schedule',       icon: 'Clock',        path: '/schedule' },
      { id: 'assignments',label: 'Assignments',          icon: 'FileText',     path: '/assignments' },
      { id: 'syllabus',   label: 'Syllabus',             icon: 'List',         path: '/syllabus' },
      { id: 'qbank',      label: 'Question Bank',        icon: 'BookMarked',   path: '/question-bank' },
      { id: 'marks',      label: 'Term Planner',         icon: 'ClipboardList',path: '/marks' },
      { id: 'results',    label: 'Results & GPA',        icon: 'TrendingUp',   path: '/results' },
      { id: 'teachers',   label: 'Teachers',             icon: 'Users',        path: '/teachers' },
    ]
  },
  {
    group: 'Daily Life',
    items: [
      { id: 'diary',      label: 'Class Diary',    icon: 'BookOpen',     path: '/diary' },
      { id: 'self-study', label: 'Self Study',     icon: 'Activity',     path: '/self-study' },
      { id: 'time',       label: 'Time Tracker',   icon: 'Timer',        path: '/time' },
      { id: 'namaz',      label: 'Namaz Tracker',  icon: 'Moon',         path: '/namaz' },
      { id: 'self-eval',  label: 'Self Eval',      icon: 'Heart',        path: '/self-eval' },
    ]
  },
  {
    group: 'Finance',
    items: [
      { id: 'money',   label: 'Money',          icon: 'Wallet',    path: '/money' },
      { id: 'tuition', label: 'Tuition',        icon: 'Users',     path: '/tuition' },
      { id: 'food',    label: 'Food & Health',  icon: 'Utensils',  path: '/food' },
    ]
  },
  {
    group: 'Activities',
    items: [
      { id: 'clubs',    label: 'Clubs',        icon: 'Layers',        path: '/clubs' },
      { id: 'projects', label: 'Projects',     icon: 'Cpu',           path: '/projects' },
      { id: 'tours',    label: 'Tours',        icon: 'MapPin',        path: '/tours' },
      { id: 'social',   label: 'Social Time',  icon: 'MessageCircle', path: '/social' },
    ]
  },
  {
    group: 'Tools',
    items: [
      { id: 'warnings',   label: 'Alerts',      icon: 'Bell',        path: '/alerts' },
      { id: 'reports',    label: 'Reports',     icon: 'BarChart2',   path: '/reports' },
      { id: 'settings',   label: 'Settings',    icon: 'Settings',    path: '/settings' },
    ]
  },
  {
    group: 'Information',
    items: [
      { id: 'about',      label: 'About KUETX',  icon: 'Info',        path: '/about' },
    ]
  },
];
