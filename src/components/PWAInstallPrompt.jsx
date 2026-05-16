import { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const beforeInstallHandler = (e) => {
      try {
        e.preventDefault();
      } catch {}
      setDeferredPrompt(e);

      try {
        const dismissed = localStorage.getItem('kuetx_pwa_prompt_dismissed');
        if (!dismissed) setTimeout(() => setVisible(true), 800);
      } catch {
        setTimeout(() => setVisible(true), 800);
      }
    };

    const appInstalled = () => {
      try {
        localStorage.setItem('kuetx_pwa_prompt_dismissed', 'installed');
      } catch {}
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  const onInstall = async () => {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        try {
          localStorage.setItem('kuetx_pwa_prompt_dismissed', 'installed');
        } catch {}
        setVisible(false);
        setDeferredPrompt(null);
      } else {
        try {
          localStorage.setItem('kuetx_pwa_prompt_dismissed', 'dismissed');
        } catch {}
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  };

  const onDismiss = () => {
    try {
      localStorage.setItem('kuetx_pwa_prompt_dismissed', 'dismissed');
    } catch {}
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 border">
        <div className="flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v6m0 8v6m8-8h-6M4 12H2" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Install the app</div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">No hassle — fast &amp; easy.</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onDismiss} className="text-sm px-3 py-1 rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-200">Maybe later</button>
          <button onClick={onInstall} className="bg-indigo-600 text-white text-sm px-3 py-1 rounded-md hover:bg-indigo-700">Install</button>
        </div>
      </div>
    </div>
  );
}
