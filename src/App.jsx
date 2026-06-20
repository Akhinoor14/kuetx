import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import { usePageTracker } from './hooks/usePageTracker';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { BottomNav, useIsMobileNav } from './components/BottomNav';
import GlobalToasts from './components/GlobalToasts';
import BackupReminderGate from './components/BackupReminderGate';
import DriveAnnouncementModal from './components/DriveAnnouncementModal';
import { store } from './store/store';
import { startAutoSync, stopAutoSync, isDriveConnected } from './lib/driveSync';

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

function Layout() {
  usePageTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(() => {
    try {
      return localStorage.getItem('kuetx_sidebar_compact') === 'true';
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const isMobileNav = useIsMobileNav();
  const isQuestionBankViewer = location.pathname === '/question-bank/view';

  useEffect(() => {
    try {
      localStorage.setItem('kuetx_sidebar_compact', sidebarCompact ? 'true' : 'false');
    } catch {}
  }, [sidebarCompact]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {!isQuestionBankViewer && (
        <Sidebar
          open={sidebarOpen}
          compact={sidebarCompact}
          onToggleCompact={() => setSidebarCompact(v => !v)}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`main-content ${sidebarCompact && !isQuestionBankViewer ? 'compact' : ''}`}
        style={isQuestionBankViewer ? { marginLeft: 0, width: '100%' } : undefined}
      >
        {!isQuestionBankViewer && <Navbar onMenuClick={() => setSidebarOpen(o => !o)} />}
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
        {!isQuestionBankViewer && <BottomNav />}
        <GlobalToasts />
        <BackupReminderGate />
        <DriveAnnouncementModal />
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Start the real-time Drive auto-sync engine (push on change + poll pull)
    // if the user already connected Drive on this device.
    if (isDriveConnected()) {
      startAutoSync(
        () => store.exportAll(),
        (data) => store.importAllReport(data)
      );
    }
    return () => stopAutoSync();
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
