import { useState } from 'react';
import * as Icons from 'lucide-react';
import { startKuetEmailVerification, checkKuetEmailVerified, isKuetEmailFormat } from '../lib/kuetEmailVerify';

/**
 * Inline widget: enter KUET email -> send verification link -> click
 * "I've verified" to confirm. Skippable everywhere it's used (soft-required
 * design) — the caller decides what "skip" does (close modal / dismiss popup).
 *
 * onVerified() fires once checkKuetEmailVerified() confirms success.
 */
export default function KuetEmailVerifyWidget({ onVerified, onSkip, compact = false }) {
  const [email, setEmail] = useState('');
  const [password] = useState(() => Math.random().toString(36).slice(2) + 'Aa1!'); // throwaway, only protects this proof credential
  const [stage, setStage] = useState('input'); // input -> sent -> checking
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    if (!isKuetEmailFormat(email)) {
      setError('KUET student email দিন (format: name1234567@stud.kuet.ac.bd)');
      return;
    }
    setBusy(true);
    try {
      await startKuetEmailVerification(email.trim(), password);
      setStage('sent');
    } catch (err) {
      setError(err?.message || 'Verification পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    setBusy(false);
  };

  const handleCheck = async () => {
    setBusy(true);
    setError('');
    const ok = await checkKuetEmailVerified();
    setBusy(false);
    if (ok) {
      if (onVerified) onVerified();
    } else {
      setError('এখনো verify হয়নি — email-এ পাঠানো লিংকে ক্লিক করে আবার চেষ্টা করুন।');
    }
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
            KUET email দিয়ে verify করো
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
            Verified হলে তোমার নামের পাশে blue tick দেখাবে — classmates বুঝবে তুমি সত্যিই এই ক্লাসের ছাত্র।
          </div>
        </div>
      </div>

      {stage === 'input' && (
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="email" placeholder="roll1234567@stud.kuet.ac.bd" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)', fontSize: 13 }}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ flex: 1 }}>
              {busy ? 'পাঠানো হচ্ছে…' : 'Verification link পাঠাও'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
        </form>
      )}

      {stage === 'sent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>{email}</strong>-এ একটা verification link পাঠানো হয়েছে। ইনবক্স (বা spam folder) চেক করে লিংকে ক্লিক করো, তারপর নিচে বাটনে চাপো।
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={handleCheck} style={{ flex: 1 }}>
              {busy ? 'চেক করা হচ্ছে…' : 'লিংকে ক্লিক করেছি, verify করো'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
