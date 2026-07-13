// FacultyVerifyHoldingScreen.jsx
//
// §5 Step 2.3 of the merged prompt — shown as its own onboarding-queue step
// right after a teacher account is created (createFacultyAccountDoc has
// already run with verifiedAt: null).
//
// RESTRUCTURE (code-main, link-backup): the OTP code (requestOtp/
// verifyOtp, see otpVerify.js + functions/index.js) is now the PRIMARY
// method — a 6-digit code is sent automatically on mount, and the person
// types it into the boxes below to verify immediately, no tab-switching
// required. The original magic-link flow (facultyEmailVerify.js) still
// works exactly as before and is one click away via "Use email link
// instead" — some institutional mail filters mangle/strip links, so
// keeping both live is deliberate, not just a transition step.
//
// Auto-advance still happens via the live Firestore subscription
// (subscribeFacultyDoc) watching faculty/{uid}.verifiedAt — this covers
// BOTH methods identically, since verifyOtp() and the magic-link
// completion path both write the same durable verifiedFacultyEmails/{email}
// doc that ultimately flips verifiedAt (see facultySync.js /
// markFacultyVerifiedIfEmailConfirmed). Whichever method succeeds first
// auto-advances this screen — no manual "I've verified" button either way.
//
// This is a HARD GATE (Deviation 2) — there is no skip/dismiss here. All
// copy is English per Deviation 3.

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, ExternalLink, KeyRound, Link2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getFacultyDoc, subscribeFacultyDoc, markFacultyVerifiedIfEmailConfirmed } from '../lib/facultySync';
import { sendFacultyVerificationLink } from '../lib/facultyEmailVerify';
import { requestOtpCode, verifyOtpCode } from '../lib/otpVerify';
import OtpInput from './OtpInput';

// Gmail's own "go straight to Spam" URL — institutional/automated
// sign-in emails land in Spam often enough that text alone isn't
// reliable, so this jumps directly to the #spam label. Only shown for
// gmail.com/googlemail.com addresses — no equivalent universal link
// exists for other providers.
const isGmailAddress = (email) => /@(gmail|googlemail)\.com$/i.test(String(email || '').trim());
const GMAIL_SPAM_URL = 'https://mail.google.com/mail/u/0/#spam';

