// FloatingInstallButton.jsx
//
// PWA_INSTALL_BUTTON_PLAN.md — global, role-agnostic floating "Install
// app" button. Mounted once in App.jsx's Layout (same pattern as
// <GlobalToasts /> / <FloatingUploadBar />) AND once in SignedOutRouter
// (see App.jsx — Layout never mounts for a signed-out visitor, so without
// a second copy there the button never appeared on the landing/about/
// privacy pages at all). Together that's every route, signed in or out,
// with zero per-role wiring, since installing the app isn't a role-scoped
// action.
//
// Placement (explicit product decision): fixed bottom-right on BOTH
// desktop and mobile by default.
//   - Desktop: sidebar is left-docked (220px wide), so bottom-right is
//     always clear of it.
//   - Mobile: bottom nav is fixed bottom, full-width, z-index 3500 (see
//     .mobile-bottom-nav in index.css) — this button sits ABOVE it
//     (bottom offset clears the nav's height + safe-area inset), same
//     stacking idea FloatingUploadBar already uses (bottom: 78) so the
//     two never overlap each other either.
//
// `side` prop (default 'right'): the landing page's hero art (turtle
// mascot + campus photo cluster) also lives bottom/top-right on mobile
// (see LandingPage.jsx), and this fixed FAB — being on top of the page
// at a constant screen position regardless of scroll — sat directly
// over that artwork's corner. Rather than fight over the same corner,
// SignedOutRouter (App.jsx) passes side="left" for the landing route
// only; every other mount (Layout, /about, /privacy) keeps the default
// right placement, unaffected.
//
// Owner decision (this session): "always show on mobile if not
// installed" — Chrome/Edge only fire beforeinstallprompt once their own
// engagement heuristic is satisfied, which can take multiple visits or
// simply never happen for a given visitor; that's a browser trust/anti-
// spam gate with no page-JS bypass. Rather than staying hidden until
// then, the button now always shows once useInstallPrompt resolves past
// 'checking' (see that hook's 'manual-wait' state) — tapping it before a
// real event has landed opens the SAME manual-instructions sheet iOS
// already used, with copy for whichever platform this is (Android
// Chrome's menu vs desktop Chrome's install icon vs iOS Share sheet),
// rather than doing nothing. The moment a real beforeinstallprompt does
// land, status flips to 'installable' and the button switches to a
// direct one-tap install with no page reload needed.
//
// Click behavior: 'installable' -> one tap = direct install via the
// browser's own native install sheet (deferredPrompt.prompt()), no extra
// "are you sure" dialog of ours. Every other showing state -> tap opens
// our manual instruction sheet, since there is no .prompt() to call yet.

import { useState } from 'react';
import { Download, Share, SquarePlus, X, ExternalLink, RefreshCw, MoreVertical, Menu } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent || '');
}

export default function FloatingInstallButton({ side = 'right' }) {
  const { status, triggerInstall, openOrUpdate } = useInstallPrompt();
  const [showManualSheet, setShowManualSheet] = useState(false);

  if (status === 'checking' || status === 'installed') return null;

  const handleClick = () => {
    if (status === 'installable') {
      triggerInstall();
      return;
    }
    if (status === 'installed-elsewhere' || status === 'update-available') {
      openOrUpdate();
      return;
    }
    // 'manual-wait' or 'ios-manual' — no working .prompt() yet, show steps.
    setShowManualSheet(true);
  };

  const icon = status === 'update-available'
    ? <RefreshCw size={13} strokeWidth={2.5} />
    : status === 'installed-elsewhere'
    ? <ExternalLink size={13} strokeWidth={2.5} />
    : <Download size={13} strokeWidth={2.5} />;

  const label = status === 'update-available'
    ? 'Update'
    : status === 'installed-elsewhere'
    ? 'Open app'
    : 'Install';

  const android = isAndroid();

  return (
    <>
      <button
        onClick={handleClick}
        className={`kx-install-fab${side === 'left' ? ' kx-install-fab-left' : ''}`}
        aria-label={label}
        title={label}
      >
        <span className="kx-install-fab-icon-wrap">
          {icon}
        </span>
        <span className="kx-install-fab-label">{label}</span>
      </button>

      {showManualSheet && (
        <div className="kx-install-sheet-backdrop" onClick={() => setShowManualSheet(false)}>
          <div className="kx-install-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="kx-install-sheet-header">
              <div className="kx-install-sheet-title">Install KUETx</div>
              <button
                className="kx-install-sheet-close"
                onClick={() => setShowManualSheet(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {status === 'ios-manual' ? (
              <>
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
              </>
            ) : android ? (
              <>
                <div className="kx-install-sheet-step">
                  <div className="kx-install-sheet-step-icon"><MoreVertical size={20} strokeWidth={2} /></div>
                  <div>
                    <div className="kx-install-sheet-step-title">1. Tap the ⋮ menu</div>
                    <div className="kx-install-sheet-step-desc">Top-right of Chrome</div>
                  </div>
                </div>
                <div className="kx-install-sheet-step">
                  <div className="kx-install-sheet-step-icon"><Download size={20} strokeWidth={2} /></div>
                  <div>
                    <div className="kx-install-sheet-step-title">2. Tap "Install app" / "Add to Home screen"</div>
                    <div className="kx-install-sheet-step-desc">KUETx will open like a normal app, no browser bar</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="kx-install-sheet-step">
                  <div className="kx-install-sheet-step-icon"><Menu size={20} strokeWidth={2} /></div>
                  <div>
                    <div className="kx-install-sheet-step-title">1. Look for the install icon</div>
                    <div className="kx-install-sheet-step-desc">In the address bar, or your browser's ⋮ menu</div>
                  </div>
                </div>
                <div className="kx-install-sheet-step">
                  <div className="kx-install-sheet-step-icon"><Download size={20} strokeWidth={2} /></div>
                  <div>
                    <div className="kx-install-sheet-step-title">2. Click "Install"</div>
                    <div className="kx-install-sheet-step-desc">KUETx opens in its own window, no address bar</div>
                  </div>
                </div>
              </>
            )}
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

        /* side="left" override — see the header comment on `side` above.
           Only the horizontal anchor flips; bottom offsets (mobile nav
           clearance, desktop's lower resting position) stay identical. */
        .kx-install-fab-left { right: auto; left: 16px; }
        @media (min-width: 768px) {
          /* Desktop sidebar is left-docked (220px) — clear it the same
             way bottom-right normally clears the right edge. */
          .kx-install-fab-left { left: 236px; }
        }

        /* Owner ask: mobile should actively nudge toward install, since
           installed-as-app is the best experience there — a slow,
           subtle pulse on the shadow (not the whole button scaling/
           moving, which would be distracting mid-scroll) keeps it
           noticeable without feeling like a nagging animation. Desktop
           stays static; the button already sits comfortably in view
           there without needing extra attention-pulling. */
        @keyframes kx-install-fab-pulse {
          0%, 100% {
            box-shadow:
              0 10px 26px -8px rgba(var(--accentRGB), 0.55),
              0 1px 2px rgba(0,0,0,0.12),
              inset 0 1px 0 rgba(255,255,255,0.25);
          }
          50% {
            box-shadow:
              0 10px 30px -6px rgba(var(--accentRGB), 0.85),
              0 1px 2px rgba(0,0,0,0.12),
              inset 0 1px 0 rgba(255,255,255,0.25);
          }
        }
        @media (max-width: 767px) {
          .kx-install-fab { animation: kx-install-fab-pulse 2.2s ease-in-out infinite; }
        }
        @media (prefers-reduced-motion: reduce) {
          .kx-install-fab { animation: none; }
        }

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
