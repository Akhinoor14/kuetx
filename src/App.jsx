import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { usePageTracker } from './hooks/usePageTracker';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import AnnouncementModal from './components/DriveAnnouncementModal';
import CommunityHiringModal from './components/CommunityHiringModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { BottomNav, useIsMobileNav } from './components/BottomNav';
import GlobalToasts from './components/GlobalToasts';
import FloatingUploadBar from './components/FloatingUploadBar';
import NoticeToast from './components/NoticeToast';
import PushPermissionBanner from './components/PushPermissionBanner';
import BackupReminderGate from './components/BackupReminderGate';
import ProfileCompleteReminder from './components/ProfileCompleteReminder';
import AuthModal from './components/AuthModal';
import ProfileSetupModal from './components/ProfileSetupModal';
import RequireCR from './components/RequireCR';
import RequireStaff from './components/RequireStaff';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import DataSafeToast from './components/DataSafeToast';
import ClassJoinIntro from './components/ClassJoinIntro';
import RoleSelectScreen from './components/RoleSelectScreen';
import FacultyProfileSetupModal from './components/FacultyProfileSetupModal';
import { getAccountRole, setAccountRole, fetchServerAccountRole, persistAccountRoleToServer } from './lib/accountRole';
import { getFacultyDoc, markFacultyVerifiedIfEmailConfirmed, isFacultyProfileComplete } from './lib/facultySync';
import { syncBloodDonorEntry } from './lib/bloodDonorSync';
import { store, getProfile, isProfileComplete, DEFAULT_PROFILE, normalizeProfileForSave, validateProfileForSave, ensureDBReady, tagProfileOwner, isProfileStaleForUid } from './store/store';
import { getGroupId } from './lib/groupUtils';
import { syncOwnVerification, joinGroup } from './lib/groupSync';
import { claimRoll } from './lib/rollOwnership';
import { auth } from './lib/firebase';
import { notify } from './lib/notify';

// Pages
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Courses from './pages/Courses';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import Results from './pages/Results';
import Schedule from './pages/Schedule';
import Teachers from './pages/Teachers';
import Diary from './pages/Diary';
import Assignments from './pages/Assignments';
import QuestionBank from './pages/QuestionBank';
import QuestionBankViewer from './pages/QuestionBankViewer';
import QuestionBankSolutions from './pages/QuestionBankSolutions';
import SelfStudy from './pages/SelfStudy';
import Namaz from './pages/Namaz';
import Money from './pages/Money';
import Calculators from './pages/Calculators';
import Alerts from './pages/Alerts';
import Notice from './pages/Notice';
import Settings from './pages/Settings';
import { Notes } from './pages/Notes';
import Clubs from './pages/Clubs';
import About from './pages/About';
import ClassManagement from './pages/ClassManagement';
import CTQuizPlanning from './pages/CTQuizPlanning';
import ClassRoster from './pages/ClassRoster';
import Classmates from './pages/Classmates';
// AdminDashboard is no longer routed directly — it's rendered inside
// TeamDashboard via AdminEntryPoint. See /team route below.
import TeamDashboard from './pages/TeamDashboard';
import FounderBatchSettings from './pages/FounderBatchSettings';
import { Tours, Projects, Syllabus, TimeTracker, Tuition, Reports } from './pages/Extras';
import SubgroupHub from './components/nav-system/SubgroupHub';
import CRHub from './components/nav-system/CRHub';
import AdminHub from './components/nav-system/AdminHub';
import RequireFaculty from './components/RequireFaculty';
import { NAV_FACULTY } from './nav-faculty';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyProfile from './pages/faculty/FacultyProfile';
import FacultyClasses from './pages/faculty/FacultyClasses';
import FacultyAllCR from './pages/faculty/FacultyAllCR';
import FacultyClassDetail from './pages/faculty/FacultyClassDetail';
import FacultySchedule from './pages/faculty/FacultySchedule';
import FacultyMeetings from './pages/faculty/FacultyMeetings';
import FacultyNoticeBroadcast from './pages/faculty/FacultyNoticeBroadcast';
import FacultyContact from './pages/faculty/FacultyContact';

