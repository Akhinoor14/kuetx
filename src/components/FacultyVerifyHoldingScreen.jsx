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
//
// BUGFIX (see BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md): actually completing
// the clicked magic-link now happens in a boot-level effect in App.jsx —
// independent of the onboarding queue — not here. This screen previously
// did that itself on mount, but it only ever mounted when accountRole was
// already 'teacher' on that exact browser, so a link opened in a new tab,
// a different browser, a phone's mail app, or after the original tab was
// closed/refreshed silently did nothing: this screen never mounted, so the
// link-completion code never ran. This screen's only job now is: (1) send/
// resend the link, and (2) live-subscribe to faculty/{uid}.verifiedAt and
// auto-advance the instant it flips true — regardless of which tab/device
// actually completed the link click.

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, ExternalLink } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getFacultyDoc, subscribeFacultyDoc } from '../lib/facultySync';
import { sendFacultyVerificationLink } from '../lib/facultyEmailVerify';

// Gmail's own "go straight to Spam" URL — since institutional/automated
// sign-in-link emails land in Spam often enough that Anthropic-style
// "check your spam folder" text alone isn't reliable, this jumps the
// person directly to the #spam label instead of #inbox. Real, documented
// Gmail label-URL pattern (mail.google.com/mail/u/0/#spam). Only
// gmail.com/googlemail.com addresses get this button — anything else
// (Yahoo, Outlook, institutional domains, etc.) doesn't share this URL
// pattern, so we fall back to the plain instruction text for those.
const isGmailAddress = (email) => /@(gmail|googlemail)\.com$/i.test(String(email || '').trim());
const GMAIL_SPAM_URL = 'https://mail.google.com/mail/u/0/#spam';

export default function FacultyVerifyHoldingScreen({ officialEmail, onVerified }) {
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'resending' | 'resent' | 'error'
  const [error, setError] = useState('');

  // Live-subscribe to our own faculty doc so this screen auto-advances the
  // instant verifiedAt is set, without any manual "I've verified" click —
  // works whether the link was clicked in this same tab or a different one,
  // since Firestore is the shared source of truth either way.
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getFacultyDoc(uid).then((fdoc) => {
      if (fdoc?.verifiedAt) onVerified?.();
    }).catch(() => {});
  }, [uid, onVerified]);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeFacultyDoc(uid, (fdoc) => {
      if (fdoc?.verifiedAt) onVerified?.();
    });
    return unsub;
  }, [onVerified, uid]);

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
      position: 'fixed', inset: 0,
      // BUGFIX: was a translucent rgba(0,0,0,0.5) overlay — combined with
      // Layout mounting underneath (fixed separately in App.jsx), the
      // half-set-up Dashboard was visibly showing through, dimmed, the
      // entire time someone was waiting to verify their email. Opaque
      // now, matching RoleSelectScreen's approach, as defense-in-depth.
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>      <div style={{
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
          Open it from your inbox — this popup will stay visible until verification is confirmed.
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

        {isGmailAddress(officialEmail) && (
          <a
            href={GMAIL_SPAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '11px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 700,
              textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box',
            }}
          >
            <ExternalLink size={14} />
            Open Gmail Spam Folder
          </a>
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
