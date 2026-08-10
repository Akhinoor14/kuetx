import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { ProviderLangProvider } from './hooks/useProviderLang';
import { usePageTracker } from './hooks/usePageTracker';
import { useModuleUsageTracker } from './hooks/useModuleUsageTracker';
import { startActivityTracking, stopActivityTracking } from './lib/activityTracking';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BottomNav, useIsMobileNav } from './components/BottomNav';
import GlobalToasts from './components/GlobalToasts';
import GlobalDialog from './components/GlobalDialog';
import { alertDialog } from './lib/dialog';
import FloatingUploadBar from './components/FloatingUploadBar';
import FloatingInstallButton from './components/FloatingInstallButton';
import NoticeToast from './components/NoticeToast';
import ProfileCompleteReminder from './components/ProfileCompleteReminder';
import AuthModal from './components/AuthModal';
import ProfileSetupModal from './components/ProfileSetupModal';
import RequireCR from './components/RequireCR';
import RequireStaff from './components/RequireStaff';
import RequireProvider from './components/RequireProvider';
import RequireStudentMode from './components/RequireStudentMode';
import RootRouteResolver from './components/RootRouteResolver';
import { useIsProvider } from './hooks/useIsProvider';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import ClassJoinIntro from './components/ClassJoinIntro';
import NoCRBanner from './components/NoCRBanner';
import RoleSelectScreen from './components/RoleSelectScreen';
import FacultyProfileSetupModal from './components/FacultyProfileSetupModal';
import { getAccountRole, setAccountRole, fetchServerAccountRole, persistAccountRoleToServer, isAccountRoleTrustedForUid } from './lib/accountRole';
import { syncLocalDataOnAuth } from './lib/accountLifecycle';
import { getFacultyDoc, isFacultyProfileComplete } from './lib/facultySync';
import { getProviderProfile } from './lib/providerSync';
import { syncBloodDonorEntry } from './lib/bloodDonorSync';
import { store, getProfile, isProfileComplete, DEFAULT_PROFILE, normalizeProfileForSave, validateProfileForSave, ensureDBReady, tagProfileOwner, isProfileStaleForUid } from './store/store';
import { getGroupId } from './lib/groupUtils';
import { syncGroupMembership, getOwnMemberVerifiedOnce, subscribePlannerSettings, subscribeMyRole, updatePlannerSettings } from './lib/groupSync';
import { migrateCourseTeacherMapToIds } from './lib/teacherRegistry';
import { subscribeGroupTermStartDate, subscribeGroupCurrentTermKey } from './lib/termStartDateSync';
import { claimRoll } from './lib/rollOwnership';
import { ensureManualVerifyRequest } from './lib/manualVerifyRequests';
import { auth } from './lib/firebase';
import { pullProfile } from './lib/firebaseSync';
import { notify } from './lib/notify';
import { pushProfile, startFirebaseSync } from './lib/firebaseSync';

