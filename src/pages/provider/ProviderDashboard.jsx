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
import { useNavigate } from 'react-router-dom';
import {
  Store, Check, X as XIcon, Clock, MessageCircle, Info,
} from 'lucide-react';
import {
  subscribeProviderServices, createService, setServiceOpen,
  subscribePendingBookings, subscribeConfirmedBookings,
  confirmBooking, cancelBooking, finishBooking, hasConflictingConfirmedSlot,
  countStudentNoShowsOnService, withServiceDefaults,
  SERVICE_TYPE_LABELS_BN, SERVICE_TYPES,
  subscribePendingInquiries, answerInquiry,
} from '../../lib/serviceSync';
// Runner (errand) mode — REWIRED this session from the old shop-bound
// functions in serviceSync.js (subscribeOpenErrandRequestsForRunner,
// subscribeRunnerActiveErrands, acceptErrandRequest, rejectErrandAccept,
// finishErrandRequest, all keyed off THIS shop's own services/{id}/
// bookings subcollection) to the new top-level open feed in
// errandRequests.js. Person's explicit design (this session): a Runner
// is now just a verified Provider account with an 'errand'-type shop —
// they see and accept from the SAME campus-wide errandRequests feed
// every student sees, not a private per-shop queue. The old serviceSync.js
// functions are left in place (unused, not deleted) for now — same
// "don't delete, no one asked to" caution as everywhere else in this
// codebase; a future cleanup pass can remove them once this rewire is
// confirmed stable.
import {
  subscribeOpenErrandRequests, subscribeMyAcceptedErrandRequests,
  acceptErrandRequest, confirmErrandAcceptor, finishErrandRequest,
  withdrawErrandAccept, getSavedErrandPhone, isErrandRunner,
} from '../../lib/errandRequests';
import { getCategorySetupConfig } from '../../lib/serviceCategoryConfig';
import { useProviderLang } from '../../hooks/useProviderLang';

