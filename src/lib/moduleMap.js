// moduleMap.js
//
// Groups every route in App.jsx into a small set of "modules" for the
// feature-adoption view of the Analytics dashboard. This is a hand-kept
// mirror of App.jsx's <Route path="..."> list on purpose — rules can't
// import JS and analyticsEngine.js's aggregation needs a fixed, finite
// set of module keys to bucket by, so this is the one file to update
// whenever a genuinely NEW top-level feature (not a sub-tab) is added.
//
// Deliberately coarse-grained: sub-tabs within a page (e.g. Extras'
// internal tabs) are NOT separate modules — that level of detail belongs
// in a real event-analytics tool, not this lightweight tracker. The goal
// here is "which of our ~6 big feature areas are people actually using,"
// not a full click-stream.

export const MODULES = {
  ACADEMIC_CORE: 'academic_core',
  QUESTION_BANK: 'question_bank',
  CLASS_SOCIAL: 'class_social',
  PERSONAL_TOOLS: 'personal_tools',
  FACULTY: 'faculty',
  ADMIN_STAFF: 'admin_staff',
};

export const MODULE_LABELS = {
  [MODULES.ACADEMIC_CORE]: 'Academic Core',
  [MODULES.QUESTION_BANK]: 'Question Bank',
  [MODULES.CLASS_SOCIAL]: 'Class & Social',
  [MODULES.PERSONAL_TOOLS]: 'Personal Tools',
  [MODULES.FACULTY]: 'Faculty Tools',
  [MODULES.ADMIN_STAFF]: 'Admin / Staff',
};

// Ordered so the more specific prefixes are checked before broader ones
// (e.g. '/faculty/question-bank' must resolve to FACULTY, not QUESTION_BANK
// — checked via the /faculty prefix rule below running first).
const ROUTE_MODULE_RULES = [
  // Faculty side — anything under /faculty/* is its own module regardless
  // of which underlying feature it mirrors, since faculty engagement is
  // a distinct product question from student engagement.
  { prefix: '/faculty', module: MODULES.FACULTY },

  // Admin / Staff
  { prefix: '/admin', module: MODULES.ADMIN_STAFF },
  { prefix: '/team', module: MODULES.ADMIN_STAFF },
  { prefix: '/cr-hub', module: MODULES.ADMIN_STAFF },
  { prefix: '/class-my-role', module: MODULES.ADMIN_STAFF },
  { prefix: '/class-roster', module: MODULES.ADMIN_STAFF },
  { prefix: '/reports', module: MODULES.ADMIN_STAFF },

  // Question Bank
  { prefix: '/question-bank', module: MODULES.QUESTION_BANK },
  { prefix: '/solutions', module: MODULES.QUESTION_BANK },

  // Class & Social
  { prefix: '/class-notices', module: MODULES.CLASS_SOCIAL },
  { prefix: '/class-planner', module: MODULES.CLASS_SOCIAL },
  { prefix: '/class-routine', module: MODULES.CLASS_SOCIAL },
  { prefix: '/classmates', module: MODULES.CLASS_SOCIAL },
  { prefix: '/clubs', module: MODULES.CLASS_SOCIAL },
  { prefix: '/notice', module: MODULES.CLASS_SOCIAL },
  { prefix: '/teachers', module: MODULES.CLASS_SOCIAL },
  { prefix: '/campus', module: MODULES.CLASS_SOCIAL },
  { prefix: '/campus-life', module: MODULES.CLASS_SOCIAL },
  { prefix: '/tours', module: MODULES.CLASS_SOCIAL },
  { prefix: '/tuition', module: MODULES.CLASS_SOCIAL },
  { prefix: '/projects', module: MODULES.CLASS_SOCIAL },

  // Academic Core
  { prefix: '/attendance', module: MODULES.ACADEMIC_CORE },
  { prefix: '/marks', module: MODULES.ACADEMIC_CORE },
  { prefix: '/results', module: MODULES.ACADEMIC_CORE },
  { prefix: '/schedule', module: MODULES.ACADEMIC_CORE },
  { prefix: '/courses', module: MODULES.ACADEMIC_CORE },
  { prefix: '/syllabus', module: MODULES.ACADEMIC_CORE },
  { prefix: '/assignments', module: MODULES.ACADEMIC_CORE },
  { prefix: '/ct-quiz-planning', module: MODULES.ACADEMIC_CORE },
  { prefix: '/academic-core', module: MODULES.ACADEMIC_CORE },
  { prefix: '/daily-academics', module: MODULES.ACADEMIC_CORE },

  // Personal Tools
  { prefix: '/diary', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/notes', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/money', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/namaz', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/self-study', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/calculators', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/time', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/tools', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/settings', module: MODULES.PERSONAL_TOOLS },
  { prefix: '/profile', module: MODULES.PERSONAL_TOOLS },
];

/**
 * Resolves a pathname (e.g. location.pathname from react-router) to a
 * module key, or null if it's a route we deliberately don't track
 * (About, Dashboard/home, admin login) — tracking every route including
 * the landing page would just make "Personal Tools" or whatever /
 * matches first look artificially inflated.
 */
export function moduleForPath(pathname) {
  const path = String(pathname || '');
  for (const rule of ROUTE_MODULE_RULES) {
    if (path === rule.prefix || path.startsWith(rule.prefix + '/')) {
      return rule.module;
    }
  }
  return null;
}
