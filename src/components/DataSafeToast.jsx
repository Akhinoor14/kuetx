/**
 * DataSafeToast.jsx
 * Shows once to new users: "data local e safe ache"
 * Dismisses permanently on click/timeout
 */
import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

const TOAST_KEY = 'kuetx_data_safe_toast_seen';

export default function DataSafeToast() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(TOAST_KEY)) return;
    // Show after 2s (let app settle first)
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setHiding(true);
    localStorage.setItem(TOAST_KEY, '1');
    setTimeout(() => setVisible(false), 300);
  };

  useEffect(() => {
    if (!visible) return;
    // Auto-dismiss after 7s
    const t = setTimeout(dismiss, 7000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, maxWidth: 320, width: 'calc(100% - 32px)',
      background: 'var(--surface)', border: '1.5px solid color-mix(in srgb, var(--success) 40%, var(--border))',
      borderRadius: 12, padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      opacity: hiding ? 0 : 1,
      transition: 'opacity 0.3s ease',
      fontFamily: 'Sora, sans-serif',
    }}>
      <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
          তোমার data safe আছে ✓
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          সব কিছু এই device এ locally save হচ্ছে। Internet ছাড়াও কাজ করবে।
          Login করলে সব device এ sync পাবে।
        </div>
      </div>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--muted)', padding: 2, flexShrink: 0,
      }}>
        <X size={14} />
      </button>
    </div>
  );
}
