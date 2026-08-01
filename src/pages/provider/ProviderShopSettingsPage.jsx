// ProviderShopSettingsPage.jsx
//
// PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2. Reachable at
// /provider/shop/settings. Contains Shop meta editor (cover image,
// location, delivery) + Shop status control (pause/permanent
// close/reactivate) + Service details editor, moved VERBATIM out of
// ProviderDashboard.jsx — same components, same Firestore calls, same
// strings. Each section keeps its own card instead of a Collapsible,
// since this is now its own dedicated page/tap.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Truck, Image as ImageIcon, Pause, Play, Power,
} from 'lucide-react';
import {
  subscribeProviderServices, updateServiceDetails, withServiceDefaults,
  setServiceStatus,
} from '../../lib/serviceSync';
import {
  uploadServiceImage, deleteServiceImage,
} from '../../lib/serviceImageUpload';
import { useProviderLang } from '../../hooks/useProviderLang';

export default function ProviderShopSettingsPage({ providerProfile }) {
  const { t } = useProviderLang();
  const [services, setServices] = useState(null);
  const uid = providerProfile?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeProviderServices(uid, setServices);
  }, [uid]);

  if (!uid) return null;

  const stillLoading = services === null;
  const rawService = services && services.length > 0 ? services[0] : null;
  const service = rawService ? withServiceDefaults(rawService) : null;
  const isDormant = service?.status === 'dormant';

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <BackLink navigate={navigate} t={t} />

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('shopSettings.loading')}
        </div>
      )}

      {!stillLoading && !service && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('shopSettings.noServiceYet')}
        </div>
      )}

      {!stillLoading && service && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: cover image,
              location, delivery — same ShopMetaEditor component/logic/
              strings as ProviderDashboard.jsx's Collapsible used to wrap. */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {t('shopSettings.metaTitle')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
              {service.locationText || t('shopSettings.notSetUp')}
            </div>
            <ShopMetaEditor service={service} t={t} />
          </div>

          {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: manual pause/
              permanent-close/reactivate control. */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {t('shopSettings.statusTitle')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
              {isDormant ? t('shopSettings.dormant') : t('shopSettings.active')}
            </div>
            <ShopStatusControl service={service} t={t} />
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {t('shopSettings.detailsTitle')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
              {service.name}
            </div>
            <ServiceDetailsEditor service={service} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink({ navigate, t }) {
  return (
    <button
      onClick={() => navigate('/provider/shop')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--muted)', fontSize: 13, fontWeight: 600,
      }}
    >
      <ArrowLeft size={16} /> {t('shopSettings.backLink')}
    </button>
  );
}

function ShopMetaEditor({ service, t }) {
  const [locationText, setLocationText] = useState(service.locationText || '');
  const [hasDelivery, setHasDelivery] = useState(Boolean(service.hasDelivery));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);

  useEffect(() => {
    setLocationText(service.locationText || '');
    setHasDelivery(Boolean(service.hasDelivery));
  }, [service.id, service.locationText, service.hasDelivery]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateServiceDetails(service.id, { locationText, hasDelivery });
      setSaved(true);
    } catch (e) {
      setError(t('shopSettings.saveError'));
    } finally {
      setSaving(false);
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cover image */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('shopSettings.coverLabel')}</label>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          {service.coverImageUrl ? (
            <img
              src={service.coverImageUrl}
              alt="cover"
              style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)' }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 12, background: 'var(--accentSoft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            >
              <ImageIcon size={24} color="var(--accent)" />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="btn btn-secondary"
              style={{ minHeight: 40, fontSize: 13 }}
            >
              {uploadingCover ? t('shopSettings.uploading') : service.coverImageUrl ? t('shopSettings.changeCover') : t('shopSettings.uploadCover')}
            </button>
            {service.coverImageUrl && (
              <button onClick={removeCover} className="btn btn-secondary" style={{ minHeight: 36, fontSize: 12, color: '#dc2626' }}>
                {t('shopSettings.removeCover')}
              </button>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={onPickCover}
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={13} /> {t('shopSettings.locationLabel')}
        </label>
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder={t('shopSettings.locationPlaceholder')}
          style={{
            width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--card)',
            color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
      </div>

      <button
        onClick={() => setHasDelivery((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderRadius: 10, border: '1px solid var(--border)',
          background: hasDelivery ? 'var(--accentSoft)' : 'var(--card)', cursor: 'pointer',
        }}
      >
        <Truck size={18} color={hasDelivery ? 'var(--accent)' : 'var(--muted)'} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'left' }}>
          {t('shopSettings.deliveryLabel')}
        </span>
        <span
          style={{
            width: 40, height: 22, borderRadius: 11, position: 'relative',
            background: hasDelivery ? '#16a34a' : '#9ca3af', flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: hasDelivery ? 20 : 2, width: 18, height: 18,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          }}
          />
        </span>
      </button>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}

      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minHeight: 44 }}>
        {saving ? t('shopSettings.saving') : t('shopSettings.save')}
      </button>
      {saved && <span style={{ fontSize: 12, color: '#16a34a' }}>{t('shopSettings.saved')}</span>}
    </div>
  );
}

function ShopStatusControl({ service, t }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null); // 'pause' | 'permanent_close' | null

  const isDormant = service.status === 'dormant';
  const isPermanent = service.dormantReason === 'manual_permanent';
  const canReactivate = isDormant && !isPermanent;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await setServiceStatus(service.id, action);
      setConfirming(null);
    } catch (e) {
      setError(t('shopSettings.statusUpdateError'));
    } finally {
      setBusy(false);
    }
  };

  if (isDormant) {
    return (
      <div>
        {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}
        {canReactivate ? (
          <button
            onClick={() => run('reactivate')}
            disabled={busy}
            className="btn btn-primary"
            style={{ width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Play size={16} /> {busy ? t('shopSettings.reactivating') : t('shopSettings.reactivate')}
          </button>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {t('shopSettings.permanentlyClosed')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
        {t('shopSettings.deactivateIntro')}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {confirming === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setConfirming('pause')}
            className="btn btn-secondary"
            style={{ minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Pause size={16} /> {t('shopSettings.pauseOption')}
          </button>
          <button
            onClick={() => setConfirming('permanent_close')}
            className="btn btn-secondary"
            style={{ minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#dc2626' }}
          >
            <Power size={16} /> {t('shopSettings.permanentCloseOption')}
          </button>
        </div>
      )}

      {confirming === 'pause' && (
        <ConfirmBlock
          text={t('shopSettings.pauseConfirmText')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run('pause')}
          confirmLabel={t('shopSettings.pauseConfirmLabel')}
          t={t}
        />
      )}

      {confirming === 'permanent_close' && (
        <ConfirmBlock
          text={t('shopSettings.permanentConfirmText')}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run('permanent_close')}
          confirmLabel={t('shopSettings.permanentConfirmLabel')}
          danger
          t={t}
        />
      )}
    </div>
  );
}

function ConfirmBlock({
  text, busy, onCancel, onConfirm, confirmLabel, danger, t,
}) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface, var(--card))' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6, marginBottom: 12 }}>{text}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} disabled={busy} className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }}>
          {t('shopSettings.cancel')}
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn btn-primary"
          style={{ flex: 1, minHeight: 44, background: danger ? '#dc2626' : undefined }}
        >
          {busy ? t('shopSettings.reactivating') : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, textarea,
}) {
  const commonStyle = {
    width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--card)',
    color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
  };
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</label>
      {textarea ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={commonStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={commonStyle} />
      )}
    </div>
  );
}

function ServiceDetailsEditor({ service, t }) {
  const [name, setName] = useState(service.name || '');
  const [description, setDescription] = useState(service.description || '');
  const [priceNote, setPriceNote] = useState(service.priceNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(service.name || '');
    setDescription(service.description || '');
    setPriceNote(service.priceNote || '');
  }, [service.id, service.name, service.description, service.priceNote]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateServiceDetails(service.id, { name, description, priceNote });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label={t('shopSettings.nameLabel')} value={name} onChange={setName} />
        <Field label={t('shopSettings.descriptionLabel')} value={description} onChange={setDescription} textarea />
        <Field label={t('shopSettings.priceNoteLabel')} value={priceNote} onChange={setPriceNote} />
      </div>
      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ marginTop: 12, minHeight: 44 }}>
        {saving ? t('shopSettings.saving') : t('shopSettings.save')}
      </button>
      {saved && <span style={{ marginLeft: 10, fontSize: 12, color: '#16a34a' }}>{t('shopSettings.saved')}</span>}
    </div>
  );
}
