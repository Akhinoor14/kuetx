// ServiceDetail.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §6). Detail page reached from
// Services.jsx. Display order is exactly the spec's: title -> price ->
// description. Booking form uses native <input type="date"> /
// <input type="time"> for preferredTime — structured, never free text
// (Gap 10) — and preferredTime itself stays fully optional.
//
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 4 additions: branches on
// service.interactionMode. 'booking' keeps the original BookingForm
// untouched below. 'inquiry' renders the new InquiryForm — multi-item
// select + quantity stepper + optional free-text question, all folded
// into one createBooking({ items, question }) call (Phase 2's single
// entry point, no new collection). Also added here: cover/offering
// image gallery, locationText/hasDelivery badges, and a non-blocking
// dormant banner (student can still view + submit an inquiry/booking
// while dormant — the plan is explicit dormant never blocks the page).

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store, Circle, ArrowLeft, MapPin, Truck, Minus, Plus, ExternalLink, ImageOff, Check,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import { getAccountRole } from '../lib/accountRole';
import { getFacultyProfile } from '../lib/facultySync';
import {
  subscribeService, createBooking, subscribeMyBookingsForService, cancelBooking,
  closeInquiry, withServiceDefaults,
  // Phase 4 (Delivery/Errand Runner plan §4.2-§4.5): errand-mode entry
  // points. UI-only addition — all of these were already written and
  // tested in serviceSync.js; this file just wires them up.
  createErrandRequest, subscribeMyErrandRequestsForService, subscribeAllServices,
  editErrandProposedPrice, confirmErrandRequest, rejectErrandAccept,
  cancelErrandRequest, finishErrandRequest,
} from '../lib/serviceSync';
import { getProviderPhone } from '../lib/providerSync';
import { renderFormattedNoticeBody } from '../lib/noticeFormat.jsx';

const STATUS_LABEL = {
  pending: 'অপেক্ষমান',
  confirmed: 'কনফার্ম হয়েছে',
  done: 'সম্পন্ন হয়েছে',
  cancelled: 'বাতিল হয়েছে',
  expired_shop_closed: 'দোকান বন্ধ থাকায় বাতিল হয়েছে',
};

const INQUIRY_STATUS_LABEL = {
  open: 'অপেক্ষমান — উত্তরের জন্য',
  answered: 'উত্তর দেওয়া হয়েছে',
  closed: 'বন্ধ করা হয়েছে',
};