// Pages — lazy-loaded (route-level code splitting).
//
// PERFORMANCE FIX: every one of these ~38 page components (plus the
// ~12 faculty-side pages below) used to be a plain top-level import, so
// Vite/Rollup had no choice but to bundle every single page's code into
// the SAME chunk(s) the app needs just to render the very first screen —
// login/onboarding, before a signed-in user has even picked a role, let
// alone visited Marks or QuestionBank or TeamDashboard. That meant a
// brand-new visitor's browser had to download and parse the JS for
// literally every page in the app (including staff-only and faculty-only
// ones they may never open) before anything appeared at all — the exact
// "website shurute dhuktei chay na, abar dhukte onek time ney" symptom.
// Wrapping each import in lazy() defers that page's chunk to the moment
// its route is actually visited, so first paint only needs the shell
// (Sidebar/Navbar/routing) + whichever single page the URL points to.
// The <Suspense> boundary around <Routes> below (with a lightweight
// inline fallback, not a fresh spinner import) shows briefly on each
// FIRST visit to a given route; subsequent visits to that route are
// instant since the browser has already cached that chunk.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Courses = lazy(() => import('./pages/Courses'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Marks = lazy(() => import('./pages/TermPlanner'));
const Results = lazy(() => import('./pages/Results'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Today = lazy(() => import('./pages/Today'));
const Teachers = lazy(() => import('./pages/Teachers'));
const Diary = lazy(() => import('./pages/Diary'));
const Assignments = lazy(() => import('./pages/Assignments'));
const QuestionBank = lazy(() => import('./pages/QuestionBank'));
const QuestionBankViewer = lazy(() => import('./pages/QuestionBankViewer'));
const QuestionBankSolutions = lazy(() => import('./pages/QuestionBankSolutions'));
const SelfStudy = lazy(() => import('./pages/SelfStudy'));
const Namaz = lazy(() => import('./pages/Namaz'));
const Money = lazy(() => import('./pages/Money'));
const Calculators = lazy(() => import('./pages/Calculators'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Notice = lazy(() => import('./pages/Notice'));
const Settings = lazy(() => import('./pages/Settings'));
const Notes = lazy(() => import('./pages/Notes').then((m) => ({ default: m.Notes })));
const Clubs = lazy(() => import('./pages/Clubs'));
const Services = lazy(() => import('./pages/Services'));
const CategoryShopList = lazy(() => import('./pages/Services').then((m) => ({ default: m.CategoryShopList })));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const ServiceOrdersHub = lazy(() => import('./pages/ServiceOrdersHub'));
const ProviderDashboardPage = lazy(() => import('./pages/provider/ProviderDashboard'));
const ProviderMyShopHubPage = lazy(() => import('./pages/provider/ProviderMyShopHub'));
const ProviderOfferingsPagePage = lazy(() => import('./pages/provider/ProviderOfferingsPage'));
const ProviderOfferingDetailPagePage = lazy(() => import('./pages/provider/ProviderOfferingDetailPage'));
const ProviderShopSettingsPagePage = lazy(() => import('./pages/provider/ProviderShopSettingsPage'));
const ProviderProfilePage = lazy(() => import('./pages/provider/ProviderProfile'));
const ProviderNotificationsPage = lazy(() => import('./pages/provider/ProviderNotifications'));
const About = lazy(() => import('./pages/About'));
import RequireGuestMode from './components/RequireGuestMode';
const GuestDashboard = lazy(() => import('./pages/guest/GuestDashboard'));
const GuestSchedule = lazy(() => import('./pages/guest/GuestSchedule'));
const GuestAttendance = lazy(() => import('./pages/guest/GuestAttendance'));
const GuestMarks = lazy(() => import('./pages/guest/GuestMarks'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const ClassRoutine = lazy(() => import('./pages/ClassRoutine'));
const ClassSetup = lazy(() => import('./pages/ClassSetup'));
const ClassPlanner = lazy(() => import('./pages/ClassPlanner'));
const CTQuizPlanning = lazy(() => import('./pages/CTQuizPlanning'));
const ClassRosterPage = lazy(() => import('./pages/ClassRosterPage'));
const ClassNotices = lazy(() => import('./pages/ClassNotices'));
const ClassMyRole = lazy(() => import('./pages/ClassMyRole'));
const Classmates = lazy(() => import('./pages/Classmates'));
// AdminDashboard is no longer routed directly — it's rendered inside
// TeamDashboard via AdminEntryPoint. See /team route below.
const TeamDashboard = lazy(() => import('./pages/TeamDashboard'));
const FounderBatchSettings = lazy(() => import('./pages/FounderBatchSettings'));
// Extras.jsx exports several named page components from one file — each
// needs its own .then() re-export as { default } for lazy() to accept it,
// since lazy() only ever resolves a module's default export.
const Tours = lazy(() => import('./pages/Extras').then((m) => ({ default: m.Tours })));
const Projects = lazy(() => import('./pages/Extras').then((m) => ({ default: m.Projects })));
const Syllabus = lazy(() => import('./pages/Extras').then((m) => ({ default: m.Syllabus })));
const TimeTracker = lazy(() => import('./pages/Extras').then((m) => ({ default: m.TimeTracker })));
const Tuition = lazy(() => import('./pages/Extras').then((m) => ({ default: m.Tuition })));
const Reports = lazy(() => import('./pages/Extras').then((m) => ({ default: m.Reports })));
import SubgroupHub from './components/nav-system/SubgroupHub';
import CRHub from './components/nav-system/CRHub';
import AdminHub from './components/nav-system/AdminHub';
import RequireFaculty from './components/RequireFaculty';
import { NAV_FACULTY } from './nav-faculty';
const FacultyDashboard = lazy(() => import('./pages/faculty/FacultyDashboard'));
const FacultyProfile = lazy(() => import('./pages/faculty/FacultyProfile'));
const FacultyClasses = lazy(() => import('./pages/faculty/FacultyClasses'));
const FacultyAllCR = lazy(() => import('./pages/faculty/FacultyAllCR'));
const FacultyClassDetail = lazy(() => import('./pages/faculty/FacultyClassDetail'));
const FacultySchedule = lazy(() => import('./pages/faculty/FacultySchedule'));
const FacultyMeetings = lazy(() => import('./pages/faculty/FacultyMeetings'));
const FacultyNoticeBroadcast = lazy(() => import('./pages/faculty/FacultyNoticeBroadcast'));
const FacultyContact = lazy(() => import('./pages/faculty/FacultyContact'));

// Minimal inline fallback for page-chunk loading — deliberately not a
// separate component/import (would defeat the point: needs to be part of
// the initial shell bundle, always available instantly, never itself
// something the user waits on).
function PageLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--muted)', fontSize: 14 }}>
      Loading…
    </div>
  );
}

function Layout({ authState, onboardingActive }) {
  usePageTracker();
  useModuleUsageTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const isQuestionBankViewer = location.pathname === '/question-bank/view';

  // BUGFIX: every page navigation used to land wherever the PREVIOUS
  // page's scroll position happened to be, instead of at the top of the
  // new page — confusing on both desktop and mobile since the actual
  // scroll container here is .main-content (overflow-y: auto), not the
  // window, so a plain `window.scrollTo` alone wouldn't have fixed it.
  // Runs on every location.pathname change (not location.key, since a
  // hash-only change within the same page shouldn't yank scroll back to
  // top) and resets both the window and .main-content, covering every
  // layout variant (desktop sidebar layout, mobile full-width layout,
  // and the question-bank viewer which renders outside .main-content).
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('.main-content')?.scrollTo(0, 0);
  }, [location.pathname]);

  // Expose upgrade modal trigger globally so Settings page can call it
  useEffect(() => {
    window.__kuetxShowUpgrade = () => setShowUpgradeModal(true);
    return () => { delete window.__kuetxShowUpgrade; };
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'flex-start' }}>
      {!isQuestionBankViewer && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          authState={authState}
        />
      )}
      <div
        className={`main-content ${!isQuestionBankViewer ? 'mode-standard' : ''}`}
        style={isQuestionBankViewer ? { marginLeft: 0, width: '100%' } : undefined}
      >
        {!isQuestionBankViewer && (
          <Navbar
            onMenuClick={() => setSidebarOpen(o => !o)}
            syncStatus={authState.syncStatus}
            isAnonymous={authState.isAnonymous}
            onShowUpgrade={() => setShowUpgradeModal(true)}
          />
        )}
        <div style={{ flex: 1 }}>
          <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* BUGFIX: '/' used to unconditionally render the student
                Dashboard for every signed-in account, teacher or not — so
                a faculty account, even a fully verified one, landed on
                the student home page after onboarding/login with no way
                to reach /faculty except typing the URL directly. Now
                routes by accountRole, same source of truth buildQueue()
                uses. See BUGFIX_ROLE_SELECT_AND_FACULTY_ROUTING.md.

                BUGFIX 2: 'provider' was added as a third accountRole
                (see accountRole.js Phase 1 note) but this ternary was
                never updated for it, so provider accounts fell into the
                else branch and got the student Dashboard too — same bug
                as the teacher case above, just missed for the newer role.

                BUGFIX 3 (multi-tab / logout-timing role bleed, then
                auto-redirect follow-up): the ternary below only trusts
                getAccountRole(), a CLIENT-cached local flag (see
                accountRole.js's own doc comment — "never used to grant
                access to anything"), for a fast *optimistic* first paint.
                If that client flag is stale (e.g. a provider account whose
                local flag hadn't been (re)written yet — race after
                switching accounts in the same browser, or a sign-out that
                hadn't finished clearing storage before this route
                re-rendered), falling through to a plain <Dashboard />
                would silently show the wrong account's shell. Unlike
                every other student route (/profile, /courses, etc.),
                which is wrapped in RequireStudentMode and shows a "wrong
                shell" block screen with a manual link if the
                server-verified useIsFaculty()/useIsProvider() checks
                disagree, root is the one entry point EVERY signed-in
                account lands on after typing the bare domain or tapping a
                bookmark — so a block screen there is the wrong UX. Instead,
                RootRouteResolver silently <Navigate replace />'s to the
                correct dashboard the moment the server-verified check
                resolves and disagrees with the client flag: client-trust
                for the fast paint, server-verified correction after, no
                block screen, no manual click required. */}
            <Route path="/" element={
              getAccountRole() === 'teacher' ? <Navigate to="/faculty" replace /> :
              getAccountRole() === 'provider' ? <Navigate to="/provider" replace /> :
              <RootRouteResolver>{() => <Dashboard />}</RootRouteResolver>
            } />
            <Route path="/profile" element={<RequireStudentMode><Profile /></RequireStudentMode>} />
            <Route path="/courses" element={<RequireStudentMode><Courses /></RequireStudentMode>} />
            <Route path="/attendance" element={<RequireStudentMode><Attendance /></RequireStudentMode>} />
            <Route path="/marks" element={<RequireStudentMode><Marks /></RequireStudentMode>} />
            <Route path="/marks/:courseId" element={<RequireStudentMode><Marks /></RequireStudentMode>} />
            <Route path="/results" element={<RequireStudentMode><Results /></RequireStudentMode>} />
            <Route path="/schedule" element={<RequireStudentMode><Schedule /></RequireStudentMode>} />
            <Route path="/today" element={<RequireStudentMode><Today /></RequireStudentMode>} />
            <Route path="/teachers" element={<RequireStudentMode><Teachers /></RequireStudentMode>} />
            <Route path="/syllabus" element={<RequireStudentMode><Syllabus /></RequireStudentMode>} />
            <Route path="/diary" element={<RequireStudentMode><Diary /></RequireStudentMode>} />
            <Route path="/assignments" element={<RequireStudentMode><Assignments /></RequireStudentMode>} />
            <Route path="/question-bank" element={<RequireStudentMode><QuestionBank /></RequireStudentMode>} />
            <Route path="/question-bank/view" element={<RequireStudentMode><QuestionBankViewer /></RequireStudentMode>} />
            <Route path="/solutions" element={<RequireStudentMode><QuestionBankSolutions /></RequireStudentMode>} />
            <Route path="/self-study/academic" element={<RequireStudentMode><SelfStudy /></RequireStudentMode>} />
            <Route path="/self-study/deep-focus" element={<RequireStudentMode><SelfStudy /></RequireStudentMode>} />
            <Route path="/time" element={<RequireStudentMode><TimeTracker /></RequireStudentMode>} />
            <Route path="/namaz" element={<RequireStudentMode><Namaz /></RequireStudentMode>} />
            <Route path="/money" element={<RequireStudentMode><Money /></RequireStudentMode>} />
            <Route path="/tuition" element={<RequireStudentMode><Tuition /></RequireStudentMode>} />
            <Route path="/clubs" element={<RequireStudentMode><Clubs /></RequireStudentMode>} />
            {/* /services* deliberately NOT wrapped in RequireStudentMode —
                this is the student-facing browse-a-provider's-shop page,
                and it's plausible a provider legitimately wants to see
                how their own listing renders there. Revisit if that
                turns out to be more confusing than useful in practice. */}
            <Route path="/services" element={<Services />} />
            <Route path="/services/category/:categoryType" element={<CategoryShopList />} />
            {/* PHASE 2 (SERVICES_OVERHAUL_PLAN_PROMPT.md): "My Orders" hub —
                a literal path segment, so React Router's specificity-based
                matching resolves this before the /services/:serviceId
                param route below regardless of declaration order; placed
                here anyway, right after the other literal /services/*
                routes, for readability. */}
            <Route path="/services/orders" element={<ServiceOrdersHub />} />
            <Route path="/services/:serviceId" element={<ServiceDetail />} />
            <Route path="/projects" element={<RequireStudentMode><Projects /></RequireStudentMode>} />
            <Route path="/tours" element={<RequireStudentMode><Tours /></RequireStudentMode>} />
            <Route path="/calculators" element={<Navigate to="/marks" replace />} />
            <Route path="/alerts" element={<RequireStudentMode><Alerts /></RequireStudentMode>} />
            <Route path="/notice" element={<RequireStudentMode><Notice /></RequireStudentMode>} />
            <Route path="/reports" element={<RequireStudentMode><Reports /></RequireStudentMode>} />
            <Route path="/notes" element={<RequireStudentMode><Notes /></RequireStudentMode>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            {/* GUEST MODE (Phase 2.1) — /guest redirects to the dashboard
                demo per the plan's recommended structure. Sub-routes are
                the four presentational-only demo pages built this phase
                (see documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 2.3's BLOCKED status for why
                these are hand-built pages, not the real Dashboard/
                Schedule/Attendance/Marks reused with injected data).
                Each wrapped in RequireGuestMode (Phase 4, item 3) so a
                signed-in user who manually navigates here is bounced to
                the real /dashboard instead of seeing fake demo data. */}
            <Route path="/guest" element={<Navigate to="/guest/dashboard" replace />} />
            <Route path="/guest/dashboard" element={<RequireGuestMode authState={authState}><GuestDashboard /></RequireGuestMode>} />
            <Route path="/guest/schedule" element={<RequireGuestMode authState={authState}><GuestSchedule /></RequireGuestMode>} />
            <Route path="/guest/attendance" element={<RequireGuestMode authState={authState}><GuestAttendance /></RequireGuestMode>} />
            <Route path="/guest/marks" element={<RequireGuestMode authState={authState}><GuestMarks /></RequireGuestMode>} />
            {/* Publicly reachable (no route guard) — a brand-new account
                still on the Role Select screen needs to be able to open
                this before finishing signup, and it's also linked from
                Navbar.jsx's hamburger menu. */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/class-routine" element={<RequireStudentMode><RequireCR><ClassRoutine /></RequireCR></RequireStudentMode>} />
            <Route path="/class-setup" element={<RequireStudentMode><RequireCR><ClassSetup /></RequireCR></RequireStudentMode>} />
            <Route path="/class-planner" element={<RequireStudentMode><RequireCR><ClassPlanner /></RequireCR></RequireStudentMode>} />
            <Route path="/ct-quiz-planning" element={<RequireStudentMode><RequireCR><CTQuizPlanning /></RequireCR></RequireStudentMode>} />
            <Route path="/class-roster" element={<RequireStudentMode><RequireCR><ClassRosterPage /></RequireCR></RequireStudentMode>} />
            <Route path="/class-notices" element={<RequireStudentMode><RequireCR><ClassNotices /></RequireCR></RequireStudentMode>} />
            <Route path="/class-my-role" element={<RequireStudentMode><RequireCR><ClassMyRole /></RequireCR></RequireStudentMode>} />
            <Route path="/classmates" element={<RequireStudentMode><Classmates /></RequireStudentMode>} />
            <Route path="/tools" element={<RequireStudentMode><SubgroupHub group="Tools" /></RequireStudentMode>} />
            {/* Class Rep hub is CR-only content, but doesn't need a hard page
                gate here — non-CR users simply never see a link to it (see
                nav.js requiresCR + modeFilter). RequireCR stays on the
                actual CR tool routes above, which is what needs real
                protection against direct URL access.
                Points at CRHub (manual hub: Profile + Routine, Class
                Planner, CT & Quiz Planner, Roster, Notices, My Role) so
                Profile stays one tap away here too, same as before this
                refactor — nav.js's 'Class Rep' group (used by the Sidebar
                and Navbar) is kept separate from this hub's exact card
                list, same relationship as before the split. */}
            <Route path="/class-rep" element={<RequireStudentMode><CRHub /></RequireStudentMode>} />
            <Route path="/academic-core" element={<RequireStudentMode><SubgroupHub group="Academics" subgroup="Academic Core" /></RequireStudentMode>} />
            <Route path="/daily-academics" element={<RequireStudentMode><SubgroupHub group="Academics" subgroup="Daily Academics" /></RequireStudentMode>} />
            {/* Owner decision (Aug 2026): Campus Life stays independent
                from Services on DESKTOP only — desktop already has
                Services promoted to its own top-level sidebar row (see
                nav.js's NAV_DESKTOP split above), so repeating it here
                would be redundant. On MOBILE there's no such separate
                Services sidebar row (mobile's bottom nav has no room for
                it), so the /campus-life hub is the only place a mobile
                student can browse Services at all — this reverts back to
                including it there, but ONLY for isMobileNav, via the
                sections={[...]} multi-subgroup form SubgroupHub already
                supports (see resolveSection's sections.forEach loop).
                Desktop keeps the single subgroup="Campus Life" prop
                exactly as before. */}
            <Route
              path="/campus-life"
              element={
                <RequireStudentMode>
                  {isMobileNav ? (
                    <SubgroupHub
                      pageTitle="Campus Life"
                      sections={[
                        { group: 'Campus Life', subgroup: 'Campus Life' },
                        { group: 'Campus Life', subgroup: 'Services' },
                      ]}
                    />
                  ) : (
                    <SubgroupHub pageTitle="Campus Life" group="Campus Life" subgroup="Campus Life" />
                  )}
                </RequireStudentMode>
              }
            />
            <Route path="/self-study" element={<RequireStudentMode><SubgroupHub group="Campus Life" subgroup="Self Study" /></RequireStudentMode>} />

            {/* Combined bottom-nav hub page. Daily Life doesn't exist as
                a separate NAV group anymore (folded into Campus Life's
                own "Campus Life" subgroup a while back) — the old
                { group: 'Daily Life' } lookup here silently resolved to
                nothing every render, dead weight kept alive by accident.
                Scoped subgroup: 'Campus Life' here for the same reason
                as the /campus-life route above — without it this page
                pulled in Self Study's items too.

                BUGFIX (Services missing from mobile Campus tab): this is
                the route the bottom nav's "Campus" button actually links
                to (see BottomNavStudent.js's path: '/campus') — /campus-life
                above already had the isMobileNav-aware two-section form
                (Campus Life + Services) added, but this route was never
                updated to match, so it always rendered only the single
                'Campus Life' subgroup regardless of device. On desktop
                that's correct (Services has its own sidebar row there —
                see nav.js's NAV_DESKTOP split), but on mobile there's no
                such separate entry point, so Services was silently
                unreachable from the bottom nav. Mirrors /campus-life's
                branch exactly. */}
            <Route
              path="/campus"
              element={
                <RequireStudentMode>
                  {isMobileNav ? (
                    <SubgroupHub
                      pageTitle="Campus"
                      sections={[
                        { group: 'Campus Life', subgroup: 'Campus Life' },
                        { group: 'Campus Life', subgroup: 'Services' },
                      ]}
                    />
                  ) : (
                    <SubgroupHub
                      pageTitle="Campus"
                      sections={[{ group: 'Campus Life', subgroup: 'Campus Life' }]}
                    />
                  )}
                </RequireStudentMode>
              }
            />
            <Route path="/cr-hub" element={<CRHub />} />
            <Route path="/admin-hub" element={<RequireStaff><AdminHub /></RequireStaff>} />
            {/* /admin kept only as a redirect for old links/bookmarks —
                real destination is /team, which already embeds
                AdminEntryPoint (Founder section) alongside the staff panel. */}
            <Route path="/admin" element={<Navigate to="/team" replace />} />
            <Route path="/team" element={<RequireStaff><TeamDashboard /></RequireStaff>} />
            <Route path="/admin/batches" element={<RequireStaff><FounderBatchSettings /></RequireStaff>} />

            {/* ── Faculty Module (/faculty/*) — §11 Phase 3/4/5 ────────────
                Every real destination is wrapped in RequireFaculty (hard
                gate, manual verification policy — requires the Blue Tick,
                see that component + useIsFaculty.js). Hub pages
                (/faculty/more) reuse the same SubgroupHub component
                the student side uses, pointed at NAV_FACULTY via its
                navSource prop instead of a duplicate hub renderer.
                Class Detail (§8.5) ships with 3 read-only tabs (Students &
                CR, Syllabus, Schedule) as of Phase 5 — Sessions/Attendance/
                Marks/Notices tabs are visible-but-disabled placeholders in
                that page until Phases 6/7/8 build them. */}
            <Route path="/provider" element={<RequireProvider><ProviderDashboardRoute /></RequireProvider>} />
            <Route path="/provider/shop" element={<RequireProvider><ProviderMyShopHubRoute /></RequireProvider>} />
            <Route path="/provider/shop/offerings" element={<RequireProvider><ProviderOfferingsPageRoute /></RequireProvider>} />
            <Route path="/provider/shop/offerings/:offeringId" element={<RequireProvider><ProviderOfferingDetailPageRoute /></RequireProvider>} />
            <Route path="/provider/shop/settings" element={<RequireProvider><ProviderShopSettingsPageRoute /></RequireProvider>} />
            <Route path="/provider/profile" element={<RequireProvider><ProviderProfileRoute /></RequireProvider>} />
            <Route path="/provider/notifications" element={<RequireProvider><ProviderNotificationsPage /></RequireProvider>} />
            <Route path="/faculty" element={<RequireFaculty><FacultyDashboard /></RequireFaculty>} />
            <Route path="/faculty/profile" element={<RequireFaculty><FacultyProfile /></RequireFaculty>} />
            <Route path="/faculty/classes" element={<RequireFaculty><FacultyClasses /></RequireFaculty>} />
            <Route path="/faculty/all-cr" element={<RequireFaculty><FacultyAllCR /></RequireFaculty>} />
            <Route path="/faculty/classes/:assignmentId" element={<RequireFaculty><FacultyClassDetail /></RequireFaculty>} />
            <Route path="/faculty/schedule" element={<RequireFaculty><FacultySchedule /></RequireFaculty>} />
            <Route path="/faculty/meetings" element={<RequireFaculty><FacultyMeetings /></RequireFaculty>} />
            <Route path="/faculty/notices" element={<RequireFaculty><FacultyNoticeBroadcast /></RequireFaculty>} />
            <Route path="/faculty/contact" element={<RequireFaculty><FacultyContact /></RequireFaculty>} />
            <Route path="/faculty/question-bank" element={<RequireFaculty><QuestionBank /></RequireFaculty>} />
            {/* Bottom-nav "More" destination — combines what used to be two
                separate, mobile-unreachable sidebar groups (Campus →
                Resources, and Tools) plus Meetings/Broadcast Notice into
                one hub page, grouped into "Communication" and "Resources &
                Settings" sections (see nav-faculty.js's "More" group for
                why). /faculty/resources and /faculty/tools both now
                redirect here rather than 404-ing for anyone with the old
                links bookmarked. Mobile-only destination now — desktop's
                sidebar has its own separate Communication/Services/
                Resources rows instead of ever landing here (see
                NAV_FACULTY_DESKTOP in nav-faculty.js). */}
            <Route path="/faculty/more" element={<RequireFaculty><SubgroupHub navSource={NAV_FACULTY} group="More" pageTitle="More" /></RequireFaculty>} />
            <Route path="/faculty/resources" element={<Navigate to="/faculty/more" replace />} />
            <Route path="/faculty/tools" element={<Navigate to="/faculty/more" replace />} />
            {/* Desktop-only Resources hub — scoped to just the Resources
                subgroup (Question Bank/Contact/Settings/About), not the
                combined mobile /faculty/more page. NAV_FACULTY_DESKTOP
                points its Resources row's hubPath here instead of at
                /faculty/resources (which redirects to the combined
                mobile hub above). */}
            <Route path="/faculty/resources-hub" element={<RequireFaculty><SubgroupHub navSource={NAV_FACULTY} group="More" subgroup="Resources" pageTitle="Resources" /></RequireFaculty>} />
          </Routes>
          </Suspense>
        </div>
        {location.pathname !== '/about' && !isQuestionBankViewer && !isMobileNav && <Footer />}
        {!isQuestionBankViewer && <BottomNav />}
        <GlobalToasts />
        <GlobalDialog />
        <FloatingUploadBar />
        {/* Global, role-agnostic — every signed-in role sees this the
            same way, no per-role wiring (see FloatingInstallButton.jsx).
            Skipped on the fullscreen question-bank viewer, same as
            BottomNav/Footer above, since that route has no chrome at
            all. Renders null internally unless the browser has actually
            offered an install path (or this is iOS Safari), so it's
            invisible everywhere else without needing a condition here. */}
        {!isQuestionBankViewer && <FloatingInstallButton />}
        {!onboardingActive && <NoticeToast />}
        <ClassJoinIntro />
        <NoCRBanner />

        {/* Account upgrade modal (anonymous → real account) */}
        {showUpgradeModal && (
          <AuthModal
            isUpgrade={true}
            onClose={() => setShowUpgradeModal(false)}
            onSuccess={async (user) => {
              setShowUpgradeModal(false);
              await authState.onAccountUpgraded(user);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Startup queue — shows one popup at a time ─────────────────────────────

// §5 of the merged Faculty Module prompt: 'role-select' is shown once, at
// SIGN-UP time only — never again afterward, on this device or any other.
//
// BUGFIX (see BUGFIX_ROLE_SELECT_AND_FACULTY_ROUTING.md): accountRole used
// to be trusted from localStorage alone. That's per-browser, so it broke
// in exactly the ways reported: (1) a genuinely-registered faculty account
// signing in on a new device / after clearing storage saw Role Select
// again, even though their real role was already decided and provable —
// faculty/{uid} already exists the moment they registered; (2) every
// pre-existing account created before this feature existed has no
// accountRole in localStorage either, so ALL of them hit Role Select on
// their very next login, despite having used the app for months.
//
// Fix: before falling back to the local flag, check the one server-side
// fact that's actually authoritative — does faculty/{uid} exist for this
// uid? If yes, this is unambiguously a faculty account (only
// createFacultyShell, called once at faculty sign-up, ever creates that
// doc) — sync accountRole locally to 'teacher' and skip role-select
// entirely. If no faculty/{uid} doc exists AND the account is not
// anonymous, treat it as an already-decided student account (the
// overwhelmingly common case, and exactly the safe default for every
// pre-existing user) rather than re-asking. Role Select now only ever
// appears for a genuinely brand-new, not-yet-decided sign-up.
//
// Async because both the teacher-profile check AND this new role
// detection need a Firestore read (getFacultyDoc) — every other branch
// here stays synchronous/local, matching the original function's cost
// profile as closely as possible.
//
// KNOWN GAP — verified in Phase 2, turned out to be a non-issue for the
// current guest-mode scope: the queue only rebuilds when
// authState.authReady/isAnonymous/uid changes (see the effect below), not
// on every client-side route change. This means buildQueue() runs once
// per public path on the page's initial load and does NOT re-run just
// because GuestNav's links (see components/guest/GuestNav.jsx) SPA-
// navigate between /guest/dashboard, /guest/schedule, /guest/attendance,
// /guest/marks. In practice this is fine: once buildQueue() resolves to
// an EMPTY queue for one public path, `current` stays null and Layout
// keeps rendering regardless of which PUBLIC_PATHS entry the URL bar
// shows next — the empty-queue state doesn't need to know "which" public
// path, only "am I on a public path or not", and that was already true
// for every public path at the moment of the initial (non-SPA) page
// load. The only case this WOULD matter is a signed-out visitor SPA-
// navigating from a public path to a genuinely gated path (e.g. typing
// '/marks' into the guest nav, which doesn't exist today) without a full
// reload in between — not a scenario the current GuestNav/GuestShell
// exposes, since it only links between PUBLIC_PATHS entries. Revisit if
// a future phase adds an in-app link from a public path to a gated one.
const PUBLIC_PATHS = ['/about', '/guest', '/guest/dashboard', '/guest/schedule', '/guest/attendance', '/guest/marks'];
const isPublicPath = (pathname) => PUBLIC_PATHS.includes(pathname);

async function buildQueue(isAnonymous, pathname) {
  const q = [];
  let accountRole = getAccountRole();

  // RESTRUCTURE (Sign In/Up-first flow): Role Select used to be pushed
  // BEFORE 'auth' for any session with no local accountRole — including a
  // brand-new anonymous visitor who hasn't even chosen Login vs Register
  // yet. That put Role Select in front of everyone on first load, whether
  // they were about to sign in to an existing account or sign up fresh.
  //
  // Fix: 'auth' now comes first for anyone with no real (non-anonymous)
  // account yet. AuthModal itself no longer needs a pre-decided role/
  // variant to render Login/Register — Login is role-agnostic (server
  // lookup below still resolves an existing account's role correctly),
  // and Register creates the account with NO role yet. Role Select is
  // only ever queued afterward, once a real uid exists and genuinely has
  // no role recorded — i.e. it now lives strictly inside the Sign Up
  // path, exactly where the spec puts it, instead of gating entry itself.
  //
  // GUEST MODE (Phase 1): the one exception to "no real account yet ->
  // 'auth' blocks everything" is the narrow PUBLIC_PATHS allow-list above.
  // A signed-out visitor sitting on /about gets an EMPTY queue instead —
  // same as a fully-onboarded signed-in account — so Layout mounts and
  // /about's own <Route> renders normally, with no opaque overlay on top.
  // This is intentionally scoped to the exact current pathname, not "any
  // anonymous visitor everywhere": every other route still hits the
  // isAnonymous/!uid check below and gets pushed to 'auth' exactly as
  // before. Signed-in accounts are completely unaffected either way,
  // since this branch only ever triggers when there's no real uid.
  if ((isAnonymous || !auth.currentUser?.uid)) {
    if (isPublicPath(pathname)) {
      return q; // empty queue: render the real route, no auth gate
    }
    q.push('auth');
    return q;
  }

  // BUGFIX (beta-era leftover local data across account/device
  // boundaries): this used to be `if (!accountRole)` — trusting ANY
  // present local value, even one left over from a completely different
  // account that once used this same browser (this app was
  // local/offline-only during its beta with 500-600 users, all since
  // removed from Firebase Auth; their local data can still be sitting on
  // devices that are now used by different, current accounts). See
  // accountRole.js's header comment for the full incident this traces
  // back to and why uid-tagging (not "always re-fetch from server",
  // which would break offline support) is the fix. isAccountRoleTrustedForUid()
  // returns true only when the local value is tagged for the uid that's
  // CURRENTLY signed in — an untagged value (pre-fix data, or genuinely
  // someone else's leftover) is treated exactly like "nothing cached
  // locally," and goes through the same full server-truth resolution
  // below that a brand-new session would.
  const uid = auth.currentUser.uid;
  if (!isAccountRoleTrustedForUid(uid)) {
    // Not yet decided locally, but this is a real (non-anonymous) signed-in
    // account — check server-side facts before ever showing role-select.
    // Checked in order:
    //   1. users/{uid}.role — the explicit, authoritative record, written
    //      once at Role Select for ANY role (see accountRole.js).
    //   2. faculty/{uid} doc existing — a secondary signal that predates
    //      (1) and still catches any account that somehow has a faculty
    //      doc but never got a users/{uid}.role write (e.g. it was
    //      created by an earlier build of this app, before role
    //      persistence existed at all).
    //   3. providers/{uid} doc existing — same idea as (2), for a real
    //      provider account whose users/{uid}.role write failed/never
    //      landed (see the BUGFIX comment inline below for the incident
    //      this was added to fix).
    //   4. students/{uid} doc existing — same idea again, for a real
    //      student account whose users/{uid}.role write failed/never
    //      landed (see the BUGFIX comment inline below). Checked last
    //      since it needs a real network round-trip (pullProfile) same
    //      as (3), and student is the default/fallthrough role anyway if
    //      none of 1-4 resolve anything.
    //   5. Otherwise: genuinely nothing recorded yet — this is a brand-new
    //      account that just came out of Register with no role chosen,
    //      the ONLY case Role Select should ever actually show for.
    const serverRole = await fetchServerAccountRole(auth.currentUser.uid);
    if (serverRole) {
      setAccountRole(serverRole);
      accountRole = serverRole;
    } else {
      const fdoc = await getFacultyDoc(auth.currentUser.uid).catch(() => null);
      if (fdoc) {
        setAccountRole('teacher');
        accountRole = 'teacher';
        persistAccountRoleToServer('teacher');
      } else {
        // BUGFIX: this else-if was missing entirely — the faculty branch
        // above has always had a fdoc existence fallback for when
        // users/{uid}.role failed to persist (or was never written by an
        // older build), but no equivalent existed for provider. A real
        // provider account (providers/{uid} exists, created at Role
        // Select's provider-form step) whose users/{uid}.role write never
        // landed — persistAccountRoleToServer failing silently is a
        // documented non-fatal path, see accountRole.js — had no way to
        // ever be recognized here. accountRole stayed null/undefined
        // forever, which falls into the final `else` branch below (the
        // student branch) on every single load: buildQueue pushed
        // 'profile', and the student ProfileSetupModal was rendered even
        // on /provider, on every refresh, because nothing here ever
        // corrected or persisted the role — the exact symptom reported
        // (Profile Setup showing on the provider account, refresh does
        // not fix it, unlike the old provider flash-loading bug which
        // this is not the same issue as). Fix: same pattern as the
        // faculty branch — check providers/{uid} existence directly and
        // resync both the local flag and the server record from it.
        const pdoc = await getProviderProfile(auth.currentUser.uid).catch(() => null);
        if (pdoc) {
          setAccountRole('provider');
          accountRole = 'provider';
          persistAccountRoleToServer('provider');
        } else {
          // BUGFIX: same gap as the provider fallback above, but for
          // student — and arguably worse, since student has no
          // dedicated per-role Firestore doc created at Role Select the
          // way teacher (createFacultyAccountDoc) and provider
          // (createProviderShell) do; choose('student') in
          // RoleSelectScreen.jsx only ever calls
          // persistAccountRoleToServer('student'), nothing else. So if
          // that one write silently failed (or a later read of
          // users/{uid}.role fails), there was NO server-side signal
          // left anywhere to recognize an existing student account by —
          // accountRole stayed null forever and buildQueue fell through
          // to q.push('role-select') below, re-showing the Student/
          // Teacher/Provider picker to someone who already has a real
          // account, on every load. Fix: use the one server-side
          // artifact a student account DOES leave behind once they've
          // ever completed profile setup — the students/{uid} doc
          // (written by pushProfile in firebaseSync.js). pullProfile()
          // already forces a genuine server read here (not the SDK's
          // local cache — see its own comment), which is the right
          // trust level for a fallback like this. A brand-new account
          // that hasn't reached Role Select yet has no students/{uid}
          // doc either, so this still correctly falls through to
          // role-select for that case — only an account with a real,
          // previously-saved profile gets auto-recovered here.
          const sdoc = await pullProfile(auth.currentUser.uid).catch(() => null);
          if (sdoc) {
            setAccountRole('student');
            accountRole = 'student';
            persistAccountRoleToServer('student');
          }
        }
      }
    }
  } else {
    // isAccountRoleTrustedForUid(uid) already confirmed this local value
    // is tagged for the CURRENTLY signed-in uid — i.e. it's this
    // account's own, previously-confirmed role, not beta-era or
    // cross-account leftover data. No server round-trip needed here:
    // trusting it directly is both correct (it was itself set from a
    // server-verified source at some earlier point — see the resolution
    // branch above) and is what keeps ordinary repeat-visit loads fast
    // and offline-safe (an offline session reading its own tagged role
    // for its own uid should never be second-guessed or blocked on a
    // network read it might not even have).
  }

  if (!accountRole) {
    q.push('role-select');
    // Nothing else can be meaningfully decided yet — profile/faculty-verify
    // steps depend on which role gets picked, and role-select itself
    // doesn't advance until a choice is made (§8.1, no dismiss path). Only
    // ever reached now by a real, freshly-registered account with
    // genuinely no role recorded anywhere — never by an anonymous visitor
    // who hasn't signed in/up yet (that's 'auth', above), and never by an
    // existing account (server lookup above already resolved it).
    return q;
  }

  if (accountRole === 'teacher') {
    if (!isAnonymous) {
      // Founder bypass and "faculty doc not created yet" both fall through
      // to !isFacultyProfileComplete() being true here, which is correct:
      // a founder never has a faculty/{uid} doc and isn't expected to —
      // RequireFaculty.jsx's isFounderBypass check (not this queue) is
      // what actually unlocks their shell, and Founder sessions skip
      // role-select entirely per §7, so this branch is only ever reached
      // by an account that genuinely chose "Faculty Member".
      const fdoc = await getFacultyDoc(auth.currentUser?.uid).catch(() => null);
      // Manual verification policy: verifiedAt (Blue Tick) is NOT checked
      // here — profile setup (name/title/dept) is unconditional and
      // separate from Admin approval, so someone can finish their profile
      // right away even before an Admin verifies them. RequireFaculty.jsx
      // is what actually blocks the real /faculty/* routes afterward
      // until an Admin grants the Blue Tick. If the faculty doc doesn't
      // exist yet for some reason, fall through the same as "profile
      // incomplete" so profile setup still creates it rather than
      // leaving the queue empty.
      if (!isFacultyProfileComplete(fdoc)) {
        // FacultyProfileSetupModal now exists (mandatory, full-screen,
        // faculty-shaped fields) — a verified-but-incomplete faculty
        // account gets sent there instead of falling through to the
        // student ProfileSetupModal (which asked for studentId/hall/
        // advisor, none of which apply) or being left with nothing
        // queued at all (the old placeholder-era behavior).
        q.push('faculty-profile');
      }
    }
  } else if (accountRole === 'provider') {
    // Provider (SERVICES_PROVIDER_PLAN.md §3): no onboarding queue step
    // needed here at all, unlike teacher's 'faculty-profile'. The full
    // detail form (name, phone) is already collected inline at Role
    // Select (see RoleSelectScreen.jsx's provider-form step) before
    // providers/{uid} is even created, so there's nothing left to
    // complete afterward. The actual gate — pending vs verified — is a
    // LIVE Firestore check done by RequireProvider on every visit to
    // /provider/*, not a one-time queue step; a provider account can
    // browse the rest of the app (Dashboard, Notice, etc.) exactly like
    // any other account while their verification is pending.
  } else {
    // Profile setup is mandatory before anything else — a half-filled
    // profile (missing roll/dept/session) is the root cause of Classmates
    // mismatch, roll-verification, and term-roadmap issues reported by
    // users. This step has no skip; it only advances via ProfileSetupModal's
    // onSave. The KUET email verify sub-step inside it keeps its own skip.
    if (!isProfileComplete(getProfile())) q.push('profile');
  }

  return q;
}

// Small wrapper so ProviderDashboard (Phase 1 shell) can display the
// account's own displayName without re-subscribing itself — RequireProvider
// already resolved providerProfile via useIsProvider by the time children
// render, but that hook's result isn't otherwise threaded through
// `children` props, so this just re-reads it once, cheaply (same
// onSnapshot cache, not an extra network read).
function ProviderDashboardRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderDashboardPage providerProfile={providerProfile} />;
}

// PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2 — same wrapper pattern as
// ProviderDashboardRoute above: RequireProvider already resolved
// providerProfile via useIsProvider by the time these render, so each
// sub-page just reads it off the same hook instead of re-subscribing.
function ProviderMyShopHubRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderMyShopHubPage providerProfile={providerProfile} />;
}

function ProviderOfferingsPageRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderOfferingsPagePage providerProfile={providerProfile} />;
}

function ProviderShopSettingsPageRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderShopSettingsPagePage providerProfile={providerProfile} />;
}

function ProviderOfferingDetailPageRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderOfferingDetailPagePage providerProfile={providerProfile} />;
}

// PHASE 3 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md) — same wrapper pattern as
// the other /provider/* routes above.
function ProviderProfileRoute() {
  const { providerProfile } = useIsProvider();
  return <ProviderProfilePage providerProfile={providerProfile} />;
}

// BUGFIX: right after Role Select's provider-form step creates
// providers/{uid} (status 'pending'), buildQueue() correctly returns an
// empty queue (see its 'provider' branch comment) and the app falls
// through to the normal shell — student-shaped sidebar/bottom-nav —
// with nothing telling the brand-new provider that their request is
// pending. They'd only ever see ProviderVerificationPending if they
// happened to navigate to /provider themselves. This one-shot redirect
// sends a freshly-created, not-yet-verified provider account straight to
// /provider right after the onboarding queue drains, so RequireProvider's
// pending screen is the first thing they see. Guarded by a sessionStorage
// flag so it fires once per browser session, not on every navigation away
// from /provider afterward.
const PROVIDER_REDIRECT_FLAG = 'kuetx:providerPostSignupRedirectDone';

function ProviderPostSignupRedirect({ queueBuilt, queueEmpty }) {
  const { isProvider, isVerifiedProvider, isResolved } = useIsProvider();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!queueBuilt || !queueEmpty || !isResolved) return;
    if (!isProvider || isVerifiedProvider) return;
    if (location.pathname.startsWith('/provider')) return;
    if (sessionStorage.getItem(PROVIDER_REDIRECT_FLAG)) return;
    // BUGFIX: this used to fire on ANY pathname the moment the queue
    // drained, including pages the person deliberately just navigated
    // to (e.g. clicking the Role Select "গোপনীয়তা নীতি ও শর্তাবলী" link
    // to /privacy right as onboarding finished) — the redirect would win
    // the race and yank them to /provider's pending-verification screen
    // instead, reading as a random error page popping up right after
    // setup. Now only fires from the natural default landing path ('/'),
    // same "first thing after signup" moment it was meant for, so it
    // never overrides an intentional navigation elsewhere.
    if (location.pathname !== '/') return;

    sessionStorage.setItem(PROVIDER_REDIRECT_FLAG, '1');
    navigate('/provider', { replace: true });
  }, [queueBuilt, queueEmpty, isResolved, isProvider, isVerifiedProvider, location.pathname, navigate]);

  return null;
}

