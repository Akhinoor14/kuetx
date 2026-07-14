// BottomNavFaculty.js
//
// Faculty-only bottom-nav fixed button set. Sibling: BottomNavStudent.js.
//
// §6.2 of the merged Faculty Module prompt: "the FIXED_BUTTONS swap as a
// whole set, not appended" — Home → My Classes → Schedule → More (hub) →
// Profile/Admin (role-aware, handled by ProfileButton in BottomNav.jsx,
// same as student mode). Deliberately not reusing STUDENT_FIXED_BUTTONS
// ids/paths — this is a fully separate 4-button set for the teacher shell.
//
// "More" replaces the old "Campus" button (see nav-faculty.js) and now
// covers everything under the More hub: Communication (Meetings, Broadcast
// Notice) + Resources & Settings (Question Bank, Contact, Settings, About).
// match() includes /faculty/resources and /faculty/tools too since those
// still redirect into /faculty/more (see App.jsx) and should keep the tab
// highlighted during the redirect.
export const FACULTY_FIXED_BUTTONS = [
  { id: 'f-home',     label: 'Home',     icon: 'Home',     path: '/faculty',          match: (p) => p === '/faculty' },
  { id: 'f-classes',  label: 'Classes',  icon: 'BookOpen', path: '/faculty/classes',  match: (p) => p === '/faculty/classes' || p.startsWith('/faculty/classes/') },
  { id: 'f-schedule', label: 'Schedule', icon: 'Clock',    path: '/faculty/schedule', match: (p) => p === '/faculty/schedule' },
  {
    id: 'f-more',
    label: 'More',
    icon: 'Layers',
    path: '/faculty/more',
    match: (p) =>
      p === '/faculty/more' ||
      p === '/faculty/resources' ||
      p === '/faculty/tools' ||
      p === '/faculty/meetings' ||
      p === '/faculty/notices' ||
      p === '/faculty/question-bank' ||
      p === '/faculty/contact' ||
      p === '/settings' ||
      p === '/about',
  },
];
