import React, { useEffect, useState } from 'react';
import DriveConnectButton from './DriveConnectButton';
import { store } from '../store/store';
import { notify } from '../lib/notify';
import { isDriveConnected } from '../lib/driveSync';

const UPDATES = [
  {
    id: 1,
    icon: '☁️',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'Google Drive Real-Time Sync',
    body: 'Your data now auto-syncs to your own Google Drive in the background, with instant sync via the Drive badge. No KUETx server. Full privacy.',
  },
  {
    id: 2,
    icon: '💰',
    tag: 'Rebuilt',
    tagColor: '#2563eb',
    title: 'Money Page',
    body: 'Income tracking, cash balance, monthly budget + alert, daily chart, month switcher, category filter, TXT memo export.',
  },
  {
    id: 3,
    icon: '📊',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'Results & GPA',
    body: 'Grade Points now shows real achieved vs max (credit-weighted). CGPA card mobile clip fixed. Ongoing term upload locked.',
  },
  {
    id: 4,
    icon: '🎓',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'Attendance',
    body: 'Cards no longer jump on input. Held / Attended labels added. Mode toggle clarified. One hint per card. Wording fixed.',
  },
  {
    id: 5,
    icon: '📋',
    tag: 'Rebuilt',
    tagColor: '#2563eb',
    title: '6 Extras Pages',
    body: 'Tours, Projects (subtasks + progress), Tuition (chart + student summary), Social (7-day chart), Food (BMI persist), Reports (real filters + rich TXT).',
  },
  {
    id: 6,
    icon: '📅',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'Edit Exams Modal',
    body: 'Edit Exams now opens correctly. Root: missing import in store.js — resolved with safe fallback.',
  },
  {
    id: 7,
    icon: '🎨',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'CSS Layout Fix',
    body: '.stat-mini and .filter-tab were missing — causing broken layouts across Extras pages. Now properly defined.',
  },
];

export default function DriveAnnouncementModal() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1); // 1 = Drive, 2 = What's New

  useEffect(() => {
    try {
      if (isDriveConnected()) return;
      const lastShown = store.get('driveAnnouncementLastShown');
      const showCount = store.get('driveAnnouncementShowCount') || 0;
      const now = Date.now();
      const interval = showCount >= 3 ? 604800000 : 259200000;
      if (!lastShown || now - new Date(lastShown).getTime() >= interval) {
        setOpen(true);
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
    setPage(1);
  };

  const handleConnected = () => {
    try { store.set('driveAnnouncementConnected', true); } catch {}
    setOpen(false);
    setPage(1);
  };

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      notify('Push not supported in this browser', 'error');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { notify('Notification permission denied', 'error'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const VAPID_PUBLIC_KEY = window.__KUETX_VAPID_KEY__ || 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY });
      try { localStorage.setItem('kuetx_push_subscription', JSON.stringify(sub)); } catch {}
      notify('Notifications enabled!', 'success');
    } catch (err) {
      notify('Failed: ' + (err.message || String(err)), 'error');
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click does NOT close */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3999,
        background: 'rgba(0,0,0,0.58)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }} />

      {/* Modal wrapper */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: 520,
          maxHeight: 'calc(100dvh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card, #fff)',
          border: '1px solid var(--border, #e2e0db)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.26), 0 4px 20px rgba(0,0,0,0.10)',
          overflow: 'hidden',
        }}>

          {/* ══════════════ PAGE 1 — DRIVE SYNC ══════════════ */}
          {page === 1 && (
            <>
              {/* Hero banner */}
              <div style={{
                background: 'linear-gradient(135deg, var(--accent, #0f9b77) 0%, #0a7a5e 100%)',
                padding: '28px 24px 22px',
                position: 'relative',
                flexShrink: 0,
              }}>
                {/* Cloud icon big */}
                <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>☁️</div>
                <div style={{
                  fontSize: 21,
                  fontWeight: 800,
                  color: '#fff',
                  lineHeight: 1.2,
                  marginBottom: 8,
                }}>
                  Sync your data across<br />all your devices, instantly
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.82)',
                  lineHeight: 1.6,
                }}>
                  Connect Google Drive once — after that, changes sync automatically in the background, or tap the Drive badge anytime for an instant sync.
                </div>

                {/* Step indicator */}
                <div style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}>
                  <div style={{ width: 20, height: 4, borderRadius: 2, background: '#fff' }} />
                  <div style={{ width: 20, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }} />
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
                {/* Connect button */}
                <DriveConnectButton variant="compact" onConnected={handleConnected} />

                {/* How it works */}
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: '🔑', text: 'Sign in with Google — one tap, no password needed' },
                    { icon: '📁', text: 'Data saved to a single "KUETx Backups" file in your own Drive' },
                    { icon: '🔄', text: 'Auto-syncs in the background — or tap the Drive badge for instant sync' },
                    { icon: '🔒', text: 'KUETx has zero server access — your data, your Drive' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 20px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flexShrink: 0,
              }}>
                {/* Next — goes to What's New */}
                <button
                  className="btn btn-ghost"
                  onClick={() => setPage(2)}
                  style={{
                    fontSize: 13,
                    width: '100%',
                    justifyContent: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  📰 See what's new &nbsp;→
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={subscribePush}
                    style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}
                  >
                    🔔 Notifications
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={dismiss}
                    style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}
                  >
                    Later
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════════ PAGE 2 — WHAT'S NEW ══════════════ */}
          {page === 2 && (
            <>
              {/* Header */}
              <div style={{
                padding: '18px 20px 14px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                {/* Back */}
                <button
                  onClick={() => setPage(1)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  ←
                </button>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>What's New</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                    {UPDATES.length} updates in this release
                  </div>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginRight: 4 }}>
                  <div style={{ width: 20, height: 4, borderRadius: 2, background: 'var(--border)' }} />
                  <div style={{ width: 20, height: 4, borderRadius: 2, background: 'var(--accent, #0f9b77)' }} />
                </div>

                {/* Close — only on page 2 */}
                <button
                  onClick={dismiss}
                  aria-label="Close"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Update list — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {UPDATES.map(u => (
                    <div key={u.id} style={{
                      display: 'flex',
                      gap: 12,
                      padding: '11px 13px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--surface, #fafaf8)',
                      alignItems: 'flex-start',
                    }}>
                      <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{u.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u.title}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 4,
                            background: u.tagColor + '18',
                            color: u.tagColor,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}>{u.tag}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{u.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 16px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                flexShrink: 0,
              }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPage(1)}
                  style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}
                >
                  ← Back to Drive Sync
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={dismiss}
                  style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}
                >
                  Close
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}