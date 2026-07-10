import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { store, getProfile, isProfileComplete } from '../store/store';
import { auth } from '../lib/firebase';
import { isPushSupported, getPushPermissionState, enablePush } from '../lib/push';
import { notify } from '../lib/notify';

const SNOOZE_KEY = 'pushBannerSnoozedUntil';
const SNOOZE_DAYS = 5;

/**
 * Soft, dismissible in-app banner shown BEFORE the native browser
 * permission prompt — asks "Notice এলে notification পেতে চান?" with
 * Allow/Not now. Only calling enablePush() (which triggers the real
 * browser popup) happens after an explicit tap on "Allow" here — the
 * app never cold-opens the native prompt on its own, matching the
 * non-intrusive UX called for in Phase E.
 *
 * Shows at most once per SNOOZE_DAYS, never once permission is already
 * 'granted' or 'denied' (denied = respect the browser-level decision,
 * don't nag), never for anonymous/incomplete-profile users, and never
 * while onboarding (App.jsx only mounts this after the onboarding
 * queue is empty, same convention as VerifyReminderPopup).
 */
export default function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await isPushSupported())) return;
      if (auth.currentUser?.isAnonymous !== false) return; // require real signed-in account
      if (!isProfileComplete(getProfile())) return;

      const permission = getPushPermissionState();
      if (permission !== 'default') return; // already granted or denied — nothing to ask

      const snoozedUntil = store.get(SNOOZE_KEY);
      if (snoozedUntil && Date.now() < new Date(snoozedUntil).getTime()) return;

      if (!cancelled) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const snooze = () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString();
    store.set(SNOOZE_KEY, until);
    setVisible(false);
  };

  const allow = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setVisible(false);
    if (result.ok) {
      notify('Push notification চালু হয়েছে!', 'success');
    } else if (result.reason === 'denied') {
      // Browser-level denial — snooze so we don't keep re-showing our
      // own banner when the native prompt will just get auto-blocked.
      const until = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString();
      store.set(SNOOZE_KEY, until);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Enable push notifications"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
        maxWidth: 420,
        margin: '0 auto',
        zIndex: 100055,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '14px 14px',
        borderRadius: 14,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
      }}
    >
      <Bell size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>
          নতুন Notice এলে জানতে চাও?
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45, marginBottom: 10 }}>
          App বন্ধ থাকলেও push notification পাঠাবো, যাতে জরুরি notice মিস না হয়।
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={allow}
            disabled={busy}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12.5,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'অপেক্ষা করো…' : 'Allow'}
          </button>
          <button
            onClick={snooze}
            disabled={busy}
            style={{
              padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={snooze}
        aria-label="Close"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0, padding: 2 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
