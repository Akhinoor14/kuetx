// Path → dynamic-import registry, used ONLY for preloading page chunks
// ahead of navigation (not for actually rendering routes — App.jsx's own
// lazy() calls still own that). Covers exactly the paths that appear in a
// sibling chip group (see nav.js) since those are the only places the user
// can tap a not-yet-visited page and see the "Loading…" Suspense fallback.
//
// Kept intentionally separate from App.jsx's lazy-import list so we never
// have to touch that giant, easy-to-break block. Because Vite/webpack
// de-dupe dynamic import() calls by specifier, calling import('./pages/X')
// here warms the exact same cached chunk that App.jsx's lazy(() =>
// import('./pages/X')) will later resolve from — so this is safe to call
// speculatively, as often as we like, with no risk of divergent copies.

const importers = {
  // Class Rep
  '/class-routine':        () => import('./pages/ClassRoutine'),
  '/class-planner':        () => import('./pages/ClassPlanner'),
  '/ct-quiz-planning':     () => import('./pages/CTQuizPlanning'),
  '/class-roster':         () => import('./pages/ClassRosterPage'),
  '/class-notices':        () => import('./pages/ClassNotices'),
  '/class-my-role':        () => import('./pages/ClassMyRole'),

  // Daily Academics
  '/attendance':  () => import('./pages/Attendance'),
  '/schedule':    () => import('./pages/Schedule'),
  '/assignments': () => import('./pages/Assignments'),
  '/teachers':    () => import('./pages/Teachers'),
  '/classmates':  () => import('./pages/Classmates'),
  '/diary':       () => import('./pages/Diary'),

  // Academic Core
  '/courses':        () => import('./pages/Courses'),
  '/syllabus':       () => import('./pages/Extras').then((m) => ({ default: m.Syllabus })),
  '/question-bank':  () => import('./pages/QuestionBank'),
  '/solutions':      () => import('./pages/QuestionBankSolutions'),
  '/marks':          () => import('./pages/Marks'),
  '/results':        () => import('./pages/Results'),
  '/alerts':         () => import('./pages/Alerts'),

  // Campus Life
  '/clubs':    () => import('./pages/Clubs'),
  '/projects': () => import('./pages/Extras').then((m) => ({ default: m.Projects })),
  '/tours':    () => import('./pages/Extras').then((m) => ({ default: m.Tours })),
  '/money':    () => import('./pages/Money'),
  '/tuition':  () => import('./pages/Extras').then((m) => ({ default: m.Tuition })),
  '/services': () => import('./pages/Services'),
  '/notes':    () => import('./pages/Notes').then((m) => ({ default: m.Notes })),
  '/time':     () => import('./pages/Extras').then((m) => ({ default: m.TimeTracker })),
  '/namaz':    () => import('./pages/Namaz'),

  // Self Study — both sub-paths share the SelfStudy chunk
  '/self-study/academic':   () => import('./pages/SelfStudy'),
  '/self-study/deep-focus': () => import('./pages/SelfStudy'),

  // Tools
  '/reports':  () => import('./pages/Extras').then((m) => ({ default: m.Reports })),
  '/settings': () => import('./pages/Settings'),
  '/about':    () => import('./pages/About'),
};

// Dedup guard so re-renders / repeated hover events don't re-trigger a
// network fetch for a chunk we've already requested (or that's already
// resolved and cached by the bundler).
const requested = new Set();

/** Preload a single page's chunk by its nav path. Safe to call repeatedly. */
export function preloadRoute(path) {
  const importer = importers[path];
  if (!importer || requested.has(path)) return;
  requested.add(path);
  importer().catch(() => {
    // Swallow errors (e.g. offline) — this is a speculative optimization,
    // not a real navigation, and App.jsx's own lazy() + Suspense will
    // still handle the real fetch/error when the user actually navigates.
    requested.delete(path);
  });
}

/** Preload every sibling in a chip group at once (e.g. on Navbar mount). */
export function preloadSiblings(siblings) {
  if (!siblings || siblings.length < 2) return;
  siblings.forEach((item) => preloadRoute(item.path));
}