// Phase 3 (SERVICE_BOOKING_REDESIGN_PLAN_PROMPT.md): a booking doc can
// now be either single-offering (offeringId, salon) or multi-item
// (items[], hotel/food — new this phase). Both PendingBookingCard and
// the confirmed-bookings list below previously assumed offeringId
// always existed (via their own local offeringLabel(b.offeringId)
// closures) — that would render "unknown offering" for every hotel
// order otherwise. This is the shared fallback used by both instead.
function bookingSummaryText(booking, offerings, offeringLabelFn) {
  if (Array.isArray(booking.items) && booking.items.length > 0) {
    return booking.items.map((item) => `${item.label} × ${item.quantity}`).join(', ');
  }
  return offeringLabelFn(booking.offeringId);
}

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
  const { t } = useProviderLang();
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
    <div className="kx-provider-dashboard" style={{ padding: '20px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Store size={22} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {providerProfile?.displayName || t('dashboard.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('dashboard.verifiedBadge')}</div>
        </div>
      </div>

      {stillLoading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {t('dashboard.loading')}
        </div>
      )}

      {!stillLoading && !myService && (
        <ServiceSetupForm providerUid={uid} />
      )}

      {!stillLoading && myService && (
        <ServiceManager service={myService} />
      )}

      {/* Desktop widening: this page had no @media rules at all before —
          the 640px inline maxWidth kept it mobile-narrow even on a large
          screen, leaving most of the viewport empty. Mobile layout
          (padding/spacing/font-size, all inline styles below) is
          untouched; only the outer column's cap grows on wider
          viewports, same breakpoint convention Services.jsx already
          uses (480px / 900px). */}
      <style>{`
        @media (min-width: 900px) {
          .kx-provider-dashboard { max-width: 880px !important; }
        }
        @media (min-width: 1280px) {
          .kx-provider-dashboard { max-width: 1040px !important; }
        }
      `}</style>
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
  // no category-select UI at all. Now the provider picks one of the six
  // plan-approved categories at signup; createService() derives
  // interactionMode from that choice (Phase 1 logic, unchanged here).
  //
  // CATEGORY_SPECIFIC_SETUP_PLAN.md Phase 1: every field below that used
  // to be identical across all six categories now reads its
  // placeholder/hint copy from serviceCategoryConfig.js, keyed by the
  // currently-selected `type`. Phase 2 adds the post-submit redirect to
  // the Offerings page (skipped for 'errand', which has no fixed catalog).
  const { t } = useProviderLang();
  const navigate = useNavigate();
  const [type, setType] = useState('salon');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cfg = getCategorySetupConfig(type);

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError(t('dashboard.setup.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await createService(providerUid, {
        type, name, description,
      });
      // Phase 2: send the provider straight to where they add their
      // items/menu/products next, instead of leaving them to discover
      // "My Shop" on their own. Errand Runner has no fixed catalog
      // (hasFixedCatalog: false) so there's nothing to redirect to —
      // ServiceManager will render on this same screen once the new
      // service doc arrives via subscribeProviderServices.
      if (cfg.hasFixedCatalog) {
        navigate('/provider/shop/offerings');
      }
    } catch (e) {
      console.error('[ServiceSetupForm] createService failed:', e);
      setError(t('dashboard.setup.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        {t('dashboard.setup.title')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        {t('dashboard.setup.subtitle')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        <Field label={t('dashboard.setup.serviceName')} value={name} onChange={setName} placeholder={cfg.shopNamePlaceholder} />
        <Field
          label={t('dashboard.setup.description')}
          value={description}
          onChange={setDescription}
          placeholder={t('dashboard.setup.descriptionPlaceholder')}
          textarea
          hint="সহজ ভাষায় লিখুন — আপনি কী সার্ভিস দেন, কেন আপনার কাছে আসবে। যেমন: 'ক্যাম্পাসের ভেতরে দ্রুত ডেলিভারি, সন্ধ্যা ৬টা পর্যন্ত অর্ডার নেওয়া হয়।'"
        />
      </div>

      {/* Phase 1: makes the two-step flow (shop profile now, items/menu
          later) explicit — nothing else here tells the provider that
          per-item prices aren't set on this screen. (Price range/note
          used to also live in this form — removed per user feedback:
          misleading here since prices are actually set per-item in
          Offerings, not as one overall range at setup time. Still
          editable later from Shop Settings if a provider wants an
          overall price-range shown on their shop page.) */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        marginTop: 14, padding: '12px 14px', borderRadius: 12,
        background: 'var(--accentSoft)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
      }}>
        <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
          {cfg.hasFixedCatalog
            ? `এই তথ্য শুধু আপনার দোকানের পরিচিতির জন্য। প্রতিটা ${cfg.itemWordPluralBn}-এর নাম, দাম ও ছবি এরপরের ধাপে "দোকান → ${cfg.offeringsPageTitleBn}" থেকে যোগ করতে পারবেন।`
            : 'আপনার কোনো ফিক্সড আইটেম বা মেনু তালিকা লাগবে না — শিক্ষার্থী বা শিক্ষকরা সরাসরি আপনাকে রিকোয়েস্ট পাঠাবেন, আপনি সেগুলো Accept/Reject করবেন।'}
        </div>
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--danger, #dc2626)' }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>
        {submitting ? t('dashboard.setup.saving') : t('dashboard.setup.submit')}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, textarea, hint,
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
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{hint}</div>
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
  const { t } = useProviderLang();
  const service = withServiceDefaults(rawService);
  const isInquiryMode = service.interactionMode === 'inquiry';
  // Phase 4 (plan §4): the Runner mode uses its own pair of live queues
  // (open requests to accept + own ongoing errands), same
  // mutually-exclusive-with-booking/inquiry pattern as isInquiryMode above.
  const isErrandMode = service.interactionMode === 'errand';
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [pendingInquiries, setPendingInquiries] = useState(null);
  const [openErrands, setOpenErrands] = useState(null);
  const [activeErrands, setActiveErrands] = useState(null);
  const [toggling, setToggling] = useState(false);

  // Phase 5: booking-mode subscribes to the pending/confirmed queues as
  // before; inquiry-mode subscribes to the new pending-inquiries stream
  // instead. Only one pair is ever active per service, matching the
  // mutually-exclusive rendering below.
  useEffect(() => {
    if (isInquiryMode || isErrandMode) return undefined;
    return subscribePendingBookings(service.id, setPending);
  }, [service.id, isInquiryMode, isErrandMode]);
  useEffect(() => {
    if (isInquiryMode || isErrandMode) return undefined;
    return subscribeConfirmedBookings(service.id, setConfirmed);
  }, [service.id, isInquiryMode, isErrandMode]);
  useEffect(() => {
    if (!isInquiryMode) return undefined;
    return subscribePendingInquiries(service.id, setPendingInquiries);
  }, [service.id, isInquiryMode]);
  useEffect(() => {
    if (!isErrandMode) return undefined;
    // REWIRED (this session): campus-wide open feed instead of this
    // shop's own bookings subcollection — a Runner sees the SAME feed
    // every student sees (see errandRequests.js's module doc comment).
    // viewerUid=null here deliberately (not service.providerUid) — this
    // is a per-shop component, but the self-exclude filter needs the
    // signed-in PROVIDER account's own uid, which is service.providerUid
    // in this context (a Provider only ever manages their own shop), so
    // passing service.providerUid is in fact correct and matches what
    // the old function received here too.
    return subscribeOpenErrandRequests(service.providerUid, setOpenErrands, true);
  }, [service.id, service.providerUid, isErrandMode]);
  useEffect(() => {
    if (!isErrandMode) return undefined;
    // REWIRED (this session): "my ongoing errands" now reads the
    // account-wide accepts collectionGroup (errandRequests.js) instead
    // of this shop's own bookings — a Runner's accepted-but-not-yet-
    // confirmed and confirmed requests both live here, merged with each
    // request's parent doc already.
    return subscribeMyAcceptedErrandRequests(service.providerUid, (accepted) => {
      setActiveErrands(accepted
        .filter((a) => a.status === 'waiting' || a.status === 'confirmed')
        .map((a) => ({ ...a.request, id: a.request?.id, acceptStatus: a.status }))
        .filter((r) => r.id));
    });
  }, [service.id, service.providerUid, isErrandMode]);

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
      <ShopOpenToggle
        isOpen={service.isOpen}
        toggling={toggling}
        onToggle={toggleOpen}
        openLabel={t('dashboard.shopOpen')}
        closedLabel={t('dashboard.shopClosed')}
      />

      {/* Phase 7 follow-up: this toggle IS the broadcast trigger for an
          errand-type (Runner) service (see syncErrandBroadcastState in
          serviceSync.js) — opening the shop now surfaces it to every
          student as a broadcast card + notification, which wasn't true
          before Phase 7 shipped. The plan flagged this as an optional
          gap (a Runner had no way to know "open" now means "public
          announcement", not just an internal-looking status flag) —
          worth a small explicit note here rather than leaving it silent. */}
      {isErrandMode && (
        <div style={{
          fontSize: 12, color: 'var(--muted)', marginTop: -8, padding: '0 4px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
        >
          <Info size={13} style={{ flexShrink: 0 }} />
          {t('dashboard.errand.broadcastHint')}
        </div>
      )}

      {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 5 / Phase 4 (Errand Runner
          plan §4): mutually exclusive by interactionMode — booking keeps
          PendingQueue + ConfirmedList + revenue exactly as before,
          inquiry gets PendingInquiries, errand (Runner) gets its own
          Open Requests queue + Ongoing list, no confirm/finish/revenue. */}
      {isErrandMode ? (
        <>
          <ErrandQueue providerUid={service.providerUid} providerName={service.name} requests={openErrands} />
          <RunnerActiveErrands providerUid={service.providerUid} requests={activeErrands} />
        </>
      ) : isInquiryMode ? (
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
        PROVIDER_NAV_RESTRUCTURE_PROMPT.md Phase 2: Offerings, revenue,
        shop meta (cover/location/delivery), shop status control, and
        service details editor were moved off this page entirely — they
        now live on their own routes under /provider/shop (My Shop hub +
        its 2 sub-pages), each reachable from the bottom nav/sidebar.
        This page keeps only the "what needs my attention right now"
        content: the open/closed toggle and the live pending/confirmed
        queues above.
      */}
    </div>
  );
}

// ---------------------------------------------------------------------
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 3 additions below: dormant
// banner, cover/offering image upload + location/delivery editor, and
// the manual pause/permanent-close/reactivate control.
// ---------------------------------------------------------------------

// Redesigned open/closed control (§5.2 still applies — biggest, most
// important, one tap). Previously a flat solid-color button; now a real
// sliding switch (track + animated knob) so the on/off state reads at a
// glance the way a physical toggle does, with a one-line caption instead
// of relying on button color alone. Track/knob colors stay anchored to
// KUETx's existing green (#16a34a = "open" everywhere else in this file)
// so this doesn't introduce a second, competing "success" color.
function ShopOpenToggle({
  isOpen, toggling, onToggle, openLabel, closedLabel,
}) {
  const { t } = useProviderLang();
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      aria-pressed={isOpen}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, width: '100%', textAlign: 'left',
        padding: '14px 16px', borderRadius: 18, border: 'none', cursor: 'pointer',
        background: isOpen ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#eef0f2',
        boxShadow: isOpen
          ? '0 6px 18px rgba(22,163,74,0.28)'
          : 'inset 0 0 0 1px rgba(15,23,42,0.08)',
        transition: 'background 0.35s ease, box-shadow 0.35s ease',
        opacity: toggling ? 0.75 : 1,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 16.5, fontWeight: 800,
            color: isOpen ? '#fff' : '#1f2937',
            transition: 'color 0.35s ease',
          }}
        >
          {isOpen ? openLabel : closedLabel}
        </span>
        <span
          style={{
            fontSize: 11.5, fontWeight: 500,
            color: isOpen ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
          }}
        >
          {isOpen ? t('dashboard.shopOpen.hint') : t('dashboard.shopClosed.hint')}
        </span>
      </span>

      {/* Track + sliding knob */}
      <span
        style={{
          position: 'relative', flexShrink: 0,
          width: 56, height: 32, borderRadius: 999,
          background: isOpen ? 'rgba(255,255,255,0.28)' : '#d1d5db',
          transition: 'background 0.35s ease',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 3, left: isOpen ? 27 : 3,
            width: 26, height: 26, borderRadius: '50%',
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.22)',
            transition: 'left 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {isOpen
            ? <Check size={15} color="#16a34a" strokeWidth={3} />
            : <XIcon size={15} color="#6b7280" strokeWidth={3} />}
        </span>
      </span>
    </button>
  );
}

