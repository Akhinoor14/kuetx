// Global ticker - emits a 'kuetx:tick' event every second (aligned to wall-clock seconds)
let tickerInterval = null;
const startTicker = () => {
  if (tickerInterval) return;
  const align = () => {
    const now = Date.now();
    const next = 1000 - (now % 1000) + 4; // small offset
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('kuetx:tick', { detail: { now: Date.now() } }));
      tickerInterval = setInterval(() => window.dispatchEvent(new CustomEvent('kuetx:tick', { detail: { now: Date.now() } })), 1000);
    }, next);
  };
  align();
};

// start eagerly
try { startTicker(); } catch {}

export const subscribeTicker = (fn) => {
  window.addEventListener('kuetx:tick', fn);
  // return unsubscribe
  return () => window.removeEventListener('kuetx:tick', fn);
};

export default { startTicker, subscribeTicker };
