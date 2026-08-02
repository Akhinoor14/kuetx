// ProviderShopSettingsPage.jsx
//
// PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2. Reachable at
// /provider/shop/settings. Contains Shop meta editor (cover image,
// location, delivery) + Shop status control (pause/permanent
// close/reactivate) + Service details editor, moved VERBATIM out of
// ProviderDashboard.jsx — same components, same Firestore calls, same
// strings. Each section keeps its own card instead of a Collapsible,
// since this is now its own dedicated page/tap.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Truck, Pause, Play, Power, Navigation, ExternalLink, Settings as SettingsIcon,
} from 'lucide-react';
import {
  subscribeProviderServices, updateServiceDetails, withServiceDefaults,
  setServiceStatus, SERVICE_TYPES, SERVICE_TYPE_LABELS_BN,
} from '../../lib/serviceSync';
import { getCategorySetupConfig } from '../../lib/serviceCategoryConfig';
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
    <div className="kx-settings-page">
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
          {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3 / PHASE 3 of
              PROVIDER_SHELL_UX_OVERHAUL_PLAN.md: cover-image editing
              moved OUT of ShopMetaEditor into ProviderProfile.jsx (the
              new /provider/profile page) — this card is now location +
              delivery only. */}
          <div className="card kx-settings-card">
            <SectionHeader
              icon={<MapPin size={16} />}
              title={t('shopSettings.metaTitle')}
              subtitle={service.locationText || t('shopSettings.notSetUp')}
            />
            <ShopMetaEditor service={service} t={t} />
          </div>

          {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: manual pause/
              permanent-close/reactivate control. */}
          <div className="card kx-settings-card">
            <SectionHeader
              icon={<Power size={16} />}
              title={t('shopSettings.statusTitle')}
              statusPill={isDormant ? 'dormant' : 'active'}
              statusLabel={isDormant ? t('shopSettings.dormant') : t('shopSettings.active')}
            />
            <ShopStatusControl service={service} t={t} />
          </div>

          <div className="card kx-settings-card">
            <SectionHeader
              icon={<SettingsIcon size={16} />}
              title={t('shopSettings.detailsTitle')}
              subtitle={service.name}
            />
            <ServiceDetailsEditor service={service} t={t} />
          </div>
        </div>
      )}

      <style>{`
        .kx-settings-page { padding: 20px 16px 40px; width: 100%; max-width: 640px; margin: 0 auto; box-sizing: border-box; }
        .kx-settings-card { padding: 18px; border-radius: 16px; }

        .kx-section-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
        .kx-section-icon {
          width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-section-title-row { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .kx-section-title { font-size: 14.5px; font-weight: 700; color: var(--text); }
        .kx-section-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

        .kx-status-pill {
          display: inline-flex; align-items: center; font-size: 11px; font-weight: 700;
          border-radius: 999px; padding: 3px 10px; flex-shrink: 0;
        }
        .kx-status-pill.active { background: var(--accentSoft); color: var(--accentDark, var(--accent)); }
        .kx-status-pill.dormant { background: rgba(234,88,12,0.14); color: #c2410c; }
      `}</style>
    </div>
  );
}

