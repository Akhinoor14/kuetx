// ProviderOfferingsPage.jsx
//
// PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2. Reachable at
// /provider/shop/offerings. Contains the Offerings manager + Revenue
// total sections moved VERBATIM out of ProviderDashboard.jsx (same
// components, same Firestore subscriptions, same strings) — just no
// longer wrapped in a Collapsible, since each now has its own dedicated
// page/tap instead of being one of many collapsed sections on one long
// page.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, Plus, Trash2, Loader2, ImagePlus,
} from 'lucide-react';
import {
  subscribeProviderServices, setServiceOfferings, addOfferingId,
  withServiceDefaults,
} from '../../lib/serviceSync';
import {
  uploadServiceImage, deleteServiceImage,
} from '../../lib/serviceImageUpload';
import { getCategorySetupConfig } from '../../lib/serviceCategoryConfig';
import { useProviderLang } from '../../hooks/useProviderLang';

export default function ProviderOfferingsPage({ providerProfile }) {
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
  const isInquiryMode = service?.interactionMode === 'inquiry';
  const cfg = service ? getCategorySetupConfig(service.type) : null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <BackLink navigate={navigate} />

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('offerings.loading')}
        </div>
      )}

      {!stillLoading && !service && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('offerings.noServiceYet')}
        </div>
      )}

      {/* CATEGORY_SPECIFIC_SETUP_PLAN.md Phase 3: Errand Runner has no
          fixed catalog by design (see serviceCategoryConfig.js's doc
          comment) — this page has nothing useful to manage for that
          category, so it shows an explanatory state instead of an empty
          Offerings list that would look broken. */}
      {!stillLoading && service && !cfg.hasFixedCatalog && (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            এই ক্যাটাগরিতে আইটেম তালিকা প্রযোজ্য না
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            আপনার সার্ভিসে কোনো ফিক্সড আইটেম বা মেনু লাগে না — শিক্ষার্থী বা
            শিক্ষকরা সরাসরি আপনাকে রিকোয়েস্ট পাঠাবেন, আপনি ড্যাশবোর্ড থেকে
            সেগুলো Accept/Reject করবেন।
          </div>
        </div>
      )}

      {!stillLoading && service && cfg.hasFixedCatalog && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Offerings — same OfferingsManager component/logic/strings as
              ProviderDashboard.jsx's Collapsible("Offerings") used to
              wrap, just no longer collapsed since this is now its own
              dedicated page. */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {cfg.offeringsPageTitleBn}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
              {(service.offerings || []).length}টা {cfg.itemWordPluralBn}
            </div>
            <OfferingsManager service={service} cfg={cfg} />
          </div>

          {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 5: revenue tracker is
              booking-mode only — inquiry mode has no confirm/finish/
              price-taking flow to feed it (plan's explicit "কোনো revenue
              tracking নেই inquiry-তে"), same condition as the original
              Collapsible on ProviderDashboard.jsx. */}
          {!isInquiryMode && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                {t('offerings.revenueTitle')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
                {t('offerings.revenueSubtitle')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Wallet size={22} color="var(--accent)" />
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>৳{service.revenueTotal || 0}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BackLink({ navigate }) {
  const { t } = useProviderLang();
  return (
    <button
      onClick={() => navigate('/provider/shop')}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        color: 'var(--muted)', fontSize: 13, fontWeight: 600,
      }}
    >
      <ArrowLeft size={16} /> {t('offerings.backLink')}
    </button>
  );
}

const MAX_OFFERING_IMAGES = 3;

function OfferingsManager({ service, cfg }) {
  const { t } = useProviderLang();
  const [offerings, setOfferings] = useState(service.offerings || []);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingWithImage, setAddingWithImage] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFor, setUploadingFor] = useState(null); // offering id currently uploading
  const fileInputsRef = useRef({});
  const newImageInputRef = useRef(null);
  const itemRefs = useRef({});

  useEffect(() => setOfferings(service.offerings || []), [service.offerings]);

  // MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: exact same whole-array-save
  // pattern as before — every mutation (add/toggle/remove/price/image)
  // builds the next full array and calls setServiceOfferings() once, no
  // partial-update path added.
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

  // CATEGORY_SPECIFIC_SETUP_PLAN.md follow-up: the provider can now pick
  // an image WHILE composing the new item (newImageFile), not only after
  // it's already saved. If a file was picked, the item is created first
  // (so we have a serviceId + offering id to upload against — the R2
  // upload path needs both), then the image upload runs immediately in
  // the same action, then that image URL is folded into the same
  // offering via one more save. Slower (2 writes instead of 1) but the
  // provider never sees an item without its photo already attached by
  // the time this finishes — no second manual step required for the
  // common case of "one photo per item".
  const addOffering = async () => {
    if (!newLabel.trim()) return;
    const price = newPrice.trim() ? Number(newPrice) : null;
    const newId = addOfferingId();
    const pickedFile = newImageFile;
    const base = {
      id: newId, label: newLabel.trim(), isAvailable: true,
      price: Number.isFinite(price) ? price : null, images: [],
    };
    setNewLabel('');
    setNewPrice('');
    setNewImageFile(null);
    setNewImagePreview(null);

    if (!pickedFile) {
      const next = [...offerings, base];
      await save(next);
      requestAnimationFrame(() => {
        itemRefs.current[newId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    setAddingWithImage(true);
    setError('');
    try {
      const next = [...offerings, base];
      await save(next);
      const url = await uploadServiceImage(service.id, pickedFile);
      const withImage = next.map((o) => (o.id === newId ? { ...o, images: [url] } : o));
      await save(withImage);
      requestAnimationFrame(() => {
        itemRefs.current[newId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (e) {
      setError(e.message || t('offerings.imageUploadError'));
    } finally {
      setAddingWithImage(false);
    }
  };

  const onPickNewItemImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const clearNewItemImage = () => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImageFile(null);
    setNewImagePreview(null);
  };

  const toggleOffering = (id) => {
    const next = offerings.map((o) => (o.id === id ? { ...o, isAvailable: !o.isAvailable } : o));
    save(next);
  };

  const removeOffering = (id) => {
    // Removing an offering entirely (not just turning it off) is fine
    // here because Gap 5 only requires that EXISTING bookings referencing
    // an offeringId stay intact — those bookings keep their offeringId
    // string regardless of whether the offerings array still lists it;
    // ProviderDashboard's offeringLabel() falls back to "Unknown offering"
    // for exactly that case. Any uploaded offering images are best-effort
    // cleaned up from R2 too, same as cover-image replace/remove.
    const removed = offerings.find((o) => o.id === id);
    (removed?.images || []).forEach((url) => deleteServiceImage(url));
    save(offerings.filter((o) => o.id !== id));
  };

  const updatePrice = (id, value) => {
    const price = value.trim() ? Number(value) : null;
    const next = offerings.map((o) => (o.id === id ? { ...o, price: Number.isFinite(price) ? price : null } : o));
    save(next);
  };

  const onPickOfferingImage = async (id, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const offering = offerings.find((o) => o.id === id);
    if (!offering) return;
    if ((offering.images || []).length >= MAX_OFFERING_IMAGES) {
      setError(t('offerings.maxImages')(MAX_OFFERING_IMAGES));
      return;
    }
    setError('');
    setUploadingFor(id);
    try {
      const url = await uploadServiceImage(service.id, file);
      const next = offerings.map((o) => (o.id === id ? { ...o, images: [...(o.images || []), url] } : o));
      await save(next);
    } catch (e) {
      setError(e.message || t('offerings.imageUploadError'));
    } finally {
      setUploadingFor(null);
    }
  };

  const removeOfferingImage = (id, url) => {
    const next = offerings.map((o) => (o.id === id ? { ...o, images: (o.images || []).filter((u) => u !== url) } : o));
    save(next);
    deleteServiceImage(url);
  };

  return (
    <div>
      {offerings.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{t('offerings.empty')}</div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {offerings.map((o) => (
        <div
          key={o.id}
          ref={(el) => { itemRefs.current[o.id] = el; }}
          style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text)', opacity: o.isAvailable ? 1 : 0.5, overflowWrap: 'break-word' }}>{o.label}</span>
            <button
              onClick={() => toggleOffering(o.id)}
              disabled={saving}
              style={{
                minHeight: 40, minWidth: 56, padding: '0 14px', borderRadius: 10, border: 'none',
                fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                background: o.isAvailable ? '#16a34a' : '#6b7280', color: '#fff',
              }}
            >
              {o.isAvailable ? (cfg?.availableLabelBn || t('offerings.on')) : (cfg?.unavailableLabelBn || t('offerings.off'))}
            </button>
            <button
              onClick={() => removeOffering(o.id)}
              disabled={saving}
              className="btn btn-secondary"
              style={{ minHeight: 40, minWidth: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Phase 3: per-item price (optional) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>৳</span>
            <input
              type="number"
              inputMode="numeric"
              defaultValue={o.price ?? ''}
              onBlur={(e) => updatePrice(o.id, e.target.value)}
              placeholder={t('offerings.pricePlaceholder')}
              style={{
                width: 110, minHeight: 36, padding: '0 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13,
              }}
            />
          </div>

          {/* Phase 3: up to 3 images per offering. Phase 1: helper label
              now reflects category (সার্ভিসের ছবি / খাবারের ছবি /
              প্রোডাক্টের ছবি) instead of always being unlabeled. */}
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 10, marginBottom: 4 }}>
            {cfg?.imageHelperTextBn}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(o.images || []).map((url) => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={url} alt={o.label} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                <button
                  onClick={() => removeOfferingImage(o.id, url)}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                    background: '#dc2626', color: '#fff', border: 'none', fontSize: 11, lineHeight: '18px',
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
                  onClick={() => fileInputsRef.current[o.id]?.click()}
                  disabled={uploadingFor === o.id}
                  style={{
                    minWidth: 48, height: 48, borderRadius: 8, border: '1px dashed var(--border)',
                    background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: uploadingFor === o.id ? '0 10px' : 0,
                  }}
                >
                  {uploadingFor === o.id
                    ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>আপলোড হচ্ছে…</span>
                      </>
                    )
                    : <Plus size={16} />}
                </button>
                <input
                  ref={(el) => { fileInputsRef.current[o.id] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={(e) => onPickOfferingImage(o.id, e)}
                />
              </>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        {newImagePreview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <img src={newImagePreview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
              <button
                onClick={clearNewItemImage}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
                  background: '#dc2626', color: '#fff', border: 'none', fontSize: 11, lineHeight: '18px',
                  cursor: 'pointer', padding: 0,
                }}
              >
                ×
              </button>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>ছবি যোগ হবে</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addOffering(); }}
            placeholder={cfg?.itemNamePlaceholder || t('offerings.newLabelPlaceholder')}
            style={{
              flex: 1, minWidth: 0, minHeight: 44, padding: '0 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addOffering(); }}
            type="number"
            inputMode="numeric"
            placeholder="৳"
            style={{
              width: 60, minHeight: 44, padding: '0 8px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <button
            onClick={() => newImageInputRef.current?.click()}
            disabled={addingWithImage}
            title={cfg?.imageHelperTextBn || 'ছবি'}
            style={{
              minHeight: 44, minWidth: 44, borderRadius: 10,
              border: `1px dashed ${newImageFile ? 'var(--accent)' : 'var(--border)'}`,
              background: newImageFile ? 'var(--accentSoft)' : 'var(--card)',
              color: newImageFile ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ImagePlus size={17} />
          </button>
          <input
            ref={newImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={onPickNewItemImage}
          />
          <button
            onClick={addOffering}
            disabled={saving || addingWithImage}
            className="btn btn-primary"
            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {addingWithImage
              ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Plus size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
