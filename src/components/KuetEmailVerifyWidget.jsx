import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { sendKuetVerificationLink, buildKuetEmailFromProfile, isRollInstitutionallyVerified, setPendingVerifyUI, getPendingVerifyUI, clearPendingVerifyUI } from '../lib/kuetEmailVerify';
import { requestOtpCode, verifyOtpCode } from '../lib/otpVerify';
import { getProfile } from '../store/store';
import OtpInput from './OtpInput';
import ManualVerifyFallback from './ManualVerifyFallback';

/**
 * Inline widget: enter just the name-part of your KUET email -> a 6-digit
 * code is sent (code-main) -> type it in below -> done. A magic sign-in
 * link (the ORIGINAL method, still fully working) is one click away as
 * "I will verify by link instead" for anyone who would rather just click a link.
 *
 * RESTRUCTURE (code-main, link-backup): stages are now
 *   'input' (name-part entry) -> 'code' (OTP box, DEFAULT after send)
 *                              -> 'link' (magic-link waiting, backup)
 * The actual "mark as verified" step for the LINK path happens app-wide
 * at boot time (see completeKuetVerificationLink() called from App.jsx).
 * The CODE path verifies immediately in this widget via verifyOtpCode(),
 * which writes the same verifiedRolls/{roll} doc directly — either path
 * ends at the same durable record, so the roll-polling fallback below
 * (isRollInstitutionallyVerified) and the global event listener both work
 * unchanged regardless of which method actually completed.
 */
