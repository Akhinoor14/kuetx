import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * PWAUpdatePrompt
 * ─────────────────────────────────────────────────────────────────────────────
 * Registers the service worker and shows a toast when a new version is waiting.
 * User clicks "Update" → sends SKIP_WAITING to the new SW → page reloads.
 *
 * Usage: render <PWAUpdatePrompt /> once in App.jsx (near PWAInstallPrompt).
 */
export default function PWAUpdatePrompt() {
  const [waitingSW, setWaitingSW] = useState(null);
  const [visible, setVisible] = useState(false);

  const handleUpdate = useCallback(() => {
    if (!waitingSW) return;
    waitingSW.postMessage({ type: 'SKIP_WAITING' });
    setVisible(false);
  }, [waitingSW]);

  const handleDismiss = () => setVisible(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    // When the new SW takes control, reload once
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Detect a waiting SW (new version installed but not yet active)
    const detectWaiting = (reg) => {
      if (reg.waiting) {
        setWaitingSW(reg.waiting);
        setVisible(true);
      }
    };

    // Register SW and watch for updates
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check immediately (e.g. page was reloaded while SW was waiting)
        detectWaiting(reg);

        // Watch for future updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — existing clients still running
              setWaitingSW(newWorker);
              setVisible(true);
            }
          });
        });

        // Periodically check for updates (every 60 s when page is active)
        const interval = setInterval(() => reg.update(), 60_000);
        return () => clearInterval(interval);
      })
      .catch((err) => console.warn('[KUETx SW] Registration failed:', err));

    // Also listen for SW_WAITING broadcast (sent from sw.js install event)
    const onMessage = (e) => {
      if (e.data?.type === 'SW_WAITING') {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg?.waiting) {
            setWaitingSW(reg.waiting);
            setVisible(true);
          }
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  if (!visible || !waitingSW) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.75rem',
        background: 'var(--color-surface, #1e293b)',
        color: 'var(--color-text, #f1f5f9)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        fontSize: '0.875rem',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
        border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
        animation: 'kuetx-slide-up 0.25s ease',
      }}
    >
      <style>{`
        @keyframes kuetx-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
      `}</style>

      {/* Icon */}
      <span style={{ flexShrink: 0, display: 'flex' }}><RefreshCw size={18} /></span>

      {/* Text */}
      <span style={{ flex: 1 }}>
        <strong style={{ fontWeight: 600 }}>New update available</strong>
      </span>

      {/* Update button */}
      <button
        type="button"
        onClick={handleUpdate}
        style={{
          padding: '0.35rem 0.85rem',
          borderRadius: '0.5rem',
          border: 'none',
          background: 'var(--color-primary, #6366f1)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.8rem',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Update
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted, #94a3b8)',
          cursor: 'pointer',
          padding: '0.2rem',
          flexShrink: 0,
          lineHeight: 1,
          display: 'flex',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
