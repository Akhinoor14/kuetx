// ProviderVerificationPending.jsx
//
// SERVICES_PROVIDER_PLAN.md §4 Step 3 & 6: shown for a provider account
// whose status is 'pending' or 'rejected' — no dashboard content at all,
// just the wait/contact instruction (pending) or the rejection reason +
// re-submit form (rejected). This is the hard gate itself: RequireProvider
// only ever renders this component OR the dashboard, never both, and
// never a "preview" of the dashboard underneath.

import { useEffect, useState } from 'react';
import { Phone, Clock, XCircle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { resubmitProviderRequest, getProviderPhone } from '../../lib/providerSync';

const FOUNDER_PHONE = '01724812042';

export default function ProviderVerificationPending({ providerProfile }) {
  const isRejected = providerProfile?.status === 'rejected';
  const [name, setName] = useState(providerProfile?.displayName || '');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Phone moved off providerProfile itself (§10 fix — see providerSync.js's
  // createProviderShell doc comment) into its own contact/phone sub-doc.
  // The owning provider always has read standing on their own number
  // (firestore.rules: request.auth.uid == uid), so this is a plain fetch,
  // not gated by the confirmed-booking check that applies to students.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getProviderPhone(uid).then(setPhone).catch(() => {});
  }, []);

  const resubmit = async () => {
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError('নাম এবং ফোন নাম্বার দুটোই দিতে হবে।');
      return;
    }
    setSubmitting(true);
    try {
      await resubmitProviderRequest(auth.currentUser.uid, { displayName: name, phone });
      setDone(true);
    } catch (e) {
      setError('আবার পাঠাতে সমস্যা হয়েছে — একটু পর চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        {isRejected
          ? <XCircle size={36} color="var(--danger, #dc2626)" />
          : <Clock size={36} color="var(--accent)" />}
      </div>

      {!isRejected && (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            Verification pending
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
            আপনার সার্ভিস প্রোভাইডার একাউন্ট এখনো verify হয়নি। Founder সরাসরি
            যোগাযোগ করে আপনার একাউন্ট verify করবেন। verify হওয়ার পর এই পেজেই
            আপনার dashboard দেখতে পাবেন — কিছু করার দরকার নেই, শুধু অপেক্ষা করুন।
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 10,
            background: 'var(--accentSoft)', color: 'var(--accent)',
            fontWeight: 700, fontSize: 14,
          }}>
            <Phone size={16} /> {FOUNDER_PHONE}
          </div>
        </>
      )}

      {isRejected && !done && (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            আপনার আবেদন গ্রহণ করা হয়নি
          </div>
          <div style={{
            fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20,
            padding: '12px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.08)',
            textAlign: 'left',
          }}>
            <strong>কারণ:</strong> {providerProfile?.rejectedReason || 'কোনো কারণ উল্লেখ করা হয়নি।'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>নাম / দোকানের নাম</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>
          )}

          <button
            onClick={resubmit}
            disabled={submitting}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 16, width: '100%' }}
          >
            {submitting ? 'পাঠানো হচ্ছে…' : 'আবার সাবমিট করুন'}
          </button>
        </>
      )}

      {isRejected && done && (
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          আপনার আবেদন আবার পাঠানো হয়েছে। Founder-এর যোগাযোগের অপেক্ষা করুন।
        </div>
      )}
    </div>
  );
}
