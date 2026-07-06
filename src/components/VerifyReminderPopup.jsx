import { useEffect, useState } from 'react';
import Modal from './Modal';
import KuetEmailVerifyWidget from './KuetEmailVerifyWidget';
import { store, getProfile } from '../store/store';
import { isRollInstitutionallyVerified, isKuetEmailFormat } from '../lib/kuetEmailVerify';

const REMIND_KEY = 'kuetVerifyReminderLastShown';
const REMIND_DAYS = 3;

/**
 * App-wide nudge to get KUET-email-verified. Soft-required by design (see
 * ProfileSetupModal's inline widget for the first ask) — this is the
 * follow-up for anyone who skipped there. No "never show again" option:
 * dismissing just snoozes it for REMIND_DAYS, matching BackupReminderGate's
 * pattern. Stops appearing permanently the moment verification succeeds.
 */
export default function VerifyReminderPopup() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const profile = getProfile();
      const roll = String(profile?.studentId || '').trim();

      // Nothing to verify against yet (profile incomplete) — skip silently.
      if (!roll || roll.length < 4) { setChecked(true); return; }

      const alreadyVerified = await isRollInstitutionallyVerified(roll);
      if (cancelled) return;
      if (alreadyVerified) { setChecked(true); return; }

      const last = store.get(REMIND_KEY);
      if (last) {
        const elapsedDays = (Date.now() - new Date(last)) / 86400000;
        if (elapsedDays < REMIND_DAYS) { setChecked(true); return; }
      }

      const timer = window.setTimeout(() => {
        setOpen(true);
        setChecked(true);
      }, 2500);
      return () => window.clearTimeout(timer);
    }

    check();
    return () => { cancelled = true; };
  }, []);

  const snooze = () => {
    store.set(REMIND_KEY, new Date().toISOString());
    setOpen(false);
  };

  const handleVerified = () => {
    // Verified — clear the snooze marker so it never resurfaces, and close.
    store.set(REMIND_KEY, null);
    setOpen(false);
  };

  if (!checked || !open) return null;

  return (
    <Modal open={open} onClose={snooze} title="KUET email verify করো">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
          তোমার account এখনো KUET-verified না। Verify করলে classmates দের কাছে তোমার নামের পাশে blue tick দেখাবে —
          এটা একবার করলেই যথেষ্ট, পরে আর জিজ্ঞেস করবে না।
        </p>
        <KuetEmailVerifyWidget onVerified={handleVerified} onSkip={snooze} compact />
      </div>
    </Modal>
  );
}
