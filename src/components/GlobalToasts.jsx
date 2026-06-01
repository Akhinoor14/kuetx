import { useEffect, useState } from 'react';

export default function GlobalToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (event) => {
      const toast = event.detail;
      if (!toast?.id) return;
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.duration || 3200);
    };

    window.addEventListener('kuetx:toast', onToast);
    return () => window.removeEventListener('kuetx:toast', onToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="kuetx-toasts" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`kuetx-toast kuetx-toast-${toast.type || 'info'}`} role="status">
          <span className="kuetx-toast-dot" />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}