export default function App() {
  const authState = useFirebaseAuth();
  console.log('[KUETx DIAG] App() rendering, authReady =', authState.authReady, 'isAnonymous =', authState.isAnonymous);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueBuilt, setQueueBuilt] = useState(false);
  const current = queue[0] || null;

  // BUGFIX(F): Term Start Date is now CR/ACR-set once per dept+batch class
  // (see src/lib/termStartDateSync.js and ClassRoutine's term-date widget)
  // instead of typed in by each student. Every existing read-site
  // (Dashboard, Schedule, Results, Marks, Profile, alertUtils) reads
  // profile.termStartDate directly and synchronously — rather than
  // touching all of them to add their own live subscription, this single
  // boot-level listener mirrors the CR-set date into the local profile
  // store whenever it changes, so those reads stay correct for free.
  // Falls back to leaving profile.termStartDate untouched if the group
  // hasn't set one yet (backward compatible with profiles that already
  // had a manually-entered value from before this feature existed).
  const currentGroupId = getGroupId(getProfile());
  useEffect(() => {
    if (!authState.authReady) return;
    const gid = currentGroupId;
    if (!gid) return;
    return subscribeGroupTermStartDate(gid, (date) => {
      if (!date) return; // group hasn't set one — keep whatever's already stored
      const current = getProfile();
      if (current.termStartDate === date) return;
      store.set('profile', { ...current, termStartDate: date });
    });
  }, [authState.authReady, currentGroupId]);

  // Same mechanism as the term-start-date listener directly above, for
  // the CURRENT TERM. currentTermKey used to be a field each student
  // typed into their own Profile — now the CR/ACR sets it once for the
  // whole class (Class Setup page) and this mirrors it into every
  // member's local profile.currentTermKey, so getCurrentTermKey(profile)
  // (used synchronously across Courses/Results/Marks/Attendance/
  // Dashboard/Schedule — 14 call sites) stays correct without touching
  // any of them. A student's own manual currentTermKey (from before this
  // feature existed) is overwritten going forward — the class no longer
  // has a "pick your own term" option once the CR has set one.
  useEffect(() => {
    if (!authState.authReady) return;
    const gid = currentGroupId;
    if (!gid) return;
    return subscribeGroupCurrentTermKey(gid, (termKey) => {
      if (!termKey) return; // group hasn't set one — keep whatever's already stored
      const current = getProfile();
      if (current.currentTermKey === termKey) return;
      store.set('profile', { ...current, currentTermKey: termKey, currentTerm: '' });
    });
  }, [authState.authReady, currentGroupId]);

  // GAP FIX (Class On/Off toggle — see CLASS_TOGGLE_NOTIFICATION_PROMPT.md
  // "Gap 2"): scheduleSettings.classOverrides / .recurringOff are written
  // group-side into plannerSettings.scheduleFields (see groupSync.js's
  // setSlotOverride/setDayOverride/setRecurringOff/clearRecurringOff), but
  // store.js's isClassOff()/getClassOffReason() — the only place read-side
  // resolution happens — read from the LOCAL store's 'scheduleSettings' key
  // only (store.get('scheduleSettings')). todayItems.js and Attendance.jsx
  // both call isClassOff() as a plain synchronous function, not a React
  // hook, so they can't subscribe to Firestore themselves.
  //
  // Same mechanism as the termStartDate/currentTermKey mirrors directly
  // above: subscribe once at boot to the group's plannerSettings doc and
  // mirror its scheduleFields into the local 'scheduleSettings' store
  // entry whenever it changes, merging rather than overwriting so any
  // OTHER scheduleSettings fields that already live there locally
  // (e.g. holidayDates — see store.js's getUpcomingHolidays, which reads
  // scheduleSettings.holidayDates) are preserved rather than clobbered.
  // Without this, Phase 3 (isClassOff() plugged into Today/Attendance)
  // is silently broken for every group member except whichever CR/ACR
  // page already has its own separate subscribePlannerSettings mount.
  useEffect(() => {
    if (!authState.authReady) return;
    const gid = currentGroupId;
    if (!gid) return;
    return subscribePlannerSettings(gid, (plannerSettings) => {
      const scheduleFields = plannerSettings?.scheduleFields;
      if (!scheduleFields) return; // group hasn't set any overrides yet
      const current = store.get('scheduleSettings') || {};
      const merged = { ...current, ...scheduleFields };
      // Cheap shallow-enough guard to avoid redundant writes on every
      // unrelated plannerSettings field change (e.g. courseTeacherMap
      // edits also live in this same doc and would otherwise re-fire
      // this mirror needlessly). Must compare every field this mirror
      // actually copies — sessionalCadence (Phase 3) added here after a
      // bug where it was computed into `merged` correctly but the guard
      // above it only checked classOverrides/recurringOff, so a
      // cadence-only change would compute the right merge and then get
      // silently thrown away by this early return, never reaching
      // store.set. Any field added to scheduleFields in the future needs
      // adding here too, or it'll hit the same silent-drop bug.
      if (JSON.stringify(current.classOverrides) === JSON.stringify(merged.classOverrides)
        && JSON.stringify(current.recurringOff) === JSON.stringify(merged.recurringOff)
        && JSON.stringify(current.sessionalCadence) === JSON.stringify(merged.sessionalCadence)) return;
      store.set('scheduleSettings', merged);
    });
  }, [authState.authReady, currentGroupId]);

  // TEACHER-ID MIGRATION (Phase 2 of TEACHER_ID_SESSIONAL_PROGRESS.md):
  // one-time, idempotent, boot-level conversion of a group's legacy
  // name-keyed courseTeacherMap (`{courseId: ['Dr. Ahmed Khan', ...]}`)
  // into the new ID-keyed shape (`{courseId: [teacherId, ...]}`) backed
  // by a new teacherRegistry (`{teacherId: name}`) — see
  // teacherRegistry.js for why (renaming a teacher used to silently
  // orphan every attendance record keyed under the old spelling).
  //
  // Deliberately gated to CR/ACR only (subscribeMyRole, the same
  // server-verified role RequireCR.jsx trusts — NOT profile.isCR, which
  // is just a self-ticked checkbox). Every group member reads
  // courseTeacherMap, but only the CR/ACR should ever WRITE
  // plannerSettings; a random member's client shouldn't be racing to
  // migrate a shared doc the moment they happen to load the app first.
  // migrateCourseTeacherMapToIds itself is a pure function — it only
  // computes the next shape; this effect is the one place that actually
  // commits it, and only when the CR/ACR role check has resolved to true.
  //
  // Safe to fire on every plannerSettings snapshot: migrateCourseTeacherMapToIds
  // returns null (no-op, no write) once the map is already ID-based, so
  // this doesn't loop or double-write once migration has happened once
  // for a group — see its own idempotency comment in teacherRegistry.js.
  const isCrOrAcrRef = useRef(false);
  useEffect(() => {
    if (!authState.authReady || !currentGroupId || !authState.uid) return;
    return subscribeMyRole(currentGroupId, authState.uid, (role) => {
      isCrOrAcrRef.current = role === 'cr' || role === 'acr';
    });
  }, [authState.authReady, currentGroupId, authState.uid]);

  useEffect(() => {
    if (!authState.authReady) return;
    const gid = currentGroupId;
    if (!gid) return;
    return subscribePlannerSettings(gid, (plannerSettings) => {
      if (!isCrOrAcrRef.current) return; // only CR/ACR may migrate the shared doc
      const result = migrateCourseTeacherMapToIds(
        plannerSettings?.courseTeacherMap,
        plannerSettings?.teacherRegistry,
      );
      if (!result) return; // already migrated, or nothing to migrate
      updatePlannerSettings(gid, getProfile(), result)
        .catch((e) => console.error('[App] teacherRegistry migration write failed:', e));
    });
  }, [authState.authReady, currentGroupId]);

  // Faculty magic-link (email sign-in-link) verification has been
  // removed entirely — faculty verification is manual-only now (Founder
  // approves via WhatsApp + ManualVerifyFallback/manualVerifyRequests.js,
  // same as the student roll fallback path). There is no link for this
  // effect to listen for anymore.

  // Build queue once auth is ready so we know isAnonymous. buildQueue is now
  // async (accountRole === 'teacher' needs a Firestore read) — guarded with
  // `cancelled` so a fast unmount/re-auth during the read can't apply a
  // stale queue.
  //
  // BUGFIX: this used to call buildQueue() the instant authState.authReady
  // flipped, trusting main.jsx's initial `Promise.race([ensureDBReady(),
  // 2000ms timeout])` to have already warmed the profile cache. On a slow
  // first IndexedDB open (new device, storage pressure, first load) that
  // race can lose — the app renders with an EMPTY memoryCache, buildQueue
  // reads getProfile() before real data has loaded, sees an incomplete
  // profile, and pushes 'profile' back onto the queue even though the real
  // profile (already saved, including anything set after onboarding like a
  // photo) is sitting safely in IndexedDB a moment away from loading. This
  // is what caused "profile setup keeps reappearing even though I already
  // filled it in." ensureDBReady() is idempotent — it no-ops instantly if
  // main.jsx's race already won — so awaiting it again here is free in the
  // common case and closes the gap in the slow case.
  // BUGFIX (Google redirect sign-in gets stuck): queueBuilt used to gate
  // this effect to run exactly once per app load. That's correct for the
  // very first mount, but AuthModal's Google button is redirect-based
  // (full-page navigate to Google and back — see AuthModal.jsx) and never
  // calls onSuccess/handleAuthSuccess directly, since there's no callback
  // to receive one across a page navigation. The ONLY signal that a
  // sign-in actually completed is useFirebaseAuth's onAuthChange flipping
  // authState.uid from null to a real uid after the redirect returns. But
  // by then queueBuilt was already true from the pre-sign-in render (which
  // queued 'auth' for a signed-out user), so this effect's old guard
  // (`!authState.authReady || queueBuilt`) skipped it forever — the queue
  // never rebuilt, and the app stayed stuck showing the AuthModal (or
  // whatever step was queued before) even though sign-in succeeded.
  //
  // Fix: key the rebuild on the actual signed-in uid, not just a one-shot
  // boolean. Track the previous uid in a ref; rebuild the queue any time
  // it changes (null -> real uid on sign-in, one uid -> another on
  // switch, real uid -> null on sign-out) in addition to the original
  // first-mount case.
  const lastAuthUidRef = useRef(undefined); // undefined = "haven't built yet"
  // See the safety-net comment on the effect below — this tracks whether
  // that extra verification pass is currently running, so the render can
  // show a proper branded "setting things up" screen instead of either a
  // blank shell or (worse) flashing ProfileSetupModal while it works.
  const [verifyingProfile, setVerifyingProfile] = useState(false);
  useEffect(() => {
    if (!authState.authReady) return;
    const uidChanged = lastAuthUidRef.current !== authState.uid;
    if (queueBuilt && !uidChanged) return;
    lastAuthUidRef.current = authState.uid;
    console.log('[KUETx DIAG] authReady=true, uid=', authState.uid, '- starting ensureDBReady()...');
    let cancelled = false;
    ensureDBReady().finally(async () => {
      if (cancelled) return;
      console.log('[KUETx DIAG] ensureDBReady() done, calling buildQueue()...');
      const q = await buildQueue(authState.isAnonymous, window.location.pathname);
      if (cancelled) return;
      console.log('[KUETx DIAG] buildQueue() done, queue =', q);

      // SAFETY NET (belt-and-braces on top of firebaseSync.js's
      // getDocFromServer() fix): buildQueue() concluding 'profile' is
      // needed for a real, signed-in account is the exact symptom of the
      // false-negative this bug has been about — a profile that
      // genuinely exists on the server but wasn't seen in time locally.
      // Rather than trust that verdict immediately and flash
      // ProfileSetupModal, do one more independent, forced server read
      // here and only commit to showing the modal if the server itself
      // confirms there's really no profile. A brief "setting up your
      // account" screen while this second check runs is far less
      // jarring than a form flashing open and shut.
      if (q[0] === 'profile' && !authState.isAnonymous && authState.uid) {
        setVerifyingProfile(true);
        try {
          const serverProfile = await pullProfile(authState.uid);
          if (cancelled) return;
          if (serverProfile && isProfileComplete(serverProfile)) {
            // Server disagrees with the local verdict — it really is
            // complete. Re-hydrate local storage from it and rebuild the
            // queue, which will now correctly skip 'profile'.
            await store.importAllReport({ kuetx_profile: serverProfile });
            const q2 = await buildQueue(authState.isAnonymous, window.location.pathname);
            if (cancelled) return;
            console.log('[KUETx DIAG] safety-net re-check found a complete server profile, corrected queue =', q2);
            setQueue(q2);
            setQueueBuilt(true);
            setVerifyingProfile(false);
            return;
          }
        } catch (err) {
          console.warn('[KUETx DIAG] safety-net profile re-check failed:', err.message);
          // Fall through — show the real queue as originally computed
          // rather than getting stuck on the verifying screen forever.
        }
        setVerifyingProfile(false);
      }

      setQueue(q);
      setQueueBuilt(true);
    });
    return () => { cancelled = true; };
  }, [authState.authReady, authState.isAnonymous, authState.uid, queueBuilt]);

  // Auto-join the class group as soon as we have a signed-in user with a
  // complete profile — no need to ever open the Classmates page manually.
  // This also self-heals EXISTING accounts: anyone who already has
  // dept+batch saved from before this change gets backfilled into their
  // group's members collection the very next time the app loads for them,
  // with no action needed on their part.
  //
  // This ALSO backfills roll-number ownership (rollOwners/{roll}) for
  // existing accounts — not just new profile saves in ProfileSetupModal.
  // Without this, an account created before that check existed would
  // never call claimRoll() again unless the person happened to re-open
  // Edit Profile, so a pre-existing duplicate-roll pair could silently
  // coexist forever.
  //
  // Deliberately scoped narrow: a losing account is blocked ONLY from
  // syncGroupMembership() — i.e. it can never file a join request, so it
  // can never show up in Classmates or write into shared class data
  // under someone else's roll. Every personal-only
  // feature (Notes, Diary, Money, Calculators, etc.) keeps working
  // normally. This is intentionally NOT a full app lock: detection here
  // is a first-loads-wins heuristic, not identity verification, so a
  // hard lockout could trap a genuine student's account over nothing
  // more than bad timing. The affected person sees a clear message and
  // can reach out to get it manually resolved, instead of losing access
  // to their whole account over a heuristic.
  //
  // Listens to 'kuetx:store-updated' (not just mount) because profile data
  // loads asynchronously from IndexedDB and can also change later (e.g.
  // roll number correction re-deriving dept/batch) — each of those should
  // re-attempt the join/refresh with the latest values.
  useEffect(() => {
    let cancelled = false;
    const tryJoin = async () => {
      if (cancelled) return;
      if (!authState.authReady || authState.isAnonymous) return;
      // BUGFIX: this effect (and its roll-collision toast) is entirely
      // student-shaped — Classmates/Class data, roll ownership, group
      // join — none of it applies to a faculty account. It had no role
      // guard at all, so a faculty account with any stray studentId left
      // in local profile storage (e.g. from an earlier student session
      // on the same browser, or a test/switched-role account) could
      // trigger the "Another account already uses your roll number..."
      // toast, which is meaningless and confusing outside the student
      // Classmates context.
      if (getAccountRole() === 'teacher') return;
      const profile = getProfile();
      if (!isProfileComplete(profile)) return;
      const gid = getGroupId(profile);
      if (!gid || !auth.currentUser?.uid) return;

      let claim;
      try {
        claim = await claimRoll(profile.studentId);
      } catch (e) {
        console.warn('[App] auto claimRoll failed', e);
        return; // network/permission hiccup — don't join with an unverified claim
      }
      if (cancelled) return;

      if (!claim.ok) {
        notify(
          'Another account already uses your roll number, so this account will not be added to the shared Classmates/Class data. You can still use the other features normally. If this looks wrong, contact us and we will fix it.',
          'error',
          8000
        );
        return; // do NOT syncGroupMembership — this account doesn't own this roll
      }

      // Backfill safety net for accounts that never went through
      // ProfileSetupModal's own trigger (e.g. profile saved before this
      // change existed, or the modal's onSave somehow didn't fire) —
      // ensureManualVerifyRequest is idempotent (deterministic doc ID),
      // so calling it on every app load/store-update here is safe and
      // just a no-op past the first successful write per account. Skip
      // when already Blue-Tick verified so an already-verified student
      // doesn't get queued into the Approvals tab for no reason.
      getOwnMemberVerifiedOnce(gid).then((alreadyVerified) => {
        if (!alreadyVerified) {
          ensureManualVerifyRequest('student', {
            name: profile.name,
            email: profile.kuetEmail,
            roll: profile.studentId,
          });
        }
      }).catch(() => {});

      syncGroupMembership(gid, profile).catch((e) => console.warn('[App] auto syncGroupMembership failed', e));
    };
    tryJoin();
    window.addEventListener('kuetx:store-updated', tryJoin);
    return () => {
      cancelled = true;
      window.removeEventListener('kuetx:store-updated', tryJoin);
    };
  }, [authState.authReady, authState.isAnonymous]);

  // Analytics heartbeat (DAU/WAU/MAU + retention) — see activityTracking.js.
  // Only for real, signed-in accounts; anonymous sessions and the pre-auth
  // window are deliberately excluded so the active-user count reflects
  // actual KUET students/faculty, not every device that opened the app.
  useEffect(() => {
    if (!authState.authReady || authState.isAnonymous) return;
    const stop = startActivityTracking();
    return () => {
      stop();
      stopActivityTracking();
    };
  }, [authState.authReady, authState.isAnonymous, authState.uid]);

  const isNewlyCreatedAccount = () => {
    try {
      const u = authState.user;
      if (!u) return false;
      const meta = u.metadata || {};
      const creation = meta.creationTime || null;
      const last = meta.lastSignInTime || null;
      if (!creation) return false;
      // If creation == lastSignInTime it's the first sign-in.
      if (creation && last && creation === last) return true;
      // Also treat very-recent creation (within 5 minutes) as new.
      const createdAt = new Date(creation).getTime();
      if (Date.now() - createdAt < 5 * 60 * 1000) return true;
      return false;
    } catch { return false; }
  };

  const advance = () => setQueue(q => q.slice(1));

  const handleAuthSuccess = async (user, info = {}) => {
    // BUGFIX (logic gap found on review): this function used to branch on
    // info.linked (set by AuthModal from its isUpgrade prop) to decide
    // "genuine upgrade, keep local data" vs "fresh sign-in, clear it".
    // That distinction is DEAD — the anonymous-session flow this was
    // built for no longer runs anywhere in the app (loginAnonymously() is
    // defined but never called; both isUpgrade={...} call sites are gated
    // behind conditions — showUpgradeModal, authState.user?.isAnonymous —
    // that can now never be true). info.linked was therefore permanently
    // false for every real auth event, which meant EVERY plain Login (not
    // just Register) fell into "clear everything," wiping a genuinely
    // RETURNING user's own local data on every single login.
    //
    // Fix: await accountLifecycle.js's syncLocalDataOnAuth() before doing
    // anything else in this function. This function reads
    // getAccountRole() and calls buildQueue() right after — both need to
    // see local storage in its FINAL state for this user (fully cleared,
    // for a brand-new account), not whatever was there before Firebase's
    // own onAuthChange listener (which independently calls this same
    // function) gets around to clearing it. useFirebaseAuth.js's
    // onAuthChange fires for the same auth event and will call
    // syncLocalDataOnAuth() too — syncLocalDataOnAuth() itself now
    // de-duplicates concurrent calls for the same uid via an in-flight
    // promise cache (see accountLifecycle.js), so calling it from both
    // places runs the actual clear/push work exactly once, with both
    // callers correctly awaiting its completion — not a redundant
    // parallel sweep, and not an unguarded race either.
    await syncLocalDataOnAuth(user);

    // BUGFIX (profile setup reappears / Finish Setup doesn't stick):
    // this function used to call buildQueue() right after
    // syncLocalDataOnAuth(), without ever waiting for the Firestore ->
    // local profile pull (that only happens inside startFirebaseSync() ->
    // hydrateProfileFromFirestore()). useFirebaseAuth.js's onAuthChange
    // listener does this correctly and does not flip authReady until
    // after that pull — but AuthModal's onSuccess (this function) fires
    // as its own separate path and got there first, running buildQueue()
    // against an empty/stale local profile on any device where local
    // storage wasn't already warm (new device, re-login after sign-out,
    // faculty accounts included since this branch doesn't check role).
    // That queued 'profile' and showed ProfileSetupModal even for
    // already-complete accounts. Then, once the OTHER path's
    // startFirebaseSync() eventually resolved in the background and
    // flipped authReady, App.jsx's authReady-gated effect re-ran
    // buildQueue() again and re-queued 'profile' a second time — which is
    // also why clicking "Finish Setup" (advance()) didn't stick: the
    // background effect clobbered the queue right after. Awaiting the
    // same startFirebaseSync() call here (idempotent/no-op if the other
    // path already started it) closes both gaps.
    if (!user.isAnonymous) {
      await startFirebaseSync(user.uid, {});
    }

    // A returning account may have a locally-set accountRole flag (e.g.
    // chosen at Role Select on a previous visit to this device) that
    // hasn't been backed up to the server yet — back-fill it. A brand-new
    // account has nothing here (the await above guarantees the clear has
    // already happened), so getAccountRole() returns null and this is a
    // no-op for it.
    if (!user.isAnonymous) {
      const localRole = getAccountRole();
      if (localRole) persistAccountRoleToServer(localRole);
    }

    // BUGFIX (millisecond profile-modal flash): this function used to
    // finish by calling buildQueue()/setQueue() itself, right here. That
    // made it a SECOND, independent caller of buildQueue() for the exact
    // same auth event — racing against useFirebaseAuth.js's own
    // authReady-gated chain (onAuthChange -> syncLocalDataOnAuth ->
    // startFirebaseSync -> setAuthReady(true)), which App.jsx's
    // uid-keyed effect (see the big comment above that effect) is
    // listening to and treats as the single source of truth for when to
    // rebuild the queue. AuthModal calls onSuccess (this function)
    // fire-and-forget, un-awaited — so while THIS function's own
    // syncLocalDataOnAuth/startFirebaseSync calls above were resolving,
    // useFirebaseAuth's onAuthChange had already fired setUser()
    // synchronously (uid changes immediately), which can flip authReady
    // true and trigger the App.jsx effect's OWN buildQueue() call before
    // this function's buildQueue() below even started. Two uncoordinated
    // buildQueue() calls for one sign-in meant whichever settled first
    // (against whatever profile state existed at that exact instant) won
    // — a narrow but real window where the stale one flashed
    // ProfileSetupModal for a frame before the other corrected it.
    //
    // Fix: don't call buildQueue()/setQueue() here at all. The
    // syncLocalDataOnAuth() and startFirebaseSync() calls above are
    // idempotent/de-duplicated per-uid (see their own comments), so
    // calling them from both this function and useFirebaseAuth's
    // onAuthChange is safe and just avoids doing the work twice — but the
    // queue itself should only ever be written by ONE place. That place
    // is App.jsx's authReady-gated effect (keyed on authState.uid), which
    // fires automatically once useFirebaseAuth's chain flips authReady to
    // true after this same sign-in. No manual rebuild needed here.
    //
    // Exception: Role Select's onSelect handler still calls
    // buildQueue()/setQueue() directly (see below) — that's a genuinely
    // separate, later event (a role being picked), not a duplicate of
    // this same sign-in, so it doesn't have this race.
  };

  return (
    <ThemeProvider>
      <ProviderLangProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {queueBuilt && queue.length === 0 && (
          <ProviderPostSignupRedirect queueBuilt={queueBuilt} queueEmpty={queue.length === 0} />
        )}
        {current === 'role-select' && (
          <RoleSelectScreen
            onSelect={() => {
              // Re-derive rather than a plain advance(): picking a role
              // changes which steps come next (teacher needs
              // 'faculty-verify' before 'profile', student doesn't), so
              // just rebuild the whole queue the same way the initial
              // mount does.
              buildQueue(authState.isAnonymous, window.location.pathname).then(setQueue);
            }}
          />
        )}
        {/* RESTRUCTURE: 'auth' is now the FIRST step for anyone without a
            real account, generic — no pre-decided role/variant needed.
            - Login: role-agnostic. buildQueue's server-side lookup (above)
              correctly routes an existing student OR teacher account
              afterward, regardless of which "variant" this modal rendered
              as, since it never assumes one.
            - Register: creates the account with NO role yet (AuthModal's
              register path no longer forces isFaculty=true/false — role
              simply isn't set until Role Select, right after this).
              handleAuthSuccess below re-derives the queue once signed in,
              which naturally lands on 'role-select' next for a fresh
              account with nothing recorded server-side. */}
        {current === 'auth' && (
          <AuthModal
            mode="login"
            queueMode={true}
            // isUpgrade must reflect whether there's an existing anonymous
            // session to preserve. If the current user is anonymous, this
            // uses linkWithPopup/linkWithCredential (keeps the SAME uid,
            // so all local IndexedDB + already-synced Firestore data stays
            // attached automatically). If there's no user at all yet, this
            // is a plain new sign-in instead.
            isUpgrade={!!authState.user?.isAnonymous}
            // No onClose — login/register is mandatory here, matching the
            // 'profile' step below. AuthModal only renders the X button and
            // the "Skip for now" link when onClose is truthy, so omitting
            // it removes both without touching AuthModal.jsx.
            onSuccess={handleAuthSuccess}
          />
        )}
        {/* faculty-verify holding screen removed from the onboarding
            queue — profile setup (name/title/dept) proceeds right away,
            unconditionally, regardless of Blue Tick status. The
            verification gate lives at the route level instead
            (RequireFaculty.jsx blocks /faculty/* until an Admin approves
            the account), not as a blocking step in this queue. */}
        {current === 'faculty-profile' && (
          <FacultyProfileSetupModal
            onSave={() => {
              buildQueue(authState.isAnonymous, window.location.pathname).then(setQueue);
            }}
          />
        )}
        {current === 'profile' && getAccountRole() !== 'teacher' && (
          <ProfileSetupModal
            isOpen={true}
            // No dismiss path — this step cannot be skipped without saving,
            // by design (see buildQueue comment).
            onClose={() => {}}
            mandatory
            minimal={isNewlyCreatedAccount() && !isProfileComplete(getProfile())}
            onSave={(formData) => {
              const result = validateProfileForSave(formData);
              if (!result.ok) {
                const msgs = Object.values(result.errors).join('\n');
                alertDialog('Profile cannot be saved:\n' + msgs);
                return;
              }
              // BUGFIX (stale profile prefill, part 2/2 — see
              // isProfileStaleForUid in store.js): tag the saved profile
              // with the uid that actually saved it, so a later fresh
              // account on this same device/browser can tell "leftover
              // data from someone else" apart from "my own real profile"
              // instead of blindly trusting whatever's in localStorage.
              const savedProfile = tagProfileOwner(normalizeProfileForSave(formData), auth.currentUser?.uid);
              store.set('profile', savedProfile);
              // Phase 5: 'profile' is excluded from the generic per-key
              // sync loop (see EXCLUDED_KEYS in firebaseSync.js) — it now
              // lives at its own students/{dept}/{batch}/{uid} path, so it
              // must be pushed explicitly here. This is the first-run
              // onboarding save path, so getting this right matters even
              // more than the Settings-page edit path (Profile.jsx) —
              // without this, a brand-new account's profile would never
              // reach Firestore at all. Fire-and-forget: local save +
              // queue advance already happened, a slow/failed push
              // shouldn't block onboarding.
              if (auth.currentUser?.uid && !auth.currentUser.isAnonymous) {
                pushProfile(auth.currentUser.uid, savedProfile).catch(err => {
                  console.warn('[KUETx Onboarding] pushProfile failed:', err.message);
                });
              }
              // Fan the directory-relevant fields (name/roll/dept/
              // bloodGroup) out to bloodDonors/{uid} so the Founder's
              // Blood Bank search can find this student — the personal
              // profile store above is owner-read-only in Firestore and
              // isn't queryable across students. Fire-and-forget: never
              // block onboarding on this, and a failure here shouldn't
              // stop the local save that already succeeded.
              if (auth.currentUser?.uid && !auth.currentUser.isAnonymous) {
                syncBloodDonorEntry(auth.currentUser.uid, formData).catch(() => {});
              }
              // Record which page-load onboarding finished on, so
              // ProfileCompleteReminder can tell "still this same load"
              // apart from "app reopened later" and never fire in the
              // same session as onboarding itself.
              try { store.set('kuetxProfileFinishedAtLoad', window.__kuetxLoadCounter); } catch {}
              advance();
            }}
            // BUGFIX (stale profile prefill): don't hand the raw stored
            // profile straight to the form. If it looks like leftover
            // data from a DIFFERENT account (tagged with a different uid,
            // and never actually completed) rather than this account's
            // own real profile, prefill with a clean DEFAULT_PROFILE
            // instead — a brand-new account should never see someone
            // else's half-typed name/roll/dept/hall pre-filled in. An
            // already-complete profile, or one genuinely tagged as this
            // uid's own, is left untouched exactly as before.
            initialProfile={
              isProfileStaleForUid(getProfile(), auth.currentUser?.uid)
                ? DEFAULT_PROFILE
                : getProfile()
            }
          />
        )}
        {current === 'profile' && getAccountRole() === 'teacher' && (
          // Dead branch kept only as a defensive fallback — buildQueue()
          // no longer ever pushes 'profile' for a teacher account (see the
          // BUGFIX comment there), so this should never actually render.
          // If it somehow does (e.g. stale queue state), don't trap the
          // user behind a broken step: just advance past it immediately.
          (() => { advance(); return null; })()
        )}
        {/* BUGFIX: Layout (which contains <Routes>/<Dashboard>) used to
            render unconditionally here, regardless of `current` — so the
            Dashboard was always fully mounted and rendering underneath
            the role-select/auth overlays, just visually covered by them.
            That's what "role select korar age dashboard render hoye jay"
            was about: the opaque-background fix made it invisible, but it
            was still there, still running its own effects/queries.
            Now Layout doesn't mount at all until the queue has been built
            AND the person isn't sitting on any of the mandatory pre-
            dashboard gates — role-select, auth, faculty-verify, or
            profile. Once ALL of those are cleared, Layout mounts.
            BUGFIX: 'faculty-verify' and 'profile' used to be excluded
            from this list on the theory that they're "per-account
            nudges" rather than a genuine "no dashboard yet" state — but
            that's wrong in practice: FacultyVerifyHoldingScreen (and
            ProfileSetupModal, mandatory mode) use a translucent
            rgba(0,0,0,0.5) overlay, not an opaque one like role-select/
            auth, so the half-set-up Dashboard was genuinely visible
            (dimmed) behind them the whole time someone was verifying
            their email or filling in their profile — plain background
            should stay solid white/var(--bg) the entire way through
            onboarding, only turning into the real Dashboard once every
            mandatory step is actually done. */}
        {(!queueBuilt || current === 'role-select' || current === 'auth' || current === 'faculty-profile' || current === 'profile') ? (
          // Same visual shape as index.html's pre-React #app-shell-skeleton
          // (sidebar + topbar bars, no text) — kept consistent so there's
          // no visible "swap" between the pre-React skeleton and this one;
          // it just looks like a single continuous app shell the whole
          // time, right up until Layout's first real render replaces it.
          // Text/spinner deliberately omitted for the same reason: a
          // "Loading…" label here is the exact thing that made this feel
          // like a stuck loading screen rather than an app that's already
          // open.
          !queueBuilt ? (
            verifyingProfile ? (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 1, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 20, background: 'var(--bg)',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'linear-gradient(135deg, var(--primary, #16a34a), var(--primary-dark, #15803d))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px -8px rgba(22, 163, 74, 0.5)',
                  animation: 'kuetxPulse 1.8s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'inherit' }}>K</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Setting up your account</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Just a moment…</div>
                </div>
                <div style={{ width: 160, height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    width: '40%', height: '100%', borderRadius: 999,
                    background: 'var(--primary, #16a34a)',
                    animation: 'kuetxIndeterminate 1.2s ease-in-out infinite',
                  }} />
                </div>
                <style>{`
                  @keyframes kuetxPulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.06); opacity: 0.9; }
                  }
                  @keyframes kuetxIndeterminate {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                  }
                `}</style>
              </div>
            ) : (
              <div style={{ position: 'fixed', inset: 0, zIndex: 1, display: 'flex', background: 'var(--bg)' }}>
                <div style={{ width: 192, flexShrink: 0, height: '100vh', background: 'var(--surface)', borderRight: '1px solid var(--border)' }} className="hidden md:block" />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 56, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} />
                </div>
              </div>
            )
          ) : (
            // role-select / auth / faculty-profile / profile: a genuine
            // step the person needs to complete, not a loading wait — a
            // blank shell with no content underneath is correct here,
            // AuthModal/RoleSelectScreen/etc render their own UI on top.
            <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'var(--bg)' }} />
          )
        ) : (
          <Layout authState={authState} onboardingActive={!!current} />
        )}
        {/* Nudges anyone who used "Finish now, add rest later" to fill in the
            full profile — but only from a later session, never right after
            onboarding (see ProfileCompleteReminder.jsx's own session guard). */}
        {authState.authReady && queue.length === 0 && <ProfileCompleteReminder />}
        {/* Global auth modal (triggered from anywhere via window.__kuetxShowAuth) */}
        {showAuthModal && (
          <AuthModal
            mode="login"
            onClose={() => setShowAuthModal(false)}
            onSuccess={async (user) => {
              setShowAuthModal(false);
              if (!user.isAnonymous) {
                await authState.onAccountUpgraded(user);
              }
            }}
          />
        )}
      </BrowserRouter>
      </ProviderLangProvider>
    </ThemeProvider>
  );
}