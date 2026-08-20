// useInstallPrompt.js
//
// PWA_INSTALL_BUTTON_PLAN.md — single shared hook behind the floating
// "Install" button (FloatingInstallButton.jsx). Mounted once in App.jsx's
// Layout, so it's visible to every signed-in role (student/faculty/
// provider/staff) on every route — this hook has zero role-awareness on
// purpose, "install the app" isn't a role-scoped concept.
//
// State machine (see PWA_INSTALL_BUTTON_PLAN.md for the full table):
//   'checking'            -> still doing the initial standalone-mode check, render nothing
//   'installed'           -> running AS the installed PWA right now (standalone
//                            window) -> hide button entirely, nothing to do here
//   'installed-elsewhere' -> NOT running standalone right now (this is an
//                            ordinary browser tab), but the PWA is confirmed
//                            installed on this device AND its service worker
//                            has no pending update -> button shows "Open app"
//   'update-available'    -> same as above, but a newer service worker is
//                            installed and waiting -> button shows "Update"
//   'installable'         -> a real captured beforeinstallprompt event is
//                            sitting ready -> button shows, tapping calls
//                            .prompt() directly, no confirmation dialog of
//                            our own
//   'ios-manual'          -> iOS Safari never fires beforeinstallprompt at
//                            all -> button shows, tapping opens an
//                            instruction sheet (Share -> Add to Home Screen)
//   'manual-wait'         -> Chrome/Edge/Android HASN'T fired
//                            beforeinstallprompt yet (browser's own
//                            engagement heuristic — visit count/time-on-site
//                            — not yet satisfied; this can't be bypassed
//                            from page JS, it's a browser trust/anti-spam
//                            gate) -> button STILL SHOWS (owner decision:
//                            never hide the install ask just because the
//                            browser hasn't offered its native prompt yet,
//                            especially on mobile where installing is the
//                            better experience) -> tapping opens the same
//                            manual-instructions sheet as 'ios-manual', with
//                            copy for whatever platform this is, since there
//                            is no .prompt() to call
//
// Owner decision (this session): "never hide the button, especially on
// mobile" — the old 'unavailable' terminal state (hide entirely until
// Chrome's own heuristic fires the event) is gone. Every non-installed,
// non-dismissed visitor on every platform now sees SOME actionable button:
// direct install where the browser allows it, otherwise a manual-steps
// sheet. Desktop keeps the exact same visual treatment; this is a state-
// machine change, not a platform-specific style change (owner: "desktop e
// easy kore rakhte pare" — desktop already works fine once
// beforeinstallprompt fires, which is common there, so no separate
// desktop styling was needed here beyond FloatingInstallButton's existing
// @media bottom-offset rule).

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
      setStatus('checking'); // stays hidden — 'checking' never renders, see FloatingInstallButton's guard
      return undefined;
    }

    // iOS Safari: no beforeinstallprompt ever fires, so this is a
    // terminal state decided immediately, not something we wait on.
    if (isIOSSafari()) {
      setStatus('ios-manual');
      return undefined;
    }

    // Chrome/Edge/etc: show the manual-instructions button immediately
    // rather than waiting silently for beforeinstallprompt — that event
    // is gated behind the browser's own engagement heuristic and may
    // never fire this session (or ever, for a visitor who doesn't meet
    // it). 'manual-wait' upgrades to 'installable' the moment a real
    // event does land, same as before.
    setStatus('manual-wait');

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

    // Confirmed-installed-elsewhere check: only ever upgrades
    // 'manual-wait' to 'installed-elsewhere'/'update-available' — never
    // runs if one of the terminal states above already returned, and
    // never downgrades 'installable' once a real beforeinstallprompt has
    // landed (that's a stronger, more actionable signal than this one).
    let cancelled = false;
    const checkInstalledElsewhere = async () => {
      try {
        if (!('getInstalledRelatedApps' in navigator)) return;
        const related = await navigator.getInstalledRelatedApps();
        if (cancelled || !related || related.length === 0) return; // empty = unknown, not "not installed" — never acts on this
        // Confirmed installed on this device. Now check for a pending
        // update on THIS tab's own registration — shared per-origin+scope
        // with the standalone window, so this really does reflect the
        // installed copy's state, not a guess.
        let hasUpdateWaiting = false;
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          hasUpdateWaiting = Boolean(reg && reg.waiting);
        }
        if (cancelled) return;
        setStatus((prev) => {
          // Don't clobber a real captured beforeinstallprompt or a
          // meanwhile-confirmed 'installed' standalone state.
          if (prev === 'installable' || prev === 'installed') return prev;
          return hasUpdateWaiting ? 'update-available' : 'installed-elsewhere';
        });
      } catch {
        // Unsupported or threw — leave status as-is, no worse than before this check existed.
      }
    };
    checkInstalledElsewhere();

    // BUGFIX (button never comes back after a real uninstall): once
    // 'installed' was set, nothing ever looked again — if the person
    // later uninstalled the PWA and came back to this same tab (or a new
    // one) still within the dismiss window, the button had no way to
    // know the app was gone and just stayed hidden forever. Every time
    // the tab regains focus/visibility, re-check the one ground-truth
    // signal (are we actually running standalone right now?) and drop
    // back to watching for beforeinstallprompt / re-run the installed-
    // elsewhere check if not.
    const recheckStandalone = () => {
      if (isStandaloneDisplay()) {
        setStatus('installed');
      } else {
        setStatus((prev) => (prev === 'installed' ? 'manual-wait' : prev));
        checkInstalledElsewhere();
      }
    };
    window.addEventListener('focus', recheckStandalone);
    document.addEventListener('visibilitychange', recheckStandalone);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('focus', recheckStandalone);
      document.removeEventListener('visibilitychange', recheckStandalone);
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
        // Declined THIS specific native prompt (closed the sheet, tapped
        // Cancel, etc) — falls back to the manual-instructions button
        // rather than disappearing, so a visitor who dismissed the
        // native sheet by accident still has a way to install later in
        // the same session.
        setStatus('manual-wait');
      }
      try { window.__kxInstallPromptPending = false; } catch {}
    } catch {
      // userChoice can reject if the prompt was interrupted — no-op,
      // button just stays in whatever state it was.
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  // 'installed-elsewhere' -> just navigate to the app root in this same
  // tab; we deliberately do NOT call .prompt() or anything install-
  // related here, since the whole point of this state is "already
  // installed, don't install again". 'update-available' -> tell the
  // waiting SW to activate (same SKIP_WAITING message index.html itself
  // sends) then reload, so the person gets the fresh version immediately
  // instead of waiting for their next natural reload.
  const openOrUpdate = useCallback(async () => {
    if (status === 'update-available' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.href = '/';
          }, { once: true });
          return;
        }
      } catch {
        // fall through to a plain navigation below
      }
    }
    window.location.href = '/';
  }, [status]);

  return { status, triggerInstall, openOrUpdate };
}