function SectionHeader({
  icon, title, subtitle, statusPill, statusLabel,
}) {
  return (
    <div className="kx-section-header">
      <div className="kx-section-icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kx-section-title-row">
          <span className="kx-section-title">{title}</span>
          {statusPill && <span className={`kx-status-pill ${statusPill}`}>{statusLabel}</span>}
        </div>
        {subtitle && <div className="kx-section-subtitle">{subtitle}</div>}
      </div>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      <GpsLocationSubsection service={service} t={t} />

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

// SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 1.1/1.2 — one-click GPS
// capture with an accuracy check and a mandatory human-confirmation step
// before anything is saved. Accuracy in meters is what
// navigator.geolocation gives back alongside lat/lng; "good" is treated as
// <50m (outdoor GPS-fix territory), anything worse warns but still allows
// proceeding (per the plan: never a hard block, just a nudge + Google Maps
// link so the provider can eyeball the pin before confirming).
const GPS_ACCURACY_GOOD_THRESHOLD_M = 50;

function formatRelativeDay(timestamp, t) {
  if (!timestamp) return null;
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return t('shopSettings.gpsToday');
  if (diffDays === 1) return t('shopSettings.gpsYesterday');
  return `${diffDays} ${t('shopSettings.gpsDaysAgo')}`;
}

function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function GpsLocationSubsection({ service, t }) {
  // 'idle' | 'fetching' | 'low_accuracy' | 'confirm' | 'saving'
  const [step, setStep] = useState('idle');
  const [pending, setPending] = useState(null); // { lat, lng, accuracy }
  const [error, setError] = useState('');

  const hasSavedLocation = typeof service.locationLat === 'number' && typeof service.locationLng === 'number';

  const requestLocation = () => {
    setError('');
    if (!('geolocation' in navigator)) {
      setError(t('shopSettings.gpsUnsupported'));
      return;
    }
    setStep('fetching');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setPending({ lat: latitude, lng: longitude, accuracy });
        if (accuracy != null && accuracy > GPS_ACCURACY_GOOD_THRESHOLD_M) {
          setStep('low_accuracy');
        } else {
          setStep('confirm');
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(t('shopSettings.gpsPermissionDenied'));
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setError(t('shopSettings.gpsPositionUnavailable'));
        } else if (geoError.code === geoError.TIMEOUT) {
          setError(t('shopSettings.gpsTimeout'));
        } else {
          setError(t('shopSettings.gpsGenericError'));
        }
        setStep('idle');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const cancelToIdle = () => {
    setPending(null);
    setStep('idle');
    setError('');
  };

  const confirmSave = async () => {
    if (!pending) return;
    setStep('saving');
    setError('');
    try {
      await updateServiceDetails(service.id, {
        locationLat: pending.lat,
        locationLng: pending.lng,
        locationAccuracy: pending.accuracy != null ? pending.accuracy : null,
      });
      setPending(null);
      setStep('idle');
    } catch (e) {
      setError(t('shopSettings.gpsSaveError'));
      setStep('confirm');
    }
  };

  const lastUpdatedLabel = hasSavedLocation ? formatRelativeDay(service.locationSetAt, t) : null;

  return (
    <div style={{
      padding: 12, borderRadius: 10, border: '1px dashed var(--border)',
      background: 'var(--surface, var(--card))',
    }}
    >
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>
        {t('shopSettings.gpsSectionTitle')}
      </div>

      {step === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {hasSavedLocation ? (
              <>
                <span>{t('shopSettings.gpsSetLabel')}</span>
                {lastUpdatedLabel && (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    ({t('shopSettings.gpsUpdatedPrefix')} {lastUpdatedLabel})
                  </span>
                )}
              </>
            ) : (
              <span>{t('shopSettings.gpsNotSet')}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasSavedLocation && (
              <a
                href={googleMapsUrl(service.locationLat, service.locationLng)}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {t('shopSettings.gpsViewOnMaps')} <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={requestLocation}
              className="btn btn-secondary"
              style={{ minHeight: 38, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Navigation size={14} />
              {hasSavedLocation ? t('shopSettings.gpsUpdateButton') : t('shopSettings.gpsSetAddButton')}
            </button>
          </div>
        </div>
      )}

      {step === 'fetching' && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('shopSettings.gpsFetching')}</div>
      )}

      {step === 'low_accuracy' && pending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--danger, #b45309)', lineHeight: 1.6 }}>
            {t('shopSettings.gpsLowAccuracyWarning')}
          </div>
          <a
            href={googleMapsUrl(pending.lat, pending.lng)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t('shopSettings.gpsViewOnMaps')} <ExternalLink size={12} />
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={requestLocation} className="btn btn-secondary" style={{ flex: 1, minHeight: 40, fontSize: 13 }}>
              {t('shopSettings.gpsRetryButton')}
            </button>
            <button type="button" onClick={() => setStep('confirm')} className="btn btn-secondary" style={{ flex: 1, minHeight: 40, fontSize: 13 }}>
              {t('shopSettings.gpsProceedAnyway')}
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && pending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.5 }}>
            {t('shopSettings.gpsConfirmTitle')}
          </div>
          {pending.accuracy != null && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {t('shopSettings.gpsConfirmAccuracyPrefix')} {Math.round(pending.accuracy)} {t('shopSettings.gpsConfirmAccuracySuffix')}
            </div>
          )}
          <a
            href={googleMapsUrl(pending.lat, pending.lng)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {t('shopSettings.gpsViewOnMaps')} <ExternalLink size={12} />
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={cancelToIdle} className="btn btn-secondary" style={{ flex: 1, minHeight: 40, fontSize: 13 }}>
              {t('shopSettings.gpsConfirmRetry')}
            </button>
            <button type="button" onClick={confirmSave} className="btn btn-primary" style={{ flex: 1, minHeight: 40, fontSize: 13 }}>
              {t('shopSettings.gpsConfirmYes')}
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('shopSettings.saving')}</div>
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginTop: 8 }}>{error}</div>
      )}
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

// CATEGORY_SETUP_EDIT_UNIFY: category used to be write-once, chosen only
// on the ServiceSetupForm at signup, with no way to fix a wrong pick
// afterwards — a separate, disagreeing edit form here only touched name/
// description/priceNote. Same grid as setup now lives here too, so
// there's one true editable record instead of two forms with different
// ideas of what's final.
function ServiceDetailsEditor({ service, t }) {
  const [type, setType] = useState(service.type || 'salon');
  const [name, setName] = useState(service.name || '');
  const [description, setDescription] = useState(service.description || '');
  const [priceNote, setPriceNote] = useState(service.priceNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setType(service.type || 'salon');
    setName(service.name || '');
    setDescription(service.description || '');
    setPriceNote(service.priceNote || '');
  }, [service.id, service.type, service.name, service.description, service.priceNote]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateServiceDetails(service.id, {
        type, name, description, priceNote,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{t('dashboard.setup.category')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {SERVICE_TYPES.map((st) => {
              const stCfg = getCategorySetupConfig(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setType(st)}
                  style={{
                    padding: '12px 10px', borderRadius: 10,
                    border: `1.5px solid ${type === st ? 'var(--accent)' : 'var(--border)'}`,
                    background: type === st ? 'var(--accentSoft)' : 'var(--card)',
                    color: type === st ? 'var(--accent)' : 'var(--text)',
                    cursor: 'pointer', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', gap: 3,
                    minWidth: 0, width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-word' }}>{SERVICE_TYPE_LABELS_BN[st]}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.75, lineHeight: 1.3, wordBreak: 'break-word' }}>
                    {stCfg.categoryHintBn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
