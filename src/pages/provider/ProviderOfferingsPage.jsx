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
  ArrowLeft, Plus, Loader2, ImagePlus, ImageOff, Settings as SettingsIcon,
} from 'lucide-react';
import {
  subscribeProviderServices, setServiceOfferings, addOfferingId,
  withServiceDefaults,
} from '../../lib/serviceSync';
import { uploadServiceImage } from '../../lib/serviceImageUpload';
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

function OfferingsManager({ service, cfg }) {
  const { t } = useProviderLang();
  const navigate = useNavigate();
  const [offerings, setOfferings] = useState(service.offerings || []);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingWithImage, setAddingWithImage] = useState(false);
  const [error, setError] = useState('');
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

  return (
    <div>
      {offerings.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{t('offerings.empty')}</div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {offerings.map((o) => {
        const coverUrl = (o.images || [])[0] || null;
        return (
          <OfferingListCard
            key={o.id}
            offering={o}
            coverUrl={coverUrl}
            cfg={cfg}
            t={t}
            onOpen={() => navigate(`/provider/shop/offerings/${o.id}`)}
            itemRef={(el) => { itemRefs.current[o.id] = el; }}
          />
        );
      })}

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

// Compact, read-only card — all editing (toggle/price/photos/delete) now
// lives on the dedicated detail page (ProviderOfferingDetailPage.jsx).
// Clicking anywhere on the card, or the "Manage" overlay button, opens
// that page. The overlay is hover-revealed on devices that support hover
// (`@media (hover: hover)`, via the .kx-offering-manage-btn CSS below);
// on touch devices there's no hover state to rely on, so the button is
// always visible there (small, corner-anchored, unobtrusive).
function OfferingListCard({
  offering: o, coverUrl, cfg, t, onOpen, itemRef,
}) {
  return (
    <div
      ref={itemRef}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="kx-offering-card"
      style={{
        marginBottom: 14, borderRadius: 18, border: '1px solid var(--border)',
        background: 'var(--card)', overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
      }}
    >
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
            <ImageOff size={26} color="var(--muted)" />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('offerings.noImage')}</span>
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="kx-offering-manage-btn"
          aria-label={t('offerings.manage')}
        >
          <SettingsIcon size={13} />
          <span>{t('offerings.manage')}</span>
        </button>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', opacity: o.isAvailable ? 1 : 0.55, overflowWrap: 'break-word' }}>
              {o.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginTop: 3 }}>
              {o.price ? `৳${o.price}` : t('offerings.noPriceYet')}
            </div>
          </div>
          <span
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '4px 10px',
              color: o.isAvailable ? '#16a34a' : '#6b7280',
              background: o.isAvailable ? 'rgba(22,163,74,0.10)' : 'rgba(107,114,128,0.10)',
            }}
          >
            {o.isAvailable ? (cfg?.availableLabelBn || t('offerings.on')) : (cfg?.unavailableLabelBn || t('offerings.off'))}
          </span>
        </div>
      </div>

      <style>{`
        .kx-offering-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        @media (hover: hover) {
          .kx-offering-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 24px -12px rgba(0,0,0,0.18);
            border-color: rgba(var(--accentRGB), 0.3);
          }
          .kx-offering-manage-btn {
            opacity: 0;
            transform: translateY(4px);
          }
          .kx-offering-card:hover .kx-offering-manage-btn,
          .kx-offering-card:focus-visible .kx-offering-manage-btn {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .kx-offering-manage-btn {
          position: absolute; right: 10px; bottom: 10px;
          display: flex; align-items: center; gap: 6;
          padding: 7px 12px; border-radius: 999px; border: none; cursor: pointer;
          background: var(--card); color: var(--text);
          font-size: 12px; font-weight: 700;
          box-shadow: 0 4px 14px -4px rgba(0,0,0,0.35);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
      `}</style>
    </div>
  );
}