function DormantBanner({ service }) {
  const { t } = useProviderLang();
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
        {t('dashboard.dormant.title')}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
        {service.dormantReason === 'auto' && t('dashboard.dormant.auto')}
        {service.dormantReason === 'manual_temporary' && t('dashboard.dormant.manualTemporary')}
        {isPermanent && t('dashboard.dormant.manualPermanent')}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
        {t('dashboard.dormant.visibility')}
      </div>
    </div>
  );
}

function PendingQueue({ serviceId, bookings, offerings }) {
  const { t } = useProviderLang();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [conflictWarningFor, setConflictWarningFor] = useState(null);

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || t('dashboard.pending.unknownOffering');

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
          setError(t('dashboard.pending.conflictWarning'));
          setBusyId(null);
          return;
        }
      }
      setConflictWarningFor(null);
      await confirmBooking(serviceId, bookingId, preferredTime || null);
    } catch (e) {
      setError(e.message || t('dashboard.pending.confirmError'));
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
      setError(e.message || t('dashboard.pending.cancelError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} /> {t('dashboard.pending.title')} {bookings ? `(${bookings.length})` : ''}
      </div>

      {bookings === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.loading')}</div>}
      {bookings && bookings.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.pending.empty')}</div>}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {(bookings || []).map((b) => (
        <PendingBookingCard
          key={b.id}
          serviceId={serviceId}
          booking={b}
          offeringLabel={bookingSummaryText(b, offerings, offeringLabel)}
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
  const { t } = useProviderLang();
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
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || t('dashboard.pending.student')}</div>
        {noShowCount >= 2 && (
          <span
            title={t('dashboard.pending.noShowTitle')}
            style={{
              fontSize: 11, fontWeight: 700,
              color: '#dc2626', background: 'rgba(220,38,38,0.12)',
              borderRadius: 6, padding: '2px 8px',
            }}
          >
            {noShowCount} {t('dashboard.pending.noShowSuffix')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{offeringLabel}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{t('dashboard.pending.requested')} {formatWhen(b.requestedAt)}</div>
      {b.preferredTime && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          {t('dashboard.pending.preferred')} {b.preferredTime.date}, {b.preferredTime.time}
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
          {t('dashboard.pending.confirm')}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn btn-secondary"
          style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
        >
          {t('dashboard.pending.cancel')}
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
  const { t } = useProviderLang();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const doAnswer = async (bookingId, replyText) => {
    setBusyId(bookingId);
    setError('');
    try {
      await answerInquiry(serviceId, bookingId, replyText);
    } catch (e) {
      setError(e.message || t('dashboard.inquiries.answerError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageCircle size={16} /> {t('dashboard.inquiries.title')} {inquiries ? `(${inquiries.length})` : ''}
      </div>

      {inquiries === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.inquiries.loading')}</div>}
      {inquiries && inquiries.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.inquiries.empty')}</div>}

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
  const { t } = useProviderLang();
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
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{inq.studentName || t('dashboard.inquiries.student')}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{t('dashboard.inquiries.requested')} {formatWhen(inq.requestedAt)}</div>
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
          {t('dashboard.inquiries.total')} ৳{total}
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
        placeholder={t('dashboard.inquiries.replyPlaceholder')}
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
        {busy ? t('dashboard.inquiries.sending') : t('dashboard.inquiries.reply')}
      </button>
    </div>
  );
}

function ConfirmedList({ serviceId, bookings, offerings }) {
  const { t } = useProviderLang();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [priceEntryFor, setPriceEntryFor] = useState(null);
  const [priceInput, setPriceInput] = useState('');

  const offeringLabel = (id) => offerings.find((o) => o.id === id)?.label || t('dashboard.pending.unknownOffering');

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
      setError(e.message || t('dashboard.confirmed.genericError'));
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
      setError(e.message || t('dashboard.confirmed.genericError'));
    } finally {
      setBusyId(null);
    }
  };

  if (bookings === null || bookings.length === 0) return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {t('dashboard.confirmed.title')} ({bookings.length})
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}
      {bookings.map((b) => (
        <div key={b.id} style={{ padding: 12, borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{b.studentName || t('dashboard.confirmed.student')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{bookingSummaryText(b, offerings, offeringLabel)}</div>
          {b.confirmedSlot && (
            <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              {t('dashboard.confirmed.slot')} {b.confirmedSlot.date} {t('dashboard.confirmed.at')} {b.confirmedSlot.time}
            </div>
          )}
          {priceEntryFor === b.id ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                {t('dashboard.confirmed.priceLabel')}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="৳"
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
                  {t('dashboard.confirmed.finishConfirm')}
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
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => startFinish(b.id)} disabled={busyId === b.id} className="btn btn-primary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                {t('dashboard.confirmed.finish')}
              </button>
              <button onClick={() => doCancel(b.id)} disabled={busyId === b.id} className="btn btn-secondary" style={{ flex: 1, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}>
                {t('dashboard.confirmed.noShow')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Phase 4 (Delivery/Errand Runner plan §4.3-§4.5): the Runner-side
// equivalent of PendingQueue/ConfirmedList above. Two separate lists per
// the plan's status flow: ErrandQueue is 'open' requests the Runner can
// Accept (broadcast + targeted-at-them, re-surfaced on edit — sorting
// already handled by subscribeOpenErrandRequestsForRunner), and
// RunnerActiveErrands is their own already-accepted (runner_accepted +
// confirmed) errands, mirroring booking mode's Pending/Confirmed split.
// ---------------------------------------------------------------------

// Phase 8, item 3: itemDescription is unbounded free-text (ServiceDetail.jsx
// textarea has no maxLength, firestore.rules only checks non-empty), so a
// long description can make the Runner's request list hard to scan. Per the
// handoff decision, we keep the card summarized (2-line clamp) but expand it
// in-place on click rather than navigating away — Runner's accept decision
// needs the full text without losing the list. The toggle only renders when
// the text is actually long enough to be clamped, to avoid clutter on short
// one-line descriptions.
const ERRAND_DESC_CLAMP_LINES = 2;

function TruncatedErrandDescription({ text, t }) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If the clamped scrollHeight exceeds what N lines can hold, the text
    // is actually being truncated — only then do we need a toggle at all.
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  if (!text) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div
        ref={ref}
        style={{
          fontSize: 13, color: 'var(--text)',
          ...(expanded ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: ERRAND_DESC_CLAMP_LINES,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {text}
      </div>
      {isClamped && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'none', border: 'none', padding: 0, marginTop: 2,
            fontSize: 12, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer',
          }}
        >
          {expanded ? t('dashboard.errand.showLess') : t('dashboard.errand.showMore')}
        </button>
      )}
    </div>
  );
}

// REWIRED (this session, bug fix — ERRAND_SYSTEM_REDESIGN_PLAN.md Phase D
// item 8): this component was left calling the OLD serviceSync.js-shaped
// signature (serviceId, bookingId, providerUid) even after the import
// above switched to errandRequests.js's acceptErrandRequest(requestId,
// {acceptorUid, acceptorName, acceptorPhone, acceptorIsFaculty}) — every
// Runner accept-tap was silently throwing since the rewire landed. Fixed
// to match the new signature and, since a Runner needs a phone number on
// the accept doc same as a student acceptor does (see ErrandFeed.jsx's
// AcceptView), added the same "reuse saved phone, ask once" step here
// rather than skipping straight to a bare accept call.
function ErrandQueue({ providerUid, providerName, requests }) {
  const { t } = useProviderLang();
  const [phoneRequestId, setPhoneRequestId] = useState(null);
  const [phone, setPhone] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const startAccept = async (requestId) => {
    setError('');
    try {
      const saved = await getSavedErrandPhone(providerUid);
      setPhone(saved || '');
    } catch { /* ignore — phone field just starts empty */ }
    setPhoneRequestId(requestId);
  };

  const doAccept = async (requestId) => {
    if (!phone.trim()) { setError(t('dashboard.errand.phoneRequired') || 'একটা ফোন নাম্বার দিন।'); return; }
    setBusyId(requestId);
    setError('');
    try {
      await acceptErrandRequest(requestId, {
        acceptorUid: providerUid,
        acceptorName: providerName,
        acceptorPhone: phone,
        acceptorIsFaculty: false, // a Runner is a verified Provider account, never faculty
      });
      setPhoneRequestId(null);
    } catch (e) {
      setError(e.message || t('dashboard.errand.acceptError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={16} /> {t('dashboard.errand.openTitle')} {requests ? `(${requests.length})` : ''}
      </div>

      {requests === null && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.loading')}</div>}
      {requests && requests.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('dashboard.errand.openEmpty')}</div>}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}

      {(requests || []).map((r) => (
        <div
          key={r.id}
          style={{
            padding: 12, borderRadius: 12, marginBottom: 8,
            background: 'var(--surface, var(--card))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
            {r.requesterName || t('dashboard.errand.requester')}
          </div>
          <TruncatedErrandDescription text={r.itemDescription} t={t} />
          {r.itemImageUrl && (
            <img
              src={r.itemImageUrl}
              alt=""
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 6 }}
            />
          )}
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>{r.proposedPrice > 0 ? `৳${r.proposedPrice}` : t('dashboard.errand.free')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{t('dashboard.errand.requested')} {formatWhen(r.createdAt)}</div>

          {phoneRequestId === r.id ? (
            <>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="০১XXXXXXXXX"
                style={{
                  width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
                }}
              />
              <button
                onClick={() => doAccept(r.id)}
                disabled={busyId === r.id}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
              >
                {busyId === r.id ? t('dashboard.errand.accepting') : t('dashboard.errand.accept')}
              </button>
            </>
          ) : (
            <button
              onClick={() => startAccept(r.id)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 10, minHeight: 46, fontSize: 14.5, fontWeight: 700 }}
            >
              {t('dashboard.errand.accept')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// REWIRED (this session, bug fix — ERRAND_SYSTEM_REDESIGN_PLAN.md Phase D
// item 8): same stale-signature problem as ErrandQueue above —
// rejectErrandAccept was never even imported from errandRequests.js (it
// doesn't exist there; the new model's equivalent is
// withdrawErrandAccept(requestId, acceptorUid)) and finishErrandRequest
// was still being called with the old (serviceId, bookingId) shape
// instead of the new single-arg (requestId). Also: `requesterPhone` is
// NOT a field errandRequests.js ever writes — only the ACCEPTOR's phone
// is collected (see acceptErrandRequest); a requester's own contact
// info was never part of this data model. Matches
// ErrandFeed.jsx's AcceptorConfirmedView, which only shows the
// requester's name and asks the acceptor to reach out, no phone field.
// Status names also updated: the new model's accepts subcollection uses
// 'waiting'/'confirmed'/'rejected'/'withdrawn', not the old shop-mode's
// 'runner_accepted'.
function RunnerActiveErrands({ providerUid, requests }) {
  const { t } = useProviderLang();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const doWithdraw = async (requestId) => {
    setBusyId(requestId);
    setError('');
    try {
      await withdrawErrandAccept(requestId, providerUid);
    } catch (e) {
      setError(e.message || t('dashboard.errand.genericError'));
    } finally {
      setBusyId(null);
    }
  };

  const doFinish = async (requestId) => {
    setBusyId(requestId);
    setError('');
    try {
      await finishErrandRequest(requestId);
    } catch (e) {
      setError(e.message || t('dashboard.errand.genericError'));
    } finally {
      setBusyId(null);
    }
  };

  if (requests === null || requests.length === 0) return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {t('dashboard.errand.ongoingTitle')} ({requests.length})
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 8 }}>{error}</div>}
      {requests.map((r) => (
        <div key={r.id} style={{ padding: 12, borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
            {r.requesterName || t('dashboard.errand.requester')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            {t(r.acceptStatus === 'confirmed' ? 'dashboard.errand.statusConfirmed' : 'dashboard.errand.statusAwaitingConfirm')}
          </div>
          <TruncatedErrandDescription text={r.itemDescription} t={t} />
          {r.itemImageUrl && (
            <img
              src={r.itemImageUrl}
              alt=""
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', marginTop: 6 }}
            />
          )}
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>{r.proposedPrice > 0 ? `৳${r.proposedPrice}` : t('dashboard.errand.free')}</div>

          {r.acceptStatus === 'confirmed' && (
            <div style={{
              fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
              padding: 8, marginTop: 8,
            }}
            >
              {t('dashboard.errand.contactRequester')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {r.acceptStatus === 'waiting' && (
              <button
                onClick={() => doWithdraw(r.id)}
                disabled={busyId === r.id}
                className="btn btn-secondary"
                style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 700 }}
              >
                {t('dashboard.errand.cancelAccept')}
              </button>
            )}
            {r.acceptStatus === 'confirmed' && (
              <button
                onClick={() => doFinish(r.id)}
                disabled={busyId === r.id}
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 700 }}
              >
                {t('dashboard.errand.finish')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

