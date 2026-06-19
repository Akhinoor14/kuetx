import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import DriveConnectButton from './DriveConnectButton';
import { store } from '../store/store';
import { notify } from '../lib/notify';
import { isDriveConnected } from '../lib/driveSync';

export default function DriveAnnouncementModal() {
  const [open, setOpen] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);

  useEffect(() => {
    try {
      // If already connected, never show again
      if (isDriveConnected()) return;

      const lastShown = store.get('driveAnnouncementLastShown');
      const showCount = store.get('driveAnnouncementShowCount') || 0;
      const now = Date.now();

      // Schedule: First 3 times every 3 days, then every 7 days if still not connected
      // 3 days = 259200000 ms, 7 days = 604800000 ms
      const interval = showCount >= 3 ? 604800000 : 259200000;

      if (!lastShown) {
        // First time — show immediately
        setOpen(true);
      } else {
        const timeSinceLastShow = now - new Date(lastShown).getTime();
        if (timeSinceLastShow >= interval) {
          // Interval passed — show again
          setOpen(true);
        }
      }
    } catch (err) {
      console.error('DriveAnnouncementModal init error:', err);
    }
  }, []);

  const dismiss = () => {
    try {
      const showCount = store.get('driveAnnouncementShowCount') || 0;
      store.set('driveAnnouncementShowCount', showCount + 1);
      store.set('driveAnnouncementLastShown', new Date().toISOString());
    } catch {}
    setOpen(false);
  };

  const handleConnected = () => {
    try {
      // User connected — mark as permanently dismissed
      store.set('driveAnnouncementConnected', true);
    } catch {}
    setOpen(false);
  };

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      notify('Push not supported in this browser', 'error');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        notify('Notification permission denied', 'error');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      // NOTE: Replace with your VAPID public key when you have a server
      const VAPID_PUBLIC_KEY = window.__KUETX_VAPID_KEY__ || 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      try { localStorage.setItem('kuetx_push_subscription', JSON.stringify(sub)); } catch {}
      notify('Subscribed to push (demo). Server required to send messages.', 'success');
    } catch (err) {
      notify('Push subscription failed: ' + (err.message || String(err)), 'error');
    }
  };

  if (!open) return null;

  return (
    <Modal onClose={dismiss} contentStyle={{ maxWidth: 720, width: 'min(96vw,720px)', padding: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 22 }}>☁️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Sync across your devices</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Connect your Google Drive to back up your KUETx data and access it from any device — phone, tablet, or computer. Your data stays in your own Drive, KUETx has no access.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: '100%', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px' }}>
            <DriveConnectButton variant="compact" onConnected={handleConnected} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
            <button className="btn btn-ghost" onClick={() => setShowUpdates(!showUpdates)} style={{ justifyContent: 'flex-start', fontSize: 13 }}>
              {showUpdates ? '✕ Hide updates' : '📰 Recent updates'}
            </button>
            <button className="btn btn-ghost" onClick={subscribePush} style={{ justifyContent: 'flex-start', fontSize: 13 }}>Enable notifications</button>
            <button className="btn btn-ghost" onClick={dismiss} style={{ justifyContent: 'flex-start', fontSize: 13 }}>Remind me later</button>
          </div>
        </div>

        {showUpdates && (
          <div style={{ width: '100%', marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>What's new (demo)</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { id: 1, title: 'Drive Sync', body: 'Connect Google Drive to backup & sync data across your devices. Your data stays in your Drive only.' },
                { id: 2, title: 'Money Page Overhaul', body: 'Income tracking, budget tracking, monthly switcher, daily chart, category filter, and TXT export memo.' },
                { id: 3, title: 'Results & Attendance', body: 'Grade points calculation fixed, CGPA mobile layout corrected, attendance card compaction & mode clarity.' },
                { id: 4, title: 'Extras Pages', body: 'Tours, Projects, Tuition, Social, Food, Reports — all rebuilt with charts, progress tracking, and rich text exports.' },
                { id: 5, title: 'Schedule Fixes', body: 'Edit Exams modal now opens correctly. Critical bugs squashed.' },
              ].map(u => (
                <div key={u.id} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surfaceGlass)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{u.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{u.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security & Privacy Notice */}
        <div style={{ width: '100%', padding: 12, borderRadius: 8, background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: 11, lineHeight: 1.6, color: 'var(--muted)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>🔒 Security & Privacy</div>
          <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
            <li>✅ Data goes to <strong>your</strong> Google Drive only — KUETx has no server access</li>
            <li>✅ Folder: "KUETx Backups/kuetx-backup.json" — only you can see it</li>
            <li>✅ OAuth scope: Limited to KUETx files, no access to your other Drive files</li>
            <li>✅ Can disconnect anytime — your Drive file is untouched</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button className="btn btn-ghost" onClick={dismiss} style={{ fontSize: 13 }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
