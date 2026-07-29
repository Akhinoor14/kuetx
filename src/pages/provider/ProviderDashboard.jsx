// ProviderDashboard.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §5). Only reachable once
// RequireProvider confirms status === 'verified'. Layout follows the
// spec's priority order exactly: pending bookings queue first (the
// thing that needs action right now), then the open/closed toggle
// (big, one-tap), then offerings management, then revenue — mobile-first
// since "owner মূলত মোবাইল ইউজার" (§5 closing note).
//
// PHASE 3 PART 2: booking-state alerts are wired at the serviceSync.js
// level (confirmBooking/cancelBooking/expirePendingBookingsForClosedShop
// write into bookingAlerts/{uid}/items — see that file and
// NotificationPanel.jsx), so nothing changes here for that item. This
// pass instead covers the two things that DO touch this file:
// mobile touch-target/scroll-depth polish (§5's closing note — the owner
// is a busy salon owner on a phone, not someone browsing at leisure),
// and letting the owner enter a real price when finishing a booking
// (previously hardcoded to 0, so revenueTotal never actually moved).

import { useEffect, useRef, useState } from 'react';
import {
  Store, Check, X as XIcon, Clock, Wallet, Plus, Trash2,
  MapPin, Truck, Image as ImageIcon, Pause, Play, Power, MessageCircle,
} from 'lucide-react';
import Collapsible from '../../components/Collapsible';
import {
  subscribeProviderServices, createService, setServiceOpen,
  setServiceOfferings, addOfferingId, updateServiceDetails,
  subscribePendingBookings, subscribeConfirmedBookings,
  confirmBooking, cancelBooking, finishBooking, hasConflictingConfirmedSlot,
  countStudentNoShowsOnService, withServiceDefaults,
  SERVICE_TYPE_LABELS, SERVICE_TYPES, setServiceStatus,
  subscribePendingInquiries, answerInquiry,
} from '../../lib/serviceSync';
import {
  uploadServiceImage, deleteServiceImage, MAX_IMAGE_BYTES,
} from '../../lib/serviceImageUpload';

