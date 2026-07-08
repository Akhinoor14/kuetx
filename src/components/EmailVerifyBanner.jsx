import { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { auth } from '../lib/firebase';
import { isEmailVerified, resendVerificationEmail, reloadUser } from '../lib/firebaseAuth';

const COOLDOWN_SECONDS = 45;

/**
 * "Verify your email" banner for accounts created via email/password.
 * This is deliberately separate from ProfileVerifyBanner (KUET institutional
 * roll verification) — this one is about basic account hygiene: proving the
 * address the person typed is actually reachable, so password-recovery
 * later doesn't dead-end. Not shown for Google or anonymous accounts, since
 * Google already guarantees a reachable address and anonymous accounts have
 * no email to lose access to in the first place.
 *
 * Parent should render this only while isEmailVerified() is false; once
 * true the parent stops rendering it, same pattern as ProfileVerifyBanner.
 */
export default function EmailVerifyBanner({ onVerified }) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [failedChecks, setFailedChecks] = useState(0);
  const pollRef = useRef(null);
  const cooldownRef = useRef(null);

  const email = auth.currentUser?.email || '';

  useEffect(() => {
    // Poll in the background so clicking the emailed link is the only
    // action needed — same UX as the KUET verify flow.
    pollRef.current = setInterval(async () => {
      await reloadUser().catch(() => {});
      if (isEmailVerified()) {
        clearInterval(pollRef.current);
        onVerified?.();
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [onVerified]);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await resendVerificationEmail();
      setResent(true);
      startCooldown();
    } catch (err) {
      setError('আবার পাঠাতে সমস্যা হয়েছে, একটু পর চেষ্টা করো।');
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setError('');
    try {
      await reloadUser();
      if (isEmailVerified()) {
        onVerified?.();
      } else {
        setFailedChecks((n) => n + 1);
        setError('এখনো verify হয়নি — link-এ ক্লিক করে আসো, তারপর আবার try করো।');
      }
    } finally {
      setChecking(false);
    }
  };

  if (!expanded) {
    return (
      <div style={{
        padding: '11px 16px', borderRadius: 12,
        background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))',
        border: '1.5px solid color-mix(in srgb, var(--warning) 25%, var(--border))',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--warning)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icons.MailWarning size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Email verify করা হয়নি</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
            Password ভুলে গেলে recovery email পাঠানোর জন্য এটা দরকার হবে।
          </div>
        </div>
        <button onClick={() => setExpanded(true)} className="btn btn-primary btn-sm" style={{ flexShrink: 0, background: 'var(--warning)' }}>
          Verify করো
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))',
      border: '1.5px solid color-mix(in srgb, var(--warning) 25%, var(--border))',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: 'var(--warning)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
        }}>
          <Icons.MailWarning size={16} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{email}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.5 }}>
            আমরা একটা verification link পাঠিয়েছি — লিংকে ক্লিক করলে automatic verify হয়ে যাবে।
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--warning)', marginTop: 4, fontWeight: 600, lineHeight: 1.5 }}>
            ⚠️ Inbox-এ না পেলে Spam/Junk folder চেক করো — বেশিরভাগ সময় ওখানেই চলে যায়।
          </div>
          {failedChecks >= 2 && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              এখনো না পেলে: Gmail-এ "Promotions" ট্যাব বা "All Mail" চেক করো, sender ঠিকানা block/filter করা আছে কিনা দেখো, অথবা নিচে "Link আবার পাঠাও" চাপো।
            </div>
          )}
        </div>
        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
          <Icons.X size={16} />
        </button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 11.5 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleCheckNow} disabled={checking} className="btn btn-secondary btn-sm">
          {checking ? 'চেক করা হচ্ছে…' : 'Verify হয়ে গেছি — Check করো'}
        </button>
        <button type="button" onClick={handleResend} disabled={cooldown > 0} className="btn btn-secondary btn-sm"
          style={{ opacity: cooldown > 0 ? 0.6 : 1, cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}>
          {cooldown > 0 ? `আবার পাঠাও (${cooldown}s)` : resent ? 'আবার পাঠানো হলো ✓' : 'Link আবার পাঠাও'}
        </button>
      </div>
    </div>
  );
}
