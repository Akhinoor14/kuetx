// ProviderOfferingDetailPage.jsx
//
// Offering hover-to-manage + dedicated detail page task. Reachable at
// /provider/shop/offerings/:offeringId. All the per-offering editing that
// used to live inline on each card in ProviderOfferingsPage.jsx's
// OfferingsManager (availability toggle, price input, photo thumbnails +
// add/remove, delete) now lives here instead — moved verbatim, same
// Firestore calls (setServiceOfferings / uploadServiceImage /
// deleteServiceImage), same strings, same MAX_OFFERING_IMAGES cap.
//
// This page does its own subscribeProviderServices(uid, setServices) call,
// mirroring exactly how ProviderOfferingsPage.jsx and
// ProviderShopSettingsPage.jsx each independently subscribe — no shared
// state lifted above the route level.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Loader2, Check, X as XIcon, ImageOff,
} from 'lucide-react';
import {
  subscribeProviderServices, setServiceOfferings, withServiceDefaults,
} from '../../lib/serviceSync';
import {
  uploadServiceImage, deleteServiceImage,
} from '../../lib/serviceImageUpload';
import { getCategorySetupConfig } from '../../lib/serviceCategoryConfig';
import { useProviderLang } from '../../hooks/useProviderLang';

const MAX_OFFERING_IMAGES = 3;

export default function ProviderOfferingDetailPage({ providerProfile }) {
  const { t } = useProviderLang();
  const { offeringId } = useParams();
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
  const cfg = service ? getCategorySetupConfig(service.type) : null;
  const offering = service ? (service.offerings || []).find((o) => o.id === offeringId) : null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <BackLink navigate={navigate} />

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('offerings.loading')}
        </div>
      )}

      {!stillLoading && (!service || !offering) && (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('offerings.notFound')}</div>
        </div>
      )}

      {!stillLoading && service && offering && (
        <OfferingDetail service={service} offering={offering} cfg={cfg} navigate={navigate} />
      )}
    </div>
  );
}

function BackLink({ navigate }) {
  const { t } = useProviderLang();
  return (
    <button
      onClick={() => navigate('/provider/shop/offerings')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--muted)', fontSize: 13, fontWeight: 600,
      }}
    >
      <ArrowLeft size={16} /> {t('offerings.detailBackLink')}
    </button>
  );
}

