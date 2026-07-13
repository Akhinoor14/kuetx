// BottomNavStudent.js
//
// Student-only bottom-nav fixed button set. Sibling: BottomNavFaculty.js.
// Kept as its own file (rather than inline in BottomNav.jsx) so the
// student and faculty button sets are never in the same array literal,
// matching the nav.js / nav-faculty.js separation.

// First 4 buttons are fixed destinations. The 5th (ProfileButton, in
// BottomNav.jsx) is role-aware:
// - normal user -> /profile (Profile page)
// - CR/ACR      -> /cr-hub (Profile + Class Management + CT & Quiz Planner)
export const STUDENT_FIXED_BUTTONS = [
  { id: 'home',      label: 'Home',      icon: 'Home',         path: '/',                match: (p) => p === '/' },
  { id: 'academics', label: 'Academics', icon: 'BookOpen',      path: '/academic-core',   match: (p) => p === '/academic-core' || ['/courses', '/syllabus', '/question-bank', '/solutions', '/marks', '/results', '/alerts'].includes(p) },
  { id: 'daily',     label: 'Daily',     icon: 'CalendarCheck', path: '/daily-academics', match: (p) => p === '/daily-academics' || ['/attendance', '/schedule', '/assignments', '/teachers', '/classmates', '/diary'].includes(p) },
  { id: 'campus',    label: 'Campus',    icon: 'Layers',        path: '/campus',          match: (p) => p === '/campus' || p === '/daily-life' || p === '/campus-life' || ['/notes', '/self-study', '/time', '/namaz', '/clubs', '/projects', '/tours', '/money', '/tuition'].includes(p) },
];
