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
import BackupReminderGate from './components/BackupReminderGate';
import VerifyReminderPopup from './components/VerifyReminderPopup';
import ProfileCompleteReminder from './components/ProfileCompleteReminder';
import AuthModal from './components/AuthModal';
import ModeSelectModal from './components/ModeSelectModal';
import ProfileSetupModal from './components/ProfileSetupModal';
import RequireCR from './components/RequireCR';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import DataSafeToast from './components/DataSafeToast';
import ClassJoinIntro from './components/ClassJoinIntro';
import KuetVerifyEmailConfirmModal from './components/KuetVerifyEmailConfirmModal';
import { isModeChosen, markModeChosen } from './lib/modeFilter';
import { store, getProfile, isProfileComplete, DEFAULT_PROFILE } from './store/store';
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
import Settings from './pages/Settings';
import { Notes } from './pages/Notes';
import Clubs from './pages/Clubs';
import About from './pages/About';
import ClassManagement from './pages/ClassManagement';
import CTQuizPlanning from './pages/CTQuizPlanning';
import Classmates from './pages/Classmates';
import AdminDashboard from './pages/AdminDashboard';
import TeamDashboard from './pages/TeamDashboard';
import { Tours, Projects, Syllabus, TimeTracker, Tuition, Reports } from './pages/Extras';
import QuickAccess from './pages/QuickAccess';
import SubgroupHub from './components/nav-system/SubgroupHub';

