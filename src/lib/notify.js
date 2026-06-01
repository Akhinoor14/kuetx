export function notify(message, type = 'info', duration = 3200) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('kuetx:toast', {
    detail: {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message: String(message || ''),
      type,
      duration,
    },
  }));
}