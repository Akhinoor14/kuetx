import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { sendKuetVerificationLink, buildKuetEmailFromProfile, isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { getProfile } from '../store/store';

/**
 * Inline widget: enter just the name-part of your KUET email -> send a
 * passwordless sign-in link -> click it in your inbox -> done. No account,
 * no password, nothing that can go stale or show a scary "already used"
 * page tied to some leftover credential — the link itself is the entire
 * proof and Firebase invalidates it the instant it's used once.
 *
 * The actual "mark as verified" step happens app-wide at boot time (see
 * completeKuetVerificationLink() called from App.jsx) the moment the
 * clicked link lands back on the app, even in a brand new tab/device —
 * this widget just polls the public verifiedRolls record as a lightweight
 * way to notice that happened and fire onVerified().
 */
export default function KuetEmailVerifyWidget({ onVerified, onSkip, compact = false }) {
  const profile = getProfile();
  const roll = String(profile?.studentId || '').trim();
  const [namePart, setNamePart] = useState('');
  const [stage, setStage] = useState('input'); // input -> sent
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  const email = buildKuetEmailFromProfile(namePart, profile);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    if (!roll) {
      setError('তোমার profile-এ roll number সেট করা নেই — আগে Profile Setup থেকে roll number দাও।');
      return;
    }
    const clean = namePart.trim().toLowerCase();
    if (!clean || !/^[a-z]+$/.test(clean)) {
      setError('শুধু নামের অংশটা লেখো (যেমন: islam) — সামনের অংশ, কোনো নাম্বার বা সিম্বল ছাড়া।');
      return;
    }
    setBusy(true);
    try {
      await sendKuetVerificationLink(email);
      setStage('sent');
      startPolling();
    } catch (err) {
      setError(err?.message || 'Verification পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
    }
    setBusy(false);
  };

  const handleResend = async () => {
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
            KUET email দিয়ে verify করো
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 2 }}>
            Verified হলে তোমার নামের পাশে blue tick দেখাবে — classmates বুঝবে তুমি সত্যিই এই ক্লাসের ছাত্র। কোনো password লাগবে না।
          </div>
        </div>
      </div>

      {stage === 'input' && (
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleResend} disabled={busy}>
              {busy ? 'পাঠানো হচ্ছে…' : 'নতুন link পাঠাও'}
            </button>
            {onSkip && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip}>
                পরে করব
              </button>
            )}
          </div>
          <style>{`@keyframes kuetx-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