export default function FacultyVerifyHoldingScreen({ officialEmail, onVerified }) {
  const [method, setMethod] = useState('code'); // 'code' | 'link'

  // --- OTP state ---
  const [otp, setOtp] = useState('');
  const [otpStatus, setOtpStatus] = useState('sending'); // 'sending' | 'sent' | 'verifying' | 'error' | 'resending'
  const [otpError, setOtpError] = useState('');

  // --- Magic-link state (unchanged behavior, just demoted to backup) ---
  const [linkStatus, setLinkStatus] = useState('idle'); // 'idle' | 'resending' | 'resent' | 'error'
  const [linkError, setLinkError] = useState('');

  const uid = auth.currentUser?.uid;

  // Auto-advance the instant verifiedAt flips true, via either method.
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

  // Send the first OTP automatically on mount — the person shouldn't
  // have to click anything to get their first code. If this fails (e.g.
  // requestOtp/verifyOtp Cloud Functions not deployed yet, or the
  // Trigger Email extension not configured yet), fall back to the
  // magic-link method automatically instead of stranding the person on a
  // code screen that can never succeed.
  useEffect(() => {
    if (!officialEmail) return;
    requestOtpCode(officialEmail, 'teacher')
      .then(() => setOtpStatus('sent'))
      .catch((e) => {
        setOtpStatus('error');
        setOtpError(e.message);
        setMethod('link');
        resendLinkOnMount(officialEmail);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officialEmail]);

  const resendLinkOnMount = async (email) => {
    setLinkStatus('resending');
    try {
      await sendFacultyVerificationLink(email);
      setLinkStatus('resent');
    } catch (e) {
      setLinkStatus('error');
      setLinkError(e.message || 'Could not send the verification link. Please try again.');
    }
  };

  const resendOtp = async () => {
    setOtpStatus('resending');
    setOtpError('');
    setOtp('');
    try {
      await requestOtpCode(officialEmail, 'teacher');
      setOtpStatus('sent');
    } catch (e) {
      setOtpStatus('error');
      setOtpError(e.message);
    }
  };

  const submitOtp = async () => {
    if (otp.length !== 6) return;
    setOtpStatus('verifying');
    setOtpError('');
    try {
      await verifyOtpCode(officialEmail, otp, 'teacher');
      // verifyOtp() already wrote verifiedFacultyEmails/{email} server-side.
      // Same as the magic-link completion path in App.jsx, that fact still
      // needs syncing onto faculty/{uid}.verifiedAt from the MAIN session —
      // otherwise verifiedAt would only ever flip whenever some unrelated
      // code path happened to call this next, which isn't guaranteed here.
      try {
        await markFacultyVerifiedIfEmailConfirmed(uid, officialEmail);
      } catch (e) {
        console.warn('[FacultyVerifyHoldingScreen] markFacultyVerifiedIfEmailConfirmed failed', e);
      }
      const fdoc = await getFacultyDoc(uid).catch(() => null);
      if (fdoc?.verifiedAt) { onVerified?.(); return; }
      setOtpStatus('sent'); // still valid; verifiedAt sync will catch up via subscription
    } catch (e) {
      setOtpStatus('error');
      setOtpError(e.message);
    }
  };

  const resendLink = async () => {
    setLinkStatus('resending');
    setLinkError('');
    try {
      await sendFacultyVerificationLink(officialEmail);
      setLinkStatus('resent');
    } catch (e) {
      setLinkStatus('error');
      setLinkError(e.message || 'Could not send the verification link. Please try again.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--card)', borderRadius: 18, padding: 28,
        width: '100%', maxWidth: 440, textAlign: 'center',
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        {method === 'code' ? (
          <>
            <KeyRound size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: 'var(--text)' }}>
              Enter your verification code
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              A 6-digit code was sent to <strong style={{ color: '#0f7d58' }}>{officialEmail}</strong>.
              Enter it below — it expires in 10 minutes.
              <div style={{ marginTop: 10, color: '#0f7d58', fontWeight: 600 }}>
                If you don't see the email, please check your spam folder.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <OtpInput value={otp} onChange={setOtp} disabled={otpStatus === 'verifying'} />
            </div>

            {otpStatus === 'error' && otpError && (
              <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 14 }}>
                {otpError}
              </div>
            )}

            {isGmailAddress(officialEmail) && (
              <a
                href={GMAIL_SPAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', padding: '11px 16px', borderRadius: 8,
                  background: 'var(--card)', color: 'var(--accent)', fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                }}
              >
                <ExternalLink size={14} />
                Open Gmail Spam Folder
              </a>
            )}

            <button
              onClick={submitOtp}
              disabled={otp.length !== 6 || otpStatus === 'verifying'}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: otp.length === 6 ? 'pointer' : 'not-allowed',
                opacity: otp.length === 6 ? 1 : 0.6, marginBottom: 10,
              }}
            >
              {otpStatus === 'verifying' ? 'Verifying…' : 'Verify code'}
            </button>

            <button
              onClick={resendOtp}
              disabled={otpStatus === 'resending' || otpStatus === 'sending'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              <RefreshCw size={14} />
              {otpStatus === 'resending' || otpStatus === 'sending' ? 'Sending…' : 'Resend code'}
            </button>

            <button
              onClick={() => setMethod('link')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '11px 16px', borderRadius: 8,
                border: '1.5px solid var(--accent)', background: 'transparent',
                color: 'var(--accent)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Link2 size={14} />
              Use email link instead
            </button>
          </>
        ) : (
          <>
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

            {linkStatus === 'resent' && (
              <div style={{ fontSize: 12.5, color: 'var(--accent)', marginBottom: 14 }}>
                A new link has been sent.
              </div>
            )}
            {linkStatus === 'error' && linkError && (
              <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 14 }}>
                {linkError}
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
              onClick={resendLink}
              disabled={linkStatus === 'resending'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              <RefreshCw size={14} />
              {linkStatus === 'resending' ? 'Sending…' : 'Resend verification link'}
            </button>

            <button
              onClick={() => setMethod('code')}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5,
                cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 4, width: '100%',
              }}
            >
              <KeyRound size={12} />
              Use verification code instead
            </button>
          </>
        )}
      </div>
    </div>
  );
}