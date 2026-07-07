import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'
// FullCalendar styles are provided via a local fallback in index.html (public/vendor/fullcalendar-fallback.css)
import { store, ensureDBReady } from './store/store.js'
import { getAllCourses } from './store/curriculumStore.js'

// One-time-per-real-page-load counter used by ProfileCompleteReminder to
// tell "still the same load onboarding finished on" apart from "app was
// reopened/reloaded since". store.get/set is sync (localStorage-backed
// cache) so this is safe to run before ensureDBReady() resolves.
window.__kuetxLoadCounter = (store.get('kuetxAppLoadCounter') || 0) + 1;
store.set('kuetxAppLoadCounter', window.__kuetxLoadCounter);

// Initialize app after DB is ready
async function initializeApp() {
  try {
    // Await DB initialization but don't block the UI for too long.
    // If the user's IndexedDB is very large, waiting indefinitely causes a blank page.
    // Race the DB init against a short timeout so the app renders quickly.
    const dbInit = ensureDBReady();
    const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
    await Promise.race([dbInit, timeout]);
    // Allow any later DB init errors to be logged without blocking render
    dbInit.catch(err => console.error('[KUETx] ensureDBReady error:', err));
  } catch (err) {
    console.error('[KUETx] Initialization error:', err);
    // Continue even if DB fails - app can still work with localStorage only
  }

  // Now render the app with populated cache
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );

  // Pre-warm heavy selectors in idle time to keep page transitions instant
  const warmup = () => {
    const run = () => {
      try { getAllCourses(store.get('profile') || {}); } catch {}
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 2000);
    }
  };

  warmup();
}

// Start initialization
initializeApp();