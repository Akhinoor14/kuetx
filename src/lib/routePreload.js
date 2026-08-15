// routePreload.js
//
// Sidebar navigation felt laggy because every page in App.jsx is behind
// lazy(() => import('./pages/X')) — correct for initial bundle size, but
// it means clicking a nav link only STARTS the chunk fetch; the page can't
// paint until that network round-trip finishes. On a slow/mobile
// connection, or any chunk not yet in the browser cache, that shows up as
// "click doesn't go anywhere right away."
//
// Fix: warm the chunk before the click happens. NavRow already tracks
// hover state (onMouseEnter/onMouseLeave) for styling — this hooks into
// that same moment (plus onTouchStart, hover's mobile equivalent) to
// kick off the identical import() the router will need, so by the time
// the click/tap lands the module is already in the browser's module
// cache and mounts instantly.
//
// IMPORTANT: each entry below must be the exact same import() call used
// in App.jsx's lazy() for that page, so it resolves to the identical
// cached module (same URL) rather than triggering a second, separate
// fetch. When a page is added to App.jsx, add its path here too —
// nothing breaks if a path is missing, it just won't get prefetched.

const preloadFns = {
  '/':                        () => import('../pages/Dashboard'),
  '/profile':                 () => import('../pages/Profile'),
  '/courses':                 () => import('../pages/Courses'),
  '/attendance':               () => import('../pages/Attendance'),
  '/marks':                    () => import('../pages/TermPlanner'),
  '/results':                  () => import('../pages/Results'),
  '/schedule':                 () => import('../pages/Schedule'),
  '/today':                    () => import('../pages/Today'),
  '/teachers':                 () => import('../pages/Teachers'),
  '/diary':                    () => import('../pages/Diary'),
  '/assignments':              () => import('../pages/Assignments'),
  '/question-bank':            () => import('../pages/QuestionBank'),
  '/solutions':                () => import('../pages/SolutionBank'),
  '/self-study/academic':      () => import('../pages/SelfStudy'),
  '/self-study/deep-focus':    () => import('../pages/SelfStudy'),
  '/self-study':                () => import('../pages/SelfStudy'),
  '/time':                      () => import('../pages/Extras'),
  '/namaz':                     () => import('../pages/Namaz'),
  '/money':                     () => import('../pages/Money'),
  '/tuition':                   () => import('../pages/Extras'),
  '/clubs':                     () => import('../pages/Clubs'),
  '/services':                  () => import('../pages/Services'),
  '/services/orders':           () => import('../pages/ServiceOrdersHub'),
  '/projects':                  () => import('../pages/Extras'),
  '/tours':                     () => import('../pages/Extras'),
  '/alerts':                    () => import('../pages/Alerts'),
  '/notice':                    () => import('../pages/Notice'),
  '/reports':                   () => import('../pages/Extras'),
  '/notes':                     () => import('../pages/Notes'),
  '/settings':                  () => import('../pages/Settings'),
  '/about':                     () => import('../pages/About'),
  '/class-routine':             () => import('../pages/ClassRoutine'),
  '/class-setup':               () => import('../pages/ClassSetup'),
  '/class-planner':             () => import('../pages/ClassPlanner'),
  '/ct-quiz-planning':          () => import('../pages/CTQuizPlanning'),
  '/class-roster':              () => import('../pages/ClassRosterPage'),
  '/class-notices':             () => import('../pages/ClassNotices'),
  '/class-my-role':             () => import('../pages/ClassMyRole'),
  '/classmates':                () => import('../pages/Classmates'),
  '/class-rep':                 () => import('../components/nav-system/CRHub'),
  '/team':                      () => import('../pages/TeamDashboard'),
  '/admin/batches':             () => import('../pages/FounderBatchSettings'),
  '/provider':                  () => import('../pages/provider/ProviderDashboard'),
  '/provider/shop':             () => import('../pages/provider/ProviderMyShopHub'),
  '/provider/shop/offerings':   () => import('../pages/provider/ProviderOfferingsPage'),
  '/provider/shop/settings':    () => import('../pages/provider/ProviderShopSettingsPage'),
  '/provider/profile':          () => import('../pages/provider/ProviderProfile'),
  '/provider/notifications':    () => import('../pages/provider/ProviderNotifications'),
  '/faculty':                   () => import('../pages/faculty/FacultyDashboard'),
  '/faculty/profile':           () => import('../pages/faculty/FacultyProfile'),
  '/faculty/classes':           () => import('../pages/faculty/FacultyClasses'),
  '/faculty/all-cr':            () => import('../pages/faculty/FacultyAllCR'),
  '/faculty/schedule':          () => import('../pages/faculty/FacultySchedule'),
  '/faculty/meetings':          () => import('../pages/faculty/FacultyMeetings'),
  '/faculty/notices':           () => import('../pages/faculty/FacultyNoticeBroadcast'),
  '/faculty/contact':           () => import('../pages/faculty/FacultyContact'),
  '/faculty/question-bank':     () => import('../pages/QuestionBank'),
};

// Guard against re-triggering the same import() repeatedly on every
// mouseenter within one page session — dynamic import() is already
// cached by the browser/bundler after the first call, but this skips
// even the redundant function call + promise churn on fast re-hovers.
const alreadyPreloaded = new Set();

export function preloadRoute(path) {
  if (!path || alreadyPreloaded.has(path)) return;
  const fn = preloadFns[path];
  if (!fn) return;
  alreadyPreloaded.add(path);
  fn().catch(() => {
    // Preload is a pure optimization — if it fails (offline, flaky
    // network), let the real navigation's own Suspense fallback handle
    // it as normal; don't surface an error for a background warm-up.
    alreadyPreloaded.delete(path);
  });
}