export default function KuetEmailVerifyWidget({ onVerified, onSkip, compact = false, overrideRoll }) {
  const profile = getProfile();
  const roll = String(overrideRoll || profile?.studentId || '').trim();
  // BUGFIX (resumability — see setPendingVerifyUI/getPendingVerifyUI in
  // kuetEmailVerify.js): if a link/code was already sent for this exact
  // roll and hasn't gone stale, resume showing the "waiting…" stage and
  // the name-part that was used, instead of always starting blank at
  // 'input' on every fresh mount (new page, new tab, app reopened).
  // This does NOT make verification mandatory — onSkip is untouched and
  // still works exactly as before; it only means "already in progress"
  // is remembered instead of forgotten.
  const pending = getPendingVerifyUI(roll);
  const [namePart, setNamePart] = useState(pending?.email ? String(pending.email).split('@')[0].replace(/\d+$/, '') : '');
  const [stage, setStage] = useState(pending ? pending.method : 'input'); // input -> code -> link
  const [error, setError] = useState('');
  const [needsManualVerify, setNeedsManualVerify] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  // --- OTP state ---
  const [otp, setOtp] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const email = buildKuetEmailFromProfile(namePart, profile);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Resuming into 'link' stage needs the same polling handleSendLink
  // would have started — otherwise a resumed session sits on "waiting
  // for you to click the link" but never actually notices if/when it
  // gets clicked, short of the global event listener below catching it
  // (which only fires if the link is opened in THIS same tab/session).
  useEffect(() => {
    if (pending?.method === 'link' && roll) {
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleGlobalVerified = (e) => {
      if (!roll || e.detail?.roll === roll) {
        clearPendingVerifyUI();
        onVerified?.();
      }
    };
    window.addEventListener('kuetx:kuet-email-verified', handleGlobalVerified);
    return () => window.removeEventListener('kuetx:kuet-email-verified', handleGlobalVerified);
  }, [roll, onVerified]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const ok = await isRollInstitutionallyVerified(roll).catch(() => false);
      if (ok) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        clearPendingVerifyUI();
        if (onVerified) onVerified();
      }
    }, 4000);
  };

  const validateInputs = () => {
    if (!roll) {
      setError('Your profile does not have a roll number yet. Set it in Profile Setup first.');
      return false;
    }
    const clean = namePart.trim().toLowerCase();
    if (!clean || !/^[a-z]+$/.test(clean)) {
      setError('Enter only the name part (for example: islam) with no numbers or symbols.');
      return false;
    }
    return true;
  };

  // Default send path — sends the OTP code, moves to 'code' stage.
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateInputs()) return;
    setBusy(true);
    try {
      await requestOtpCode(email, 'student');
      setStage('code');
      setPendingVerifyUI({ roll, method: 'code', email });
    } catch (err) {
      if (err?.needsManualVerify) {
        setNeedsManualVerify(true);
        setStage('link');
      } else {
        setError(err?.message || 'There was a problem sending the code. Try again.');
      }
    }
    setBusy(false);
  };

  const handleResendCode = async () => {
    setError('');
    setBusy(true);
    setOtp('');
    try {
      await requestOtpCode(email, 'student');
      setPendingVerifyUI({ roll, method: 'code', email });
    } catch (err) {
      if (err?.needsManualVerify) {
        setNeedsManualVerify(true);
        setStage('link');
      } else {
        setError(err?.message || 'There was a problem resending it. Try again in a moment.');
      }
    }
    setBusy(false);
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) return;
    setError('');
    setOtpVerifying(true);
    try {
      await verifyOtpCode(email, otp, 'student');
      clearPendingVerifyUI();
      onVerified?.();
    } catch (err) {
      setError(err?.message || 'The code did not match. Try again.');
    }
    setOtpVerifying(false);
  };

  // Backup path — the original magic-link flow, unchanged.
  const handleSendLink = async () => {
    setError('');
    setBusy(true);
    try {
      await sendKuetVerificationLink(email);
      setStage('link');
      setPendingVerifyUI({ roll, method: 'link', email });
      startPolling();
    } catch (err) {
      if (err?.needsManualVerify) {
        setNeedsManualVerify(true);
        setStage('link');
      } else {
        setError(err?.message || 'There was a problem sending the verification. Try again.');
      }
    }
    setBusy(false);
  };

  const handleResendLink = async () => {
    setError('');
    setBusy(true);
    try {
      await sendKuetVerificationLink(email);
      setPendingVerifyUI({ roll, method: 'link', email });
    } catch (err) {
      if (err?.needsManualVerify) {
        setNeedsManualVerify(true);
      } else {
        setError(err?.message || 'There was a problem resending it. Try again in a moment.');
      }
    }
    setBusy(false);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(29,155,240,0.08) 0%, rgba(59,130,246,0.08) 100%)',
      border: '1px solid rgba(29,155,240,0.25)', borderRadius: 12,
      padding: compact ? 12 : 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: '#1d9bf0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
        }}>
          <Icons.Check size={14} color="white" strokeWidth={3.5} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Enter the email KUET gave you
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
            Once verified, a blue tick will appear next to your name so classmates know you are really in this class. No password is needed.
          </div>
        </div>
      </div>

      {stage === 'input' && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--text)',
          background: 'var(--surface)', borderRadius: 8, padding: '9px 11px', border: '1px solid var(--border)',
        }}>
          <div><strong>1.</strong> Type only the name part in the box below, not the full email</div>
          <div><strong>2.</strong> Click &quot;Send code&quot;</div>
          <div><strong>3.</strong> Enter the 6-digit code from your Gmail or inbox and it will verify immediately</div>
        </div>
      )}

      {stage === 'input' && (
        <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--inputBg)', overflow: 'hidden',
          }}>
            <input
              type="text" placeholder="islam" value={namePart}
              onChange={(e) => setNamePart(e.target.value)}
              style={{
                padding: '9px 10px', border: 'none', background: 'transparent', fontSize: 13,
                flex: 1, minWidth: 0, outline: 'none', color: 'var(--text)',
              }}
            />
            <span style={{
              padding: '9px 10px', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap',
              userSelect: 'none', background: 'var(--border)',
            }}>
              {roll || '######'}@stud.kuet.ac.bd
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Enter only the name part — the roll number has been auto-filled from your profile, so it can not be anything other than your own roll.
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                I will do it later
              </button>
            )}
          </div>
        </form>
      )}

      {stage === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            A 6-digit code has been sent to <strong>{email}</strong>. <strong>Check Spam/Junk too</strong> — Gmail sometimes puts it there. The code stays valid for 10 minutes.
          </div>
          <OtpInput value={otp} onChange={setOtp} disabled={otpVerifying} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <button
            type="button" className="btn btn-primary btn-sm"
            onClick={handleVerifyCode} disabled={otp.length !== 6 || otpVerifying}
          >
            {otpVerifying ? 'Verifying…' : 'Verify now'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResendCode} disabled={busy}>
              {busy ? 'Sending…' : 'Send a new code'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                I will do it later
              </button>
            )}
          </div>
          <button
            type="button" onClick={handleSendLink} disabled={busy}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            I will verify by link instead
          </button>
          <button
            type="button"
            onClick={() => { setNeedsManualVerify(true); setStage('link'); }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            I can not get either code or link, and I want to verify manually
          </button>
        </div>
      )}

      {stage === 'link' && needsManualVerify && (
        <ManualVerifyFallback
          role="student"
          details={{ name: profile?.name, email, roll }}
          onDone={() => { if (onSkip) onSkip(); }}
        />
      )}

      {stage === 'link' && !needsManualVerify && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            A sign-in link has been sent to <strong>{email}</strong>. <strong>Check Spam/Junk too</strong> — Gmail sometimes puts it there. Click the link and it will verify automatically, with no password needed.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
            <span className="spinner" style={{
              width: 13, height: 13, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: '#1d9bf0',
              animation: 'kuetx-spin 0.8s linear infinite', flexShrink: 0,
            }} />
            Waiting for you to click the link…
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResendLink} disabled={busy}>
              {busy ? 'Sending…' : 'Send a new link'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                I will do it later
              </button>
            )}
          </div>
          <button
            type="button" onClick={() => setStage('code')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            I will verify by code instead
          </button>
          <style>{`@keyframes kuetx-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
