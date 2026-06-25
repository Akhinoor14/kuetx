import React, { useEffect, useState } from 'react';
import { store } from '../store/store';

const UPDATES = [
  {
    id: 1,
    icon: '☁️',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'Google Drive Real-Time Sync',
    body: 'Your data now auto-syncs to your own Google Drive in the background. No KUETx server. Full privacy.',
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
    body: 'Cards no longer jump on input. Held / Attended labels added. Mode toggle clarified.',
  },
  {
    id: 5,
    icon: '📋',
    tag: 'Rebuilt',
    tagColor: '#2563eb',
    title: '6 Extras Pages',
    body: 'Tours, Projects (subtasks + progress), Tuition, Social (7-day chart), Food (BMI persist), Reports (real filters + rich TXT).',
  },
  {
    id: 6,
    icon: '🌙',
    tag: 'Fixed',
    tagColor: '#7c3aed',
    title: 'Dark Mode',
    body: 'Dark mode overrides across Assignment, Class Management, Question Bank, Time Tracker, Self Eval, CT Planner pages.',
  },
  {
    id: 7,
    icon: '🗺️',
    tag: 'Improved',
    tagColor: '#0891b2',
    title: 'Tours — Add Tour Modal',
    body: 'Scrollable modal with sticky header/footer. Collapsible Trip Outline. Responsive sizing.',
  },
  {
    id: 8,
    icon: '🏛️',
    tag: 'Fixed',
    tagColor: '#d97706',
    title: 'Clubs — Add Activity',
    body: 'Popup now uses portal rendering — correct position on all devices.',
  },
  {
    id: 9,
    icon: '🔐',
    tag: 'New',
    tagColor: '#16a34a',
    title: 'Firebase Auth Gate',
    body: 'Sign-up prompt now shown on first open. Account required to unlock full sync features.',
  },
];

const MODAL_KEY = 'announcementV2LastShown';
const COUNT_KEY = 'announcementV2ShowCount';

export default function AnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const lastShown = store.get(MODAL_KEY);
      const showCount = store.get(COUNT_KEY) || 0;
      const now = Date.now();
      // Show every 3 days first 3 times, then weekly
      const interval = showCount >= 3 ? 604800000 : 259200000;
      if (!lastShown || now - new Date(lastShown).getTime() >= interval) {
        setOpen(true);
      }
    } catch (err) {
      console.error('AnnouncementModal init error:', err);
    }
  }, []);

  const dismiss = () => {
    try {
      const showCount = store.get(COUNT_KEY) || 0;
      store.set(COUNT_KEY, showCount + 1);
      store.set(MODAL_KEY, new Date().toISOString());
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }} onClick={dismiss} />

      {/* Modal */}
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
          maxWidth: 500,
          maxHeight: 'calc(100dvh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card, #fff)',
          border: '1px solid var(--border, #e2e0db)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.26), 0 4px 20px rgba(0,0,0,0.10)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: 22, lineHeight: 1 }}>🎉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>What's New in KUETx</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {UPDATES.length} updates in this release
              </div>
            </div>
            <button
              onClick={dismiss}
              aria-label="Close"
              style={{
                width: 30, height: 30,
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

            {/* Community + Guide links */}
            <div style={{
              marginTop: 14,
              padding: '13px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Stay connected</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href="https://www.facebook.com/kuetx"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: 'rgba(24,119,242,0.10)',
                    border: '1px solid rgba(24,119,242,0.22)',
                    color: '#1877F2',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 14 }}>📘</span>
                  Join Facebook Community
                </a>
                <button
                  onClick={() => {
                    dismiss();
                    // trigger guide — same logic as Navbar
                    localStorage.removeItem('kuetx_guide_seen');
                    window.dispatchEvent(new CustomEvent('kuetx:openGuide'));
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 13px',
                    borderRadius: 8,
                    background: 'rgba(15,155,119,0.10)',
                    border: '1px solid rgba(15,155,119,0.22)',
                    color: 'var(--accent, #0f9b77)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14 }}>📖</span>
                  View Guide
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              className="btn btn-primary"
              onClick={dismiss}
              style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
            >
              Got it 🚀
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
