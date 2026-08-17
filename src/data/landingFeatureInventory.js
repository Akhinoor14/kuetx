// landingFeatureInventory.js
//
// Phase 9.1 (landing visual redesign, §5 feature breakdown + stats strip).
// Single source of truth for every real, live feature/route shown on the
// public landing page — every entry here traces to an actual `path:` in
// src/nav.js / src/nav-faculty.js / src/components/nav-system/
// SidebarNavProvider.jsx, or a `requiresCR` item inside nav.js's Class
// Rep group. Nothing here is invented copy — this file exists so Phase
// 9.3 (feature breakdown section) and 9.1's own stats-strip number can
// both read from one verified list instead of two hand-typed copies
// drifting apart.
//
// COUNT METHODOLOGY (owner asked for a real, accurate number — "features
// onek onek beshi" than routes, so this deliberately does NOT just count
// nav.js `path:` entries 1:1):
//   - Student: every non-admin nav.js item (Dashboard/Today/Profile/
//     Notice/Tools + both Academics subgroups + both Campus Life
//     subgroups incl. Services + Self Study) = 37, plus the 7 Class-Rep-
//     only items (requiresCR: true, a permission layer on top of the
//     Student role, not a separate role) = 44.
//   - Faculty: Dashboard/Profile/My Classes/Schedule (4) + Communication
//     (2: Meetings, Broadcast Notice) + Resources minus the two routes
//     already counted for students (Question Bank, Publications,
//     Contact = 3; Settings/About are the same shared routes students
//     already have) + Services (6, mirrors student Services exactly) =
//     15 faculty-specific features.
//   - Provider: Dashboard, My Shop, Profile (3 provider-specific
//     destinations; Settings/About are the same shared routes again).
//   - Total: 44 + 15 + 3 = 62 distinct features. Settings/About counted
//     once (under student) rather than three times since it's the same
//     page for every role — inflating the number by re-counting shared
//     pages per-role would not be a real count.
//   - This intentionally EXCLUDES: the 2 requiresAdmin-only items
//     (internal, not a public-facing feature), and sub-tabs that live
//     inside a page rather than as their own nav destination (e.g.
//     nav-faculty.js's own comment: Roster/Attendance/Marks/Syllabus are
//     tabs inside Class Detail, not top-level faculty routes) — those
//     are real functionality too but aren't independently countable
//     from the nav configs the same way, which is why the landing copy
//     says "62+" rather than a bare "62".
export const TOTAL_FEATURE_COUNT = 62;
export const FEATURE_COUNT_DISPLAY = '৬২+'; // Bangla digits, matches existing landing copy convention (see stats strip)

// ─── Student ────────────────────────────────────────────────────────────
// Grouped the same way nav.js groups them, so this can render either as
// a flat list or under the same category headers a returning user would
// recognize from the real sidebar.
export const STUDENT_FEATURES = {
  core: ['Dashboard', 'Today', 'Profile', 'Notice'],
  dailyAcademics: ['Attendance', 'Class Schedule', 'Assignments', 'Teachers', 'Classmates', 'Class Diary'],
  academicCore: ['Courses', 'Syllabus', 'Question Bank', 'Publications', 'Solution Bank', 'Term Planner', 'Results & GPA', 'Alerts'],
  campusLife: ['Projects', 'Notes', 'Time Tracker', 'Money', 'Namaz Tracker', 'Clubs', 'Tuition', 'Tours'],
  // Owner note (Phase 9 kickoff): Pick and Drop should be highlighted
  // more than the other Services entries, not buried in an alphabetical
  // list — kept first in this array on purpose so Phase 9.3's rendering
  // can lead with it / badge it, rather than needing a second data pass.
  services: ['Pick and Drop', 'Salon', 'Food', 'Pharmacy', 'Stationery', 'Online Mart'],
  selfStudy: ['Academic Self-Study', 'Deep Focus'],
  tools: ['Reports', 'Settings', 'About KUETx'],
};

// Owner note (Phase 9 kickoff): CR is a permission layer on top of the
// Student role (requiresCR: true in nav.js), not its own role/card — but
// asked to be surfaced as its own explicit feature block on the landing
// page, separate from the plain Student role card, since it's easy to
// miss that CRs get a whole extra toolset most students never see.
export const CR_FEATURES = ['Class Setup', 'Routine', 'Class Planner', 'CT & Quiz Planner', 'Roster', 'Class Announcements', 'My Role'];

// ─── Faculty ────────────────────────────────────────────────────────────
export const FACULTY_FEATURES = {
  core: ['Dashboard', 'Profile', 'My Classes', 'My Schedule'],
  communication: ['Meetings', 'Broadcast Notice'],
  resources: ['Question Bank', 'Publications', 'Contact'], // Settings/About shared with student, not re-listed
  services: ['Pick and Drop', 'Salon', 'Food', 'Pharmacy', 'Stationery', 'Online Mart'],
};

// ─── Provider ───────────────────────────────────────────────────────────
export const PROVIDER_FEATURES = {
  core: ['Dashboard', 'My Shop', 'Profile'], // Settings/About shared with student, not re-listed
};
