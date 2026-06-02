import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'
// FullCalendar styles are provided via a local fallback in index.html (public/vendor/fullcalendar-fallback.css)
import { store, ensureDBReady } from './store/store.js'
import { getAllCourses } from './store/curriculumStore.js'

// Initialize app after DB is ready
async function initializeApp() {
  try {
    // Await DB initialization BEFORE rendering React
    await ensureDBReady();
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

