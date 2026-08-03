// useInstallPrompt.js
//
// PWA_INSTALL_BUTTON_PLAN.md — single shared hook behind the floating
// "Install" button (FloatingInstallButton.jsx). Mounted once in App.jsx's
// Layout, so it's visible to every signed-in role (student/faculty/
// provider/staff) on every route — this hook has zero role-awareness on
// purpose, "install the app" isn't a role-scoped concept.
//
// State machine (see PWA_INSTALL_BUTTON_PLAN.md for the full table):
//   'checking'    -> still doing the initial standalone-mode check, render nothing
//   'installed'   -> already running as an installed PWA, or the person
//                    installed it earlier this session -> hide button
//   'unavailable' -> no captured beforeinstallprompt (browser hasn't fired
//                    it, requirements not met, or this is a browser that
//                    never fires it) AND not iOS Safari -> hide button
//   'ios-manual'  -> iOS Safari never fires beforeinstallprompt at all;
//                    the only path there is the manual Share-sheet steps
//                    -> button shows, tapping opens an instruction sheet
//   'installable' -> a real captured event is sitting ready -> button
//                    shows, tapping calls .prompt() directly, no
//                    confirmation dialog of our own
//
// Chrome/Edge/Android are the only browsers that ever fire
// beforeinstallprompt — desktop Firefox and Safari (all platforms other
// than iOS) simply never reach 'installable', which is correct: there is
// no programmatic install path there, so per the "click = direct
// install, no separate button" requirement, the honest thing is to show
// nothing rather than a button with no working install-here mechanism.

import { useEffect, useState, useCallback } from 'react';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia && window.matchMedia('(display-mode: standalone)');
  // iOS Safari's own (non-standard) flag — matchMedia('display-mode:
  // standalone') is unreliable on iOS, navigator.standalone is the real
  // signal there.
  const iosStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
  return Boolean((mql && mql.matches) || iosStandalone);
}

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

const DISMISS_KEY = 'kuetx_install_dismissed_until';
const DISMISS_DAYS = 14;

function isDismissedForNow() {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // localStorage unavailable (private mode) — nothing to persist,
    // button will just keep showing next load, acceptable fallback.
  }
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setStatus('installed');
      return undefined;
    }

    if (isDismissedForNow()) {
      setStatus('unavailable');
      return undefined;
    }

    // iOS Safari: no beforeinstallprompt ever fires, so this is a
    // terminal state decided immediately, not something we wait on.
    if (isIOSSafari()) {
      setStatus('ios-manual');
      return undefined;
    }

    // Otherwise wait for the real browser signal — until it fires (or
    // never does), stay 'unavailable' so the button doesn't render.
    setStatus('unavailable');

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setStatus('installable');
      // BUGFIX (install button vanishing after an SW update): the SW's
      // forced reload on controllerchange (see index.html) used to fire
      // at any moment, including right after beforeinstallprompt landed —
      // wiping this React state via a full page reload before the user
      // ever saw/tapped the button. Chrome doesn't reliably refire
      // beforeinstallprompt on the very next load (session/engagement
      // heuristic), so the button would then just stay hidden. This flag
      // tells index.html's reload logic to hold off while a real,
      // not-yet-acted-on prompt is live.
      try { window.__kxInstallPromptPending = true; } catch {}
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setStatus('installed');
      try { window.__kxInstallPromptPending = false; } catch {}
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // One click = one direct install, no extra confirmation dialog of our
  // own (browser's own native install sheet is the only prompt shown) —
  // per explicit product decision, this hook never renders/awaits a
  // "are you sure" step before calling .prompt().
  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setStatus('installed');
      } else {
        // Declined this time — Chrome won't refire beforeinstallprompt
        // again for a while regardless, so treat this the same as a
        // manual dismiss (cooldown) rather than leaving a dead button up.
        dismissInstallPrompt();
        setStatus('unavailable');
      }
      try { window.__kxInstallPromptPending = false; } catch {}
    } catch {
      // userChoice can reject if the prompt was interrupted — no-op,
      // button just stays in whatever state it was.
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { status, triggerInstall };
}
