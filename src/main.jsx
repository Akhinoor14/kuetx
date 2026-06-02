import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// FullCalendar styles are provided via a local fallback in index.html (public/vendor/fullcalendar-fallback.css)
import { store, ensureDBReady } from './store/store.js'
import { getAllCourses } from './store/curriculumStore.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Warm IDB cache in the background for large data sets
ensureDBReady().catch(console.error);

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

