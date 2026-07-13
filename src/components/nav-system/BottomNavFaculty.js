// BottomNavFaculty.js
//
// Faculty-only bottom-nav fixed button set. Sibling: BottomNavStudent.js.
//
// §6.2 of the merged Faculty Module prompt: "the FIXED_BUTTONS swap as a
// whole set, not appended" — Home → My Classes → Schedule → Campus (hub) →
// Profile/Admin (role-aware, handled by ProfileButton in BottomNav.jsx,
// same as student mode). Deliberately not reusing STUDENT_FIXED_BUTTONS
// ids/paths — this is a fully separate 4-button set for the teacher shell.
export const FACULTY_FIXED_BUTTONS = [
  { id: 'f-home',     label: 'Home',     icon: 'Home',     path: '/faculty',           match: (p) => p === '/faculty' },
  { id: 'f-classes',  label: 'Classes',  icon: 'BookOpen', path: '/faculty/classes',   match: (p) => p === '/faculty/classes' || p.startsWith('/faculty/classes/') },
  { id: 'f-schedule', label: 'Schedule', icon: 'Clock',    path: '/faculty/schedule',  match: (p) => p === '/faculty/schedule' },
  { id: 'f-campus',   label: 'Campus',   icon: 'Layers',   path: '/faculty/resources', match: (p) => p === '/faculty/resources' || p === '/faculty/question-bank' },
];