function Layout({ authState, onboardingActive }) {
  usePageTracker();
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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
          <Routes>
            {/* BUGFIX: '/' used to unconditionally render the student
                Dashboard for every signed-in account, teacher or not — so
                a faculty account, even a fully verified one, landed on
                the student home page after onboarding/login with no way
                to reach /faculty except typing the URL directly. Now
                routes by accountRole, same source of truth buildQueue()
                uses. See BUGFIX_ROLE_SELECT_AND_FACULTY_ROUTING.md. */}
            <Route path="/" element={getAccountRole() === 'teacher' ? <Navigate to="/faculty" replace /> : <Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/marks" element={<Marks />} />
            <Route path="/results" element={<Results />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/syllabus" element={<Syllabus />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/question-bank" element={<QuestionBank />} />
            <Route path="/question-bank/view" element={<QuestionBankViewer />} />
            <Route path="/solutions" element={<QuestionBankSolutions />} />
            <Route path="/self-study/academic" element={<SelfStudy />} />
            <Route path="/self-study/deep-focus" element={<SelfStudy />} />
            <Route path="/time" element={<TimeTracker />} />
            <Route path="/namaz" element={<Namaz />} />
            <Route path="/money" element={<Money />} />
            <Route path="/tuition" element={<Tuition />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/calculators" element={<Navigate to="/marks" replace />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/notice" element={<Notice />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="/class-management" element={<RequireCR><ClassManagement /></RequireCR>} />
            <Route path="/ct-quiz-planning" element={<RequireCR><CTQuizPlanning /></RequireCR>} />
            <Route path="/class-roster" element={<RequireCR><ClassRoster /></RequireCR>} />
            <Route path="/classmates" element={<Classmates />} />
            <Route path="/tools" element={<SubgroupHub group="Tools" />} />
            {/* Class Rep hub is CR-only content, but doesn't need a hard page
                gate here — non-CR users simply never see a link to it (see
                nav.js requiresCR + modeFilter). RequireCR stays on the two
                actual CR tool routes below, which is what needs real
                protection against direct URL access. */}
            <Route path="/class-rep" element={<SubgroupHub group="Class Rep" />} />
            <Route path="/academic-core" element={<SubgroupHub group="Academics" subgroup="Academic Core" />} />
            <Route path="/daily-academics" element={<SubgroupHub group="Academics" subgroup="Daily Academics" />} />
            <Route path="/campus-life" element={<SubgroupHub group="Campus Life" subgroup="Campus Life" />} />
            <Route path="/self-study" element={<SubgroupHub group="Campus Life" subgroup="Self Study" />} />

            {/* Combined bottom-nav hub page. Daily Life doesn't exist as
                a separate NAV group anymore (folded into Campus Life's
                own "Campus Life" subgroup a while back) — the old
                { group: 'Daily Life' } lookup here silently resolved to
                nothing every render, dead weight kept alive by accident.
                Scoped subgroup: 'Campus Life' here for the same reason
                as the /campus-life route above — without it this page
                pulled in Self Study's items too. */}
            <Route
              path="/campus"
              element={
                <SubgroupHub
                  pageTitle="Campus"
                  sections={[{ group: 'Campus Life', subgroup: 'Campus Life' }]}
                />
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
                links bookmarked. */}
            <Route path="/faculty/more" element={<RequireFaculty><SubgroupHub navSource={NAV_FACULTY} group="More" pageTitle="More" /></RequireFaculty>} />
            <Route path="/faculty/resources" element={<Navigate to="/faculty/more" replace />} />
            <Route path="/faculty/tools" element={<Navigate to="/faculty/more" replace />} />
          </Routes>
        </div>
        {location.pathname !== '/about' && !isQuestionBankViewer && !isMobileNav && <Footer />}
        {!isQuestionBankViewer && <PWAInstallPrompt />}
        <PWAUpdatePrompt />
        {!isQuestionBankViewer && <BottomNav />}
        <GlobalToasts />
        <FloatingUploadBar />
        {!onboardingActive && <NoticeToast />}
        <DataSafeToast suppress={onboardingActive} />
        <ClassJoinIntro />

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
function shouldShowAnnouncement() {
  try {
    // Brand-new install: don't pile this on top of mode/auth/profile setup
    // in the very first session — record it as "seen" silently and show it
    // starting from the user's next visit instead.
    const lastShown = store.get('announcementV2LastShown');
    if (!lastShown) {
      store.set('announcementV2LastShown', new Date().toISOString());
      return false;
    }
    const showCount = store.get('announcementV2ShowCount') || 0;
    const interval = showCount >= 3 ? 604800000 : 259200000;
    return Date.now() - new Date(lastShown).getTime() >= interval;
  } catch { return false; }
}

function shouldShowBackup() {
  try {
    const autoBackup = store.get('autoBackup') ?? true;
    if (!autoBackup) return false;
    const last = store.get('lastBackupTime');
    if (!last) { store.set('lastBackupTime', new Date().toISOString()); return false; }
    const elapsedDays = (Date.now() - new Date(last)) / 86400000;
    if (elapsedDays < 7) return false;
    if (store.get('backupReminderSnoozed') === new Date().toDateString()) return false;
    return true;
  } catch { return false; }
}

function shouldShowCommunityHiring() {
  try {
    // BUGFIX: this used to defer only until the "next visit" — with no
    // minimum time gap, so reopening the app minutes after finishing
    // onboarding (very common for a PWA — switching tabs, closing/
    // reopening) would show this immediately, right on top of whatever
    // else was already queued. Now requires the same kind of real elapsed
    // time as the other two post-onboarding popups (announcement/backup),
    // not just "not the very first session."
    const seen = store.get('communityHiringPopupShown');
    if (seen === undefined || seen === null) {
      // First time this is ever checked — record "now" as the reference
      // point and defer to a later session, same first-session courtesy
      // as shouldShowAnnouncement/shouldShowBackup.
      store.set('communityHiringPopupShown', false);
      store.set('communityHiringFirstEligibleAt', new Date().toISOString());
      return false;
    }
    if (seen === true) return false; // already shown once, never again
    const firstEligibleAt = store.get('communityHiringFirstEligibleAt');
    if (!firstEligibleAt) {
      // Pre-fix installs won't have this timestamp yet — set it now and
      // defer one more session rather than firing immediately.
      store.set('communityHiringFirstEligibleAt', new Date().toISOString());
      return false;
    }
    const elapsedDays = (Date.now() - new Date(firstEligibleAt).getTime()) / 86400000;
    return elapsedDays >= 2; // same-day reopen no longer triggers it
  } catch { return false; }
}

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
async function buildQueue(isAnonymous) {
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
  if (isAnonymous || !auth.currentUser?.uid) {
    q.push('auth');
    return q;
  }

  if (!accountRole) {
    // Not yet decided locally, but this is a real (non-anonymous) signed-in
    // account — check server-side facts before ever showing role-select.
    // Checked in order:
    //   1. users/{uid}.role — the explicit, authoritative record, written
    //      once at Role Select for EITHER role (see accountRole.js).
    //   2. faculty/{uid} doc existing — a secondary signal that predates
    //      (1) and still catches any account that somehow has a faculty
    //      doc but never got a users/{uid}.role write (e.g. it was
    //      created by an earlier build of this app, before role
    //      persistence existed at all).
    //   3. Otherwise: genuinely nothing recorded yet — this is a brand-new
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
      }
    }
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
  } else {
    // Profile setup is mandatory before anything else — a half-filled
    // profile (missing roll/dept/session) is the root cause of Classmates
    // mismatch, roll-verification, and term-roadmap issues reported by
    // users. This step has no skip; it only advances via ProfileSetupModal's
    // onSave. The KUET email verify sub-step inside it keeps its own skip.
    if (!isProfileComplete(getProfile())) q.push('profile');
  }

  // BUGFIX (real, ongoing — not just first-session): staggering each
  // popup's OWN delay (2/3-9/7 days) only prevented them from all becoming
  // eligible on the very first later session. It did nothing to stop them
  // recurring together — once a user has been active long enough, all
  // three conditions independently go true on MANY sessions afterward,
  // and every one of those sessions queued all three back-to-back: dismiss
  // announcement, community-hiring appears immediately, dismiss that,
  // backup appears immediately. That back-to-back stacking — not the
  // first-time timing — is what "popup e onek shomossa" was about.
  //
  // Fix: only ever queue ONE of these three non-essential popups per
  // session, in a fixed priority order. The others stay eligible and will
  // simply be reconsidered next session instead of firing right after each
  // other in the same one.
  if (shouldShowAnnouncement()) {
    q.push('announcement');
  } else if (shouldShowCommunityHiring()) {
    q.push('communityHiring');
  } else if (shouldShowBackup()) {
    q.push('backup');
  }
  return q;
}

export default function App() {
  const authState = useFirebaseAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueBuilt, setQueueBuilt] = useState(false);
  const current = queue[0] || null;

  // Complete a KUET email verification link, if the current URL is one —
  // runs once at boot so clicking the emailed link works even in a fresh
  // tab/device that never opened the verify widget itself. No-op otherwise.
  useEffect(() => {
    let cancelled = false;

    async function run(emailOverride = null) {
      const { completeKuetVerificationLink } = await import('./lib/kuetEmailVerify');
      const result = await completeKuetVerificationLink(window.location.href, emailOverride);
      if (cancelled) return;

      if (result.status === 'success') {
        notify('KUET email verified! Your blue tick will appear next to your name.', 'success');
        window.dispatchEvent(new CustomEvent('kuetx:kuet-email-verified', { detail: { roll: result.roll } }));
        const gid = getGroupId(getProfile());
        syncOwnVerification(gid, auth.currentUser?.uid).catch((e) => console.warn('[App] syncOwnVerification failed', e));
        return;
      }
      if (result.status === 'error') {
        console.warn('[KUETx] KUET email verify link:', result.message);
        notify(result.message, 'error', 6000);
      }
      // 'not-a-link' and 'needs-email' → nothing to do.
    }

    run();
    return () => { cancelled = true; };
  }, []);

  // BUGFIX: faculty magic-link verification previously only ran INSIDE
  // FacultyVerifyHoldingScreen, which only mounts when the onboarding
  // queue's current step happens to be 'faculty-verify' — which itself
  // only gets pushed when accountRole (a localStorage flag) is already
  // 'teacher' on THIS browser. A teacher who opened the emailed link in a
  // new tab, a different browser, their phone's mail app, or after
  // closing/refreshing the original signup tab would land on a page where
  // that condition was never true, so isFacultyVerifyLink()/
  // completeFacultyVerificationLink() never ran at all — the click did
  // nothing, verifiedFacultyEmails/{email} never got written, and
  // faculty/{uid}.verifiedAt stayed null forever, even though the person
  // genuinely clicked the right link. This mirrors the student
  // KUET-email-verify handling above: a boot-level effect, independent of
  // the onboarding queue, so the link works regardless of which tab/device/
  // queue-state it's opened from. See BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md.
  useEffect(() => {
    let cancelled = false;

    async function run(emailOverride = null) {
      const { isFacultyVerifyLink, completeFacultyVerificationLink } = await import('./lib/facultyEmailVerify');
      if (!emailOverride && !isFacultyVerifyLink(window.location.href)) return;
      const result = await completeFacultyVerificationLink(window.location.href, emailOverride);
      if (cancelled) return;

      if (result.status === 'success') {
        setAccountRole('teacher');
        const uid = auth.currentUser?.uid;
        if (uid) {
          try {
            await markFacultyVerifiedIfEmailConfirmed(uid, result.email);
          } catch (e) {
            console.warn('[App] markFacultyVerifiedIfEmailConfirmed failed', e);
            notify('Verification succeeded but could not be saved. Please reopen the link or contact the developer.', 'error', 6000);
            return;
          }
        }
        notify('Faculty email verified! You now have full access.', 'success');
        return;
      }
      if (result.status === 'error') {
        console.warn('[KUETx] Faculty email verify link:', result.message);
        notify(result.message, 'error', 6000);
      }
      // 'not-a-link' and 'needs-email' → nothing to do.
    }

    run();
    return () => { cancelled = true; };
  }, []);

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
  useEffect(() => {
    if (!authState.authReady || queueBuilt) return;
    let cancelled = false;
    ensureDBReady().finally(() => {
      if (cancelled) return;
      buildQueue(authState.isAnonymous).then((q) => {
        if (cancelled) return;
        setQueue(q);
        setQueueBuilt(true);
      });
    });
    return () => { cancelled = true; };
  }, [authState.authReady, authState.isAnonymous, queueBuilt]);

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
  // joinGroup() — i.e. it can never show up in Classmates or write into
  // shared class data under someone else's roll. Every personal-only
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
        return; // do NOT joinGroup — this account doesn't own this roll
      }

      joinGroup(gid, profile).catch((e) => console.warn('[App] auto joinGroup failed', e));
    };
    tryJoin();
    window.addEventListener('kuetx:store-updated', tryJoin);
    return () => {
      cancelled = true;
      window.removeEventListener('kuetx:store-updated', tryJoin);
    };
  }, [authState.authReady, authState.isAnonymous]);

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
    if (!user.isAnonymous) {
      // onAccountUpgraded() calls pushAllToFirestore() unconditionally,
      // which is correct both for a true link (brand-new real account,
      // nothing to conflict with) and for the credential-already-in-use
      // fallback (existing account — local anonymous-session data merges
      // in via last-write-wins per document, same as any other
      // multi-device sync in this app). Faculty accounts don't have any
      // local IndexedDB student data to push, so this is a harmless no-op
      // for them beyond marking the account non-anonymous.
      await authState.onAccountUpgraded(user);
    }

    // BUGFIX: RoleSelectScreen's persistAccountRoleToServer() call happens
    // BEFORE this — at that moment the person is still anonymous (or has
    // no account at all yet) for the common new-visitor flow
    // (role-select -> auth -> ...), so that write silently no-ops (no
    // uid to attach it to). This is the first point where a real,
    // non-anonymous auth.currentUser genuinely exists, so back-fill the
    // server record here. persistAccountRoleToServer() is safe to call
    // redundantly — it's a no-op once users/{uid}.role already exists,
    // per the Firestore rules' "set once" enforcement.
    if (!user.isAnonymous) {
      const localRole = getAccountRole();
      if (localRole) persistAccountRoleToServer(localRole);
    }

    // RESTRUCTURE: role is no longer known at this point for a fresh
    // Register (Role Select now happens AFTER account creation, not
    // before) — the old hand-rolled splicing here assumed getAccountRole()
    // was already 'teacher' or 'student', which is only true for Login,
    // not Register, post-restructure. buildQueue() already contains every
    // rule needed (server-role lookup, faculty-doc fallback, role-select
    // if genuinely nothing recorded, faculty-verify, profile) — simplest
    // and most robust to just re-run it rather than duplicate that logic
    // here by hand.
    const q = await buildQueue(user.isAnonymous);
    setQueue(q);
  };

  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {current === 'role-select' && (
          <RoleSelectScreen
            onSelect={() => {
              // Re-derive rather than a plain advance(): picking a role
              // changes which steps come next (teacher needs
              // 'faculty-verify' before 'profile', student doesn't), so
              // just rebuild the whole queue the same way the initial
              // mount does.
              buildQueue(authState.isAnonymous).then(setQueue);
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
              buildQueue(authState.isAnonymous).then(setQueue);
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
                alert('Profile cannot be saved:\n' + msgs);
                return;
              }
              // BUGFIX (stale profile prefill, part 2/2 — see
              // isProfileStaleForUid in store.js): tag the saved profile
              // with the uid that actually saved it, so a later fresh
              // account on this same device/browser can tell "leftover
              // data from someone else" apart from "my own real profile"
              // instead of blindly trusting whatever's in localStorage.
              store.set('profile', tagProfileOwner(normalizeProfileForSave(formData), auth.currentUser?.uid));
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
        {current === 'announcement' && (
          <AnnouncementModal open={true} onClose={advance} />
        )}
        {current === 'communityHiring' && (
          <CommunityHiringModal
            open={true}
            onClose={() => {
              try { store.set('communityHiringPopupShown', true); } catch {}
              advance();
            }}
          />
        )}
        {current === 'backup' && (
          <BackupReminderGate open={true} onClose={advance} />
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
          <div style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--bg)', zIndex: 1,
          }}>
            {!queueBuilt && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
            )}
          </div>
        ) : (
          <Layout authState={authState} onboardingActive={!!current} />
        )}
        {/* VerifyReminderPopup component was removed entirely — this was
            just a nag reminder to complete the (optional, non-blocking)
            KUET-email Tier-1 verification; that verification itself
            (KuetEmailVerifyWidget, inside ProfileSetupModal) is unaffected
            and still fully self-service. */}
        {authState.authReady && !authState.isAnonymous && queue.length === 0 && <PushPermissionBanner />}
        {/* Nudges anyone who used "Finish now, add rest later" to fill in the
            full profile — but only from a later session, never right after
            onboarding (see ProfileCompleteReminder.jsx's own session guard). */}
        {authState.authReady && queue.length === 0 && <ProfileCompleteReminder />}
        {/* BUGFIX (modal overlap): verifyEmailPrompt/facultyVerifyPrompt are
            set by a boot-time effect that runs independently of the
            sequential onboarding `queue` — it never checked `current`
            before showing, so a cross-device/cross-tab KUET-email-link
            click could pop this modal directly on top of a mandatory,
            un-dismissible step (most visibly ProfileSetupModal), with no
            z-index/mutual-exclusion between them. The Firestore write +
            signOut in completeKuetVerificationLink() already succeeded by
            this point regardless — only the *prompt* itself needs to wait
            its turn, not the verification. So: hold the prompt in state as
            before (still captured immediately, nothing about detection or
            the underlying link-completion logic changes), but only render
            it once `queue.length === 0`, i.e. once every mandatory
            pre-dashboard gate has actually cleared — same rule
            VerifyReminderPopup already uses a few lines up. If the queue
            is still non-empty when the prompt is captured, it simply waits
            here rendered-but-gated until the queue drains, then appears on
            its own, never layered on top of another modal. */}
        {/* KuetVerifyEmailConfirmModal / FacultyVerifyEmailConfirmModal
            removed from render — this was a standalone "you just verified!"
            confirm popup, redundant with the inline confirmation
            KuetEmailVerifyWidget (inside ProfileSetupModal) and the
            faculty magic-link completion screen already show at the
            moment verification succeeds. Removing this popup does NOT
            disable verification itself — sendKuetVerificationLink /
            completeKuetVerificationLink (student) and the faculty email
            magic-link flow are both still fully active; only this one
            extra confirmation surface was cut. The boot-time
            link-detection effects above are left in place but are inert:
            they only ever set verifyEmailPrompt/facultyVerifyPrompt,
            which nothing renders anymore now that this popup is gone. */}
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
    </ThemeProvider>
  );
}