// ProfileCompleteReminder.jsx
//
// Anyone who used ProfileSetupModal's "Finish now, add rest later"
// shortcut only has name + studentId saved — everything else (session,
// current term, term start date, residence/advisor info) is still empty.
// This is a soft, snoozable nudge (same pattern as VerifyReminderPopup /
// BackupReminderGate) that appears on a LATER session — never in the
// same first-launch session as onboarding — inviting them to open the
// full setup form. Clicking it opens ProfileSetupModal in its normal
// (non-mandatory, closable, all steps + skip available) mode; the
// person can fill in as much or as little as they want and it won't
// come back once every extra field has something in it, or once
// dismissed for the day.
//
// "Next session" is tracked with a one-time module-load marker in
// sessionStorage (cleared automatically when the tab/app fully closes
// and reopens) rather than just queue.length === 0 — the mandatory
// onboarding queue can empty in the SAME session right after "Finish
// now" is clicked (advance() runs immediately, nothing else queued for
// a brand-new install), so relying on queue emptiness alone would show
// this reminder seconds after onboarding instead of on a later visit.

import { useEffect, useState } from 'react';
import { store, getProfile, normalizeProfileForSave, validateProfileForSave } from '../store/store';
import ProfileSetupModal from './ProfileSetupModal';

const SNOOZE_KEY = 'kuetxProfileCompleteReminderSnoozed';

function isExtrasEmpty(profile) {
  const p = profile || {};
  return !String(p.session || '').trim()
    && !String(p.currentTermKey || '').trim()
    && !String(p.termStartDate || '').trim()
    && !String(p.hallName || '').trim()
    && !String(p.roomNo || '').trim()
    && !String(p.advisorName || '').trim()
    && !String(p.advisorContact || '').trim();
}

// True only from the NEXT page load onward, relative to whenever profile
// setup last completed. The mandatory queue's "Finish now" advance()
// happens WITHOUT a page reload, so telling "same load as onboarding"
// apart from "reopened the app" needs a load counter rather than a
// sessionStorage flag: main.jsx bumps window.__kuetxLoadCounter exactly
// once per real page load (before this component ever mounts), and
// App.jsx snapshots that counter into 'kuetxProfileFinishedAtLoad' at the
// exact moment mandatory profile setup is saved. This component only
// enables itself once the CURRENT load's counter is strictly higher than
// the one recorded at save time — i.e. the page has been reloaded/reopened
// since onboarding finished.
function isFreshSessionSinceProfileSetup() {
  try {
    const savedAtLoad = store.get('kuetxProfileFinishedAtLoad');
    if (savedAtLoad == null) return true; // no record — profile predates this feature, fine to nudge
    const thisLoad = window.__kuetxLoadCounter || 0;
    return thisLoad > savedAtLoad;
  } catch { return true; }
}

export default function ProfileCompleteReminder() {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const profile = getProfile();

    // Only nudge once there's at least a minimal profile (name+roll) —
    // matches isProfileComplete()'s new minimal definition. If somehow
    // still incomplete, App.jsx's own mandatory queue handles that case.
    if (!String(profile?.name || '').trim() || !String(profile?.studentId || '').trim()) return;
    if (!isExtrasEmpty(profile)) return; // already filled in — nothing to remind about

    // Never nudge on the very session profile setup just happened in —
    // wait for the NEXT time the app is opened (new tab/launch).
    if (!isFreshSessionSinceProfileSetup()) return;

    const today = new Date().toDateString();
    if (store.get(SNOOZE_KEY) === today) return;

    const timer = window.setTimeout(() => setOpen(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  const snooze = () => {
    store.set(SNOOZE_KEY, new Date().toDateString());
    setOpen(false);
  };

  const openFullSetup = () => {
    setOpen(false);
    setModalOpen(true);
  };

  if (modalOpen) {
    return (
      <ProfileSetupModal
        isOpen={true}
        onClose={() => setModalOpen(false)}
        onSave={(formData) => {
          const result = validateProfileForSave(formData);
          if (!result.ok) {
            const msgs = Object.values(result.errors).join('\n');
            alert('Profile cannot be saved:\n' + msgs);
            return;
          }
          store.set('profile', normalizeProfileForSave(formData));
          setModalOpen(false);
        }}
        initialProfile={getProfile()}
      />
    );
  }

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 4500, maxWidth: 340, width: 'calc(100% - 32px)',
      background: 'var(--surface)', border: '1.5px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: 'Sora, sans-serif',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        📋 Finish setting up your profile?
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
        Add your session, current term, and hall so Schedule, CGPA, and the term timeline work properly. You can do it any time.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={openFullSetup} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          Do it now
        </button>
        <button onClick={snooze} style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Later
        </button>
      </div>
    </div>
  );
}