function Layout({ authState, onboardingActive }) {
  usePageTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState(() => {
    try {
      return localStorage.getItem('kuetx_sidebar_mode') || '2col';
    } catch {
      return '2col';
    }
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const isQuestionBankViewer = location.pathname === '/question-bank/view';

  useEffect(() => {
    try {
      localStorage.setItem('kuetx_sidebar_mode', sidebarMode);
    } catch {}
  }, [sidebarMode]);

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
          mode={sidebarMode}
          onCycleMode={() => setSidebarMode(m => m === 'compact' ? '2col' : m === '2col' ? '3col' : 'compact')}
          onClose={() => setSidebarOpen(false)}
          authState={authState}
        />
      )}
      <div
        className={`main-content ${!isQuestionBankViewer ? `mode-${sidebarMode}` : ''}`}
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/quick-access" element={<QuickAccess />} />
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
            <Route path="/self-study" element={<SelfStudy />} />
            <Route path="/time" element={<TimeTracker />} />
            <Route path="/namaz" element={<Namaz />} />
            <Route path="/money" element={<Money />} />
            <Route path="/tuition" element={<Tuition />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/calculators" element={<Navigate to="/marks" replace />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="/class-management" element={<RequireCR><ClassManagement /></RequireCR>} />
            <Route path="/ct-quiz-planning" element={<RequireCR><CTQuizPlanning /></RequireCR>} />
            <Route path="/classmates" element={<Classmates />} />
            <Route path="/class-rep" element={<RequireCR><SubgroupHub group="Class Rep" /></RequireCR>} />
            <Route path="/academic-core" element={<SubgroupHub group="Academics" subgroup="Academic Core" />} />
            <Route path="/daily-academics" element={<SubgroupHub group="Academics" subgroup="Daily Academics" />} />
            <Route path="/campus-life" element={<SubgroupHub group="Campus Life" />} />
            <Route path="/daily-life" element={<SubgroupHub group="Daily Life" />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/team" element={<TeamDashboard />} />
          </Routes>
        </div>
        {location.pathname !== '/about' && !isQuestionBankViewer && !isMobileNav && <Footer syncStatus={authState.syncStatus} isAnonymous={authState.isAnonymous} displayName={authState.displayName} />}
        {!isQuestionBankViewer && <PWAInstallPrompt />}
        <PWAUpdatePrompt />
        {!isQuestionBankViewer && <BottomNav />}
        <GlobalToasts />
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
    // Same first-session deferral as announcements — a brand-new user has
    // already gone through mode/auth/profile-setup; don't stack a hiring
    // popup right after. Mark it as "seen" the first time through so it
    // naturally appears on a later visit instead.
    const seen = store.get('communityHiringPopupShown');
    if (seen === undefined || seen === null) {
      store.set('communityHiringPopupShown', false); // "shown the queue once" sentinel, still false = eligible next visit
      return false;
    }
    return !seen;
  } catch { return false; }
}

function buildQueue(isAnonymous) {
  const q = [];
  // Mode-select is no longer a mandatory first-launch step — everyone
  // starts on "Full KUETx" (getAppMode() already defaults to 'full') and
  // can switch modes any time later from Settings. We still silently
  // mark mode as "chosen" the first time buildQueue runs so isModeChosen()
  // stays consistent for any other code that checks it, but we never push
  // 'mode' into the mandatory queue.
  if (!isModeChosen()) markModeChosen();
  if (isAnonymous) q.push('auth');
  // Profile setup is mandatory before anything else — a half-filled
  // profile (missing roll/dept/session) is the root cause of Classmates
  // mismatch, roll-verification, and term-roadmap issues reported by
  // users. This step has no skip; it only advances via ProfileSetupModal's
  // onSave. The KUET email verify sub-step inside it keeps its own skip.
  if (!isProfileComplete(getProfile())) q.push('profile');
  if (shouldShowAnnouncement()) q.push('announcement');
  if (shouldShowCommunityHiring()) q.push('communityHiring');
  if (shouldShowBackup()) q.push('backup');
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
  const [verifyEmailPrompt, setVerifyEmailPrompt] = useState(null); // { busy, error } | null
  useEffect(() => {
    let cancelled = false;

    async function run(emailOverride = null) {
      const { completeKuetVerificationLink } = await import('./lib/kuetEmailVerify');
      const result = await completeKuetVerificationLink(window.location.href, emailOverride);
      if (cancelled) return;

      if (result.status === 'needs-email') {
        // Cross-device/cross-profile click — ask nicely via the modal
        // instead of a raw window.prompt(). The modal's onConfirm below
        // re-runs this same function with the typed email.
        setVerifyEmailPrompt({ busy: false, error: '' });
        return;
      }
      if (result.status === 'success') {
        setVerifyEmailPrompt(null);
        notify('KUET email verify হয়ে গেছে! নামের পাশে blue tick দেখাবে।', 'success');
        // Any already-mounted page (e.g. Profile, which only checks once
        // on mount) needs to know this just happened rather than staying
        // stuck showing "not verified" until a manual refresh.
        window.dispatchEvent(new CustomEvent('kuetx:kuet-email-verified', { detail: { roll: result.roll } }));
        // If they'd already joined their class group before verifying,
        // that member doc was created with verified:false and nothing
        // else ever revisits it — fix it now so "Pending" doesn't get
        // stuck forever.
        const gid = getGroupId(getProfile());
        syncOwnVerification(gid, auth.currentUser?.uid).catch((e) => console.warn('[App] syncOwnVerification failed', e));
        return;
      }
      if (result.status === 'error') {
        setVerifyEmailPrompt(null);
        console.warn('[KUETx] KUET email verify link:', result.message);
        notify(result.message, 'error', 6000);
      }
      // 'not-a-link' → nothing to do, most page loads hit this silently.
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const handleVerifyEmailConfirm = async (typedEmail) => {
    setVerifyEmailPrompt((p) => ({ ...p, busy: true, error: '' }));
    const { completeKuetVerificationLink } = await import('./lib/kuetEmailVerify');
    const result = await completeKuetVerificationLink(window.location.href, typedEmail);
    if (result.status === 'success') {
      setVerifyEmailPrompt(null);
      notify('KUET email verify হয়ে গেছে! নামের পাশে blue tick দেখাবে।', 'success');
      window.dispatchEvent(new CustomEvent('kuetx:kuet-email-verified', { detail: { roll: result.roll } }));
      const gid = getGroupId(getProfile());
      syncOwnVerification(gid, auth.currentUser?.uid).catch((e) => console.warn('[App] syncOwnVerification failed', e));
    } else {
      setVerifyEmailPrompt({ busy: false, error: result.message || 'Verify করতে সমস্যা হয়েছে, আবার চেষ্টা করো।' });
    }
  };

  // Build queue once auth is ready so we know isAnonymous
  useEffect(() => {
    if (!authState.authReady || queueBuilt) return;
    setQueue(buildQueue(authState.isAnonymous));
    setQueueBuilt(true);
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
          'তোমার roll number দিয়ে অন্য একটা account আগেই আছে, তাই এই account-টা Classmates/Class-এর shared তথ্যে যোগ হবে না। বাকি সব feature (Notes, Diary, Wallet, ইত্যাদি) normal ভাবে ব্যবহার করতে পারবে। ভুল মনে হলে Contact-এ জানাও, ঠিক করে দেওয়া হবে।',
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

  const advance = () => setQueue(q => q.slice(1));

  const handleAuthSuccess = async (user, info = {}) => {
    if (!user.isAnonymous) {
      // onAccountUpgraded() calls pushAllToFirestore() unconditionally,
      // which is correct both for a true link (brand-new real account,
      // nothing to conflict with) and for the credential-already-in-use
      // fallback (existing account — local anonymous-session data merges
      // in via last-write-wins per document, same as any other
      // multi-device sync in this app).
      await authState.onAccountUpgraded(user);
    }
    // Re-derive the remaining queue instead of a plain advance(): a
    // brand-new account has no profile yet, so 'profile' needs to be
    // inserted now even though it wasn't in the queue built before login.
    setQueue((q) => {
      const rest = q.slice(1);
      const needsProfile = !isProfileComplete(getProfile()) && !rest.includes('profile');
      return needsProfile ? ['profile', ...rest] : rest;
    });
  };

  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {/* 'mode' is never in the queue anymore (see buildQueue) — ModeSelectModal
            is kept imported/importable for a possible future "Change mode"
            entry point in Settings, just not rendered as part of onboarding. */}
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
        {current === 'profile' && (
          <ProfileSetupModal
            isOpen={true}
            // No dismiss path — this step cannot be skipped without saving,
            // by design (see buildQueue comment).
            onClose={() => {}}
            mandatory
            onSave={(formData) => {
              store.set('profile', { ...DEFAULT_PROFILE, ...formData });
              // Record which page-load onboarding finished on, so
              // ProfileCompleteReminder can tell "still this same load"
              // apart from "app reopened later" and never fire in the
              // same session as onboarding itself.
              try { store.set('kuetxProfileFinishedAtLoad', window.__kuetxLoadCounter); } catch {}
              advance();
            }}
            initialProfile={getProfile()}
          />
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
        <Layout authState={authState} onboardingActive={!!current} />
        {/* Independent of the sequential onboarding queue above — this has
            its own internal 3-day snooze + "stop once verified" logic, so it
            doesn't need to block on / wait for the queue to finish. */}
        {authState.authReady && !authState.isAnonymous && queue.length === 0 && <VerifyReminderPopup />}
        {/* Nudges anyone who used "Finish now, add rest later" to fill in the
            full profile — but only from a later session, never right after
            onboarding (see ProfileCompleteReminder.jsx's own session guard). */}
        {authState.authReady && queue.length === 0 && <ProfileCompleteReminder />}
        {verifyEmailPrompt && (
          <KuetVerifyEmailConfirmModal
            busy={verifyEmailPrompt.busy}
            error={verifyEmailPrompt.error}
            onConfirm={handleVerifyEmailConfirm}
            onCancel={() => setVerifyEmailPrompt(null)}
          />
        )}
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