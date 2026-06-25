import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { usePageTracker } from './hooks/usePageTracker';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import AnnouncementModal from './components/DriveAnnouncementModal';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { BottomNav, useIsMobileNav } from './components/BottomNav';
import GlobalToasts from './components/GlobalToasts';
import BackupReminderGate from './components/BackupReminderGate';
import AuthModal from './components/AuthModal';
import ModeSelectModal from './components/ModeSelectModal';
import GuideModal from './components/GuideModal';
import useFirebaseAuth from './hooks/useFirebaseAuth';
import { isModeChosen } from './lib/modeFilter';
import { store } from './store/store';

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
import SelfEval from './pages/SelfEval';
import Money from './pages/Money';
import Calculators from './pages/Calculators';
import Alerts from './pages/Alerts';
import SmartScore from './pages/SmartScore';
import Settings from './pages/Settings';
import { Notes } from './pages/Notes';
import Clubs from './pages/Clubs';
import About from './pages/About';
import ClassManagement from './pages/ClassManagement';
import CTQuizPlanning from './pages/CTQuizPlanning';
import { Tours, Social, Projects, Syllabus, TimeTracker, Tuition, Food, Reports } from './pages/Extras';
import QuickAccess from './pages/QuickAccess';

function Layout({ authState }) {
  usePageTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(() => {
    try {
      return localStorage.getItem('kuetx_sidebar_compact') === 'true';
    } catch {
      return false;
    }
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const isQuestionBankViewer = location.pathname === '/question-bank/view';

  useEffect(() => {
    try {
      localStorage.setItem('kuetx_sidebar_compact', sidebarCompact ? 'true' : 'false');
    } catch {}
  }, [sidebarCompact]);

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
          compact={sidebarCompact}
          onToggleCompact={() => setSidebarCompact(v => !v)}
          onClose={() => setSidebarOpen(false)}
          authState={authState}
        />
      )}
      <div
        className={`main-content ${sidebarCompact && !isQuestionBankViewer ? 'compact' : ''}`}
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
            <Route path="/self-eval" element={<SelfEval />} />
            <Route path="/money" element={<Money />} />
            <Route path="/tuition" element={<Tuition />} />
            <Route path="/food" element={<Food />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/social" element={<Social />} />
            <Route path="/calculators" element={<Navigate to="/marks" replace />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/smart-score" element={<SmartScore />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="/class-management" element={<ClassManagement />} />
            <Route path="/ct-quiz-planning" element={<CTQuizPlanning />} />
          </Routes>
        </div>
        {location.pathname !== '/about' && !isQuestionBankViewer && !isMobileNav && <Footer />}
        {!isQuestionBankViewer && <PWAInstallPrompt />}
        <PWAUpdatePrompt />
        {!isQuestionBankViewer && <BottomNav />}
        <GlobalToasts />

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
    const lastShown = store.get('announcementV2LastShown');
    const showCount = store.get('announcementV2ShowCount') || 0;
    const interval = showCount >= 3 ? 604800000 : 259200000;
    return !lastShown || Date.now() - new Date(lastShown).getTime() >= interval;
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

function buildQueue(isAnonymous) {
  const q = [];
  if (!isModeChosen()) q.push('mode');
  if (isAnonymous) q.push('auth');
  if (shouldShowAnnouncement()) q.push('announcement');
  if (shouldShowBackup()) q.push('backup');
  return q;
}

export default function App() {
  const authState = useFirebaseAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueBuilt, setQueueBuilt] = useState(false);
  const current = queue[0] || null;

  // Build queue once auth is ready so we know isAnonymous
  useEffect(() => {
    if (!authState.authReady || queueBuilt) return;
    setQueue(buildQueue(authState.isAnonymous));
    setQueueBuilt(true);
  }, [authState.authReady, authState.isAnonymous, queueBuilt]);

  const advance = () => setQueue(q => q.slice(1));

  const handleAuthSuccess = async (user) => {
    advance();
    if (!user.isAnonymous) {
      await authState.onAccountUpgraded(user);
    }
  };

  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {current === 'mode' && (
          <ModeSelectModal onDone={advance} />
        )}
        {current === 'auth' && (
          <AuthModal
            mode="login"
            queueMode={true}
            onClose={advance}
            onSuccess={handleAuthSuccess}
          />
        )}
        {current === 'announcement' && (
          <AnnouncementModal open={true} onClose={advance} />
        )}
        {current === 'backup' && (
          <BackupReminderGate open={true} onClose={advance} />
        )}
        <Layout authState={authState} />
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