// Phase 4 (plan §4): errand request status labels — mirrors the state
// machine in serviceSync.js's createErrandRequest/acceptErrandRequest/
// confirmErrandRequest/finishErrandRequest comments exactly.
const ERRAND_STATUS_LABEL = {
  open: 'অপেক্ষমান — কোনো Runner এখনো গ্রহণ করেননি',
  runner_accepted: 'একজন Runner গ্রহণ করেছেন — কনফার্ম করুন',
  confirmed: 'কনফার্ম হয়েছে',
  finished: 'সম্পন্ন হয়েছে',
  cancelled: 'বাতিল হয়েছে',
};

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(undefined); // undefined = loading, null = not found
  const [myBookings, setMyBookings] = useState(null);

  useEffect(() => subscribeService(serviceId, (s) => setService(s ? withServiceDefaults(s) : s)), [serviceId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    // Phase 4 (plan §4.2): errand-mode services store requests in the same
    // bookings subcollection, but subscribeMyBookingsForService's query
    // shape doesn't match errand fields — use the dedicated subscriber
    // once we know the service's mode.
    if (service && service.interactionMode === 'errand') {
      return subscribeMyErrandRequestsForService(serviceId, uid, setMyBookings);
    }
    return subscribeMyBookingsForService(serviceId, uid, setMyBookings);
  }, [serviceId, service?.interactionMode]);

  if (service === undefined) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  if (service === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        এই সার্ভিসটি খুঁজে পাওয়া যায়নি।
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/services')} className="btn btn-sm">Back to Services</button>
        </div>
      </div>
    );
  }

  const isInquiryMode = service.interactionMode === 'inquiry';
  const isErrandMode = service.interactionMode === 'errand';
  const isDormant = service.status === 'dormant';

  const activeBooking = !isInquiryMode && !isErrandMode
    ? (myBookings || []).find((b) => b.status === 'pending' || b.status === 'confirmed')
    : null;
  const activeInquiry = isInquiryMode
    ? (myBookings || []).find((b) => b.status === 'open' || b.status === 'answered')
    : null;
  // Phase 4 (plan §4): "one active request" — open/runner_accepted/confirmed
  // all count as active, mirroring createErrandRequest's own active-check.
  const activeErrand = isErrandMode
    ? (myBookings || []).find((b) => ['open', 'runner_accepted', 'confirmed'].includes(b.status))
    : null;

  return (
    <div className="kx-detail-page">
      <button onClick={() => navigate('/services')} className="btn btn-sm kx-detail-back">
        <ArrowLeft size={14} /> Services
      </button>

      <div className="kx-detail-layout">
        {/* ── Left column: media + info ─────────────────────────────── */}
        <div className="kx-detail-info">
          {service.coverImageUrl ? (
            <img src={service.coverImageUrl} alt={service.name} className="kx-detail-cover" />
          ) : (
            <div className="kx-detail-cover kx-detail-cover-placeholder">
              <Store size={48} color="var(--accent)" strokeWidth={1.4} />
            </div>
          )}

          <div className="kx-detail-titlebar">
            {/* title (§6 order: title -> price -> description) */}
            <div className="kx-detail-title">{service.name}</div>
            <div className="kx-detail-status">
              <Circle size={9} fill={service.isOpen ? '#16a34a' : '#9ca3af'} color={service.isOpen ? '#16a34a' : '#9ca3af'} />
              <span style={{ color: service.isOpen ? '#16a34a' : 'var(--muted)' }}>
                {service.isOpen ? 'এখন খোলা' : 'এখন বন্ধ'}
              </span>
            </div>
          </div>

          {/* Phase 4: locationText / hasDelivery badges */}
          {(service.locationText || service.hasDelivery
            || (typeof service.locationLat === 'number' && typeof service.locationLng === 'number')) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {service.locationText && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '4px 10px',
                }}
                >
                  <MapPin size={12} /> {service.locationText}
                </span>
              )}
              {/* SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 2: GPS
                  coordinate, if the provider has set one, gets a small
                  "মানচিত্রে দেখুন" link that opens Google Maps in a new tab —
                  no API key needed. Silently absent when the provider hasn't
                  added GPS yet (locationText badge alone still shows), same
                  "no negative empty-state" pattern as locationText itself. */}
              {typeof service.locationLat === 'number' && typeof service.locationLng === 'number' && (
                <a
                  href={`https://www.google.com/maps?q=${service.locationLat},${service.locationLng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                    color: 'var(--accent)', background: 'var(--accentSoft)', borderRadius: 999,
                    padding: '4px 10px', textDecoration: 'none',
                  }}
                >
                  মানচিত্রে দেখুন <ExternalLink size={11} />
                </a>
              )}
              {service.hasDelivery && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                  color: 'var(--accent)', background: 'var(--accentSoft)', borderRadius: 999, padding: '4px 10px',
                }}
                >
                  <Truck size={12} /> হোম ডেলিভারি আছে
                </span>
              )}
            </div>
          )}

          {/* Phase 4: dormant banner — informational only, never blocks the page */}
          {isDormant && <DormantInfoBanner service={service} />}

          {/* price */}
          {service.priceNote && (
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>{service.priceNote}</div>
          )}

          {/* description */}
          {service.description && (
            <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>
              {renderFormattedNoticeBody(service.description)}
            </div>
          )}
        </div>

        {/* ── Right column: booking / inquiry / errand form ─────────── */}
        <div className="kx-detail-action">
          {myBookings === null ? null : isErrandMode ? (
            activeErrand ? (
              <MyActiveErrand serviceId={serviceId} errand={activeErrand} />
            ) : (
              <ErrandForm service={service} />
            )
          ) : isInquiryMode ? (
            activeInquiry ? (
              <MyActiveInquiry serviceId={serviceId} inquiry={activeInquiry} />
            ) : (
              <InquiryForm service={service} />
            )
          ) : activeBooking ? (
            <MyActiveBooking serviceId={serviceId} booking={activeBooking} />
          ) : (
            <BookingForm service={service} />
          )}
        </div>
      </div>

      <style>{`
        .kx-detail-page { padding: 20px 16px 40px; width: 100%; max-width: 1180px; margin: 0 auto; box-sizing: border-box; }
        .kx-detail-back { margin-bottom: 16px; display: inline-flex; align-items: center; gap: 6px; }

        .kx-detail-layout { display: grid; grid-template-columns: 1fr; gap: 24px; width: 100%; align-items: start; }

        .kx-detail-cover {
          width: 100%; aspect-ratio: 16 / 9; max-height: 380px; object-fit: cover;
          border-radius: 18px; border: 1px solid var(--border); margin-bottom: 16px;
        }
        .kx-detail-cover-placeholder {
          background: var(--accentSoft); display: flex; align-items: center; justify-content: center;
        }

        .kx-detail-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .kx-detail-title { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-detail-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }

        .kx-detail-info { min-width: 0; }
        .kx-detail-action { min-width: 0; }

        @media (min-width: 900px) {
          .kx-detail-layout { grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); gap: 32px; }
          .kx-detail-action { position: sticky; top: 20px; }
          .kx-detail-cover { max-height: 420px; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 4 additions below: dormant
// banner (student-facing, informational-only per the plan), the
// student's own active-inquiry status view, and the multi-item
// InquiryForm itself.
// ---------------------------------------------------------------------

function DormantInfoBanner({ service }) {
  return (
    <div
      className="card"
      style={{
        padding: 12, borderRadius: 12, background: 'rgba(234,88,12,0.10)',
        border: '1px solid rgba(234,88,12,0.35)', marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>
        এই শপ আপাতত সক্রিয় না
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
        {service.dormantReason === 'auto' && 'দীর্ঘদিন কোনো আপডেট না হওয়ায় এটা স্বয়ংক্রিয়ভাবে নিষ্ক্রিয় হয়েছে।'}
        {service.dormantReason === 'manual_temporary' && 'দোকানের মালিক সাময়িকভাবে এটা বন্ধ রেখেছেন।'}
        {service.dormantReason === 'manual_permanent' && 'দোকানের মালিক এটা স্থায়ীভাবে বন্ধ করেছেন।'}
        {!service.dormantReason && 'এই মুহূর্তে এটা কম-সক্রিয় হিসেবে চিহ্নিত।'}
      </div>
    </div>
  );
}

function MyActiveInquiry({ serviceId, inquiry }) {
  const [closing, setClosing] = useState(false);

  const doClose = async () => {
    setClosing(true);
    try {
      await closeInquiry(serviceId, inquiry.id);
    } finally {
      setClosing(false);
    }
  };

  const total = (inquiry.items || []).reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = (inquiry.items || []).some((item) => typeof item.price === 'number');

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>আপনার প্রশ্ন/অনুরোধ</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 8 }}>
        Status: <strong style={{ color: 'var(--text)' }}>{INQUIRY_STATUS_LABEL[inquiry.status] || inquiry.status}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {(inquiry.items || []).map((item) => (
          <div key={item.offeringId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text)' }}>{item.label} × {item.quantity}</span>
            {typeof item.price === 'number' && (
              <span style={{ color: 'var(--muted)' }}>৳{item.price * item.quantity}</span>
            )}
          </div>
        ))}
      </div>

      {hasAnyPrice && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
          মোট (আনুমানিক): ৳{total}
        </div>
      )}

      {inquiry.question && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, fontStyle: 'italic' }}>
          &ldquo;{inquiry.question}&rdquo;
        </div>
      )}

      {inquiry.status === 'answered' && inquiry.replyText && (
        <div style={{
          fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
          padding: 10, marginBottom: 8, lineHeight: 1.6,
        }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>দোকানের উত্তর</div>
          {inquiry.replyText}
        </div>
      )}

      <button onClick={doClose} disabled={closing} className="btn btn-sm btn-secondary" style={{ marginTop: 4 }}>
        {closing ? 'বন্ধ হচ্ছে…' : 'এই অনুরোধ বন্ধ করুন'}
      </button>
    </div>
  );
}

