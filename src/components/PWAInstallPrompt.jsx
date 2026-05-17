import { useEffect, useRef, useState } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const promptTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const beforeInstallHandler = (e) => {
      try {
        e.preventDefault();
      } catch {}
      setDeferredPrompt(e);
    };

    const appInstalled = () => {
      try {
        localStorage.setItem('kuetx_pwa_prompt_dismissed', 'installed');
      } catch {}
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalled);

    return () => {
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
      }
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);

  if (installed) return null;

  const onInstall = async () => {
    try {
      if (!deferredPrompt) {
        setShowHint(true);
        window.clearTimeout(promptTimerRef.current);
        promptTimerRef.current = window.setTimeout(() => setShowHint(false), 2600);
        return;
      }

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        try {
          localStorage.setItem('kuetx_pwa_prompt_dismissed', 'installed');
        } catch {}
        setInstalled(true);
        setDeferredPrompt(null);
      }

      setShowHint(false);
    } catch {
      setShowHint(true);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-1.5">
      {showHint ? (
        <div className="max-w-[10.5rem] rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 text-[11px] leading-4 text-slate-600 shadow-md backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-300">
          Use browser menu to install.
        </div>
      ) : null}

      <button
        type="button"
        onClick={onInstall}
        className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/88 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.12)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_22px_rgba(15,23,42,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:border-slate-700/80 dark:bg-slate-900/88 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
        title="Install KUETx"
        aria-label="Install KUETx app"
      >
        <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 transition group-hover:bg-emerald-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
          </svg>
        </span>
        <span>Install</span>
      </button>
    </div>
  );
}
