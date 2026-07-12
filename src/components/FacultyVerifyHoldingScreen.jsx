// FacultyVerifyHoldingScreen.jsx
//
// §5 Step 2.3 of the merged prompt — shown as its own onboarding-queue step
// right after a teacher account is created (createFacultyAccountDoc has
// already run with verifiedAt: null). Sends the magic link, then waits via
// a live Firestore subscription (subscribeFacultyDoc) for verifiedAt to
// flip — no manual "I've verified" button, matching the auto-polling
// pattern already used for student KUET email verification elsewhere in
// this app (per §12 Ambiguity Protocol: follow the nearest existing
// analogous pattern for anything not spelled out).
//
// This is a HARD GATE (Deviation 2) — there is no skip/dismiss here, unlike
// the optional nice-to-have verification banners elsewhere in the app.
// All copy is English per Deviation 3.

import { useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';
import { subscribeFacultyDoc, markFacultyVerifiedIfEmailConfirmed } from '../lib/facultySync';
import {
  sendFacultyVerificationLink,
  isFacultyVerifyLink,
  completeFacultyVerificationLink,
} from '../lib/facultyEmailVerify';

export default function FacultyVerifyHoldingScreen({ officialEmail, onVerified }) {
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'resending' | 'resent' | 'error'
  const [error, setError] = useState('');

  // Live-subscribe to our own faculty doc so this screen auto-advances the
  // instant verifiedAt is set, without any manual "I've verified" click.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeFacultyDoc(uid, (fdoc) => {
      if (fdoc?.verifiedAt) onVerified?.();
    });
    return unsub;
  }, [onVerified]);

  // Complete the link if the current page load IS the clicked link itself
  // (same-device or a fresh tab opened from the emailed link), then confirm
  // + write verifiedAt via facultySync.js. This runs once on mount.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isFacultyVerifyLink()) return;
      const result = await completeFacultyVerificationLink();
      if (cancelled) return;
      if (result.status === 'success') {
        const uid = auth.currentUser?.uid;
        if (uid) {
          try {
            await markFacultyVerifiedIfEmailConfirmed(uid, result.email);
            onVerified?.();
          } catch (e) {
            setStatus('error');
            setError(e.message || 'Could not confirm verification. Please try again.');
          }
        }
      } else if (result.status === 'error') {
        setStatus('error');
        setError(result.message);
      }
      // 'not-a-link' / 'needs-email' — leave the waiting screen as-is;
      // cross-device email-confirmation prompts are a later-phase nicety,
      // not required for Phase 2.
    }
    run();
    return () => { cancelled = true; };
  }, [onVerified]);

  const resend = async () => {
    setStatus('resending');
    setError('');
    try {
      await sendFacultyVerificationLink(officialEmail);
      setStatus('resent');
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Could not send the verification link. Please try again.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 18, padding: 28,
        width: '100%', maxWidth: 440, textAlign: 'center',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        <Mail size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: 'var(--text)' }}>
          Verify your email to continue
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          We've sent a sign-in link to <strong style={{ color: '#0f7d58' }}>{officialEmail}</strong>.
          Open it from your inbox — this page will continue automatically once it's confirmed.
          <div style={{ marginTop: 10, color: '#0f7d58', fontWeight: 600 }}>
            If you don't see the email, please check your spam folder.
          </div>
        </div>

        {status === 'resent' && (
          <div style={{ fontSize: 12.5, color: 'var(--accent)', marginBottom: 14 }}>
            A new link has been sent.
          </div>
        )}
        {status === 'error' && error && (
          <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={resend}
          disabled={status === 'resending'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          {status === 'resending' ? 'Sending…' : 'Resend verification link'}
        </button>
      </div>
    </div>
  );
}