function OfferingDetail({
  service, offering, cfg, navigate,
}) {
  const { t } = useProviderLang();
  const [offerings, setOfferings] = useState(service.offerings || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [priceInput, setPriceInput] = useState(offering.price ?? '');
  const [priceSaved, setPriceSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => setOfferings(service.offerings || []), [service.offerings]);

  const o = offerings.find((x) => x.id === offering.id) || offering;

  useEffect(() => setPriceInput(o.price ?? ''), [o.id, o.price]);

  // Same whole-array-save pattern as OfferingsManager (list page) — every
  // mutation builds the next full array and calls setServiceOfferings()
  // once.
  const save = async (next) => {
    setSaving(true);
    setError('');
    try {
      await setServiceOfferings(service.id, next);
      setOfferings(next);
    } catch (e) {
      setError(t('offerings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleOffering = () => {
    const next = offerings.map((x) => (x.id === o.id ? { ...x, isAvailable: !x.isAvailable } : x));
    save(next);
  };

  const updatePrice = async () => {
    const price = String(priceInput).trim() ? Number(priceInput) : null;
    const next = offerings.map((x) => (x.id === o.id ? { ...x, price: Number.isFinite(price) ? price : null } : x));
    await save(next);
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 1500);
  };

  const onPickOfferingImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if ((o.images || []).length >= MAX_OFFERING_IMAGES) {
      setError(t('offerings.maxImages')(MAX_OFFERING_IMAGES));
      return;
    }
    setError('');
    setUploadingImage(true);
    try {
      const url = await uploadServiceImage(service.id, file);
      const next = offerings.map((x) => (x.id === o.id ? { ...x, images: [...(x.images || []), url] } : x));
      await save(next);
    } catch (e) {
      setError(e.message || t('offerings.imageUploadError'));
    } finally {
      setUploadingImage(false);
    }
  };

  const removeOfferingImage = (url) => {
    const next = offerings.map((x) => (x.id === o.id ? { ...x, images: (x.images || []).filter((u) => u !== url) } : x));
    save(next);
    deleteServiceImage(url);
  };

  const removeOffering = async () => {
    // Removing an offering entirely (not just turning it off) is fine here
    // because bookings that reference an offeringId keep that id string
    // regardless of whether the offerings array still lists it —
    // ProviderDashboard's offeringLabel() falls back to "Unknown offering"
    // for exactly that case. Any uploaded offering images are best-effort
    // cleaned up from R2 too, same as cover-image replace/remove.
    setDeleting(true);
    setError('');
    try {
      (o.images || []).forEach((url) => deleteServiceImage(url));
      await setServiceOfferings(service.id, offerings.filter((x) => x.id !== o.id));
      navigate('/provider/shop/offerings');
    } catch (e) {
      setError(t('offerings.saveError'));
      setDeleting(false);
    }
  };

  const coverUrl = (o.images || [])[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 18 }}>
        <div style={{ width: '100%', aspectRatio: '4 / 3', background: 'var(--surface, #f3f4f6)', position: 'relative' }}>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={o.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: o.isAvailable ? 1 : 0.45 }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6, opacity: o.isAvailable ? 1 : 0.45,
            }}
            >
              <ImageOff size={30} color="var(--muted)" />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('offerings.noImage')}</span>
            </div>
          )}
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', overflowWrap: 'break-word' }}>
            {o.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
            {o.price ? `৳${o.price}` : t('offerings.noPriceYet')}
          </div>
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}

      {/* Availability toggle — exact same sliding switch UI/logic as the
          old inline card's toggleOffering. */}
      <div className="card" style={{ padding: 16 }}>
        <button
          onClick={toggleOffering}
          disabled={saving}
          aria-pressed={o.isAvailable}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '9px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: o.isAvailable ? 'rgba(22,163,74,0.10)' : 'rgba(107,114,128,0.10)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: o.isAvailable ? '#16a34a' : '#6b7280' }}>
            {o.isAvailable ? (cfg?.availableLabelBn || t('offerings.on')) : (cfg?.unavailableLabelBn || t('offerings.off'))}
          </span>
          <span style={{ position: 'relative', width: 40, height: 24, borderRadius: 999, background: o.isAvailable ? '#16a34a' : '#d1d5db', flexShrink: 0 }}>
            <span
              style={{
                position: 'absolute', top: 2, left: o.isAvailable ? 18 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                transition: 'left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              {o.isAvailable
                ? <Check size={12} color="#16a34a" strokeWidth={3} />
                : <XIcon size={12} color="#6b7280" strokeWidth={3} />}
            </span>
          </span>
        </button>
      </div>

      {/* Price — same updatePrice pattern, saved explicitly with a button
          on this dedicated page instead of on-blur, per the task's note
          that this reads better here. */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          ৳ {t('offerings.pricePlaceholder')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder={t('offerings.pricePlaceholder')}
            style={{
              flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <button
            onClick={updatePrice}
            disabled={saving}
            className="btn btn-primary"
            style={{ minHeight: 44, padding: '0 16px', whiteSpace: 'nowrap' }}
          >
            {priceSaved ? t('offerings.priceSaved') : t('offerings.savePrice')}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{t('offerings.perUnitHint')}</div>
      </div>

      {/* Photo management — same thumbnails + remove + add-via-file-picker,
          same MAX_OFFERING_IMAGES cap, same uploading-spinner state. */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {t('offerings.photosTitle')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 10 }}>
          {cfg?.imageHelperTextBn}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(o.images || []).map((url) => (
            <div key={url} style={{ position: 'relative' }}>
              <img src={url} alt={o.label} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
              <button
                onClick={() => removeOfferingImage(url)}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                  background: '#dc2626', color: '#fff', border: 'none', fontSize: 12, lineHeight: '20px',
                  cursor: 'pointer', padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {(o.images || []).length < MAX_OFFERING_IMAGES && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  minWidth: 64, height: 64, borderRadius: 10, border: '1px dashed var(--border)',
                  background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: uploadingImage ? '0 12px' : 0,
                }}
              >
                {uploadingImage
                  ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>আপলোড হচ্ছে…</span>
                    </>
                  )
                  : <Plus size={18} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={onPickOfferingImage}
              />
            </>
          )}
        </div>
      </div>

      {/* Delete — dedicated destructive button with the same confirm-step
          pattern/visual style as ConfirmBlock in
          ProviderShopSettingsPage.jsx, reused here for consistency. */}
      <div className="card" style={{ padding: 16 }}>
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="btn btn-secondary"
            style={{ width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#dc2626' }}
          >
            <Trash2 size={16} /> {t('offerings.deleteOffering')}
          </button>
        ) : (
          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface, var(--card))' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6, marginBottom: 12 }}>
              {t('offerings.deleteConfirmText')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="btn btn-secondary"
                style={{ flex: 1, minHeight: 44 }}
              >
                {t('offerings.cancel')}
              </button>
              <button
                onClick={removeOffering}
                disabled={deleting}
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 44, background: '#dc2626' }}
              >
                {deleting ? t('offerings.deleting') : t('offerings.deleteConfirmLabel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
