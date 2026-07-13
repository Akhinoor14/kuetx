import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { sendKuetVerificationLink, buildKuetEmailFromProfile, isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { requestOtpCode, verifyOtpCode } from '../lib/otpVerify';
import { getProfile } from '../store/store';
import OtpInput from './OtpInput';

/**
 * Inline widget: enter just the name-part of your KUET email -> a 6-digit
 * code is sent (code-main) -> type it in below -> done. A magic sign-in
 * link (the ORIGINAL method, still fully working) is one click away as
 * "link-এ verify করব বরং" for anyone who'd rather just click a link.
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
  const [namePart, setNamePart] = useState('');
  const [stage, setStage] = useState('input'); // input -> code -> link
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  // --- OTP state ---
  const [otp, setOtp] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  const email = buildKuetEmailFromProfile(namePart, profile);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    const handleGlobalVerified = (e) => {
      if (!roll || e.detail?.roll === roll) onVerified?.();
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
        if (onVerified) onVerified();
      }
    }, 4000);
  };

  const validateInputs = () => {
    if (!roll) {
      setError('তোমার profile-এ roll number সেট করা নেই — আগে Profile Setup থেকে roll number দাও।');
      return false;
    }
    const clean = namePart.trim().toLowerCase();
    if (!clean || !/^[a-z]+$/.test(clean)) {
      setError('শুধু নামের অংশটা লেখো (যেমন: islam) — সামনের অংশ, কোনো নাম্বার বা সিম্বল ছাড়া।');
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
    } catch (err) {
      setError(err?.message || 'Code পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    setBusy(false);
  };

  const handleResendCode = async () => {
    setError('');
    setBusy(true);
    setOtp('');
    try {
      await requestOtpCode(email, 'student');
    } catch (err) {
      setError(err?.message || 'আবার পাঠাতে সমস্যা হয়েছে, একটু পর আবার চেষ্টা করো।');
    }
    setBusy(false);
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) return;
    setError('');
    setOtpVerifying(true);
    try {
      await verifyOtpCode(email, otp, 'student');
      onVerified?.();
    } catch (err) {
      setError(err?.message || 'Code মেলেনি, আবার চেষ্টা করো।');
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
      startPolling();
    } catch (err) {
      setError(err?.message || 'Verification পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    setBusy(false);
  };

  const handleResendLink = async () => {
    setError('');
    setBusy(true);
    try {
      await sendKuetVerificationLink(email);
    } catch (err) {
      setError(err?.message || 'আবার পাঠাতে সমস্যা হয়েছে, একটু পর আবার চেষ্টা করো।');
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
            তোমার KUET-এর দেওয়া email দাও
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
            Verified হলে তোমার নামের পাশে blue tick দেখাবে — classmates বুঝবে তুমি সত্যিই এই ক্লাসের ছাত্র। কোনো password লাগবে না।
          </div>
        </div>
      </div>

      {stage === 'input' && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--text)',
          background: 'var(--surface)', borderRadius: 8, padding: '9px 11px', border: '1px solid var(--border)',
        }}>
          <div><strong>১.</strong> নিচের বক্সে শুধু তোমার নামের অংশটা লেখো (পুরো ইমেইল না)</div>
          <div><strong>২.</strong> &quot;Code পাঠাও&quot;-এ চাপ দাও</div>
          <div><strong>৩.</strong> তোমার Gmail/Inbox থেকে ৬-সংখ্যার code বসাও — সাথে সাথেই verify হয়ে যাবে</div>
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
            শুধু নামের অংশটা লেখো — roll number তোমার profile থেকে auto-fill হয়ে গেছে, এটা তোমার নিজের roll ছাড়া অন্য কিছু হতে পারবে না।
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'পাঠানো হচ্ছে…' : 'Code পাঠাও'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
        </form>
      )}

      {stage === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>{email}</strong>-এ একটা ৬-সংখ্যার code পাঠানো হয়েছে। <strong>Spam/Junk folder-ও চেক করো</strong> — Gmail মাঝে মাঝে ওখানে ফেলে দেয়। Code-টা ১০ মিনিট পর্যন্ত valid থাকবে।
          </div>
          <OtpInput value={otp} onChange={setOtp} disabled={otpVerifying} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <button
            type="button" className="btn btn-primary btn-sm"
            onClick={handleVerifyCode} disabled={otp.length !== 6 || otpVerifying}
          >
            {otpVerifying ? 'Verify হচ্ছে…' : 'Verify করো'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResendCode} disabled={busy}>
              {busy ? 'পাঠানো হচ্ছে…' : 'নতুন code পাঠাও'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
          <button
            type="button" onClick={handleSendLink} disabled={busy}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            এর বদলে link-এ verify করব
          </button>
        </div>
      )}

      {stage === 'link' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>{email}</strong>-এ একটা sign-in link পাঠানো হয়েছে। <strong>Spam/Junk folder-ও চেক করো</strong> — Gmail মাঝে মাঝে ওখানে ফেলে দেয়। লিংকে ক্লিক করলেই automatic verify হয়ে যাবে, কোনো password লাগবে না।
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
            <span className="spinner" style={{
              width: 13, height: 13, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: '#1d9bf0',
              animation: 'kuetx-spin 0.8s linear infinite', flexShrink: 0,
            }} />
            লিংকে ক্লিক করার অপেক্ষায়…
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResendLink} disabled={busy}>
              {busy ? 'পাঠানো হচ্ছে…' : 'নতুন link পাঠাও'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
          <button
            type="button" onClick={() => setStage('code')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            এর বদলে code-এ verify করব
          </button>
          <style>{`@keyframes kuetx-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