function InquiryForm({ service }) {
  const profile = getProfile();
  const [studentPhone, setStudentPhone] = useState('');
  const [quantities, setQuantities] = useState({}); // offeringId -> quantity
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const availableOfferings = (service.offerings || []).filter((o) => o.isAvailable);

  const setQty = (offeringId, qty) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[offeringId];
      } else {
        next[offeringId] = qty;
      }
      return next;
    });
  };

  const selectedItems = availableOfferings
    .filter((o) => quantities[o.id] > 0)
    .map((o) => ({
      offeringId: o.id,
      label: o.label,
      price: typeof o.price === 'number' ? o.price : null,
      quantity: quantities[o.id],
    }));

  const total = selectedItems.reduce(
    (sum, item) => (typeof item.price === 'number' ? sum + item.price * item.quantity : sum),
    0,
  );
  const hasAnyPrice = selectedItems.some((item) => typeof item.price === 'number');

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('দোকান এখন বন্ধ — এখন অনুরোধ পাঠানো যাবে না।');
      return;
    }
    if (selectedItems.length === 0) {
      setError('অন্তত একটা আইটেম বেছে নিন।');
      return;
    }
    if (!studentPhone.trim()) {
      setError('ফোন নাম্বার দিন।');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(service.id, {
        studentUid: auth.currentUser.uid,
        studentName: profile?.name || '',
        studentPhone,
        items: selectedItems,
        question,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>প্রশ্ন/অনুরোধ পাঠানো হয়েছে ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          দোকান উত্তর দিলে এখানেই দেখতে পাবেন।
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        দোকান এখন বন্ধ — খোলা হলে এখান থেকেই প্রশ্ন/অনুরোধ পাঠাতে পারবেন।
      </div>
    );
  }

  if (availableOfferings.length === 0) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        এখন কোনো আইটেম available নেই।
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>আইটেম বেছে নিন</div>

      <div className="kx-offering-grid" style={{ marginBottom: 14 }}>
        {availableOfferings.map((o) => {
          const qty = quantities[o.id] || 0;
          const img = Array.isArray(o.images) && o.images[0];
          return (
            <div key={o.id} className={`kx-offering-card${qty > 0 ? ' is-selected' : ''}`}>
              <div className="kx-offering-media">
                {img ? <img src={img} alt={o.label} /> : <ImageOff size={22} color="var(--muted)" />}
              </div>
              <div className="kx-offering-body">
                <div className="kx-offering-name">{o.label}</div>
                {typeof o.price === 'number' && (
                  <div className="kx-offering-price">
                    ৳{o.price} <span>/ পিস</span>
                  </div>
                )}
                <div className="kx-offering-stepper">
                  <button
                    type="button"
                    onClick={() => setQty(o.id, qty - 1)}
                    disabled={qty === 0}
                    className="btn btn-sm btn-secondary"
                    style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 18, textAlign: 'center' }}>{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(o.id, qty + 1)}
                    className="btn btn-sm btn-secondary"
                    style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .kx-offering-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 150px));
          gap: 10px;
        }
        .kx-offering-card {
          border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
          background: var(--card); display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .kx-offering-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .kx-offering-media {
          width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-offering-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-offering-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .kx-offering-name { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-offering-price { font-size: 12px; font-weight: 700; color: var(--accent); }
        .kx-offering-price span { color: var(--muted); font-weight: 400; }
        .kx-offering-stepper { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
      `}</style>

      {hasAnyPrice && selectedItems.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
          মোট (আনুমানিক): ৳{total}
        </div>
      )}

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
      <input
        value={studentPhone}
        onChange={(e) => setStudentPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>প্রশ্ন/অনুরোধ (ঐচ্ছিক)</label>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="যেমন: কালার/সাইজ নিয়ে কোনো নির্দিষ্ট চাহিদা থাকলে লিখুন"
        rows={3}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'পাঠানো হচ্ছে…' : 'প্রশ্ন/অনুরোধ পাঠান'}
      </button>
    </div>
  );
}

function MyActiveBooking({ serviceId, booking }) {
  const [cancelling, setCancelling] = useState(false);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelBooking(serviceId, booking.id, 'student');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>আপনার বুকিং</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
        Status: <strong style={{ color: 'var(--text)' }}>{STATUS_LABEL[booking.status] || booking.status}</strong>
      </div>
      {booking.preferredTime && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          পছন্দের সময়: {booking.preferredTime.date} at {booking.preferredTime.time}
        </div>
      )}
      {booking.confirmedSlot && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          কনফার্ম করা সময়: {booking.confirmedSlot.date} at {booking.confirmedSlot.time}
        </div>
      )}
      <button onClick={doCancel} disabled={cancelling} className="btn btn-sm btn-secondary" style={{ marginTop: 12 }}>
        {cancelling ? 'বাতিল হচ্ছে…' : 'বুকিং বাতিল করুন'}
      </button>
    </div>
  );
}

function BookingForm({ service }) {
  const profile = getProfile();
  const [offeringId, setOfferingId] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [wantsPreferredTime, setWantsPreferredTime] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const availableOfferings = (service.offerings || []).filter((o) => o.isAvailable);
  // salon/hotel are the only two 'booking'-mode types (see
  // TYPE_TO_INTERACTION_MODE in serviceSync.js) — hotel here means food
  // vendors, so its per-unit price reads "/ পিস" (per piece/plate)
  // rather than salon's "/ জন" (per person).
  const priceUnitLabel = service.type === 'hotel' ? 'পিস' : 'জন';

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('দোকান এখন বন্ধ — এখন বুক করা যাবে না।');
      return;
    }
    if (!offeringId) {
      setError('একটা offering সিলেক্ট করুন।');
      return;
    }
    if (!studentPhone.trim()) {
      setError('ফোন নাম্বার দিন।');
      return;
    }
    if (wantsPreferredTime && (!date || !time)) {
      setError('তারিখ এবং সময় দুটোই দিতে হবে, অথবা preferred time অপশনটা বন্ধ রাখুন।');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(service.id, {
        studentUid: auth.currentUser.uid,
        studentName: profile?.name || '',
        studentPhone,
        offeringId,
        preferredTime: wantsPreferredTime ? { date, time } : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'বুক করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>বুকিং পাঠানো হয়েছে ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          Owner কনফার্ম করলে এখানেই দেখতে পাবেন।
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        দোকান এখন বন্ধ — খোলা হলে এখান থেকেই বুক করতে পারবেন।
      </div>
    );
  }

  if (availableOfferings.length === 0) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        এখন কোনো offering available নেই।
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>বুক করুন</div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>যা করাতে চান, বেছে নিন</label>
      <div className="kx-pick-grid" style={{ marginTop: 8, marginBottom: 12 }}>
        {availableOfferings.map((o) => {
          const isSelected = offeringId === o.id;
          const coverUrl = Array.isArray(o.images) ? o.images[0] : null;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOfferingId(o.id)}
              className={`kx-pick-card${isSelected ? ' is-selected' : ''}`}
            >
              <div className="kx-pick-media">
                {coverUrl
                  ? <img src={coverUrl} alt={o.label} />
                  : <ImageOff size={22} color="var(--muted)" />}
                {isSelected && (
                  <div className="kx-pick-check">
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="kx-pick-body">
                <div className="kx-pick-name">{o.label}</div>
                {typeof o.price === 'number' && (
                  <div className="kx-pick-price">
                    ৳{o.price} <span>/ {priceUnitLabel}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .kx-pick-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 140px));
          gap: 10px;
        }
        .kx-pick-card {
          text-align: left; cursor: pointer; border-radius: 14px; overflow: hidden;
          border: 1px solid var(--border); background: var(--card);
          display: flex; flex-direction: column;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .kx-pick-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
        .kx-pick-media {
          position: relative; width: 100%; aspect-ratio: 1 / 1; background: var(--accentSoft, #f3f4f6);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .kx-pick-media img { width: 100%; height: 100%; object-fit: cover; }
        .kx-pick-check {
          position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 50%;
          background: var(--accent); display: flex; align-items: center; justify-content: center;
        }
        .kx-pick-body { padding: 8px 9px 10px; display: flex; flex-direction: column; gap: 4px; }
        .kx-pick-name { font-size: 12.5px; font-weight: 700; color: var(--text); line-height: 1.3; }
        .kx-pick-price { font-size: 11.5px; font-weight: 700; color: var(--accent); }
        .kx-pick-price span { color: var(--muted); font-weight: 400; }
      `}</style>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
      <input
        value={studentPhone}
        onChange={(e) => setStudentPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
        <input type="checkbox" checked={wantsPreferredTime} onChange={(e) => setWantsPreferredTime(e.target.checked)} />
        পছন্দের সময় দিতে চান? (ঐচ্ছিক)
      </label>

      {wantsPreferredTime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'পাঠানো হচ্ছে…' : 'বুক করুন'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Phase 4 (Delivery/Errand Runner plan §4.2-§4.5): request form + status
// view for errand-mode services. Mirrors the Booking/Inquiry pair above —
// ErrandForm is the "not yet requested" state, MyActiveErrand covers all
// three active statuses (open / runner_accepted / confirmed) with the
// actions valid in each, per the plan's status-flow diagram.
// ---------------------------------------------------------------------

function MyActiveErrand({ serviceId, errand }) {
  const [editing, setEditing] = useState(false);
  const [newPrice, setNewPrice] = useState(String(errand.proposedPrice || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // plan §4.4: contact exchange — the errand doc itself never stores the
  // Runner's phone (only acceptedByRunnerUid); once 'confirmed',
  // firestore.rules' hasConfirmedBookingWithProvider gate lets this
  // requester read providers/{uid}/contact/phone via getProviderPhone.
  const [runnerPhone, setRunnerPhone] = useState('');

  useEffect(() => {
    if (errand.status !== 'confirmed' || !errand.acceptedByRunnerUid) return;
    getProviderPhone(errand.acceptedByRunnerUid).then(setRunnerPhone).catch(() => {});
  }, [errand.status, errand.acceptedByRunnerUid]);

  const doSaveEdit = async () => {
    setError('');
    const price = Number(newPrice);
    if (!(price > 0)) {
      setError('একটা বৈধ মূল্য দিন।');
      return;
    }
    setBusy(true);
    try {
      await editErrandProposedPrice(serviceId, errand.id, price);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  // plan §4.4: "✗ বাতিল করুন" on a runner_accepted request sends it back
  // to open (re-broadcast), NOT a full withdrawal — distinct from the
  // §4.2 "withdraw an open request" cancel below.
  const doRejectAccept = async () => {
    setBusy(true);
    try {
      await rejectErrandAccept(serviceId, errand.id);
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      await confirmErrandRequest(serviceId, errand.id);
    } catch (e) {
      setError(e.message || 'কনফার্ম করতে সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelErrandRequest(serviceId, errand.id);
    } finally {
      setBusy(false);
    }
  };

  const doFinish = async () => {
    setBusy(true);
    try {
      await finishErrandRequest(serviceId, errand.id);
    } catch (e) {
      setError(e.message || 'সম্পন্ন করতে সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>আপনার এরান্ড রিকোয়েস্ট</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 8 }}>
        Status: <strong style={{ color: 'var(--text)' }}>{ERRAND_STATUS_LABEL[errand.status] || errand.status}</strong>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{errand.itemDescription}</div>

      {!editing ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
          প্রস্তাবিত মূল্য: ৳{errand.proposedPrice}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
          <button onClick={doSaveEdit} disabled={busy} className="btn btn-sm btn-primary">সেভ</button>
          <button onClick={() => setEditing(false)} disabled={busy} className="btn btn-sm btn-secondary">বাতিল</button>
        </div>
      )}

      {/* plan §4.4: contact exchange — the errand doc has no phone
          field, so this comes from a separate getProviderPhone() read
          gated by firestore.rules' hasConfirmedBookingWithProvider once
          'confirmed' (see the useEffect above). */}
      {errand.status === 'confirmed' && runnerPhone && (
        <div style={{
          fontSize: 13, color: 'var(--text)', background: 'var(--accentSoft)', borderRadius: 10,
          padding: 10, marginBottom: 10,
        }}
        >
          Runner-এর ফোন নাম্বার: <strong>{runnerPhone}</strong>
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {errand.status === 'open' && !editing && (
          <>
            <button onClick={() => setEditing(true)} disabled={busy} className="btn btn-sm btn-secondary">মূল্য পরিবর্তন</button>
            <button onClick={doCancel} disabled={busy} className="btn btn-sm btn-secondary">রিকোয়েস্ট বাতিল করুন</button>
          </>
        )}
        {errand.status === 'runner_accepted' && (
          <>
            <button onClick={doConfirm} disabled={busy} className="btn btn-sm btn-primary">✓ হ্যাঁ, কনফার্ম করছি</button>
            <button onClick={doRejectAccept} disabled={busy} className="btn btn-sm btn-secondary">✗ বাতিল করুন</button>
          </>
        )}
        {errand.status === 'confirmed' && (
          <button onClick={doFinish} disabled={busy} className="btn btn-sm btn-primary">সম্পন্ন হয়েছে বলে মার্ক করুন</button>
        )}
      </div>
    </div>
  );
}

function ErrandForm({ service }) {
  const profile = getProfile();
  const isFaculty = getAccountRole() === 'teacher';
  const [requesterName, setRequesterName] = useState(isFaculty ? '' : (profile?.name || ''));
  const [requesterPhone, setRequesterPhone] = useState(isFaculty ? '' : '');
  const [itemDescription, setItemDescription] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // SHOP_LOCATION_AND_UPCOMING_FEATURES_PLAN.md Phase 4 targeted-picker:
  // broadcast (default) vs targeted-at-one-specific-Runner. The backend
  // (createErrandRequest) already accepted targetRunnerUid from day one —
  // only this dropdown UI was missing. Runner list is every OTHER
  // approved+open errand-type service (excluding the one whose page this
  // form lives on, since targeting the page's own Runner is redundant —
  // broadcast/plain-submit already reaches them, and a same-Runner
  // "target" would be a confusing no-op).
  const [visibility, setVisibility] = useState('broadcast');
  const [targetRunnerUid, setTargetRunnerUid] = useState('');
  const [runners, setRunners] = useState(null);

  useEffect(() => {
    const unsub = subscribeAllServices((all) => {
      const list = all.filter((s) => (
        s.type === 'errand' && s.isOpen && s.providerUid !== service.providerUid
      ));
      setRunners(list);
    });
    return unsub;
  }, [service.providerUid]);

  // Faculty name/phone live in a separate doc fetched async, unlike the
  // synchronous getProfile() student store — prefill once on mount.
  useEffect(() => {
    if (!isFaculty) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyProfile(uid).then((fdoc) => {
      if (fdoc) {
        setRequesterName((prev) => prev || fdoc.name || '');
        setRequesterPhone((prev) => prev || fdoc.phone || '');
      }
    }).catch(() => {});
  }, [isFaculty]);

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('এই Runner এখন সক্রিয় নেই — এখন রিকোয়েস্ট পাঠানো যাবে না।');
      return;
    }
    if (!itemDescription.trim()) {
      setError('কী লাগবে সেটা লিখুন।');
      return;
    }
    if (!(Number(proposedPrice) > 0)) {
      setError('একটা বৈধ প্রস্তাবিত মূল্য দিন।');
      return;
    }
    if (!requesterPhone.trim()) {
      setError('ফোন নাম্বার দিন।');
      return;
    }
    if (visibility === 'targeted' && !targetRunnerUid) {
      setError('Targeted request-এর জন্য একজন Runner বেছে নিন।');
      return;
    }

    setSubmitting(true);
    try {
      await createErrandRequest(service.id, {
        requesterUid: auth.currentUser.uid,
        requesterName,
        requesterPhone,
        requesterRole: isFaculty ? 'faculty' : 'student',
        itemDescription,
        proposedPrice: Number(proposedPrice),
        visibility,
        targetRunnerUid: visibility === 'targeted' ? targetRunnerUid : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'পাঠাতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>এরান্ড রিকোয়েস্ট পাঠানো হয়েছে ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          কোনো Runner গ্রহণ করলে এখানেই দেখতে পাবেন।
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        এই Runner এখন সক্রিয় নেই — সক্রিয় হলে এখান থেকেই রিকোয়েস্ট পাঠাতে পারবেন।
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>এরান্ড রিকোয়েস্ট পাঠান</div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>কী লাগবে</label>
      <textarea
        value={itemDescription}
        onChange={(e) => setItemDescription(e.target.value)}
        placeholder="যেমন: ফার্মেসি থেকে Napa Extra ১ পাতা, ক্যাম্পাসের সামনের দোকান থেকে"
        rows={3}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>প্রস্তাবিত মূল্য (জিনিসের দাম + ডেলিভারি ফি)</label>
      <input
        type="number"
        value={proposedPrice}
        onChange={(e) => setProposedPrice(e.target.value)}
        placeholder="৳"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      {isFaculty && (
        <>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>নাম</label>
          <input
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            style={{
              width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
            }}
          />
        </>
      )}

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
      <input
        value={requesterPhone}
        onChange={(e) => setRequesterPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      {/* Phase 4 targeted-picker: broadcast (default, everyone sees it)
          vs targeted (only one chosen Runner sees it). Hidden entirely if
          there are no other Runners to target — falling back silently to
          plain broadcast, same "no dead-end UI" pattern used elsewhere. */}
      {runners && runners.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>কাকে পাঠাবেন</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => { setVisibility('broadcast'); setTargetRunnerUid(''); }}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: visibility === 'broadcast' ? 'var(--accentSoft)' : 'var(--card)',
                color: visibility === 'broadcast' ? 'var(--accent)' : 'var(--text)',
              }}
            >
              সব Runner (Broadcast)
            </button>
            <button
              type="button"
              onClick={() => setVisibility('targeted')}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: visibility === 'targeted' ? 'var(--accentSoft)' : 'var(--card)',
                color: visibility === 'targeted' ? 'var(--accent)' : 'var(--text)',
              }}
            >
              নির্দিষ্ট Runner
            </button>
          </div>

          {visibility === 'targeted' && (
            <select
              value={targetRunnerUid}
              onChange={(e) => setTargetRunnerUid(e.target.value)}
              style={{
                width: '100%', marginTop: 8, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
                fontSize: 14, fontFamily: 'inherit',
              }}
            >
              <option value="">Runner বেছে নিন…</option>
              {runners.map((r) => (
                <option key={r.providerUid} value={r.providerUid}>
                  {r.name}{r.locationText ? ` — ${r.locationText}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'পাঠানো হচ্ছে…' : 'রিকোয়েস্ট পাঠান'}
      </button>
    </div>
  );
}
