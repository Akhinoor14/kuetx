import { useEffect, useRef, useState } from 'react';

// ── Browser / OS detection ────────────────────────────────────────────────
function detectEnv() {
  if (typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isChrome = /chrome|chromium|crios/i.test(ua) && !/edge|opr\//i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  const isOpera = /opr\//i.test(ua);
  const isFirefox = /firefox|fxios/i.test(ua);
  const isEdge = /edg\//i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;
  return { isIOS, isSafari, isChrome, isSamsung, isOpera, isFirefox, isEdge, isAndroid, isStandalone };
}

// Returns instructions for browsers that don't fire beforeinstallprompt
function getManualInstructions(env) {
  if (env.isIOS && env.isSafari) {
    return {
      type: 'ios',
      steps: [
        { icon: '⎋', text: <>Tap the <strong>Share</strong> button at the bottom</> },
        { icon: '＋', text: <>Scroll down, tap <strong>"Add to Home Screen"</strong></> },
        { icon: '✓', text: <>Tap <strong>Add</strong> — installed!</> },
      ],
    };
  }
  if (env.isSamsung) {
    return {
      type: 'samsung',
      steps: [
        { icon: '⋮', text: <>Tap the <strong>menu (⋮)</strong> in Samsung Internet</> },
        { icon: '＋', text: <>Tap <strong>"Add page to"</strong> → <strong>Home screen</strong></> },
        { icon: '✓', text: <>Tap <strong>Add</strong></> },
      ],
    };
  }
  if (env.isFirefox && env.isAndroid) {
    return {
      type: 'firefox',
      steps: [
        { icon: '⋮', text: <>Tap the <strong>menu (⋮)</strong> in Firefox</> },
        { icon: '＋', text: <>Tap <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong></> },
      ],
    };
  }
  if (env.isOpera) {
    return {
      type: 'opera',
      steps: [
        { icon: '…', text: <>Tap <strong>menu (…)</strong> in Opera</> },
        { icon: '＋', text: <>Tap <strong>"Home screen"</strong></> },
      ],
    };
  }
  // Generic fallback
  return {
    type: 'generic',
    steps: [
      { icon: '⋮', text: <>Open your <strong>browser menu</strong></> },
      { icon: '＋', text: <>Look for <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></> },
    ],
  };
}

// ── Component ─────────────────────────────────────────────────────────────
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [panelMode, setPanelMode] = useState(null);
  const [hiddenUntil, setHiddenUntil] = useState(0);
  const [env] = useState(() => detectEnv());
  const hideTimer = useRef(null);

  useEffect(() => {
    if (env.isStandalone) { setInstalled(true); return; }

    // Check previously installed flag
    try {
      if (localStorage.getItem('kuetx_pwa_installed') === '1') {
        setInstalled(true); return;
      }
    } catch {}

    const now = Date.now();
    try {
      const stored = Number(localStorage.getItem('kuetx_pwa_install_hide_until') || 0);
      if (stored > now) {
        setHiddenUntil(stored);
        hideTimer.current = setTimeout(() => {
          setHiddenUntil(0);
          try { localStorage.removeItem('kuetx_pwa_install_hide_until'); } catch {}
        }, stored - now);
      }
    } catch {}

    const onBeforeInstall = (e) => {
      try { e.preventDefault(); } catch {}
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      try { localStorage.setItem('kuetx_pwa_installed', '1'); } catch {}
      setInstalled(true);
      setDeferredPrompt(null);
      setPanelMode(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || hiddenUntil > Date.now()) return null;

  const handleInstall = async () => {
    // Native prompt available (Chrome Android, Edge, Samsung sometimes)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          try { localStorage.setItem('kuetx_pwa_installed', '1'); } catch {}
          setInstalled(true);
          setDeferredPrompt(null);
          setPanelMode(null);
        }
      } catch {
        // prompt() failed — fall through to manual hint
        setPanelMode('hint');
      }
      return;
    }
    // No native prompt — show manual instructions
    setPanelMode('hint');
  };

  const instructions = getManualInstructions(env);

  const handleLater = () => {
    const hideUntilMs = Date.now() + 8 * 60 * 60 * 1000;
    setHiddenUntil(hideUntilMs);
    setPanelMode(null);
    try { localStorage.setItem('kuetx_pwa_install_hide_until', String(hideUntilMs)); } catch {}
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setHiddenUntil(0);
      try { localStorage.removeItem('kuetx_pwa_install_hide_until'); } catch {}
    }, 8 * 60 * 60 * 1000);
  };

  return (
    <div className="pwa-prompt-wrap">
      {panelMode === 'ask' && (
        <div className="pwa-dialog-backdrop" role="presentation" onClick={handleLater}>
          <div className="pwa-dialog-card" role="dialog" aria-label="Install app" onClick={(event) => event.stopPropagation()}>
            <div className="pwa-dialog-kicker">KUETx App</div>
            <div className="pwa-dialog-title">Install KUETx</div>
            <div className="pwa-dialog-sub">Dedicated window, offline access, one-tap launch.</div>
            <div className="pwa-dialog-points">
              <div className="pwa-dialog-point"><span>•</span><span>Offline ready</span></div>
              <div className="pwa-dialog-point"><span>•</span><span>Native feel</span></div>
              <div className="pwa-dialog-point"><span>•</span><span>Less chrome</span></div>
            </div>
            <div className="pwa-dialog-actions">
              <button type="button" className="pwa-dialog-primary" onClick={() => { setPanelMode(null); handleInstall(); }}>
                Install
              </button>
              <button type="button" className="pwa-dialog-secondary" onClick={() => setPanelMode('hint')}>
                Steps
              </button>
              <button type="button" className="pwa-dialog-ghost" onClick={handleLater}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual install hint */}
      {panelMode === 'hint' && (
        <div className="pwa-dialog-backdrop" role="presentation" onClick={() => setPanelMode(null)}>
          <div className="pwa-dialog-card pwa-dialog-card-hint" role="dialog" aria-label="How to install" onClick={(event) => event.stopPropagation()}>
            <div className="pwa-dialog-kicker">Manual install</div>
            <div className="pwa-dialog-title">Install KUETx from your browser menu</div>
            <div className="pwa-dialog-sub">Follow these browser-specific steps if the install button is not available.</div>
            <div className="pwa-hint-steps">
              {instructions.steps.map((step, i) => (
                <div key={i} className="pwa-hint-step">
                  <span className="pwa-hint-num">{i + 1}</span>
                  <span className="pwa-hint-text">{step.text}</span>
                </div>
              ))}
            </div>
            <div className="pwa-dialog-actions">
              <button className="pwa-dialog-secondary" type="button" onClick={() => setPanelMode('ask')}>Back</button>
              <button className="pwa-dialog-primary" type="button" onClick={() => setPanelMode(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating install button */}
      <button
        type="button"
        onClick={() => setPanelMode('ask')}
        className={`pwa-install-btn${panelMode ? ' active' : ''}`}
        title="Install KUETx app"
        aria-label="Install KUETx"
        aria-expanded={!!panelMode}
      >
        <span className="pwa-install-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
          </svg>
        </span>
        <span>Install</span>
      </button>
    </div>
  );
}
