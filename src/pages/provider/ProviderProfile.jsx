// ProviderProfile.jsx
//
// PHASE 3 (PROVIDER_SHELL_UX_OVERHAUL_PLAN.md): dedicated Provider Profile
// page at /provider/profile. The bottom-nav "Profile" tab used to point
// straight at /settings, showing the Theme/Language/Account card stack a
// second route also shows — confusing ("why does Profile show Theme?").
// This page is the provider-shell analog of Profile.jsx (student) /
// FacultyProfile.jsx (faculty): identity + shop photo/summary, NOT
// account settings.
//
// Cover-image editing (upload/change/remove) was MOVED here, verbatim,
// from ShopMetaEditor in ProviderShopSettingsPage.jsx — same
// uploadServiceImage/deleteServiceImage calls, same coverInputRef/
// onPickCover/removeCover logic — and rendered as the page's top-of-page
// avatar-style anchor, mirroring exactly how Profile.jsx (student) puts
// an editable avatar at the very top with everything else below as
// read-only/data cards. ShopMetaEditor itself had its cover-image block
// deleted once this page took over that responsibility, so it isn't
// editable from two places — see ProviderShopSettingsPage.jsx's own
// comment at that deletion site.
//
// Location text + delivery toggle deliberately STAY in Shop Settings —
// they're operational shop config, not identity, matching how
// Profile.jsx keeps the avatar separate from academic data further down.

import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Phone, Mail, Store, ShieldCheck, Clock, XCircle } from 'lucide-react';
import {
  subscribeProviderServices, updateServiceDetails, withServiceDefaults,
} from '../../lib/serviceSync';
import { uploadServiceImage, deleteServiceImage } from '../../lib/serviceImageUpload';
import { getProviderPhone } from '../../lib/providerSync';
import { auth } from '../../lib/firebase';
import { useProviderLang } from '../../hooks/useProviderLang';

export default function ProviderProfile({ providerProfile }) {
  const { t } = useProviderLang();
  const uid = providerProfile?.uid;

  const [services, setServices] = useState(null);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeProviderServices(uid, setServices);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    getProviderPhone(uid).then(setPhone).catch(() => {});
  }, [uid]);

  if (!uid) return null;

  const stillLoading = services === null;
  const rawService = services && services.length > 0 ? services[0] : null;
  const service = rawService ? withServiceDefaults(rawService) : null;

  const status = providerProfile?.status || null;
  const displayName = providerProfile?.displayName || auth.currentUser?.displayName || t('settings.defaultUser');
  const email = auth.currentUser?.email;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Shop cover photo — top-of-page anchor, avatar-style, tap-to-
          change. Mirrors Profile.jsx's (student) avatar treatment. ── */}
      {stillLoading ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('profile.loading')}
        </div>
      ) : service ? (
        <CoverPhotoAnchor service={service} t={t} />
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('shopSettings.noServiceYet')}
        </div>
      )}

      {/* ── Identity card: name, phone, email ── */}
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          {t('profile.identityTitle')}
        </div>

        <InfoRow icon={<Store size={15} />} label={t('profile.nameLabel')} value={displayName} />
        {phone && <InfoRow icon={<Phone size={15} />} label={t('profile.phoneLabel')} value={phone} />}
        {email && <InfoRow icon={<Mail size={15} />} label={t('profile.emailLabel')} value={email} />}
      </div>

      {/* ── Verification status — only surfaced here if not already
          obvious elsewhere; ProviderVerificationPending.jsx already hard-
          gates pending/rejected accounts before they can reach this page
          at all, so in practice this only ever renders the "verified"
          state, shown as a small reassurance badge, not a gate. ── */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'verified' ? (
          <>
            <ShieldCheck size={18} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('profile.statusVerified')}</span>
          </>
        ) : status === 'rejected' ? (
          <>
            <XCircle size={18} color="var(--danger, #dc2626)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('profile.statusRejected')}</span>
          </>
        ) : (
          <>
            <Clock size={18} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('profile.statusPending')}</span>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}

// Moved verbatim (upload/remove logic + coverInputRef pattern) from
// ShopMetaEditor in ProviderShopSettingsPage.jsx — same
// uploadServiceImage/updateServiceDetails/deleteServiceImage calls.
// Rendered here as a large, tap-to-change, avatar-style circle instead of
// ShopMetaEditor's small 72×72 inline square, to read as this page's
// visual anchor the same way Profile.jsx's avatar does.
function CoverPhotoAnchor({ service, t }) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const coverInputRef = useRef(null);

  const onPickCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploadingCover(true);
    try {
      const oldUrl = service.coverImageUrl;
      const url = await uploadServiceImage(service.id, file);
      await updateServiceDetails(service.id, { coverImageUrl: url });
      if (oldUrl) deleteServiceImage(oldUrl); // best-effort, not awaited
    } catch (e) {
      setError(e.message || t('shopSettings.imageUploadError'));
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = async () => {
    setError('');
    try {
      const oldUrl = service.coverImageUrl;
      await updateServiceDetails(service.id, { coverImageUrl: null });
      if (oldUrl) deleteServiceImage(oldUrl);
    } catch (e) {
      setError(t('shopSettings.coverRemoveError'));
    }
  };

  return (
    <div className="content-page-bg" style={{
      borderRadius: 20, overflow: 'hidden', position: 'relative',
      padding: 'clamp(24px,5vw,32px) clamp(20px,4vw,28px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div
        onClick={() => coverInputRef.current?.click()}
        title={t('profile.changeCoverHint')}
        style={{
          width: 96, height: 96, borderRadius: '50%',
          background: service.coverImageUrl ? 'transparent' : 'var(--accentSoft)',
          border: '4px solid var(--card, #fff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, cursor: uploadingCover ? 'default' : 'pointer',
          overflow: 'hidden', position: 'relative',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => { if (!uploadingCover) e.currentTarget.style.transform = 'scale(1.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
      >
        {service.coverImageUrl ? (
          <img src={service.coverImageUrl} alt={t('profile.coverAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageIcon size={32} color="var(--accent)" />
        )}

        {/* Always-visible camera badge — same rationale as Profile.jsx's:
            hover-only affordances are invisible on touch devices. */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '32%', height: '32%', minWidth: 28, minHeight: 28,
          borderRadius: '50%', background: 'var(--accent)',
          border: '2.5px solid var(--card, #fff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}>
          <Camera size={14} color="#fff" />
        </div>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onPickCover}
      />

      <div style={{ marginTop: 12, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
        {service.name}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          className="btn btn-secondary"
          style={{ minHeight: 36, fontSize: 12 }}
        >
          {uploadingCover ? t('shopSettings.uploading') : service.coverImageUrl ? t('shopSettings.changeCover') : t('shopSettings.uploadCover')}
        </button>
        {service.coverImageUrl && (
          <button onClick={removeCover} className="btn btn-secondary" style={{ minHeight: 36, fontSize: 12, color: '#dc2626' }}>
            {t('shopSettings.removeCover')}
          </button>
        )}
      </div>

      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}
    </div>
  );
}