function formatWhen(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ProviderDashboard({ providerProfile }) {
  const [services, setServices] = useState(null);
  const uid = providerProfile?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeProviderServices(uid, setServices);
  }, [uid]);

  if (!uid) return null;

  const myService = services && services.length > 0 ? services[0] : null;
  const stillLoading = services === null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Store size={22} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {providerProfile?.displayName || 'Provider Dashboard'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Verified service provider</div>
        </div>
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {!stillLoading && !myService && (
        <ServiceSetupForm providerUid={uid} />
      )}

      {!stillLoading && myService && (
        <ServiceManager service={myService} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// First-time setup — a verified provider has no services/{serviceId}
// doc yet (Phase 1 left serviceIds: [] on purpose). This is the one-time
// form that creates it.
// ---------------------------------------------------------------------
function ServiceSetupForm({ providerUid }) {
  // MULTI_CATEGORY_SERVICES_PLAN.md Phase 3 (explicit, mandatory gap from
  // Phase 0.5): this form previously sent type: 'salon' hardcoded, with
  // no category-select UI at all. Now the provider picks one of the five
  // plan-approved categories at signup; createService() derives
  // interactionMode from that choice (Phase 1 logic, unchanged here).
  const [type, setType] = useState('salon');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('সার্ভিসের নাম দিন।');
      return;
    }
    setSubmitting(true);
    try {
      await createService(providerUid, {
        type, name, description, priceNote,
      });
    } catch (e) {
      setError('সেভ করতে সমস্যা হয়েছে — আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        আপনার সার্ভিস সেট আপ করুন
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        এটা একবারই করতে হবে। পরে সব কিছু এখান থেকে এডিট করতে পারবেন।
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ক্যাটাগরি</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {SERVICE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  padding: '12px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  border: `1.5px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === t ? 'var(--accentSoft)' : 'var(--card)',
                  color: type === t ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                {SERVICE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <Field label="সার্ভিসের নাম" value={name} onChange={setName} placeholder="যেমন: Rafiq's Salon" />
        <Field label="বর্ণনা (ঐচ্ছিক)" value={description} onChange={setDescription} placeholder="সংক্ষিপ্ত বিবরণ" textarea />
        <Field label="মূল্য নোট (ঐচ্ছিক)" value={priceNote} onChange={setPriceNote} placeholder="যেমন: ৳50 - ৳300" />
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>
        {submitting ? 'সেভ হচ্ছে…' : 'সার্ভিস তৈরি করুন'}
      </button>
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

// ---------------------------------------------------------------------
// Main manager — shown once a service exists.
// ---------------------------------------------------------------------
function ServiceManager({ service: rawService }) {
  // MULTI_CATEGORY_SERVICES_PLAN.md Phase 1 migration note: run every
  // service doc through withServiceDefaults() before use, so a
  // pre-Phase-1 service (no interactionMode/status field yet) still
  // renders correctly here instead of showing "undefined".
  const service = withServiceDefaults(rawService);
  const isInquiryMode = service.interactionMode === 'inquiry';
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [pendingInquiries, setPendingInquiries] = useState(null);
  const [toggling, setToggling] = useState(false);

  // Phase 5: booking-mode subscribes to the pending/confirmed queues as
  // before; inquiry-mode subscribes to the new pending-inquiries stream
  // instead. Only one pair is ever active per service, matching the
  // mutually-exclusive rendering below.
  useEffect(() => {
    if (isInquiryMode) return undefined;
    return subscribePendingBookings(service.id, setPending);
  }, [service.id, isInquiryMode]);
  useEffect(() => {
    if (isInquiryMode) return undefined;
    return subscribeConfirmedBookings(service.id, setConfirmed);
  }, [service.id, isInquiryMode]);
  useEffect(() => {
    if (!isInquiryMode) return undefined;
    return subscribePendingInquiries(service.id, setPendingInquiries);
  }, [service.id, isInquiryMode]);

  const toggleOpen = async () => {
    setToggling(true);
    try {
      await setServiceOpen(service.id, !service.isOpen);
    } finally {
      setToggling(false);
    }
  };

  const isDormant = service.status === 'dormant';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isDormant && <DormantBanner service={service} />}

      {/* Open/Closed — biggest, most important, one tap (§5.2). Left
          exactly as-is even while dormant — plan's note: "owner dormant
          অবস্থায়ও চাইলে isOpen টগল করতে পারবে". */}
      <button
        onClick={toggleOpen}
        disabled={toggling}
        style={{
          padding: '18px 16px', borderRadius: 16, border: 'none', cursor: 'pointer',
          fontSize: 17, fontWeight: 800, color: '#fff',
          background: service.isOpen ? '#16a34a' : '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}
      >
        {service.isOpen ? <Check size={22} /> : <XIcon size={22} />}
        {service.isOpen ? 'দোকান এখন খোলা — ট্যাপ করে বন্ধ করুন' : 'দোকান এখন বন্ধ — ট্যাপ করে খুলুন'}
      </button>

      {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 5: mutually exclusive
          by interactionMode — booking keeps PendingQueue + ConfirmedList
          + revenue exactly as before; inquiry gets the new
          PendingInquiries list instead, no confirm/finish/revenue. */}
      {isInquiryMode ? (
        <PendingInquiries serviceId={service.id} inquiries={pendingInquiries} offerings={service.offerings || []} />
      ) : (
        <>
          {/* Pending bookings queue — first screen priority (§5.1) */}
          <PendingQueue serviceId={service.id} bookings={pending} offerings={service.offerings || []} />

          {/* Confirmed bookings — finish or cancel-as-no-show */}
          <ConfirmedList serviceId={service.id} bookings={confirmed} offerings={service.offerings || []} />
        </>
      )}

      {/*
        Mobile scroll-depth pass (§5 closing note): PendingQueue and
        ConfirmedList above stay always-expanded — those are the two
        things a busy owner mid-shift needs on-screen without an extra
        tap. Offerings, revenue, and the details editor are lower-
        frequency (edited occasionally, not every booking), so they
        collapse by default, cutting the vertical stack down to just the
        open/closed toggle + two live queues on first paint.
      */}
      <Collapsible title="Offerings" subtitle={`${(service.offerings || []).length} item${(service.offerings || []).length === 1 ? '' : 's'}`}>
        <OfferingsManager service={service} />
      </Collapsible>

      {/* Phase 5: revenue tracker is booking-mode only — inquiry mode has
          no confirm/finish/price-taking flow to feed it (plan's explicit
          "কোনো revenue tracking নেই inquiry-তে"). */}
      {!isInquiryMode && (
        <Collapsible
          title="মোট আয়"
          subtitle="Done বুকিং থেকে"
          rightCollapsed={<span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>৳{service.revenueTotal || 0}</span>}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Wallet size={22} color="var(--accent)" />
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>৳{service.revenueTotal || 0}</div>
          </div>
        </Collapsible>
      )}

      {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: cover image, location,
          delivery — same Collapsible pattern as Offerings/revenue/details
          above, since these are also low-frequency edits. */}
      <Collapsible title="ছবি, লোকেশন ও ডেলিভারি" subtitle={service.locationText || 'সেট করা হয়নি'}>
        <ShopMetaEditor service={service} />
      </Collapsible>

      {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: manual pause/permanent-
          close/reactivate control. */}
      <Collapsible
        title="শপ স্ট্যাটাস"
        subtitle={isDormant ? 'নিষ্ক্রিয় (Dormant)' : 'সক্রিয়'}
      >
        <ShopStatusControl service={service} />
      </Collapsible>

      <Collapsible title="সার্ভিস বিবরণ এডিট করুন" subtitle={service.name}>
        <ServiceDetailsEditor service={service} />
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 3 additions below: dormant
// banner, cover/offering image upload + location/delivery editor, and
// the manual pause/permanent-close/reactivate control.
// ---------------------------------------------------------------------

function DormantBanner({ service }) {
  const isPermanent = service.dormantReason === 'manual_permanent';
  return (
    <div
      className="card"
      style={{
        padding: 14, borderRadius: 14, background: 'rgba(234,88,12,0.10)',
        border: '1px solid rgba(234,88,12,0.35)',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#c2410c' }}>
        এই শপ এখন নিষ্ক্রিয় (Dormant)
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
        {service.dormantReason === 'auto' && 'সব অফারিং দীর্ঘদিন ধরে আনঅ্যাভেইলেবল থাকায় সিস্টেম স্বয়ংক্রিয়ভাবে এটা নিষ্ক্রিয় করেছে।'}
        {service.dormantReason === 'manual_temporary' && 'আপনি এই শপ সাময়িকভাবে বন্ধ রেখেছেন — নিচের "শপ স্ট্যাটাস" থেকে যেকোনো সময় আবার সক্রিয় করতে পারবেন।'}
        {isPermanent && 'আপনি এই শপ স্থায়ীভাবে বন্ধ করেছেন — নিজে থেকে আর সক্রিয় করা যাবে না, Founder-এর সাথে যোগাযোগ করতে হবে।'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
        ছাত্রদের কাছে এখনো তালিকায় দেখাবে, কিন্তু আলাদা "বর্তমানে নিষ্ক্রিয়" অংশে, কম-প্রাধান্যে।
      </div>
    </div>
  );
}

function ShopStatusControl({ service }) {
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
      setError('আপডেট করতে সমস্যা হয়েছে — আবার চেষ্টা করুন।');
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
            <Play size={16} /> {busy ? 'হচ্ছে…' : 'Reactivate — আবার সক্রিয় করুন'}
          </button>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            এই শপ স্থায়ীভাবে বন্ধ — নিজে থেকে reactivate করা যাবে না।
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
        Deactivate করলে শপ "নিষ্ক্রিয়" তালিকায় চলে যাবে — কিন্তু ডেটা/offerings
        সব অক্ষত থাকবে। কী ধরনের deactivate করবেন বেছে নিন:
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {confirming === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setConfirming('pause')}
            className="btn btn-secondary"
            style={{ minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Pause size={16} /> সাময়িক বিরতি (Temporary pause)
          </button>
          <button
            onClick={() => setConfirming('permanent_close')}
            className="btn btn-secondary"
            style={{ minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#dc2626' }}
          >
            <Power size={16} /> স্থায়ীভাবে বন্ধ (Permanent close)
          </button>
        </div>
      )}

      {confirming === 'pause' && (
        <ConfirmBlock
          text="Temporary pause করলে শপ নিষ্ক্রিয় তালিকায় যাবে, কিন্তু আপনি যেকোনো সময় নিজে থেকে আবার Reactivate করে ফিরিয়ে আনতে পারবেন। কোনো ডেটা মুছে যাবে না।"
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run('pause')}
          confirmLabel="নিশ্চিত — Pause করুন"
        />
      )}

      {confirming === 'permanent_close' && (
        <ConfirmBlock
          text="Permanent close করলে শপ নিষ্ক্রিয় তালিকায় যাবে এবং আপনি নিজে থেকে আর reactivate করতে পারবেন না — শুধু Founder-level review-এর মাধ্যমে আবার খোলা যাবে।"
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => run('permanent_close')}
          confirmLabel="নিশ্চিত — স্থায়ীভাবে বন্ধ করুন"
          danger
        />
      )}
    </div>
  );
}

function ConfirmBlock({
  text, busy, onCancel, onConfirm, confirmLabel, danger,
}) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface, var(--card))' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.6, marginBottom: 12 }}>{text}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} disabled={busy} className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }}>
          বাতিল
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn btn-primary"
          style={{ flex: 1, minHeight: 44, background: danger ? '#dc2626' : undefined }}
        >
          {busy ? 'হচ্ছে…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}

function ShopMetaEditor({ service }) {
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
      setError('সেভ করতে সমস্যা হয়েছে।');
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
      setError(e.message || 'ছবি আপলোড করতে সমস্যা হয়েছে।');
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
      setError('মুছতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cover image */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>কভার ছবি (সর্বোচ্চ 1MB)</label>
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
              {uploadingCover ? 'আপলোড হচ্ছে…' : service.coverImageUrl ? 'পরিবর্তন করুন' : 'ছবি আপলোড করুন'}
            </button>
            {service.coverImageUrl && (
              <button onClick={removeCover} className="btn btn-secondary" style={{ minHeight: 36, fontSize: 12, color: '#dc2626' }}>
                মুছুন
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
          <MapPin size={13} /> লোকেশন (ঐচ্ছিক, ফ্রি-টেক্সট)
        </label>
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="যেমন: Hall-3 Gate, Fazlul Haque Hall market"
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
          হোম ডেলিভারি আছে
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
        {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
      </button>
      {saved && <span style={{ fontSize: 12, color: '#16a34a' }}>সেভ হয়েছে ✓</span>}
    </div>
  );
}

function PendingQueue({ serviceId, bookings, offerings }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [conflictWarningFor, setConflictWarningFor] = useState(null);

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || 'Unknown offering';

  const doConfirm = async (bookingId, preferredTime) => {
    setBusyId(bookingId);
    setError('');
    try {
      // §11 item 2: warn, don't block — see hasConflictingConfirmedSlot's
      // own doc comment for why this stays a nudge rather than an
      // enforced rule. If the owner already dismissed the warning once
      // for this booking (conflictWarningFor === bookingId) and tapped
      // Confirm again, go ahead — re-showing the same warning forever
      // would just be annoying, not protective.
      if (preferredTime && conflictWarningFor !== bookingId) {
        const conflict = await hasConflictingConfirmedSlot(serviceId, preferredTime);
        if (conflict) {
          setConflictWarningFor(bookingId);
          setError('এই সময়ে আরেকটা বুকিং আগে থেকেই কনফার্ম আছে — আবার Confirm চাপলে এগিয়ে যাবে।');
          setBusyId(null);
          return;
        }
      }
      setConflictWarningFor(null);
      await confirmBooking(serviceId, bookingId, preferredTime || null);
    } catch (e) {
      setError(e.message || 'কনফার্ম করতে সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      await cancelBooking(serviceId, bookingId, 'owner');
    } catch (e) {
      setError(e.message || 'বাতিল করতে সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} /> Pending Bookings {bookings ? `(${bookings.length})` : ''}
      </div>

      {bookings === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {bookings && bookings.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>কোনো pending বুকিং নেই।</div>}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {(bookings || []).map((b) => (
        <PendingBookingCard
          key={b.id}
          serviceId={serviceId}
          booking={b}
          offeringLabel={offeringLabel(b.offeringId)}
          busy={busyId === b.id}
          onConfirm={() => doConfirm(b.id, b.preferredTime)}
          onCancel={() => doCancel(b.id)}
        />
      ))}
    </div>
  );
}

function PendingBookingCard({
  serviceId, booking: b, offeringLabel, busy, onConfirm, onCancel,
}) {
  // §11 item 1: fetched lazily per card, once, not part of the live
  // bookings subscription above — this is a one-off lookup for owner
  // context, not something that needs real-time updates while the queue
  // is open (the count can only grow from a NEW no-show, which wouldn't
  // affect an already-rendered pending booking's own card anyway).
  const [noShowCount, setNoShowCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    countStudentNoShowsOnService(serviceId, b.studentUid)
      .then((n) => { if (!cancelled) setNoShowCount(n); })
      .catch(() => { if (!cancelled) setNoShowCount(0); });
    return () => { cancelled = true; };
  }, [serviceId, b.studentUid]);

  return (
    <div
      style={{
        padding: 12, borderRadius: 12, marginBottom: 8,
        background: b.preferredTime ? 'var(--accentSoft)' : 'var(--surface, var(--card))',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || 'Student'}</div>
        {noShowCount >= 2 && (
          <span
            title="আগে এই শপে একাধিকবার no-show হয়েছে"
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
              color: '#dc2626', background: 'rgba(220,38,38,0.12)',
              borderRadius: 6, padding: '2px 8px',
            }}
          >
            {noShowCount}× no-show
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{offeringLabel}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Requested: {formatWhen(b.requestedAt)}</div>
      {b.preferredTime && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          Preferred: {b.preferredTime.date} at {b.preferredTime.time}
        </div>
      )}
      {b.studentPhone && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.studentPhone}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="btn btn-primary"
          style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn btn-secondary"
          style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
        >
          বাতিল
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 5 additions below: the
// inquiry-mode equivalent of PendingQueue/PendingBookingCard above —
// no confirm/finish/revenue, just item+quantity display and a
// reply-and-answer action per inquiry.
// ---------------------------------------------------------------------

function PendingInquiries({ serviceId, inquiries, offerings }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const doAnswer = async (bookingId, replyText) => {
    setBusyId(bookingId);
    setError('');
    try {
      await answerInquiry(serviceId, bookingId, replyText);
    } catch (e) {
      setError(e.message || 'উত্তর পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={16} /> Pending Inquiries {inquiries ? `(${inquiries.length})` : ''}
      </div>

      {inquiries === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>}
      {inquiries && inquiries.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>কোনো নতুন প্রশ্ন/অনুরোধ নেই।</div>}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {(inquiries || []).map((inq) => (
        <InquiryQueueCard
          key={inq.id}
          inquiry={inq}
          busy={busyId === inq.id}
          onAnswer={(replyText) => doAnswer(inq.id, replyText)}
        />
      ))}
    </div>
  );
}

function InquiryQueueCard({ inquiry: inq, busy, onAnswer }) {
  const [replyText, setReplyText] = useState('');

  const total = (inq.items || []).reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = (inq.items || []).some((item) => typeof item.price === 'number');

  return (
    <div
      style={{
        padding: 12, borderRadius: 12, marginBottom: 8,
        background: 'var(--surface, var(--card))', border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{inq.studentName || 'Student'}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Requested: {formatWhen(inq.requestedAt)}</div>
      {inq.studentPhone && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{inq.studentPhone}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {(inq.items || []).map((item) => (
          <div key={item.offeringId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text)' }}>{item.label} × {item.quantity}</span>
            {typeof item.price === 'number' && (
              <span style={{ color: 'var(--muted)' }}>৳{item.price * item.quantity}</span>
            )}
          </div>
        ))}
      </div>

      {hasAnyPrice && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', marginTop: 6 }}>
          মোট (আনুমানিক): ৳{total}
        </div>
      )}

      {inq.question && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>
          &ldquo;{inq.question}&rdquo;
        </div>
      )}

      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="উত্তর লিখুন…"
        rows={2}
        style={{
          width: '100%', marginTop: 10, padding: '8px 10px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13.5,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <button
        onClick={() => onAnswer(replyText)}
        disabled={busy || !replyText.trim()}
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 8, minHeight: 44, fontSize: 14, fontWeight: 700 }}
      >
        {busy ? 'পাঠানো হচ্ছে…' : 'উত্তর দিন'}
      </button>
    </div>
  );
}

function ConfirmedList({ serviceId, bookings, offerings }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [priceEntryFor, setPriceEntryFor] = useState(null);
  const [priceInput, setPriceInput] = useState('');

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || 'Unknown offering';

  // §11 revenue decision: stays a single running revenueTotal (no
  // daily/weekly/per-offering breakdown for now — see the file-level note
  // for why) but the owner can now actually enter what they charged, so
  // revenueTotal moves at all. Previously this was hardcoded to 0, which
  // meant "Finish" never added anything to revenue no matter how many
  // bookings were completed. Price entry is a tiny inline step (not a
  // separate screen) since finishing a booking is the busy, high-frequency
  // action here — a modal or route change would slow down exactly the
  // moment §5's "কম scroll, বড় টগল" note is about.
  const startFinish = (bookingId) => {
    setError('');
    setPriceInput('');
    setPriceEntryFor(bookingId);
  };

  const confirmFinish = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      const price = Number(priceInput) || 0;
      await finishBooking(serviceId, bookingId, price);
      setPriceEntryFor(null);
    } catch (e) {
      setError(e.message || 'সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (bookingId) => {
    setBusyId(bookingId);
    setError('');
    try {
      await cancelBooking(serviceId, bookingId, 'owner');
    } catch (e) {
      setError(e.message || 'সমস্যা হয়েছে।');
    } finally {
      setBusyId(null);
    }
  };

  if (bookings === null || bookings.length === 0) return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        Confirmed ({bookings.length})
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}
      {bookings.map((b) => (
        <div key={b.id} style={{ padding: 12, borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || 'Student'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{offeringLabel(b.offeringId)}</div>
          {b.confirmedSlot && (
            <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              Slot: {b.confirmedSlot.date} at {b.confirmedSlot.time}
            </div>
          )}
          {priceEntryFor === b.id ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="৳ মূল্য"
                style={{
                  width: 90, minHeight: 46, padding: '0 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 15,
                }}
              />
              <button
                onClick={() => confirmFinish(b.id)}
                disabled={busyId === b.id}
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
              >
                সম্পন্ন করুন
              </button>
              <button
                onClick={() => setPriceEntryFor(null)}
                disabled={busyId === b.id}
                className="btn btn-secondary"
                style={{ minHeight: 46, minWidth: 46, fontSize: 14.5, fontWeight: 700 }}
              >
                <XIcon size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => startFinish(b.id)} disabled={busyId === b.id} className="btn btn-primary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                Finish
              </button>
              <button onClick={() => doCancel(b.id)} disabled={busyId === b.id} className="btn btn-secondary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                No-show / বাতিল
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const MAX_OFFERING_IMAGES = 3;

function OfferingsManager({ service }) {
  const [offerings, setOfferings] = useState(service.offerings || []);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFor, setUploadingFor] = useState(null); // offering id currently uploading
  const fileInputsRef = useRef({});

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
      setError('সেভ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const addOffering = () => {
    if (!newLabel.trim()) return;
    const price = newPrice.trim() ? Number(newPrice) : null;
    const next = [...offerings, {
      id: addOfferingId(), label: newLabel.trim(), isAvailable: true,
      price: Number.isFinite(price) ? price : null, images: [],
    }];
    setNewLabel('');
    setNewPrice('');
    save(next);
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
      setError(`প্রতি item-এ সর্বোচ্চ ${MAX_OFFERING_IMAGES}টা ছবি দেওয়া যাবে।`);
      return;
    }
    setError('');
    setUploadingFor(id);
    try {
      const url = await uploadServiceImage(service.id, file);
      const next = offerings.map((o) => (o.id === id ? { ...o, images: [...(o.images || []), url] } : o));
      await save(next);
    } catch (e) {
      setError(e.message || 'ছবি আপলোড করতে সমস্যা হয়েছে।');
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
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>এখনো কোনো offering যোগ করা হয়নি।</div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {offerings.map((o) => (
        <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', opacity: o.isAvailable ? 1 : 0.5 }}>{o.label}</span>
            <button
              onClick={() => toggleOffering(o.id)}
              disabled={saving}
              style={{
                minHeight: 40, minWidth: 56, padding: '0 14px', borderRadius: 10, border: 'none',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                background: o.isAvailable ? '#16a34a' : '#6b7280', color: '#fff',
              }}
            >
              {o.isAvailable ? 'ON' : 'OFF'}
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
              placeholder="দাম (ঐচ্ছিক)"
              style={{
                width: 110, minHeight: 36, padding: '0 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13,
              }}
            />
          </div>

          {/* Phase 3: up to 3 images per offering */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
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
                    width: 48, height: 48, borderRadius: 8, border: '1px dashed var(--border)',
                    background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {uploadingFor === o.id ? '…' : <Plus size={16} />}
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

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="নতুন offering (যেমন: Haircut)"
          style={{
            flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
        />
        <input
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder="৳"
          style={{
            width: 70, minHeight: 44, padding: '0 10px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
        />
        <button
          onClick={addOffering}
          disabled={saving}
          className="btn btn-primary"
          style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function ServiceDetailsEditor({ service }) {
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
        <Field label="নাম" value={name} onChange={setName} />
        <Field label="বর্ণনা" value={description} onChange={setDescription} textarea />
        <Field label="মূল্য নোট" value={priceNote} onChange={setPriceNote} />
      </div>
      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ marginTop: 12, minHeight: 44 }}>
        {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
      </button>
      {saved && <span style={{ marginLeft: 10, fontSize: 12, color: '#16a34a' }}>সেভ হয়েছে ✓</span>}
    </div>
  );
}

