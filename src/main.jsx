import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { store, ensureDBReady } from './store/store.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Weekly backup reminder (fires 3s after load)
;(() => {
  const autoBackup = store.get('autoBackup') ?? true;
  if (!autoBackup) return;
  const last = store.get('lastBackupTime');
  if (!last) { store.set('lastBackupTime', new Date().toISOString()); return; }
  const daysSince = (Date.now() - new Date(last)) / 86400000;
  if (daysSince < 7) return;
  const snooze = store.get('backupReminderSnoozed');
  if (snooze === new Date().toDateString()) return;
  setTimeout(() => {
    const go = window.confirm(
      `📦 KUETx Backup Reminder\n\nIt's been ${Math.floor(daysSince)} days since your last backup.\n\nYour data is stored only in this browser — a lost device or cleared cache means lost data.\n\nGo to Settings to download backup now?`
    );
    if (go) window.location.href = '/settings';
    else store.set('backupReminderSnoozed', new Date().toDateString());
  }, 3000);
})();

// Warm IDB cache in the background for large data sets
ensureDBReady().catch(console.error);

// Pre-warm heavy selectors in idle time to keep page transitions instant
const warmup = () => {
  const run = () => {
    import('./store/curriculumStore.js')
      .then(({ getAllCourses }) => {
        try { getAllCourses(store.get('profile') || {}); } catch {}
      })
      .catch(() => {});
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 2000);
  }
};

warmup();

