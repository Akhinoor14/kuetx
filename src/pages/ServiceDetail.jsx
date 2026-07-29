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
  Store, Circle, ArrowLeft, MapPin, Truck, Minus, Plus,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import {
  subscribeService, createBooking, subscribeMyBookingsForService, cancelBooking,
  closeInquiry, withServiceDefaults,
} from '../lib/serviceSync';
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

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(undefined); // undefined = loading, null = not found
  const [myBookings, setMyBookings] = useState(null);

  useEffect(() => subscribeService(serviceId, (s) => setService(s ? withServiceDefaults(s) : s)), [serviceId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    return subscribeMyBookingsForService(serviceId, uid, setMyBookings);
  }, [serviceId]);

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
  const isDormant = service.status === 'dormant';

  const activeBooking = !isInquiryMode
    ? (myBookings || []).find((b) => b.status === 'pending' || b.status === 'confirmed')
    : null;
  const activeInquiry = isInquiryMode
    ? (myBookings || []).find((b) => b.status === 'open' || b.status === 'answered')
    : null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <button onClick={() => navigate('/services')} className="btn btn-sm" style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={14} /> Services
      </button>

      {/* Phase 4: cover image, if the provider has uploaded one */}
      {service.coverImageUrl && (
        <img
          src={service.coverImageUrl}
          alt={service.name}
          style={{
            width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14, marginBottom: 14,
            border: '1px solid var(--border)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        {!service.coverImageUrl && (
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Store size={22} color="var(--accent)" />
          </div>
        )}
        {/* title (§6 order: title -> price -> description) */}
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{service.name}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <Circle size={9} fill={service.isOpen ? '#16a34a' : '#9ca3af'} color={service.isOpen ? '#16a34a' : '#9ca3af'} />
        <span style={{ fontSize: 13, fontWeight: 700, color: service.isOpen ? '#16a34a' : 'var(--muted)' }}>
          {service.isOpen ? 'এখন খোলা' : 'এখন বন্ধ'}
        </span>
      </div>

      {/* Phase 4: locationText / hasDelivery badges */}
      {(service.locationText || service.hasDelivery) && (
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
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
          {renderFormattedNoticeBody(service.description)}
        </div>
      )}

      {myBookings === null ? null : isInquiryMode ? (
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {availableOfferings.map((o) => {
          const qty = quantities[o.id] || 0;
          return (
            <div
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}
            >
              {Array.isArray(o.images) && o.images[0] && (
                <img
                  src={o.images[0]}
                  alt={o.label}
                  style={{
                    width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{o.label}</div>
                {typeof o.price === 'number' && (
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>৳{o.price}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
          );
        })}
      </div>

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

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Offering</label>
      <select
        value={offeringId}
        onChange={(e) => setOfferingId(e.target.value)}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      >
        <option value="">সিলেক্ট করুন</option>
        {availableOfferings.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

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
