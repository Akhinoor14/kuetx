import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { sendKuetVerificationLink, buildKuetEmailFromProfile, isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { getProfile } from '../store/store';

const COOLDOWN_SECONDS = 60;

/**
 * Top-of-profile "Verify Now" banner for anyone not yet KUET-email
 * verified. Only rendered by the parent while `isKuetVerified` is false —
 * once the parent's isKuetVerified flips true (roll shows up in
 * verifiedRolls/{roll}), the parent stops rendering this at all, so there's
 * nothing to manually hide here.
 *
 * Flow: tap "Verify Now" -> type just the name-part (roll is locked from
 * your own profile) -> send a passwordless sign-in link -> cooldown timer
 * on resend -> auto-polls in the background so clicking the emailed link
 * is the only action needed. No account or password is ever created, so
 * there's nothing that can go stale between attempts, and a used/expired
 * link just means "send a new one" rather than a dead end.
 */
export default function ProfileVerifyBanner({ onVerified }) {
  const profile = getProfile();
  const roll = String(profile?.studentId || '').trim();
  const [expanded, setExpanded] = useState(false);
  const [namePart, setNamePart] = useState('');
  const [stage, setStage] = useState('idle'); // idle -> sending -> sent
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const pollRef = useRef(null);
  const cooldownRef = useRef(null);

  const email = buildKuetEmailFromProfile(namePart, profile);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }, []);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const ok = await isRollInstitutionallyVerified(roll).catch(() => false);
      if (ok) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        onVerified?.();
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
    if (cooldown > 0) return;
    setStage('sending');
    try {
      await sendKuetVerificationLink(email);
      setStage('sent');
      startCooldown();
      startPolling();
    } catch (err) {
      setError(err?.message || 'Verification পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।');
      setStage('idle');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await sendKuetVerificationLink(email);
      startCooldown();
    } catch (err) {
      setError(err?.message || 'আবার পাঠাতে সমস্যা হয়েছে, একটু পর চেষ্টা করো।');
    }
  };

  if (!expanded) {
    return (
      <div style={{
        padding: '11px 16px', borderRadius: 12,
        background: 'color-mix(in srgb, #1d9bf0 8%, var(--surface))',
        border: '1.5px solid color-mix(in srgb, #1d9bf0 25%, var(--border))',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: '#1d9bf0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icons.ShieldCheck size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>KUET email verify করা হয়নি</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>নামের পাশে blue tick পেতে verify করো — একবার করলেই যথেষ্ট, password লাগবে না।</div>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, background: '#1d9bf0' }}
        >
          Verify Now
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'color-mix(in srgb, #1d9bf0 8%, var(--surface))',
      border: '1.5px solid color-mix(in srgb, #1d9bf0 25%, var(--border))',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: '#1d9bf0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
        }}>
          <Icons.ShieldCheck size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>KUET email verify করো</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.5 }}>
            তোমার regular login বদলাবে না — এটা শুধু institutional proof, কোনো password লাগবে না।
          </div>
        </div>
        {stage === 'idle' && (
          <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
            <Icons.X size={16} />
          </button>
        )}
      </div>

      {stage !== 'sent' && (
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
            শুধু নামের অংশটা লেখো — roll number তোমার profile থেকে auto-fill হয়ে গেছে।
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={stage === 'sending'} style={{ background: '#1d9bf0' }}>
            {stage === 'sending' ? 'পাঠানো হচ্ছে…' : 'Verification link পাঠাও'}
          </button>
        </form>
      )}

      {stage === 'sent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            <strong>{email}</strong>-এ sign-in link পাঠানো হয়েছে। <strong>Spam/Junk folder-ও চেক করো</strong> — Gmail মাঝে মাঝে ওখানে ফেলে দেয়। লিংকে ক্লিক করলেই automatic verify হয়ে যাবে, কোনো password লাগবে না।
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
            <span style={{
              width: 13, height: 13, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: '#1d9bf0',
              animation: 'kuetx-verify-spin 0.8s linear infinite', flexShrink: 0, display: 'inline-block',
            }} />
            লিংকে ক্লিক করার অপেক্ষায়…
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className="btn btn-secondary btn-sm"
              style={{ opacity: cooldown > 0 ? 0.6 : 1, cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}
            >
              {cooldown > 0 ? `আবার পাঠাও (${cooldown}s)` : 'আবার পাঠাও'}
            </button>
          </div>
          <style>{`@keyframes kuetx-verify-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
