// FloatingInstallButton.jsx
//
// PWA_INSTALL_BUTTON_PLAN.md — global, role-agnostic floating "Install
// app" button. Mounted once in App.jsx's Layout (same pattern as
// <GlobalToasts /> / <FloatingUploadBar />), so it shows for every
// signed-in role — student, faculty, provider, staff — with zero
// per-role wiring, since installing the app isn't a role-scoped action.
//
// Placement (explicit product decision): fixed bottom-right on BOTH
// desktop and mobile.
//   - Desktop: sidebar is left-docked (220px wide), so bottom-right is
//     always clear of it.
//   - Mobile: bottom nav is fixed bottom, full-width, z-index 3500 (see
//     .mobile-bottom-nav in index.css) — this button sits ABOVE it
//     (bottom offset clears the nav's height + safe-area inset), same
//     stacking idea FloatingUploadBar already uses (bottom: 78) so the
//     two never overlap each other either.
//
// Click behavior (explicit product decision): one tap = direct install,
// no extra "are you sure" dialog of ours — the browser's own native
// install sheet (triggered by deferredPrompt.prompt()) is the only
// confirmation shown. iOS Safari has no programmatic install path at
// all, so there the tap opens a small instruction sheet (Share -> Add to
// Home Screen) instead — that's the one unavoidable exception, not an
// extra confirmation step for the normal case.

import { useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useInstallPrompt, dismissInstallPrompt } from '../hooks/useInstallPrompt';

export default function FloatingInstallButton() {
  const { status, triggerInstall } = useInstallPrompt();
  const [showIOSSheet, setShowIOSSheet] = useState(false);

  if (status !== 'installable' && status !== 'ios-manual') return null;

  const handleClick = () => {
    if (status === 'ios-manual') {
      setShowIOSSheet(true);
      return;
    }
    triggerInstall();
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="kx-install-fab"
        aria-label="Install app"
        title="Install app"
      >
        <span className="kx-install-fab-icon-wrap">
          <Download size={13} strokeWidth={2.5} />
        </span>
        <span className="kx-install-fab-label">Install</span>
      </button>

      {showIOSSheet && (
        <div className="kx-install-sheet-backdrop" onClick={() => setShowIOSSheet(false)}>
          <div className="kx-install-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="kx-install-sheet-header">
              <div className="kx-install-sheet-title">Install KUETx</div>
              <button
                className="kx-install-sheet-close"
                onClick={() => { setShowIOSSheet(false); dismissInstallPrompt(); }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="kx-install-sheet-step">
              <div className="kx-install-sheet-step-icon"><Share size={20} strokeWidth={2} /></div>
              <div>
                <div className="kx-install-sheet-step-title">1. Tap the Share icon</div>
                <div className="kx-install-sheet-step-desc">In Safari's toolbar</div>
              </div>
            </div>
            <div className="kx-install-sheet-step">
              <div className="kx-install-sheet-step-icon"><SquarePlus size={20} strokeWidth={2} /></div>
              <div>
                <div className="kx-install-sheet-step-title">2. Tap "Add to Home Screen"</div>
                <div className="kx-install-sheet-step-desc">Scroll down if you don't see it right away</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .kx-install-fab {
          position: fixed;
          right: 16px;
          bottom: 88px;
          z-index: 1300;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 18px 11px 12px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 999px;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--accent) 100%, white 10%),
            color-mix(in srgb, var(--accent) 100%, black 12%));
          color: #fff;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: 0.1px;
          cursor: pointer;
          box-shadow:
            0 10px 26px -8px rgba(var(--accentRGB), 0.55),
            0 1px 2px rgba(0,0,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.25);
          transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s ease, filter 0.18s ease;
        }
        .kx-install-fab-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: rgba(255,255,255,0.2);
          flex-shrink: 0;
        }
        .kx-install-fab:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow:
            0 16px 36px -8px rgba(var(--accentRGB), 0.65),
            0 2px 4px rgba(0,0,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.3);
          filter: brightness(1.05);
        }
        .kx-install-fab:active { transform: translateY(-1px) scale(0.98); }

        /* Desktop: no bottom nav to clear, so the button can sit lower,
           still safely right of the 220px left sidebar either way. */
        @media (min-width: 768px) {
          .kx-install-fab { bottom: 24px; }
        }

        .kx-install-fab-label { white-space: nowrap; }

        .kx-install-sheet-backdrop {
          position: fixed; inset: 0; z-index: 3600;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 700px) {
          .kx-install-sheet-backdrop { align-items: center; }
        }
        .kx-install-sheet {
          width: 100%; max-width: 380px;
          background: var(--card);
          border-radius: 20px 20px 0 0;
          padding: 18px 18px 26px;
        }
        @media (min-width: 700px) {
          .kx-install-sheet { border-radius: 20px; }
        }
        .kx-install-sheet-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .kx-install-sheet-title { font-size: 16px; font-weight: 800; color: var(--text); }
        .kx-install-sheet-close {
          background: var(--border); border: none; border-radius: 999px;
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text);
        }
        .kx-install-sheet-step {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 4px;
        }
        .kx-install-sheet-step-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: var(--accentSoft); color: var(--accent);
          display: flex; align-items: center; justify-content: center;
        }
        .kx-install-sheet-step-title { font-size: 14px; font-weight: 700; color: var(--text); }
        .kx-install-sheet-step-desc { font-size: 12.5px; color: var(--muted); margin-top: 1px; }
      `}</style>
    </>
  );
}
