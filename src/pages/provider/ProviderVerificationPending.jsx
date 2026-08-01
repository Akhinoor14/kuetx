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
import { SERVICE_TYPES, PROVIDER_SIGNUP_TYPES, PROVIDER_SIGNUP_TYPE_LABELS_BN } from '../../lib/serviceSync';
import { useProviderLang } from '../../hooks/useProviderLang';
import { FOUNDER_PHONE } from '../../lib/constants';

export default function ProviderVerificationPending({ providerProfile }) {
  const { t } = useProviderLang();
  const isRejected = providerProfile?.status === 'rejected';
  const [name, setName] = useState(providerProfile?.displayName || '');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState(providerProfile?.serviceType || SERVICE_TYPES[0]);
  const [serviceTypeOther, setServiceTypeOther] = useState(providerProfile?.serviceTypeOther || '');
  const [location, setLocation] = useState(providerProfile?.location || '');
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
    if (!name.trim() || !phone.trim() || !location.trim()) {
      setError(t('verify.resubmitMissingFields'));
      return;
    }
    if (serviceType === 'other' && !serviceTypeOther.trim()) {
      setError(t('verify.resubmitMissingType'));
      return;
    }
    setSubmitting(true);
    try {
      await resubmitProviderRequest(auth.currentUser.uid, {
        displayName: name, phone, serviceType, serviceTypeOther, location,
      });
      setDone(true);
    } catch (e) {
      setError(t('verify.resubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      padding: '32px 16px 48px', maxWidth: 460, margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Icon in a soft circular badge, flex-centered so it can never
          render flush-left regardless of parent text-align quirks. */}
      <div style={{
        width: 68, height: 68, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
        background: isRejected
          ? 'rgba(220,38,38,0.10)'
          : 'var(--accentSoft)',
      }}>
        {isRejected
          ? <XCircle size={32} color="var(--danger, #dc2626)" />
          : <Clock size={32} color="var(--accent)" />}
      </div>

      {!isRejected && (
        <>
          <div style={{
            fontSize: 18, fontWeight: 800, color: 'var(--text)',
            marginBottom: 8, textAlign: 'center',
          }}>
            {t('verify.pendingTitle')}
          </div>
          <div style={{
            fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7,
            marginBottom: 24, textAlign: 'center', maxWidth: 380,
          }}>
            {t('verify.pendingBody')}
          </div>

          {/* Provider's own submitted name/phone (§3 request — separate
              from the Founder's contact number below). Read from
              providerProfile.displayName + the fetched contact/phone
              sub-doc, so the person can confirm what they submitted is
              correct while they wait, instead of only seeing whom to
              call. */}
          <div style={{
            width: '100%', textAlign: 'left', marginBottom: 24,
            padding: '16px 18px', borderRadius: 16,
            background: 'var(--card)', border: '1px solid var(--border)',
            boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
          }}>
            <div style={{
              fontSize: 11.5, color: 'var(--muted)', fontWeight: 700,
              marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              {t('verify.submittedInfoTitle')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)' }}>{t('verify.nameLabel')}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{providerProfile?.displayName || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)' }}>{t('verify.phoneLabel')}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{phone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)' }}>{t('verify.serviceTypeLabel')}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>
                  {providerProfile?.serviceType === 'other'
                    ? (providerProfile?.serviceTypeOther || t('verify.serviceTypeOther'))
                    : (PROVIDER_SIGNUP_TYPE_LABELS_BN[providerProfile?.serviceType] || '—')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)' }}>{t('verify.addressLabel')}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{providerProfile?.location || '—'}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, textAlign: 'center' }}>
            {t('verify.contactFounder')}
          </div>
          <a
            href={`tel:${FOUNDER_PHONE}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 22px', borderRadius: 999,
              background: 'var(--accentSoft)', color: 'var(--accent)',
              fontWeight: 700, fontSize: 14.5, textDecoration: 'none',
            }}
          >
            <Phone size={16} /> {FOUNDER_PHONE}
          </a>
        </>
      )}

      {isRejected && !done && (
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>
            {t('verify.rejectedTitle')}
          </div>
          <div style={{
            fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, marginBottom: 20,
            padding: '12px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.08)',
            textAlign: 'left',
          }}>
            <strong>{t('verify.rejectedReasonLabel')}</strong> {providerProfile?.rejectedReason || t('verify.rejectedNoReason')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('verify.shopNameLabel')}</label>
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
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('verify.phoneNumberLabel')}</label>
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
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('verify.serviceTypeSelectLabel')}</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              >
                {PROVIDER_SIGNUP_TYPES.map((st) => (
                  <option key={st} value={st}>{PROVIDER_SIGNUP_TYPE_LABELS_BN[st]}</option>
                ))}
              </select>
            </div>
            {serviceType === 'other' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('verify.serviceTypeOtherLabel')}</label>
                <input
                  value={serviceTypeOther}
                  onChange={(e) => setServiceTypeOther(e.target.value)}
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', fontSize: 14,
                  }}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('verify.shopAddressLabel')}</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
            {submitting ? t('verify.resubmitting') : t('verify.resubmit')}
          </button>
        </div>
      )}

      {isRejected && done && (
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, textAlign: 'center' }}>
          {t('verify.resubmittedDone')}
        </div>
      )}
    </div>
  );
}
